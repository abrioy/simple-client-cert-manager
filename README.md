# simple-client-cert-manager

Minimal React front-end that guides a user through generating a key pair in the browser, completing an OIDC Authorization Code + PKCE flow, and asking a private [step-ca](https://smallstep.com/docs/step-ca/) instance to sign the resulting CSR. The application is delivered as static assets behind an nginx proxy that forwards signing requests to step-ca. No keys or certificates are ever persisted on the server.

## Features

- Single-page React experience that keeps all private key material in the browser.
- Browser-only CSR generation using [jsrsasign](https://github.com/kjur/jsrsasign).
- OIDC Authorization Code + PKCE flow that resumes the certificate request after redirect.
- nginx runtime that serves the static bundle and proxies `/api/sign` to step-ca.

## Configuration

The container is configured entirely through environment variables at runtime:

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Port exposed by nginx. | `8080` |
| `STEP_CA_URL` | Base URL for the private step-ca instance. | `http://step-ca:9000` |
| `STEP_CA_SIGN_PATH` | Path to the signing endpoint relative to `STEP_CA_URL`. | `/1.0/sign` |
| `STEP_CA_PROFILE` | Optional profile query parameter appended to signing requests. | _unset_ |
| `ENROLLMENT_API_PATH` | Front-end endpoint proxied by nginx to the step-ca signing API. | `/api/sign` |
| `OIDC_AUTHORIZATION_ENDPOINT` | OIDC authorization endpoint used for the Authorization Code + PKCE flow. | _(required)_ |
| `OIDC_TOKEN_ENDPOINT` | OIDC token endpoint used to exchange the authorization code for tokens. | _(required)_ |
| `OIDC_CLIENT_ID` | Registered OIDC client identifier for this application. | _(required)_ |
| `OIDC_SCOPE` | Space-separated scopes requested during authorization. | `openid email profile` |
| `CERTIFICATE_SUBJECT` | Subject string embedded in generated CSRs (e.g. `CN=my-user,O=Example`). | `CN=client` |
| `CERTIFICATE_FILENAME` | Suggested filename for the downloaded certificate. | `client.crt` |
| `PRIVATE_KEY_FILENAME` | Suggested filename for the downloaded private key. | `client.key` |

## Local development

Install dependencies and run the Vite development server:

```bash
npm install
npm run dev
```

The app loads runtime configuration from `/config.js`. When developing locally, you can create a `.env.local` file and rely on Vite's [environment variable support](https://vitejs.dev/guide/env-and-mode.html), or manually author a `public/config.js` file with the desired values.

Build the production bundle:

```bash
npm run build
```

## Docker image

The provided multi-stage `Dockerfile` builds the React bundle and packages it with nginx. Example invocation:

```bash
docker build -t simple-client-cert-manager .
docker run --rm -p 8080:8080 \ \
  -e STEP_CA_URL="https://step-ca.internal" \ \
  -e STEP_CA_SIGN_PATH="/1.0/sign" \ \
  -e OIDC_AUTHORIZATION_ENDPOINT="https://auth.example.com/oauth2/authorize" \ \
  -e OIDC_TOKEN_ENDPOINT="https://auth.example.com/oauth2/token" \ \
  -e OIDC_CLIENT_ID="spa-client" \ \
  simple-client-cert-manager
```

At runtime the entrypoint renders `/config.js` with the supplied environment variables and templates the nginx configuration so that `/api/sign` (or the path defined by `ENROLLMENT_API_PATH`) is proxied directly to the configured step-ca instance.

Navigate to `http://localhost:8080` to request a client certificate.
