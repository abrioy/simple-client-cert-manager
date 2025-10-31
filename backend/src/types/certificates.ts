import { z } from 'zod';

export const issueCertificateSchema = z.object({
  commonName: z.string().min(1, 'Common name is required'),
  subjectAlternativeNames: z.array(z.string()).optional(),
  validityDays: z
    .number()
    .int()
    .positive('validityDays must be greater than zero')
    .optional()
});

export type IssueCertificatePayload = z.infer<typeof issueCertificateSchema>;

export const revokeCertificateSchema = z.object({
  serialNumber: z.string().min(1, 'serialNumber is required'),
  reason: z.string().optional()
});

export type RevokeCertificatePayload = z.infer<typeof revokeCertificateSchema>;
