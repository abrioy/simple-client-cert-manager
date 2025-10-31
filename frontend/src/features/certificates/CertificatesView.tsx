import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../../components/Card';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { CodeBlock } from '../../components/CodeBlock';
import { Alert } from '../../components/Alert';
import { useCaHealth, useIssueCertificate, useRevokeCertificate } from './hooks';
import './CertificatesView.css';

const issueCertificateFormSchema = z.object({
  commonName: z.string().min(1, 'Common name is required'),
  subjectAlternativeNames: z.string().optional(),
  validityDays: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    })
});

type IssueCertificateFormValues = z.infer<typeof issueCertificateFormSchema>;

const revokeCertificateFormSchema = z.object({
  serialNumber: z.string().min(1, 'Serial number is required'),
  reason: z.string().optional()
});

type RevokeCertificateFormValues = z.infer<typeof revokeCertificateFormSchema>;

export const CertificatesView = () => {
  const [certificateResult, setCertificateResult] = useState<{ certificate: string; privateKey: string } | null>(null);
  const issueCertificateMutation = useIssueCertificate();
  const revokeCertificateMutation = useRevokeCertificate();
  const caHealthQuery = useCaHealth();

  const issueForm = useForm<IssueCertificateFormValues>({
    resolver: zodResolver(issueCertificateFormSchema),
    defaultValues: { commonName: '', subjectAlternativeNames: '', validityDays: '30' }
  });

  const revokeForm = useForm<RevokeCertificateFormValues>({
    resolver: zodResolver(revokeCertificateFormSchema),
    defaultValues: { serialNumber: '', reason: '' }
  });

  const healthStatus = useMemo(() => {
    if (caHealthQuery.isLoading) {
      return <Alert>Checking CA health...</Alert>;
    }

    if (caHealthQuery.error || !caHealthQuery.data?.healthy) {
      return (
        <Alert variant="error" title="step-ca is unreachable">
          Ensure the Docker daemon is running and the configured step-ca container is healthy.
        </Alert>
      );
    }

    return <Alert variant="success">step-ca is reachable and healthy.</Alert>;
  }, [caHealthQuery.data?.healthy, caHealthQuery.error, caHealthQuery.isLoading]);

  const handleIssueCertificate = issueForm.handleSubmit(async (values) => {
    setCertificateResult(null);
    const sanitizedSans = values.subjectAlternativeNames
      ? values.subjectAlternativeNames.split(',').map((value) => value.trim()).filter(Boolean)
      : [];

    const payload = {
      commonName: values.commonName,
      subjectAlternativeNames: sanitizedSans,
      validityDays: values.validityDays
    };

    try {
      const result = await issueCertificateMutation.mutateAsync(payload);
      setCertificateResult(result);
      issueForm.reset();
    } catch (error) {
      console.error('Failed to issue certificate', error);
    }
  });

  const handleRevokeCertificate = revokeForm.handleSubmit(async (values) => {
    try {
      await revokeCertificateMutation.mutateAsync({ serialNumber: values.serialNumber, reason: values.reason });
      revokeForm.reset();
    } catch (error) {
      console.error('Failed to revoke certificate', error);
    }
  });

  return (
    <div className="certificates-view">
      {healthStatus}

      <Card
        title="Issue a client certificate"
        subtitle="Provision a new certificate with the configured step-ca provisioner."
      >
        <form className="form" onSubmit={handleIssueCertificate}>
          <TextField
            label="Common name"
            placeholder="e.g. client.example.com"
            {...issueForm.register('commonName')}
            error={issueForm.formState.errors.commonName?.message}
          />
          <TextField
            label="Subject alternative names"
            placeholder="Comma separated DNS names"
            {...issueForm.register('subjectAlternativeNames')}
            error={issueForm.formState.errors.subjectAlternativeNames?.message}
          />
          <TextField
            label="Validity (days)"
            type="number"
            min={1}
            {...issueForm.register('validityDays')}
            error={issueForm.formState.errors.validityDays?.message}
          />
          <Button type="submit" disabled={issueCertificateMutation.isPending}>
            {issueCertificateMutation.isPending ? 'Issuing…' : 'Issue certificate'}
          </Button>
          {issueCertificateMutation.error ? (
            <Alert variant="error">{issueCertificateMutation.error.message}</Alert>
          ) : null}
        </form>

        {certificateResult ? (
          <div className="certificate-output">
            <Alert variant="success" title="Certificate issued">
              Store your private key securely. It will not be shown again.
            </Alert>
            <CodeBlock label="Certificate">{certificateResult.certificate}</CodeBlock>
            <CodeBlock label="Private key">{certificateResult.privateKey}</CodeBlock>
          </div>
        ) : null}
      </Card>

      <Card title="Revoke a certificate" subtitle="Invalidate a certificate by serial number.">
        <form className="form" onSubmit={handleRevokeCertificate}>
          <TextField
            label="Serial number"
            placeholder="Serial number from the issued certificate"
            {...revokeForm.register('serialNumber')}
            error={revokeForm.formState.errors.serialNumber?.message}
          />
          <TextField
            label="Reason (optional)"
            placeholder="e.g. key compromise"
            {...revokeForm.register('reason')}
            error={revokeForm.formState.errors.reason?.message}
          />
          <Button type="submit" variant="secondary" disabled={revokeCertificateMutation.isPending}>
            {revokeCertificateMutation.isPending ? 'Revoking…' : 'Revoke certificate'}
          </Button>
          {revokeCertificateMutation.error ? (
            <Alert variant="error">{revokeCertificateMutation.error.message}</Alert>
          ) : null}
          {revokeCertificateMutation.isSuccess ? (
            <Alert variant="success">Certificate revoked successfully.</Alert>
          ) : null}
        </form>
      </Card>
    </div>
  );
};
