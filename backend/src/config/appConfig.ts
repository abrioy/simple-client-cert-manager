import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('4000'),
  STEP_CA_DOCKER_IMAGE: z.string().optional(),
  STEP_CA_DOCKER_VOLUMES: z.string().optional(),
  STEP_CA_DOCKER_ENV: z.string().optional(),
  STEP_CA_DOCKER_NETWORK: z.string().optional(),
  STEP_CA_URL: z.string().optional(),
  STEP_CA_ROOT_CERT_PATH: z.string().optional(),
  STEP_CA_FINGERPRINT: z.string().optional(),
  STEP_CA_PROVISIONER: z.string().optional(),
  STEP_CA_PROVISIONER_PASSWORD_FILE: z.string().optional(),
  STEP_CA_TOKEN: z.string().optional(),
  STATIC_FILES_DIR: z.string().optional()
});

const parsed = envSchema.parse(process.env);

const listFromEnv = (value?: string): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const envMapFromEnv = (value?: string): Record<string, string> => {
  if (!value) return {};
  return value.split(',').reduce<Record<string, string>>((acc, pair) => {
    const [key, ...rest] = pair.split('=');
    if (!key || rest.length === 0) {
      return acc;
    }
    acc[key.trim()] = rest.join('=').trim();
    return acc;
  }, {});
};

export const appConfig = {
  nodeEnv: parsed.NODE_ENV,
  port: Number.parseInt(parsed.PORT, 10),
  staticFilesDir: parsed.STATIC_FILES_DIR,
  stepCa: {
    dockerImage: parsed.STEP_CA_DOCKER_IMAGE ?? 'smallstep/step-cli:latest',
    dockerVolumes: listFromEnv(parsed.STEP_CA_DOCKER_VOLUMES),
    dockerEnv: envMapFromEnv(parsed.STEP_CA_DOCKER_ENV),
    dockerNetwork: parsed.STEP_CA_DOCKER_NETWORK,
    caUrl: parsed.STEP_CA_URL,
    rootCertPath: parsed.STEP_CA_ROOT_CERT_PATH,
    fingerprint: parsed.STEP_CA_FINGERPRINT,
    provisioner: parsed.STEP_CA_PROVISIONER,
    provisionerPasswordFile: parsed.STEP_CA_PROVISIONER_PASSWORD_FILE,
    token: parsed.STEP_CA_TOKEN
  }
} as const;

export type AppConfig = typeof appConfig;
