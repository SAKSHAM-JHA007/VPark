// Integration harness for the security regression tests.
//
// Each test file runs in its own process (node --test default), so this sets up an
// isolated data directory and test configuration *before* the app modules load.
// The developer's real .data directory is never read or written.
import './register-ts.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const TEST_PROJECT_ID = 'vpark-test-project';
export const ADMIN_UID = 'allowlisted-admin-uid-0001';
export const ORIGIN = 'http://localhost:3000';
export const SESSION_COOKIE = 'vpark_session';

/**
 * @param {{ redis?: { url: string, token: string }, sessionSecret?: string, dataDir?: string }} [options]
 *   redis: point the app's session store at a (fake) Upstash REST server instead of
 *   the local development store.
 */
export async function setupApp({ redis, sessionSecret, dataDir: givenDataDir } = {}) {
  const dataDir = givenDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'vpark-security-test-'));
  process.env.VPARK_DATA_DIR = dataDir;
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = sessionSecret || crypto.randomBytes(48).toString('base64url');
  process.env.FIREBASE_PROJECT_ID = TEST_PROJECT_ID;
  process.env.VPARK_ADMIN_FIREBASE_UIDS = ADMIN_UID;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'VPARK_SESSION_STORE']) {
    delete process.env[k];
  }
  if (redis) {
    process.env.UPSTASH_REDIS_REST_URL = redis.url;
    process.env.UPSTASH_REDIS_REST_TOKEN = redis.token;
  }

  const { NextRequest } = await import('next/server.js');
  const { db } = await import('../../src/lib/db.ts');
  const auth = await import('../../src/lib/auth.ts');

  function request(method, url, { token, cookie, body, origin = ORIGIN, headers = {} } = {}) {
    const h = new Headers({ host: 'localhost:3000', ...headers });
    if (origin) h.set('origin', origin);
    const cookies = [];
    if (token) cookies.push(`${SESSION_COOKIE}=${token}`);
    if (cookie) cookies.push(cookie);
    if (cookies.length) h.set('cookie', cookies.join('; '));
    let payload;
    if (body !== undefined) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      h.set('content-type', 'application/json');
    }
    return new NextRequest(`${ORIGIN}${url}`, { method, headers: h, body: payload });
  }

  async function sessionFor(userId) {
    return (await auth.getSessionManager().createSession({ userId })).token;
  }

  function cleanup() {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }

  return { db, auth, NextRequest, request, sessionFor, dataDir, cleanup };
}

/** Read a JSON response body and status. */
export async function read(res) {
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON body
  }
  return { status: res.status, json, text };
}

/** Session token set by a response, if any. */
export function sessionTokenFrom(res) {
  return res.cookies.get(SESSION_COOKIE)?.value || undefined;
}

/** Recursively collect every [path, value] pair in a JSON value. */
export function walk(value, prefix = '$', out = []) {
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, `${prefix}.${k}`, out);
  } else {
    out.push([prefix, value]);
  }
  return out;
}

/** Create a verified listing directly in the database (test fixture). */
export function seedVerifiedListing(db, overrides = {}) {
  const listing = db.createListing({
    title: 'Covered stilt bay',
    description: 'Private bay at 42 Secret Lane next to the blue gate.',
    providerId: 'usr_owner_1',
    providerName: 'Suresh Sharma',
    providerType: 'OWNER',
    providerSituation: 'HOUSE_OWNER',
    category: 'PRIVATE',
    address: '42 Secret Lane, 3rd Cross, Yelahanka New Town',
    locality: 'Yelahanka New Town',
    city: 'Bengaluru',
    latitude: 13.1002,
    longitude: 77.5952,
    landmark: 'Opposite blue gate house #42',
    totalCapacity: 2,
    vehicleTypes: ['SEDAN', 'SUV'],
    capacityBreakdown: { twoWheeler: 0, hatchback: 2, sedan: 2, suv: 2, ev: 0 },
    isCovered: true,
    hasEvCharging: false,
    pricing: { hourlyRate: 40, dailyRate: 240, monthlyRate: 2500, currency: 'INR' },
    accessMethod: 'LOCKBOX_KEY',
    accessInstructions: 'Lockbox code 4321, key opens the side gate.',
    houseRules: ['Park within lines'],
    photos: ['https://example.com/a.jpg', 'https://example.com/b.jpg', 'https://example.com/c.jpg'],
    operatingHours: { is24x7: true, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
    availabilityConfidence: 'PROVIDER_MANAGED',
    lastConfirmedAt: new Date().toISOString(),
    isBookable: true,
    initialStatus: 'PENDING_REVIEW',
    documents: [
      {
        id: `doc_test_${Math.random().toString(36).slice(2, 8)}`,
        listingId: '',
        providerId: 'usr_owner_1',
        docType: 'SALE_DEED',
        fileName: 'sale-deed-42-secret-lane.pdf',
        fileUrl: '',
        storageKey: 'secret-storage-key.pdf',
        status: 'PENDING',
        uploadedAt: new Date().toISOString(),
      },
    ],
    ...overrides,
  });
  // Seeding at the database layer (the seeded admin record is fine for fixtures).
  const res = db.adminUpdateListingStatus('usr_admin_1', listing.id, 'VERIFIED');
  if (!res.success) throw new Error(`fixture: ${res.error}`);
  return db.getListingById(listing.id);
}
