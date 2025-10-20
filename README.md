# simple-client-cert-manager

Minimal Node.js service that proxies browser-based certificate enrollment requests to a private [step-ca](https://smallstep.com/docs/step-ca/) instance. The service never stores keys or certificates; private keys are generated in the browser and remain client-side.

## Features

- Lightweight HTTP server written in TypeScript with no runtime dependencies.
- Single-page interface that generates RSA keys in the browser using [jsrsasign](https://github.com/kjur/jsrsasign).
- Proxies certificate signing requests (CSRs) to step-ca using an OpenID Connect Authorization Code + PKCE flow initiated from the browser.
- Download links for the issued certificate, private key, and optional CA chain without persisting any material on the server.

## Configuration

Environment variables control the runtime behaviour:

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Port for the HTTP server. | `3000` |
| `STEP_CA_URL` | Base URL for the private step-ca instance. | `http://step-ca:9000` |
| `STEP_CA_SIGN_PATH` | Path to the signing endpoint relative to `STEP_CA_URL`. | `/1.0/sign` |
| `STEP_CA_PROFILE` | Optional profile query parameter appended to the signing request. | _unset_ |
| `OIDC_AUTHORIZATION_ENDPOINT` | OIDC authorization endpoint used for the Authorization Code + PKCE flow. | _(required)_ |
| `OIDC_TOKEN_ENDPOINT` | OIDC token endpoint used to exchange the authorization code for an ID token. | _(required)_ |
| `OIDC_CLIENT_ID` | Registered OIDC client identifier for this application. | _(required)_ |
| `OIDC_SCOPE` | Space-separated list of scopes requested during authorization. | `openid email profile` |
| `CERTIFICATE_SUBJECT` | Subject string embedded in generated CSRs (e.g. `CN=my-user,O=Example`). | `CN=client` |
| `CERTIFICATE_FILENAME` | Suggested filename for the downloaded certificate. | `client.crt` |
| `PRIVATE_KEY_FILENAME` | Suggested filename for the downloaded private key. | `client.key` |

The browser performs a full Authorization Code flow with PKCE. The service redirects the user to the configured authorization endpoint, exchanges the returned `code` for tokens via the configured token endpoint, and then submits the CSR to `/api/enroll` with the resulting `id_token` (falling back to `access_token` or `token` fields if necessary).

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
  -e OIDC_AUTHORIZATION_ENDPOINT="https://auth.example.com/oauth2/v1/authorize" \
  -e OIDC_TOKEN_ENDPOINT="https://auth.example.com/oauth2/v1/token" \
  -e OIDC_CLIENT_ID="my-client-id" \
  simple-client-cert-manager
```

Navigate to `http://localhost:3000` to request a certificate.
