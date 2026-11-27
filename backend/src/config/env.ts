import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProd = process.env.NODE_ENV === 'production';
const storageDriver = (process.env.STORAGE_DRIVER || (isProd ? 'supabase' : 'memory')) as 'supabase' | 'memory';

function requireSecret(name: string, fallback: string): string {
  const val = process.env[name];
  if (val && val.length >= 16 && !val.includes('replace-with') && !val.includes('YOUR_')) return val;
  if (isProd) {
    throw new Error(`Missing or weak required secret environment variable: ${name}`);
  }
  return fallback;
}

if (isProd && storageDriver !== 'supabase') {
  throw new Error('Production environment requires STORAGE_DRIVER=supabase (in-memory storage is prohibited in production).');
}

const supabaseUrl = process.env.SUPABASE_URL?.trim() || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

if (storageDriver === 'supabase') {
  if (
    !supabaseUrl ||
    !supabaseServiceRoleKey ||
    supabaseUrl.includes('your-project-ref') ||
    supabaseServiceRoleKey.includes('your-supabase-service-role-key') ||
    supabaseServiceRoleKey.includes('YOUR_')
  ) {
    throw new Error('Valid SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when STORAGE_DRIVER=supabase.');
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  port: Number(process.env.PORT || 4000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  storageDriver,
  demoMode: isProd ? false : process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE !== 'false',
  supabaseUrl,
  supabaseServiceRoleKey,
  jwtSecret: requireSecret('JWT_SECRET', 'dev-only-jwt-secret-change-in-production-32chars'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  qrHmacSecret: requireSecret('QR_HMAC_SECRET', 'dev-only-qr-hmac-secret-change-in-production'),
  otpHmacSecret: requireSecret('OTP_HMAC_SECRET', 'dev-only-otp-hmac-secret-change-in-production'),
  webhookSharedSecret: requireSecret('WEBHOOK_SHARED_SECRET', 'dev-only-webhook-secret-change-in-production'),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 300),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 25),
};
