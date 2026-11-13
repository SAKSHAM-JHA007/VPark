export function hashOtp(phone: string, code: string, salt: string): string;
export function verifyOtpHash(phone: string, code: string, salt: string, expectedHash: string): boolean;

