import { Router } from 'express';
import createHttpError from 'http-errors';
import { issueCertificateSchema, revokeCertificateSchema } from '../types/certificates.js';
import { enrollCertificate, revokeIssuedCertificate } from '../services/certificateService.js';

export const certificatesRouter = Router();

certificatesRouter.post('/', async (req, res, next) => {
  try {
    const parsedBody = issueCertificateSchema.parse(req.body);
    const { certificate, privateKey } = await enrollCertificate({
      commonName: parsedBody.commonName,
      subjectAlternativeNames: parsedBody.subjectAlternativeNames,
      validityDays: parsedBody.validityDays
    });

    res.status(201).json({ certificate, privateKey });
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      return next(createHttpError(400, 'Invalid request payload', { errors: (error as any).issues }));
    }
    next(error);
  }
});

certificatesRouter.post('/revoke', async (req, res, next) => {
  try {
    const parsedBody = revokeCertificateSchema.parse(req.body);
    const result = await revokeIssuedCertificate(parsedBody.serialNumber, parsedBody.reason);
    res.json({ message: 'Certificate revoked', output: result.stdout.trim() });
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      return next(createHttpError(400, 'Invalid request payload', { errors: (error as any).issues }));
    }
    next(error);
  }
});
