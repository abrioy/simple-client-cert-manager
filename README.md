# simple-client-cert-manager

Minimal Node.js service that proxies browser-based certificate enrollment requests to a private [step-ca](https://smallstep.com/docs/step-ca/) instance. The service never stores keys or certificates; private keys are generated in the browser and remain client-side.

## Features

- Lightweight HTTP server written in TypeScript with no runtime dependencies.
- Single-page interface that generates RSA keys in the browser using [jsrsasign](https://github.com/kjur/jsrsasign).
- Proxies certificate signing requests (CSRs) to step-ca using an OpenID Connect ID token supplied by the browser.
- Download links for the issued certificate, private key, and optional CA chain without persisting any material on the server.

## Configuration

Environment variables control the runtime behaviour:

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Port for the HTTP server. | `3000` |
| `STEP_CA_URL` | Base URL for the private step-ca instance. | `http://step-ca:9000` |
| `STEP_CA_SIGN_PATH` | Path to the signing endpoint relative to `STEP_CA_URL`. | `/1.0/sign` |
| `STEP_CA_PROFILE` | Optional profile query parameter appended to the signing request. | _unset_ |
| `OIDC_TOKEN_ENDPOINT` | Browser-accessible endpoint that returns an ID token JSON payload. | _(required)_ |
| `CERTIFICATE_SUBJECT` | Subject string embedded in generated CSRs (e.g. `CN=my-user,O=Example`). | `CN=client` |
| `CERTIFICATE_FILENAME` | Suggested filename for the downloaded certificate. | `client.crt` |
| `PRIVATE_KEY_FILENAME` | Suggested filename for the downloaded private key. | `client.key` |

The `/api/enroll` endpoint expects the OIDC token endpoint to reply with JSON containing an `id_token`, `token`, or `access_token` property.

## Development

Install dependencies and build the project:

```bash
npm install
npm run build
```

Start the service:

```bash
npm start
```

## Docker

A multi-stage `Dockerfile` is included. Build and run the container with the required environment variables:

```bash
docker build -t simple-client-cert-manager .
docker run --rm -p 3000:3000 \
  -e STEP_CA_URL="https://step-ca.internal" \
  -e OIDC_TOKEN_ENDPOINT="https://auth.example.com/token" \
  simple-client-cert-manager
```

Navigate to `http://localhost:3000` to request a certificate.
