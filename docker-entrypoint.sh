#!/bin/sh
set -euo pipefail

: "${PORT:=8080}"
: "${STEP_CA_URL:=http://step-ca:9000}"
: "${STEP_CA_SIGN_PATH:=/1.0/sign}"
: "${ENROLLMENT_API_PATH:=/api/sign}"
: "${STEP_CA_PROFILE:=}"
: "${OIDC_AUTHORIZATION_ENDPOINT:=}"
: "${OIDC_TOKEN_ENDPOINT:=}"
: "${OIDC_CLIENT_ID:=}"
: "${OIDC_SCOPE:=openid email profile}"
: "${CERTIFICATE_SUBJECT:=CN=client}"
: "${CERTIFICATE_FILENAME:=client.crt}"
: "${PRIVATE_KEY_FILENAME:=client.key}"

if [ -f /usr/share/nginx/html/config.js.template ]; then
  envsubst '\
${OIDC_AUTHORIZATION_ENDPOINT}\
${OIDC_TOKEN_ENDPOINT}\
${OIDC_CLIENT_ID}\
${OIDC_SCOPE}\
${CERTIFICATE_SUBJECT}\
${CERTIFICATE_FILENAME}\
${PRIVATE_KEY_FILENAME}\
${ENROLLMENT_API_PATH}\
${STEP_CA_PROFILE}' < /usr/share/nginx/html/config.js.template > /usr/share/nginx/html/config.js
fi

if [ -f /etc/nginx/templates/app.conf.template ]; then
  envsubst '\
${PORT}\
${STEP_CA_URL}\
${STEP_CA_SIGN_PATH}' < /etc/nginx/templates/app.conf.template > /etc/nginx/conf.d/default.conf
fi

exec "$@"
