export type AppEnv = {
  NODE_ENV: string;
  PORT: number;
  JWT_SECRET: string;
  JWT_SECRET_FROM_ENV: boolean;
  MONGODB_URI: string;
  CORS_ORIGIN: string;
  AUTH_RATE_LIMIT: number;
  USE_DEFAULT_OTP: boolean;
  DEFAULT_OTP: string;
};

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const nodeEnv = String(config.NODE_ENV ?? 'development');
  const jwtFromEnv = config.JWT_SECRET ? String(config.JWT_SECRET) : '';
  if (nodeEnv === 'production' && jwtFromEnv.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters when NODE_ENV=production',
    );
  }
  if (nodeEnv === 'production' && !String(config.CORS_ORIGIN ?? '').trim()) {
    throw new Error('CORS_ORIGIN is required when NODE_ENV=production');
  }

  const port = Number(config.PORT ?? 4001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const rateLimit = Number(config.AUTH_RATE_LIMIT ?? 10);
  if (!Number.isInteger(rateLimit) || rateLimit < 1) {
    throw new Error('AUTH_RATE_LIMIT must be a positive integer');
  }

  const mongoUri = String(
    config.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/moi-kanaku',
  );
  if (nodeEnv === 'production' && !config.MONGODB_URI) {
    throw new Error('MONGODB_URI is required when NODE_ENV=production');
  }
  if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }

  const defaultOtp = String(config.DEFAULT_OTP ?? '4444');
  if (!/^\d{4}$/.test(defaultOtp)) {
    throw new Error('DEFAULT_OTP must be a 4-digit code');
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    JWT_SECRET: jwtFromEnv || 'development-only-jwt-secret-not-for-production',
    JWT_SECRET_FROM_ENV: jwtFromEnv.length > 0,
    MONGODB_URI: mongoUri,
    CORS_ORIGIN: config.CORS_ORIGIN ? String(config.CORS_ORIGIN) : '',
    AUTH_RATE_LIMIT: rateLimit,
    USE_DEFAULT_OTP: readFlag(config.USE_DEFAULT_OTP, nodeEnv !== 'production'),
    DEFAULT_OTP: defaultOtp,
  };
}

function readFlag(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  const text = String(value).trim().toLowerCase();
  if (text === 'true' || text === '1' || text === 'yes' || text === 'on') {
    return true;
  }
  if (text === 'false' || text === '0' || text === 'no' || text === 'off') {
    return false;
  }
  throw new Error('USE_DEFAULT_OTP must be true or false');
}
