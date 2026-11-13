import crypto from 'node:crypto';

export function hashOtp(phone, code, salt) {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${phone}:${code}`)
    .digest('hex');
}

export function verifyOtpHash(phone, code, salt, expectedHash) {
  if (typeof code !== 'string' || !expectedHash || typeof expectedHash !== 'string') {
    return false;
  }
  const actualHash = hashOtp(phone, code.trim(), salt);
  const a = Buffer.from(actualHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

