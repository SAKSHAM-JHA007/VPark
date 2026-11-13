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
