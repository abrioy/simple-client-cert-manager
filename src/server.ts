// @ts-nocheck
import http from "node:http";

type EnrollmentRequest = {
  csr?: string;
  token?: string;
};

type EnvConfig = {
  port: number;
  stepCaUrl: string;
  stepCaSignPath: string;
  stepCaProfile?: string;
  oidcTokenEndpoint: string;
  certificateSubject: string;
  certificateFilename: string;
  privateKeyFilename: string;
};

const env: EnvConfig = {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  stepCaUrl: process.env.STEP_CA_URL ?? "http://step-ca:9000",
  stepCaSignPath: process.env.STEP_CA_SIGN_PATH ?? "/1.0/sign",
  stepCaProfile: process.env.STEP_CA_PROFILE,
  oidcTokenEndpoint: process.env.OIDC_TOKEN_ENDPOINT ?? "",
  certificateSubject: process.env.CERTIFICATE_SUBJECT ?? "CN=client",
  certificateFilename: process.env.CERTIFICATE_FILENAME ?? "client.crt",
  privateKeyFilename: process.env.PRIVATE_KEY_FILENAME ?? "client.key"
};

const htmlPage = buildPage(env);

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.statusCode = 400;
      res.end("Bad Request");
      return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    if (req.method === "GET" && requestUrl.pathname === "/") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(htmlPage);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/healthz") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/enroll") {
      const payload = await readJsonBody(req);
      const { csr, token } = payload;

      if (!csr || typeof csr !== "string" || !csr.includes("BEGIN CERTIFICATE REQUEST")) {
        sendJson(res, 400, { error: "Invalid CSR" });
        return;
      }

      if (!token || typeof token !== "string") {
        sendJson(res, 400, { error: "Missing token" });
        return;
      }

      const signUrl = new URL(env.stepCaSignPath, env.stepCaUrl);
      if (env.stepCaProfile) {
        signUrl.searchParams.set("profile", env.stepCaProfile);
      }

      const upstreamResponse = await fetch(signUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ csr })
      });

      const upstreamText = await upstreamResponse.text();
      res.statusCode = upstreamResponse.status;
      res.setHeader(
        "Content-Type",
        upstreamResponse.headers.get("content-type") ?? "application/json; charset=utf-8"
      );
      res.setHeader("Cache-Control", "no-store");
      res.end(upstreamText);
      return;
    }

    res.statusCode = 404;
    res.end("Not Found");
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Internal Server Error" }));
  }
});

server.listen(env.port, () => {
  console.log(`listening on port ${env.port}`);
});

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

async function readJsonBody(req: http.IncomingMessage): Promise<EnrollmentRequest> {
  const chunks: Buffer[] = [];
  const limit = 512 * 1024;
  let total = 0;

  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buffer.length;
    if (total > limit) {
      throw new Error("Payload too large");
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw) as EnrollmentRequest;
  } catch (error) {
    console.error("Failed to parse JSON", error);
    return {};
  }
}

