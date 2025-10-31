import { useMutation, useQuery } from '@tanstack/react-query';
import {
  fetchHealth,
  issueCertificate,
  revokeCertificate,
  type IssueCertificateInput,
  type IssueCertificateResponse
} from './api';

export const useIssueCertificate = () =>
  useMutation<IssueCertificateResponse, Error, IssueCertificateInput>({
    mutationFn: issueCertificate
  });

export const useRevokeCertificate = () =>
  useMutation<{ message: string; output?: string }, Error, { serialNumber: string; reason?: string }>({
    mutationFn: ({ serialNumber, reason }: { serialNumber: string; reason?: string }) =>
      revokeCertificate(serialNumber, reason)
  });

export const useCaHealth = () =>
  useQuery({
    queryKey: ['ca-health'],
    queryFn: fetchHealth,
    refetchInterval: 60_000
  });
