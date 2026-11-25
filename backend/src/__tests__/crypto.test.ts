import { describe, expect, it } from 'vitest';
import {
  generateOtpPair,
  generateParcelQrToken,
  signWebhookPayload,
  verifyOtpHash,
  verifyParcelQrToken,
  verifyWebhookSignature,
} from '../utils/crypto';

describe('Crypto & Security Utilities', () => {
  it('generates and verifies opaque QR tokens without PII', () => {
    const parcelId = 'cccc1111-1111-4111-8111-111111111101';
    const token = generateParcelQrToken(parcelId);
    expect(token.startsWith('pb1:')).toBe(true);
    expect(verifyParcelQrToken(token)).toEqual({ valid: true, parcelId });
    expect(verifyParcelQrToken(`${token}tampered`)).toEqual({ valid: false });
  });

  it('hashes OTPs and never stores or compares plaintext directly', () => {
    const { otp, otpHash } = generateOtpPair();
    expect(otp).toMatch(/^\d{6}$/);
    expect(otpHash).not.toContain(otp);
    expect(verifyOtpHash(otp, otpHash)).toBe(true);
    expect(verifyOtpHash('000000', otpHash)).toBe(false);
  });

  it('verifies webhook HMAC signatures and rejects stale timestamps', () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ eventType: 'parcel.dispatched' });
    const sig = `sha256=${signWebhookPayload(ts, body)}`;
    expect(verifyWebhookSignature(ts, body, sig)).toBe(true);

    const oldTs = String(Math.floor(Date.now() / 1000) - 9999);
    expect(verifyWebhookSignature(oldTs, body, sig)).toBe(false);
  });
});
