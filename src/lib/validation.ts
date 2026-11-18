import {
  normalizeIndianPhone,
  validatePhoneNumber as validatePhoneFn,
  normalizePlateNumber as normalizePlateFn,
  validatePlateNumber as validatePlateFn,
  formatPlateNumber as formatPlateFn,
} from './engine.mjs';

export { normalizeIndianPhone };

export function validatePhoneNumber(phone: string): boolean {
  return validatePhoneFn(phone);
}

export function normalizePlateNumber(raw: string): string {
  return normalizePlateFn(raw);
}

export function validatePlateNumber(plate: string): boolean {
  return validatePlateFn(plate);
}

export function formatPlateNumber(plate: string): string {
  return formatPlateFn(plate);
}
