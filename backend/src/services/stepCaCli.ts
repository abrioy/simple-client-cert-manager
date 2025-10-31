import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { execa } from 'execa';
import { appConfig } from '../config/appConfig.js';

const STEP_COMMAND = 'step';

export type StepCliResult = {
  stdout: string;
  stderr: string;
};

export type IssueCertificateOptions = {
  commonName: string;
  subjectAlternativeNames?: string[];
  validityDays?: number;
};

export type RevokeCertificateOptions = {
  serialNumber: string;
  reason?: string;
};

export async function runStepCli(args: string[]): Promise<StepCliResult> {
  const dockerArgs = ['run', '--rm'];
  const { stepCa } = appConfig;

  if (stepCa.dockerNetwork) {
    dockerArgs.push('--network', stepCa.dockerNetwork);
  }

  for (const [key, value] of Object.entries(stepCa.dockerEnv)) {
    dockerArgs.push('-e', `${key}=${value}`);
  }

  for (const volume of stepCa.dockerVolumes) {
    dockerArgs.push('-v', volume);
  }

  dockerArgs.push(stepCa.dockerImage, STEP_COMMAND, ...args);

  const subprocess = await execa('docker', dockerArgs, {
    all: true
  });

  return { stdout: subprocess.stdout, stderr: subprocess.stderr ?? '' };
}

const durationFromDays = (days?: number): string | undefined => {
  if (!days || days <= 0) {
    return undefined;
  }
  const hours = Math.round(days * 24);
  return `${hours}h`;
};

export async function issueCertificate({
  commonName,
  subjectAlternativeNames = [],
  validityDays
}: IssueCertificateOptions): Promise<{ certificate: string; privateKey: string }> {
  const workDir = join(tmpdir(), `step-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });
  const certificatePath = join(workDir, 'certificate.crt');
  const privateKeyPath = join(workDir, 'private.key');

  try {
    const commandArgs = ['ca', 'certificate', commonName, certificatePath, privateKeyPath];
    const { stepCa } = appConfig;

    for (const san of subjectAlternativeNames) {
      commandArgs.push('--san', san);
    }

    const notAfter = durationFromDays(validityDays);
    if (notAfter) {
      commandArgs.push('--not-after', notAfter);
    }

    if (stepCa.caUrl) {
      commandArgs.push('--ca-url', stepCa.caUrl);
    }
    if (stepCa.rootCertPath) {
      commandArgs.push('--root', stepCa.rootCertPath);
    }
    if (stepCa.fingerprint) {
      commandArgs.push('--fingerprint', stepCa.fingerprint);
    }
    if (stepCa.provisioner) {
      commandArgs.push('--provisioner', stepCa.provisioner);
    }
    if (stepCa.provisionerPasswordFile) {
      commandArgs.push('--provisioner-password-file', stepCa.provisionerPasswordFile);
    }
    if (stepCa.token) {
      commandArgs.push('--token', stepCa.token);
    }

    await runStepCli(commandArgs);

    const [certificate, privateKey] = await Promise.all([
      fs.readFile(certificatePath, 'utf-8'),
      fs.readFile(privateKeyPath, 'utf-8')
    ]);

    return { certificate, privateKey };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

export async function revokeCertificate({ serialNumber, reason }: RevokeCertificateOptions): Promise<StepCliResult> {
  const commandArgs = ['ca', 'revoke', '--serial', serialNumber];
  const { stepCa } = appConfig;

  if (reason) {
    commandArgs.push('--reason', reason);
  }
  if (stepCa.caUrl) {
    commandArgs.push('--ca-url', stepCa.caUrl);
  }
  if (stepCa.rootCertPath) {
    commandArgs.push('--root', stepCa.rootCertPath);
  }
  if (stepCa.provisioner) {
    commandArgs.push('--provisioner', stepCa.provisioner);
  }
  if (stepCa.provisionerPasswordFile) {
    commandArgs.push('--provisioner-password-file', stepCa.provisionerPasswordFile);
  }
  if (stepCa.token) {
    commandArgs.push('--token', stepCa.token);
  }

  return runStepCli(commandArgs);
}

export async function checkHealth(): Promise<boolean> {
  try {
    await runStepCli(['ca', 'health']);
    return true;
  } catch (error) {
    return false;
  }
}
