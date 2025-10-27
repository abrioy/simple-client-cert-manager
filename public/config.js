window.__CONFIG__ = {
  oidc: {
    authorizationEndpoint: "${OIDC_AUTHORIZATION_ENDPOINT}",
    tokenEndpoint: "${OIDC_TOKEN_ENDPOINT}",
    clientId: "${OIDC_CLIENT_ID}",
    scope: "${OIDC_SCOPE}"
  },
  certificate: {
    subject: "${CERTIFICATE_SUBJECT}",
    certificateFilename: "${CERTIFICATE_FILENAME}",
    privateKeyFilename: "${PRIVATE_KEY_FILENAME}"
  },
  enrollmentEndpoint: "${ENROLLMENT_API_PATH}",
  stepCaProfile: "${STEP_CA_PROFILE}"
};
