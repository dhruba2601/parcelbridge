import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const storageDriver = (process.env.STORAGE_DRIVER || (isProd ? 'supabase' : 'memory')) as 'supabase' | 'memory';

function requireSecret(name: string, fallback: string): string {
  const val = process.env[name];
  if (val && val.length >= 16) return val;
  if (isProd) {
    throw new Error(`Missing or weak required secret environment variable: ${name}`);
  }
  return fallback;
}

if (isProd && storageDriver !== 'supabase') {
  throw new Error('Production environment requires STORAGE_DRIVER=supabase (in-memory storage is prohibited in production).');
}

if (storageDriver === 'supabase' && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when STORAGE_DRIVER=supabase.');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  port: Number(process.env.PORT || 4000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  storageDriver,
  demoMode: isProd ? false : process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE !== 'false',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  jwtSecret: requireSecret('JWT_SECRET', 'dev-only-jwt-secret-change-in-production-32chars'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  qrHmacSecret: requireSecret('QR_HMAC_SECRET', 'dev-only-qr-hmac-secret-change-in-production'),
  otpHmacSecret: requireSecret('OTP_HMAC_SECRET', 'dev-only-otp-hmac-secret-change-in-production'),
  webhookSharedSecret: requireSecret('WEBHOOK_SHARED_SECRET', 'dev-only-webhook-secret-change-in-production'),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 300),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 25),
};
