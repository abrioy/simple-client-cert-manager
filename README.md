# Client Certificate Manager

A secure, minimal web application for generating P12 client certificates using OpenSSL CLI.

## Features

- Generate client certificates in P12 bundle format
- View all generated certificates
- Revoke certificates using Certificate Revocation List (CRL)
- Minimal dependencies for maximum security
- React frontend served by Node/Express backend
- All certificate operations use OpenSSL CLI
- Command history displayed in UI for transparency
- Docker containerized

## Architecture

### Backend (Node/Express)
- Express server serving static React bundle
- REST API for certificate operations
- OpenSSL CLI wrapper for all crypto operations
- JSON file-based certificate storage (no database dependency)

### Frontend (React + Vite)
- Single Page Application
- Displays user email from forward auth header
- Shows OpenSSL command history
- Download P12 bundles directly

## Prerequisites

- Docker (for containerized deployment)
- OR Node.js 20+ (for local development)
- Root and intermediate CA certificates and keys

## Certificate Setup

Before running the application, you need:

1. **Root Certificate** (`/certs/root.pem`)
2. **Intermediate Certificate** (`/certs/intermediate.pem`)
3. **Intermediate Private Key** (`/certs/intermediate-key.pem`)

### Example: Generate Test Certificates

```bash
# Create certs directory
mkdir -p certs

# Generate root CA
openssl genrsa -out certs/root-key.pem 4096
openssl req -new -x509 -days 3650 -key certs/root-key.pem -out certs/root.pem \
  -subj "/C=US/O=Example Org/CN=Root CA"

# Generate intermediate CA
openssl genrsa -out certs/intermediate-key.pem 4096
openssl req -new -key certs/intermediate-key.pem -out certs/intermediate.csr \
  -subj "/C=US/O=Example Org/CN=Intermediate CA"

# Sign intermediate with root
openssl x509 -req -days 1825 -in certs/intermediate.csr \
  -CA certs/root.pem -CAkey certs/root-key.pem -CAcreateserial \
  -out certs/intermediate.pem -sha256

# Clean up CSR
rm certs/intermediate.csr
```

## Docker Deployment

### Build the image

```bash
docker build -t client-cert-manager .
```

### Run the container

```bash
docker run -d \
  --name cert-manager \
  -p 3000:3000 \
  -v $(pwd)/certs:/certs:ro \
  -v $(pwd)/data:/data \
  -e CERT_VALIDITY_DAYS=180 \
  client-cert-manager
```

### Behind a reverse proxy with forward auth

Example nginx configuration:

```nginx
location / {
  proxy_pass http://localhost:3000;
  proxy_set_header X-Forwarded-Email $user_email;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```

Example Traefik labels:

```yaml
labels:
  - "traefik.http.middlewares.auth.forwardauth.address=http://auth-service"
  - "traefik.http.middlewares.auth.forwardauth.authResponseHeaders=X-Forwarded-Email"
  - "traefik.http.routers.cert-manager.middlewares=auth"
```

## Local Development

### Install dependencies

```bash
# Install server dependencies
cd server
pnpm install

# Install client dependencies
cd ../client
pnpm install
```

### Set up environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### Run in development mode

Terminal 1 (Backend):
```bash
cd server
pnpm run dev
```

Terminal 2 (Frontend):
```bash
cd client
pnpm run dev
```

Frontend will be available at http://localhost:5173 (proxies API to backend on port 3000)

### Build for production

```bash
# Build frontend
cd client
pnpm run build

# Start production server
cd ../server
pnpm start
```

Access at http://localhost:3000

### Quick start with run.sh

```bash
# Build and run container in development mode
./run.sh
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `production` | Environment mode |
| `CERT_DIR` | `/certs` | Directory containing CA certificates |
| `DATA_DIR` | `/data` | Directory for certificate storage and CRL |
| `CERT_VALIDITY_DAYS` | `180` | Certificate validity period (6 months) |

## API Endpoints

- `GET /api/user` - Get user info from X-Forwarded-Email header
- `POST /api/certificates` - Generate new client certificate
- `GET /api/certificates` - List all certificates
- `POST /api/certificates/:id/revoke` - Revoke a certificate
- `GET /api/crl` - Get current Certificate Revocation List

## Security Considerations

- Runs behind reverse proxy with forward authentication
- Minimal dependencies (only Express and React)
- All crypto operations use OpenSSL CLI (audited and trusted)
- Intermediate CA key stored securely (read-only mount)
- No client-side crypto (private keys generated server-side)
- Command output transparency (users see all OpenSSL commands)

## Project Structure

```
.
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main application component
│   │   ├── main.jsx       # React entry point
│   │   └── api.js         # API service
│   ├── index.html         # HTML template with inline CSS
│   ├── vite.config.js     # Vite configuration
│   └── package.json
├── server/                # Node/Express backend
│   ├── index.js          # Express server
│   ├── openssl.js        # OpenSSL CLI wrapper
│   ├── storage.js        # Certificate storage
│   └── package.json
├── Dockerfile
├── .env.example
└── README.md
```

## License

MIT
