import crypto from 'crypto';
import { env } from '../config/env';

/**
 * Generates an opaque, HMAC-signed QR token for a parcel.
 * Contains NO customer PII (name, phone, flat, or address).
 * Format: pb1:<parcelId>:<16-char-hmac-hex>
 */
export function generateParcelQrToken(parcelId: string): string {
  const sig = crypto
    .createHmac('sha256', env.qrHmacSecret)
    .update(`parcel:${parcelId}`)
    .digest('hex')
    .slice(0, 24);
  return `pb1:${parcelId}:${sig}`;
}

export function verifyParcelQrToken(token: string): { valid: boolean; parcelId?: string } {
  const parts = token.split(':');
  if (parts.length !== 3 || parts[0] !== 'pb1') {
    return { valid: false };
  }
  const [, parcelId, providedSig] = parts;
  if (!parcelId || !providedSig) return { valid: false };

  const expectedSig = crypto
    .createHmac('sha256', env.qrHmacSecret)
    .update(`parcel:${parcelId}`)
    .digest('hex')
    .slice(0, 24);

  const a = Buffer.from(providedSig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false };
  }
  return { valid: true, parcelId };
}

/**
 * Generates a 6-digit numeric OTP and returns both plaintext (for delivery notification)
 * and its HMAC-SHA256 hash (for database storage — never store plaintext OTPs).
 */
export function generateOtpPair(): { otp: string; otpHash: string } {
  const num = crypto.randomInt(100000, 1000000);
  const otp = String(num);
  return {
    otp,
    otpHash: hashOtp(otp),
  };
}

export function hashOtp(otp: string): string {
  return crypto
    .createHmac('sha256', env.otpHmacSecret)
    .update(otp.trim())
    .digest('hex');
}

export function verifyOtpHash(otp: string, storedHash: string): boolean {
  const computed = hashOtp(otp);
  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(storedHash, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Verifies partner webhook HMAC-SHA256 signature with replay-window protection.
 * Header format: X-ParcelBridge-Signature: sha256=<hex>
 */
export function signWebhookPayload(timestamp: string, rawBody: string, secret = env.webhookSharedSecret): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
}

export function verifyWebhookSignature(
  timestamp: string,
  rawBody: string,
  signatureHeader: string,
  secret = env.webhookSharedSecret,
  maxSkewSeconds = 300
): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - ts) > maxSkewSeconds) {
    return false;
  }

  const provided = signatureHeader.replace(/^sha256=/, '').trim();
  const expected = signWebhookPayload(timestamp, rawBody, secret);

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
