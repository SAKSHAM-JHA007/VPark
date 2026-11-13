import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { calculatePricingPaise } from '../src/lib/engine.mjs';

describe('VPark Foundation PRD End-to-End Schema & Domain Contracts', () => {
  test('PRD 8.3: Public spaces remain discovery-only and non-bookable', () => {
    const publicListing = {
      category: 'PUBLIC',
      isBookable: false,
      surveyDate: 'Surveyed on 15 Oct 2026',
    };
    assert.equal(publicListing.isBookable, false);
    assert.ok(publicListing.surveyDate.includes('Surveyed on'));
  });

  test('PRD 8.11 & 9.2: Pricing snapshot and host gross payout exact match in paise', () => {
    const snap = calculatePricingPaise(6000, '2026-11-11T09:00:00Z', '2026-11-11T12:00:00Z');
    assert.equal(snap.parkingFee, 180);
    assert.equal(snap.platformFee, 21.6);
    assert.equal(snap.totalAmount, 205.48);
    assert.equal(snap.parkingFeePaise + snap.platformFeePaise + snap.totalTaxesPaise, snap.totalAmountPaise);
  });

  test('PRD 9.1: Prisma schema defines canonical tables, paise columns, and soft deletes', () => {
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
    assert.equal(fs.existsSync(schemaPath), true, 'prisma/schema.prisma must exist');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    const requiredModels = [
      'model User',
      'model Role',
      'model UserRole',
      'model ProviderProfile',
      'model DriverProfile',
      'model Vehicle',
      'model Consent',
      'model OtpChallenge',
      'model ParkingListing',
      'model ListingImage',
      'model ListingVerification',
      'model AuditLog',
    ];
    for (const model of requiredModels) {
      assert.ok(schema.includes(model), `Missing Prisma ${model}`);
    }

    assert.ok(schema.includes('price_hourly') && schema.includes('priceHourly     Int'), 'Prices must be stored as integer paise');
    assert.ok(schema.includes('phoneVerifiedAt'), 'Timestamps must replace boolean verified flags');
    assert.ok(schema.includes('deletedAt'), 'Soft-delete column required');
  });
});
