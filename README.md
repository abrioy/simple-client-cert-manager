# Simple Client Certificate Manager

A minimal Next.js application that issues mutual TLS client certificates via
[`step-ca`](https://smallstep.com/docs/step-ca/). Private keys are generated in the
browser and never leave the user's device. The server simply receives a CSR and
shells out to the `step` CLI to sign it.

## Features

- Next.js (App Router) with a single page that generates RSA key pairs in the
  browser and downloads the resulting certificate + key pair.
- API route that invokes the `step` CLI with an OIDC ID token supplied by the
  browser. No keys or certificates are persisted on disk beyond the lifetime of
  the request.
- Ready-to-run Docker image with the `step` binary baked in.

## Prerequisites

- Node.js 20+
- A reachable `step-ca` instance and the `step` CLI configuration required to
  sign CSRs with OIDC tokens.
- An OIDC provider capable of returning an ID token to the browser (for testing
  you can supply a static token via environment variable).

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

The page is available at `http://localhost:3000`. Click the button to generate
an RSA key pair and CSR inside the browser, fetch an ID token, and request a
signed certificate from `step-ca`.

### Required environment variables

| Variable | Scope | Description |
| --- | --- | --- |
| `STEP_CA_URL` | Server | CA URL passed to `step ca sign --ca-url`. Optional if `step` is already configured. |
| `STEP_CA_ROOT_CERT` | Server | Path to the root certificate used by `step` (`--root`). |
| `STEP_CA_FINGERPRINT` | Server | Root certificate fingerprint (`--fingerprint`). |
| `STEP_CA_PROVISIONER` | Server | Provisioner to use (`--provisioner`). |
| `STEP_CA_PROVISIONER_PASSWORD_FILE` | Server | Path to provisioner password file (`--password-file`). |
| `STEP_CA_NOT_BEFORE` | Server | Optional override for `--not-before`. |
| `STEP_CA_NOT_AFTER` | Server | Optional override for `--not-after`. |
| `STEP_CLI_BIN` | Server | Path to the `step` binary (defaults to `step`). |
| `NEXT_PUBLIC_OIDC_TOKEN_ENDPOINT` | Client | URL the browser will call to obtain an ID token. Must respond with JSON `{ "id_token": "..." }`. |
| `NEXT_PUBLIC_STATIC_ID_TOKEN` | Client | Optional static token for testing (skips the token fetch step). |

## Docker

Build the production image:

```bash
docker build -t simple-client-cert-manager .
```

Run the container, forwarding configuration to the API route:

```bash
docker run --rm -p 3000:3000 \
  -e STEP_CA_URL="https://step-ca:9000" \
  -e STEP_CA_ROOT_CERT="/home/step/root_ca.crt" \
  -e STEP_CA_FINGERPRINT="<fingerprint>" \
  -e STEP_CA_PROVISIONER="oidc-provisioner" \
  -e STEP_CA_PROVISIONER_PASSWORD_FILE="/run/secrets/provisioner-pass" \
  -e NEXT_PUBLIC_OIDC_TOKEN_ENDPOINT="https://issuer.example.com/token" \
  simple-client-cert-manager
```

## Security considerations

- The browser generates the key pair using `node-forge` and only sends the CSR
  (public information) to the server.
- The API route writes CSR and certificate data to a temporary directory that is
  deleted after signing, ensuring no long-term persistence on disk.
- Always secure the deployment with HTTPS and restrict access to the API route
  as appropriate for your environment.
