import { env } from './env';

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,

  corsOrigins: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),

  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET
  },

  refreshToken: {
    ttlDays: env.REFRESH_TOKEN_TTL_DAYS,
    rememberTtlDays: env.REFRESH_TOKEN_REMEMBER_TTL_DAYS
  },

  cookieSecret: env.COOKIE_SECRET,
  bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,

  login: {
    maxAttempts: env.LOGIN_MAX_ATTEMPTS,
    lockoutMinutes: env.LOGIN_LOCKOUT_MINUTES
  },

  upload: {
    dir: env.UPLOAD_DIR,
    maxSizeBytes: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024
  },

  storage: {
    provider: env.STORAGE_PROVIDER,
    aws: {
      region: env.AWS_REGION,
      bucket: env.AWS_S3_BUCKET,
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY
    }
  },

  monitoring: {
    sentryDsn: env.SENTRY_DSN
  },

  // See EXPOSE_AUTH_TOKENS's comment in config/env.ts.
  exposeAuthTokens: env.EXPOSE_AUTH_TOKENS ? env.EXPOSE_AUTH_TOKENS === 'true' : env.NODE_ENV !== 'production'
} as const;
