import { z } from 'zod';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const issueCertificateResponseSchema = z.object({
  certificate: z.string(),
  privateKey: z.string()
});

const revokeCertificateResponseSchema = z.object({
  message: z.string(),
  output: z.string().optional()
});

const healthResponseSchema = z.object({
  healthy: z.boolean()
});

export type IssueCertificateInput = {
  commonName: string;
  subjectAlternativeNames: string[];
  validityDays?: number;
};

export type IssueCertificateResponse = z.infer<typeof issueCertificateResponseSchema>;

export async function issueCertificate(input: IssueCertificateInput): Promise<IssueCertificateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/certificates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message ?? 'Failed to issue certificate');
  }

  const payload = await response.json();
  return issueCertificateResponseSchema.parse(payload);
}

export async function revokeCertificate(serialNumber: string, reason?: string) {
  const response = await fetch(`${API_BASE_URL}/api/certificates/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serialNumber, reason })
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message ?? 'Failed to revoke certificate');
  }

  const payload = await response.json();
  return revokeCertificateResponseSchema.parse(payload);
}

export async function fetchHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  if (!response.ok) {
    throw new Error('Unable to reach CA health endpoint');
  }
  const payload = await response.json();
  return healthResponseSchema.parse(payload);
}
