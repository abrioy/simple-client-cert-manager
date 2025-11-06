"use client";

import { useState } from "react";
import forge from "node-forge";

type DownloadLinks = {
  certificateUrl: string;
  privateKeyUrl: string;
  certificateName: string;
  privateKeyName: string;
};

function generateRsaKeyPair(): Promise<forge.pki.rsa.KeyPair> {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err, keypair) => {
      if (err || !keypair) {
        reject(err ?? new Error("Failed to generate key pair"));
      } else {
        resolve(keypair);
      }
    });
  });
}

async function createCertificateSigningRequest(commonName: string) {
  const keyPair = await generateRsaKeyPair();
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keyPair.publicKey;
  csr.setSubject([{ name: "commonName", value: commonName }]);
  csr.sign(keyPair.privateKey, forge.md.sha256.create());

  if (!csr.verify()) {
    throw new Error("Generated CSR failed verification");
  }

  const csrPem = forge.pki.certificationRequestToPem(csr);
  const privateKeyPem = forge.pki.privateKeyToPem(keyPair.privateKey);

  return { csrPem, privateKeyPem };
}

async function requestIdToken() {
  if (process.env.NEXT_PUBLIC_STATIC_ID_TOKEN) {
    return process.env.NEXT_PUBLIC_STATIC_ID_TOKEN;
  }

  const endpoint = process.env.NEXT_PUBLIC_OIDC_TOKEN_ENDPOINT;
  if (!endpoint) {
    throw new Error("OIDC token endpoint is not configured");
  }

  const response = await fetch(endpoint, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain ID token (${response.status})`);
  }

  const data = await response.json();
  if (typeof data?.id_token !== "string") {
    throw new Error("Token response did not include an id_token");
  }

  return data.id_token as string;
}

function createDownloadUrl(content: string) {
  const blob = new Blob([content], { type: "application/x-pem-file" });
  return URL.createObjectURL(blob);
}

export default function HomePage() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<DownloadLinks | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleGenerate() {
    setIsBusy(true);
    setStatus("Generating key pair and CSR in your browser...");
    setError(null);

    const subject = `mtls-${crypto.randomUUID()}`;

    try {
      const { csrPem, privateKeyPem } = await createCertificateSigningRequest(
        subject,
      );

      setStatus("Requesting ID token...");
      const token = await requestIdToken();

      setStatus("Requesting signed certificate from step-ca...");
      const response = await fetch("/api/certificates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ csr: csrPem }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to issue certificate");
      }

      const payload = (await response.json()) as {
        certificate?: string;
      };

      if (typeof payload.certificate !== "string") {
        throw new Error("Certificate response was malformed");
      }

      if (downloads) {
        URL.revokeObjectURL(downloads.certificateUrl);
        URL.revokeObjectURL(downloads.privateKeyUrl);
      }

      const certificateUrl = createDownloadUrl(payload.certificate);
      const privateKeyUrl = createDownloadUrl(privateKeyPem);

      setDownloads({
        certificateUrl,
        privateKeyUrl,
        certificateName: `${subject}.pem`,
        privateKeyName: `${subject}-key.pem`,
      });

      setStatus("Certificate generated. Download your files below.");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus(null);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main>
      <h1>Simple Client Certificate Manager</h1>
      <p>
        Generate mutual TLS client certificates using <code>step-ca</code>
        without your private key ever leaving the browser.
      </p>
      <button onClick={handleGenerate} disabled={isBusy}>
        {isBusy ? "Working..." : "Download a new client certificate"}
      </button>
      {status && <p>{status}</p>}
      {error && (
        <p role="alert" style={{ color: "#fca5a5" }}>
          {error}
        </p>
      )}
      {downloads && (
        <div style={{ marginTop: "1.5rem" }}>
          <h2>Downloads</h2>
          <p>Store these files securely; they will not be shown again.</p>
          <ul style={{ listStyle: "none", paddingLeft: 0 }}>
            <li>
              <a
                href={downloads.certificateUrl}
                download={downloads.certificateName}
              >
                Download certificate ({downloads.certificateName})
              </a>
            </li>
            <li>
              <a href={downloads.privateKeyUrl} download={downloads.privateKeyName}>
                Download private key ({downloads.privateKeyName})
              </a>
            </li>
          </ul>
        </div>
      )}
      <section style={{ marginTop: "2rem", fontSize: "0.9rem" }}>
        <h2>Configuration</h2>
        <p>
          This page expects an authenticated session with your OIDC provider.
          It fetches an ID token from
          {" "}
          <code>NEXT_PUBLIC_OIDC_TOKEN_ENDPOINT</code> (or uses the
          provided static token) and sends it to the API route that shells out
          to the <code>step</code> CLI.
        </p>
      </section>
    </main>
  );
}
