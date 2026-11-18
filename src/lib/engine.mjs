/**
 * Normalize an Indian or international phone number to strict E.164 format.
 * Supports 10-digit Indian mobile numbers (default +91) and extensible E.164 numbers (PRD 6.5).
 */
export function normalizeIndianPhone(input) {
  if (typeof input !== 'string') return null;
  const cleaned = input.replace(/[\s\-().]/g, '');
  if (!cleaned) return null;

  // 10-digit Indian mobile starting 6-9
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  // 0-prefixed Indian number
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned.slice(1)}`;
  }
  // 91-prefixed without +
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  // Strict +91 Indian format
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }
  // General extensible E.164 (+ followed by 8 to 15 digits, non-zero start)
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

/**
 * Validates whether a phone number can be normalized into strict E.164 format.
 * Accepts 10-digit Indian numbers starting with 6-9, optionally prefixed by +91, 91, or 0,
 * as well as valid international E.164 numbers.
 */
export function validatePhoneNumber(phone) {
  return normalizeIndianPhone(phone) !== null;
}

/**
 * Strips all non-alphanumeric characters and converts to uppercase.
 */
export function normalizePlateNumber(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

/**
 * Validates Indian vehicle registration plate numbers.
 * Supported formats:
 *  1. Standard State RTO Series:
 *     State code (2 letters) + RTO (1-2 digits) + Series (1-3 letters) + Number (1-4 digits)
 *     e.g., KA-04-MB-1234, DL-01-A-1234, MH-12-AB-9021, KA-51-EV-9021
 *  2. Bharat (BH) Series (MoRTH 2021+):
 *     Year (2 digits) + "BH" + Number (4 digits) + Series (1-2 letters)
 *     e.g., 22-BH-1234-AA
 */
export function validatePlateNumber(plate) {
  if (typeof plate !== 'string') return false;
  const clean = normalizePlateNumber(plate);
  if (!clean || clean.length < 6 || clean.length > 12) return false;

  // 1. Standard Indian State plate: [A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}
  const standardPattern = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/;

  // 2. Bharat (BH) Series: [0-9]{2}BH[0-9]{4}[A-Z]{1,2}
  const bhPattern = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;

  return standardPattern.test(clean) || bhPattern.test(clean);
}

/**
 * Formats a clean alphanumeric plate into standard hyphenated representation (e.g. KA-04-MB-1234).
 */
export function formatPlateNumber(plate) {
  const clean = normalizePlateNumber(plate);
  if (!clean) return '';
  const bhMatch = clean.match(/^([0-9]{2})(BH)([0-9]{4})([A-Z]{1,2})$/);
  if (bhMatch) {
    return `${bhMatch[1]}-${bhMatch[2]}-${bhMatch[3]}-${bhMatch[4]}`;
  }
  const stdMatch = clean.match(/^([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{1,4})$/);
  if (stdMatch) {
    return `${stdMatch[1]}-${stdMatch[2]}-${stdMatch[3]}-${stdMatch[4]}`;
  }
  return clean;
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Pure integer paise pricing computation (PRD Section 9.2: never float arithmetic).
 */
export function calculatePricingPaise(hourlyRatePaise, startTime, endTime) {
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  const durationHours = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60)));

  const safeHourlyPaise = Math.max(0, Math.round(hourlyRatePaise));
  const parkingFeePaise = safeHourlyPaise * durationHours;
  const platformFeePaise = Math.round((parkingFeePaise * 12) / 100);
  const cgstPaise = Math.round((platformFeePaise * 9) / 100);
  const sgstPaise = Math.round((platformFeePaise * 9) / 100);
  const totalTaxesPaise = cgstPaise + sgstPaise;
  const totalAmountPaise = parkingFeePaise + platformFeePaise + totalTaxesPaise;

  return {
    durationHours,
    parkingFeePaise,
    platformFeePaise,
    cgstPaise,
    sgstPaise,
    totalTaxesPaise,
    totalAmountPaise,
    parkingFee: parkingFeePaise / 100,
    platformFee: platformFeePaise / 100,
    cgst: cgstPaise / 100,
    sgst: sgstPaise / 100,
    totalTaxes: totalTaxesPaise / 100,
    totalAmount: totalAmountPaise / 100,
  };
}

export function calculateCancellationRefundPaise({
  hoursBeforeStart,
  parkingFeePaise,
  totalAmountPaise,
  cancelledBy,
}) {
  if (cancelledBy === 'PROVIDER') {
    return Math.round(totalAmountPaise);
  }
  if (hoursBeforeStart >= 2) {
    return Math.round(parkingFeePaise);
  }
  return Math.round((parkingFeePaise * 50) / 100);
}

export function isListingStale(lastConfirmedAt, thresholdDays = 30, nowMs = Date.now()) {
  if (!lastConfirmedAt) return true;
  const confirmedMs = new Date(lastConfirmedAt).getTime();
  if (Number.isNaN(confirmedMs)) return true;
  return nowMs - confirmedMs > thresholdDays * 24 * 60 * 60 * 1000;
}

export function calculateRankingScore({
  distanceKm,
  hourlyRate,
  isVerified,
  confidence,
  rating,
  isStale,
}) {
  const distanceScore = Math.max(0, 1 - distanceKm / 10);
  const priceScore = Math.max(0, 1 - hourlyRate / 150);
  const verificationScore = isVerified ? 1.0 : 0.4;
  const confidenceScore =
    confidence === 'PROVIDER_MANAGED'
      ? 1.0
      : confidence === 'BOOKED_ON_VPARK' || confidence === 'BOOKED_ON_PARKORA'
      ? 0.8
      : 0.3;
  const ratingScore = rating > 0 ? rating / 5.0 : 0.7;
  const stalePenalty = isStale ? 0.25 : 0.0;

  return (
    Math.round(
      (0.35 * distanceScore +
        0.25 * priceScore +
        0.2 * verificationScore +
        0.1 * confidenceScore +
        0.1 * ratingScore -
        stalePenalty) *
        100
    ) / 100
  );
}

export function hasCapability(user, requiredRole) {
  if (!user) return false;
  if (user.accountStatus && user.accountStatus !== 'ACTIVE') return false;
  if (user.deletedAt) return false;
  return Array.isArray(user.roles) && user.roles.includes(requiredRole);
}
