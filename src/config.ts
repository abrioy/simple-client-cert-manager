export type AppConfig = {
  oidc: {
    authorizationEndpoint: string;
    tokenEndpoint: string;
    clientId: string;
    scope: string;
  };
  certificate: {
    subject: string;
    certificateFilename: string;
    privateKeyFilename: string;
  };
  enrollmentEndpoint: string;
  stepCaProfile?: string;
};

type RawConfig = Partial<AppConfig> & {
  oidc?: Partial<AppConfig["oidc"]>;
  certificate?: Partial<AppConfig["certificate"]>;
};

declare global {
  interface Window {
    __CONFIG__?: RawConfig;
  }
}

export function loadConfig(): { config: AppConfig; missing: string[] } {
  const raw = window.__CONFIG__ ?? {};
  const missing: string[] = [];

  const authorizationEndpoint = raw.oidc?.authorizationEndpoint?.trim() ?? "";
  if (!authorizationEndpoint) {
    missing.push("OIDC authorization endpoint");
  }

  const tokenEndpoint = raw.oidc?.tokenEndpoint?.trim() ?? "";
  if (!tokenEndpoint) {
    missing.push("OIDC token endpoint");
  }

  const clientId = raw.oidc?.clientId?.trim() ?? "";
  if (!clientId) {
    missing.push("OIDC client ID");
  }

  const scope = raw.oidc?.scope?.trim() || "openid email profile";

  const subject = raw.certificate?.subject?.trim() || "CN=client";
  const certificateFilename = raw.certificate?.certificateFilename?.trim() || "client.crt";
  const privateKeyFilename = raw.certificate?.privateKeyFilename?.trim() || "client.key";

  const enrollmentEndpoint = raw.enrollmentEndpoint?.trim() || "/api/sign";
  const stepCaProfile = raw.stepCaProfile?.trim() || undefined;

  const config: AppConfig = {
    oidc: {
      authorizationEndpoint,
      tokenEndpoint,
      clientId,
      scope
    },
    certificate: {
      subject,
      certificateFilename,
      privateKeyFilename
    },
    enrollmentEndpoint,
    stepCaProfile
  };

  return { config, missing };
}
