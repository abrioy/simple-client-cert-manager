import { IssueCertificateOptions, issueCertificate, revokeCertificate } from './stepCaCli.js';

export async function enrollCertificate(options: IssueCertificateOptions) {
  return issueCertificate(options);
}

export async function revokeIssuedCertificate(serialNumber: string, reason?: string) {
  return revokeCertificate({ serialNumber, reason });
}
