#!/bin/sh
set -euo pipefail

: "${STEP_CA_URL:=http://step-ca:9000}"
: "${STEP_CA_PROFILE:=}"
: "${OIDC_AUTHORIZATION_ENDPOINT:=}"
: "${OIDC_TOKEN_ENDPOINT:=}"
: "${OIDC_CLIENT_ID:=}"
: "${OIDC_CLIENT_SECRET:=}"
: "${OIDC_SCOPE:=openid email profile}"
: "${CERTIFICATE_SUBJECT:=CN=client}"
: "${CERTIFICATE_FILENAME:=client.crt}"
: "${PRIVATE_KEY_FILENAME:=client.key}"


if [ "${OIDC_AUTHORIZATION_ENDPOINT:-}" = "" ]; then
  echo "WARNING: OIDC_AUTHORIZATION_ENDPOINT is not set" >&2
fi

if [ "${OIDC_TOKEN_ENDPOINT:-}" = "" ]; then
  echo "WARNING: OIDC_TOKEN_ENDPOINT is not set" >&2
fi

if [ "${OIDC_CLIENT_ID:-}" = "" ]; then
  echo "WARNING: OIDC_CLIENT_ID is not set" >&2
fi

if [ "${OIDC_CLIENT_SECRET:-}" = "" ]; then
  echo "WARNING: OIDC_CLIENT_SECRET is not set" >&2
fi

if [ -f /etc/caddy/templates/config.js.template ]; then
  envsubst '\
${OIDC_AUTHORIZATION_ENDPOINT}\
${OIDC_TOKEN_ENDPOINT}\
${OIDC_CLIENT_ID}\
${OIDC_CLIENT_SECRET}\
${OIDC_SCOPE}\
${CERTIFICATE_SUBJECT}\
${CERTIFICATE_FILENAME}\
${PRIVATE_KEY_FILENAME}\
${ENROLLMENT_API_PATH}\
${STEP_CA_PROFILE}' < /etc/caddy/templates/config.js.template > /usr/share/caddy/config.js
fi


if [ -f /etc/caddy/templates/Caddyfile.template ]; then
  envsubst '\
${STEP_CA_URL}' < /etc/caddy/templates/Caddyfile.template > /etc/caddy/Caddyfile
fi


exec "$@"
