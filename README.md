# Simple Client Certificate Manager

A full-stack reference implementation for managing client certificates with [step-ca](https://smallstep.com/docs/step-ca/).
The backend is an Express + TypeScript service that shells out to the `step` CLI packaged inside the official Docker image,
while the frontend is a modern React single page application built with Vite.

## Architecture

- **Backend** (`backend/`): Express server written in TypeScript. All interactions with step-ca are funneled through a dedicated
  `stepCaCli` service that invokes the `smallstep/step-cli` Docker image. The service exposes REST endpoints for issuing and
  revoking certificates and for checking CA health.
- **Frontend** (`frontend/`): React SPA that follows contemporary best practices (React Query for data fetching, React Hook Form
  and Zod for type-safe forms, component-driven UI). Users can issue and revoke certificates and inspect the resulting PEM data.
- **Docker**: The backend expects Docker to be available. When an API call requires step-ca, the backend launches `docker run`
  with the configured image, volumes, environment variables, and network options.

## Getting started

### Prerequisites

- Node.js 20+
- Docker Engine available to the backend process

### Install dependencies

```bash
npm install
```

This installs dependencies for both the backend and frontend workspaces.

### Running the backend

```bash
npm run dev:backend
```

The backend loads configuration from environment variables (see [Configuration](#configuration)).

### Running the frontend

```bash
npm run dev:frontend
```

By default the Vite dev server proxies `/api` calls to `http://localhost:4000`.

### Building for production

```bash
npm run build
```

The backend TypeScript sources are compiled to `backend/dist` and the frontend bundle is written to `frontend/dist`.
The backend can serve the static bundle when the `STATIC_FILES_DIR` environment variable is set to `frontend/dist` (or another
path containing the built assets).

## Configuration

The backend is configured through environment variables. Most settings are optional but you must supply the information required
for your step-ca instance.

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Port the Express server listens on. | `4000` |
| `STATIC_FILES_DIR` | Path to static assets to be served by Express (e.g. `frontend/dist`). | _unset_ |
| `STEP_CA_DOCKER_IMAGE` | Docker image that provides the `step` CLI. | `smallstep/step-cli:latest` |
| `STEP_CA_DOCKER_VOLUMES` | Comma-separated list of Docker volume mounts passed to `docker run`. | _unset_ |
| `STEP_CA_DOCKER_ENV` | Comma-separated list of `KEY=value` pairs forwarded as environment variables to the container. | _unset_ |
| `STEP_CA_DOCKER_NETWORK` | Docker network passed to `docker run --network`. | _unset_ |
| `STEP_CA_URL` | URL of the step-ca instance. | _unset_ |
| `STEP_CA_ROOT_CERT_PATH` | Path (inside the container) to the root certificate used to verify the CA. | _unset_ |
| `STEP_CA_FINGERPRINT` | Root certificate fingerprint used for bootstrapping. | _unset_ |
| `STEP_CA_PROVISIONER` | Provisioner name used when issuing or revoking certificates. | _unset_ |
| `STEP_CA_PROVISIONER_PASSWORD_FILE` | Path to the provisioner password file accessible within the container. | _unset_ |
| `STEP_CA_TOKEN` | Optional one-time token for certificate enrollment. | _unset_ |

Volumes are specified using normal Docker syntax, for example:

```
STEP_CA_DOCKER_VOLUMES=/host/path/step:/home/step,
  /host/path/passwords:/passwords
STEP_CA_DOCKER_ENV=STEP_CA_URL=https://step-ca:9000,STEP_CA_CONFIG=/home/step/config/ca.json
```

## Docker image

The provided `Dockerfile` builds the frontend and backend into a single container image. The resulting image starts the backend
Express server and serves the compiled React bundle.

```bash
docker build -t simple-client-cert-manager .
docker run --rm -p 4000:4000 \
  -e STEP_CA_DOCKER_VOLUMES="/path/to/step:/home/step" \
  -e STEP_CA_DOCKER_ENV="STEP_CA_URL=https://step-ca:9000" \
  simple-client-cert-manager
```

With `STATIC_FILES_DIR=frontend/dist`, navigate to `http://localhost:4000` to use the SPA.
