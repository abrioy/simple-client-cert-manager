#!/bin/bash
set -e

echo "Building Docker image..."
docker build -t client-cert-manager .

echo ""
echo "Starting container..."
docker run --rm \
  --name cert-manager \
  -p 3000:3000 \
  -v "$(pwd)/certs:/certs:ro" \
  -v "$(pwd)/data:/data" \
  -e CERT_VALIDITY_DAYS=180 \
  -e NODE_ENV=development \
  client-cert-manager
