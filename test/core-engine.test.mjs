import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeIndianPhone,
  calculateDistance,
  calculatePricingPaise,
  calculateCancellationRefundPaise,
  isListingStale,
  calculateRankingScore,
  hasCapability,
} from '../src/lib/engine.mjs';
import { hashOtp, verifyOtpHash } from '../src/lib/otp-crypto.mjs';

function checkSlotAvailability({ totalCapacity, existingBookings, activeHolds, requestStart, requestEnd }) {
  const overlappingBookings = existingBookings.filter(
    (b) => requestStart < b.endTime && requestEnd > b.startTime
  );
  const nowIso = new Date().toISOString();
  const overlappingHolds = activeHolds.filter(
    (h) => h.expiresAt > nowIso && requestStart < h.endTime && requestEnd > h.startTime
  );
  return Math.max(0, totalCapacity - overlappingBookings.length - overlappingHolds.length);
}

describe('VPark Foundation PRD Core Engine (Live Imported Module)', () => {
  test('PRD 6.2 & 6.5: E.164 phone normalization (+91 default & extensible)', () => {
    assert.equal(normalizeIndianPhone('9876543210'), '+919876543210');
    assert.equal(normalizeIndianPhone('+91 98765-43210'), '+919876543210');
    assert.equal(normalizeIndianPhone('09876543210'), '+919876543210');
    assert.equal(normalizeIndianPhone('919876543210'), '+919876543210');
    assert.equal(normalizeIndianPhone('+447911123456'), '+447911123456');
    assert.equal(normalizeIndianPhone('12345'), null);
    assert.equal(normalizeIndianPhone('abc'), null);
  });

  test('PRD 6.4: SHA-256 OTP challenge hashing and timing-safe verification', () => {
    const phone = '+919876543210';
    const salt = 'otp_challenge_1';
    const code = '123456';
    const hash = hashOtp(phone, code, salt);

    assert.notEqual(hash, code, 'Stored OTP must be hashed, never plaintext');
    assert.equal(verifyOtpHash(phone, '123456', salt, hash), true);
    assert.equal(verifyOtpHash(phone, '999999', salt, hash), false);
    assert.equal(verifyOtpHash('+919000000001', '123456', salt, hash), false);
    assert.equal(verifyOtpHash(phone, '123456', 'other_salt', hash), false);
  });

  test('PRD 8.2: Haversine distance accuracy in Yelahanka micro-market', () => {
    const dist = calculateDistance(13.0998, 77.5971, 13.1114, 77.5849);
    assert.ok(dist >= 1.5 && dist <= 2.2, `Distance should be ~1.85km, got ${dist}`);
    assert.equal(calculateDistance(13.0998, 77.5971, 13.0998, 77.5971), 0);
  });

  test('PRD 8.2: Dynamic >30-day staleness check and ranking penalty', () => {
    const now = Date.parse('2026-11-11T12:00:00Z');
    const freshDate = '2026-11-05T12:00:00Z';
    const staleDate = '2026-10-01T12:00:00Z';

    assert.equal(isListingStale(freshDate, 30, now), false);
    assert.equal(isListingStale(staleDate, 30, now), true);

    const freshScore = calculateRankingScore({
      distanceKm: 0.5,
      hourlyRate: 40,
      isVerified: true,
      confidence: 'PROVIDER_MANAGED',
      rating: 4.9,
      isStale: false,
    });

    const staleScore = calculateRankingScore({
      distanceKm: 0.5,
      hourlyRate: 40,
      isVerified: true,
      confidence: 'PROVIDER_MANAGED',
      rating: 4.9,
      isStale: true,
    });

    assert.ok(freshScore > staleScore);
    assert.equal(Math.round((freshScore - staleScore) * 100) / 100, 0.25);
  });

  test('PRD 9.2: Integer paise pricing calculation (never float arithmetic)', () => {
    const pricing = calculatePricingPaise(
      6000, // ₹60/hr in paise
      '2026-11-11T10:00:00Z',
      '2026-11-11T13:00:00Z'
    );

    assert.equal(pricing.durationHours, 3);
    assert.equal(pricing.parkingFeePaise, 18000);
    assert.equal(pricing.platformFeePaise, 2160);
    assert.equal(pricing.cgstPaise, 194);
    assert.equal(pricing.sgstPaise, 194);
    assert.equal(pricing.totalAmountPaise, 20548);
    assert.equal(pricing.totalAmount, 205.48);
  });

  test('Overbooking prevention and expired hold cleanup', () => {
    const totalCapacity = 2;
    const existingBookings = [
      { startTime: '2026-11-10T14:00:00Z', endTime: '2026-11-10T17:00:00Z' },
    ];
    const activeHolds = [
      {
        startTime: '2026-11-10T15:00:00Z',
        endTime: '2026-11-10T18:00:00Z',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      },
      {
        startTime: '2026-11-10T15:00:00Z',
        endTime: '2026-11-10T18:00:00Z',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      },
    ];

    const availableBusy = checkSlotAvailability({
      totalCapacity,
      existingBookings,
      activeHolds,
      requestStart: '2026-11-10T15:30:00Z',
      requestEnd: '2026-11-10T16:30:00Z',
    });
    assert.equal(availableBusy, 0);

    const availableFree = checkSlotAvailability({
      totalCapacity,
      existingBookings,
      activeHolds,
      requestStart: '2026-11-10T18:00:00Z',
      requestEnd: '2026-11-10T20:00:00Z',
    });
    assert.equal(availableFree, 2);
  });

  test('Cancellation refund policy in integer paise', () => {
    const parkingFeePaise = 16000;
    const totalAmountPaise = 18266;

    assert.equal(
      calculateCancellationRefundPaise({
        hoursBeforeStart: 3,
        parkingFeePaise,
        totalAmountPaise,
        cancelledBy: 'DRIVER',
      }),
      16000
    );

    assert.equal(
      calculateCancellationRefundPaise({
        hoursBeforeStart: 1,
        parkingFeePaise,
        totalAmountPaise,
        cancelledBy: 'DRIVER',
      }),
      8000
    );

    assert.equal(
      calculateCancellationRefundPaise({
        hoursBeforeStart: 1,
        parkingFeePaise,
        totalAmountPaise,
        cancelledBy: 'PROVIDER',
      }),
      18266
    );
  });

  test('PRD 6.6: Single-account capability checks and soft-delete enforcement', () => {
    const driverOnly = { id: 'u1', roles: ['DRIVER'], accountStatus: 'ACTIVE', deletedAt: null };
    const dualUser = { id: 'u2', roles: ['DRIVER', 'PROVIDER'], accountStatus: 'ACTIVE', deletedAt: null };
    const deletedUser = { id: 'u3', roles: ['DRIVER', 'PROVIDER'], accountStatus: 'DELETION_PENDING', deletedAt: '2026-11-11T00:00:00Z' };

    assert.equal(hasCapability(driverOnly, 'DRIVER'), true);
    assert.equal(hasCapability(driverOnly, 'PROVIDER'), false);
    assert.equal(hasCapability(driverOnly, 'ADMIN'), false);

    assert.equal(hasCapability(dualUser, 'DRIVER'), true);
    assert.equal(hasCapability(dualUser, 'PROVIDER'), true);

    assert.equal(hasCapability(deletedUser, 'DRIVER'), false);
    assert.equal(hasCapability(null, 'DRIVER'), false);
  });
});
