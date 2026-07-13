import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters.'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters.'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  REFRESH_TOKEN_REMEMBER_TTL_DAYS: z.coerce.number().int().positive().default(30),

  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET must be at least 16 characters.'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),

  // Account lockout after repeated failed logins (brute-force protection independent of IP-based rate limiting).
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  UPLOAD_DIR: z.string().default('src/uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(10),

  // File storage backend. 'local' (default) writes to UPLOAD_DIR on disk — fine for a single
  // instance, but that disk is ephemeral on most PaaS deploys (Railway/Render), so uploaded
  // files disappear on redeploy/restart. Use 's3' in production; see backend/README.md.
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // Error tracking (optional). Unset = disabled; no SDK is installed until this is actually
  // configured. See src/utils/monitoring.ts for the integration point.
  SENTRY_DSN: z.string().optional(),

  // Invite/reset tokens are returned directly in API responses today because no email provider
  // is connected (see services/email/) — defaults to dev-only exposure. Set to 'true' to force
  // it on in a non-production environment that still reports NODE_ENV=production (e.g. staging),
  // or leave unset/false to keep tokens out of every response once a real provider is wired up.
  EXPOSE_AUTH_TOKENS: z.enum(['true', 'false']).optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables. Check .env against .env.example.');
}

if (parsed.data.STORAGE_PROVIDER === 's3' && (!parsed.data.AWS_REGION || !parsed.data.AWS_S3_BUCKET)) {
  throw new Error('STORAGE_PROVIDER=s3 requires AWS_REGION and AWS_S3_BUCKET to be set.');
}

export const env = parsed.data;
