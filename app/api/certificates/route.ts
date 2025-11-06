import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing authorization token" },
      { status: 401 },
    );
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    return NextResponse.json({ error: "Invalid authorization token" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const csr = (body as { csr?: unknown })?.csr;
  if (typeof csr !== "string" || !csr.includes("BEGIN CERTIFICATE REQUEST")) {
    return NextResponse.json({ error: "CSR is required" }, { status: 400 });
  }

  const tmpDir = await mkdtemp(path.join(tmpdir(), "step-ca-"));
  const csrPath = path.join(tmpDir, "request.csr");
  const certPath = path.join(tmpDir, "certificate.pem");

  try {
    await fs.writeFile(csrPath, csr, "utf8");

    const stepBinary = process.env.STEP_CLI_BIN ?? "step";
    const args = ["ca", "sign", csrPath, certPath];
    const optionEnvMap: Array<[string, string | undefined]> = [
      ["--ca-url", process.env.STEP_CA_URL],
      ["--root", process.env.STEP_CA_ROOT_CERT],
      ["--fingerprint", process.env.STEP_CA_FINGERPRINT],
      ["--provisioner", process.env.STEP_CA_PROVISIONER],
      ["--password-file", process.env.STEP_CA_PROVISIONER_PASSWORD_FILE],
      ["--not-before", process.env.STEP_CA_NOT_BEFORE],
      ["--not-after", process.env.STEP_CA_NOT_AFTER],
    ];
    for (const [flag, value] of optionEnvMap) {
      if (value) {
        args.push(flag, value);
      }
    }
    args.push("--token", token);

    await execFileAsync(stepBinary, args, {
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });

    const certificate = await fs.readFile(certPath, "utf8");
    return NextResponse.json({ certificate });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate certificate";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
