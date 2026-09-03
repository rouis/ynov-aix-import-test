import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url(),
  COMPLEX_SECRET_KEY: z.string().min(32),
  // Facteur de coût bcrypt : fixe et plancher OWASP imposé (ANO-001).
  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),
  S3_ENDPOINT: z.string().url(),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  // URL du frontend, utilisée pour construire le lien d'activation envoyé par email.
  FRONT_URL: z.string().url().default('http://localhost:3001'),
  ACTIVATION_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(48),
  RESET_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(1),
  // Configuration SMTP (optionnelle en dev : sans SMTP_HOST, le lien est loggé).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Ticketin <no-reply@ticketin.local>'),
  // Ingestion d'emails entrants (création de tickets par mail).
  INBOUND_MAIL_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().int().positive().default(993),
  IMAP_USER: z.string().optional(),
  IMAP_PASS: z.string().optional(),
  IMAP_TLS: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
  IMAP_FOLDER: z.string().default('INBOX'),
  INBOUND_POLL_CRON: z.string().default('0 * * * * *'),
  INBOUND_POLL_MODE: z.enum(['inprocess', 'external']).default('inprocess'),
  INBOUND_ALLOWED_DOMAINS: z.string().default(''),
  INBOUND_ORGANIZATION_ID: z.string().optional(),
  INBOUND_DEFAULT_CATEGORY: z.string().default('Email'),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (raw: Record<string, unknown>): Env => {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${errors}`);
  }
  return result.data;
};