function buildPage(config: EnvConfig): string {
  const allowedConnect = new Set<string>(["'self'"]);
  if (config.oidcTokenEndpoint) {
    try {
      const endpointUrl = new URL(config.oidcTokenEndpoint);
      allowedConnect.add(endpointUrl.origin);
    } catch (error) {
      console.warn("Invalid OIDC token endpoint", error);
    }
  }

  const csp = `default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' https://cdn.jsdelivr.net; connect-src ${Array.from(allowedConnect).join(" ")};`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Client Certificate Enrollment</title>
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 40rem; }
      button { padding: 0.75rem 1.5rem; font-size: 1rem; }
      pre { background: #f4f4f4; padding: 1rem; overflow-x: auto; }
      .hidden { display: none; }
      .actions { margin-top: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/jsrsasign@10.9.0/lib/jsrsasign.min.js" integrity="sha384-dXu0N4Wf0MR1MLk6MGZ9d3AN1L4XZsUu57cd8tgcQbLhay0kKZC0cn8KnRFN1yGc" crossorigin="anonymous"></script>
  </head>
  <body>
    <h1>Download a Client Certificate</h1>
    <p>Generate a fresh key pair in your browser, request a certificate from step-ca, and download the result. Private keys never leave this page.</p>
    <button id="enroll">Get certificate</button>
    <p id="status" role="status"></p>
    <div class="actions">
      <a id="cert-link" class="hidden" download="${config.certificateFilename}">Download certificate</a>
      <a id="key-link" class="hidden" download="${config.privateKeyFilename}">Download private key</a>
    </div>
    <section id="ca-section" class="hidden">
      <h2>CA certificate</h2>
      <pre id="ca-text"></pre>
    </section>
    <script>
      (function () {
        const config = ${JSON.stringify({
          oidcTokenEndpoint: config.oidcTokenEndpoint,
          subject: config.certificateSubject,
          certificateFilename: config.certificateFilename,
          privateKeyFilename: config.privateKeyFilename
        })};
        const button = document.getElementById("enroll");
        const status = document.getElementById("status");
        const certLink = document.getElementById("cert-link");
        const keyLink = document.getElementById("key-link");
        const caSection = document.getElementById("ca-section");
        const caText = document.getElementById("ca-text");

        if (!button || !status || !certLink || !keyLink || !caSection || !caText) {
          console.error("Page not initialised correctly");
          return;
        }

        if (!config.oidcTokenEndpoint) {
          status.textContent = "OIDC token endpoint is not configured.";
          button.setAttribute("disabled", "true");
          return;
        }

        button.addEventListener("click", async () => {
          button.setAttribute("disabled", "true");
          certLink.classList.add("hidden");
          keyLink.classList.add("hidden");
          caSection.classList.add("hidden");
          caText.textContent = "";

          try {
            status.textContent = "Generating a new private key...";
            const keypair = window.KEYUTIL.generateKeypair("RSA", 2048);
            const privateKeyPem = window.KEYUTIL.getPEM(keypair.prvKeyObj, "PKCS1PRV");
            const csrPem = window.KJUR.asn1.csr.CSRUtil.newCSRPEM({
              subject: { str: config.subject },
              sbjpubkey: keypair.pubKeyObj,
              sigalg: "SHA256withRSA",
              sbjprvkey: keypair.prvKeyObj
            });

            status.textContent = "Requesting ID token...";
            const tokenResponse = await fetch(config.oidcTokenEndpoint, { credentials: "include" });
            if (!tokenResponse.ok) {
              throw new Error("Token request failed (" + tokenResponse.status + ")");
            }
            const tokenJson = await tokenResponse.json();
            const token = tokenJson.id_token || tokenJson.token || tokenJson.access_token;
            if (!token) {
              throw new Error("No token found in response");
            }

            status.textContent = "Requesting certificate from step-ca...";
            const enrollResponse = await fetch("/api/enroll", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ csr: csrPem, token })
            });

            const rawBody = await enrollResponse.text();
            if (!enrollResponse.ok) {
              throw new Error(rawBody || "Enrollment failed (" + enrollResponse.status + ")");
            }

            let payload;
            try {
              payload = JSON.parse(rawBody);
            } catch (jsonError) {
              throw new Error("Invalid JSON returned from enrollment endpoint");
            }

            const certificatePem = payload.certificate || payload.crt || payload.cert;
            if (!certificatePem) {
              throw new Error("No certificate present in response");
            }

            const caPem = payload.ca || payload.ca_certificate || (Array.isArray(payload.ca_chain) ? payload.ca_chain.join('\n') : undefined);

            const certificateBlob = new Blob([certificatePem], { type: "application/x-pem-file" });
            certLink.href = URL.createObjectURL(certificateBlob);
            certLink.download = config.certificateFilename;
            certLink.classList.remove("hidden");

            const keyBlob = new Blob([privateKeyPem], { type: "application/x-pem-file" });
            keyLink.href = URL.createObjectURL(keyBlob);
            keyLink.download = config.privateKeyFilename;
            keyLink.classList.remove("hidden");

            if (caPem) {
              caText.textContent = caPem;
              caSection.classList.remove("hidden");
            }

            status.textContent = "Certificate ready.";
          } catch (error) {
            console.error(error);
            status.textContent = error instanceof Error ? error.message : "Unexpected error";
          } finally {
            button.removeAttribute("disabled");
          }
        });
      })();
    </script>
  </body>
</html>`;
}

export {};
