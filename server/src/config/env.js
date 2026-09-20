import 'dotenv/config';

/**
 * Single place where process.env is read. Everything else imports `env`, which
 * means a missing variable fails loudly at boot rather than at 2am in a route.
 */
function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    console.warn(`[config] ${key} is not set — using a development default.`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT ?? 4000),

  databaseUrl: required('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/digital_heroes'),
  databaseSsl: process.env.DATABASE_SSL === 'true',

  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  cookieName: process.env.COOKIE_NAME ?? 'dh_session',

  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  serverUrl: process.env.SERVER_URL ?? 'http://localhost:4000',
  corsOrigins: (process.env.CORS_ORIGINS ?? process.env.CLIENT_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  payments: {
    provider: process.env.PAYMENT_PROVIDER ?? 'stripe',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    monthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_ID ?? '',
    yearlyPriceId: process.env.STRIPE_YEARLY_PRICE_ID ?? '',
    currency: process.env.CURRENCY ?? 'GBP',
  },

  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local', // local | s3
    endpoint: process.env.STORAGE_ENDPOINT ?? '',
    bucket: process.env.STORAGE_BUCKET ?? 'digital-heroes-proofs',
    accessKey: process.env.STORAGE_ACCESS_KEY ?? '',
    secretKey: process.env.STORAGE_SECRET_KEY ?? '',
    region: process.env.STORAGE_REGION ?? 'auto',
    publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL ?? '',
    localDir: process.env.STORAGE_LOCAL_DIR ?? 'uploads',
    maxFileBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024),
  },

  draw: {
    prizeShare: Number(process.env.PRIZE_SHARE ?? 0.5),
    ballPoolSize: Number(process.env.BALL_POOL_SIZE ?? 40),
    numbersPerTicket: Number(process.env.NUMBERS_PER_TICKET ?? 5),
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 300),
    authMax: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 10),
  },
};

export default env;
