// Regression tests: exact parking locations must not leak before a qualifying booking.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_UID, read, seedVerifiedListing, setupApp, walk } from './support/harness.mjs';

const app = await setupApp();
const { db, request, sessionFor } = app;
const { GET: search } = await import('../src/app/api/search/route.ts');
const bookingsRoute = await import('../src/app/api/bookings/route.ts');
const bookingRoute = await import('../src/app/api/bookings/[id]/route.ts');
const exportRoute = await import('../src/app/api/user/export/route.ts');
const privacy = await import('../src/lib/security/listing-privacy.mjs');

const EXACT = { lat: 13.1002, lng: 77.5952 };
let privateListing;
let publicListing;
let adminUserId;
let otherDriverId;

// Strings that must never appear in a discovery response for a private listing.
const SECRET_STRINGS = [
  '42 Secret Lane',
  'Opposite blue gate',
  'Lockbox code 4321',
  'sale-deed-42-secret-lane.pdf',
  'secret-storage-key',
  'Suresh Sharma',
  'usr_owner_1',
  'HOUSE_OWNER',
];
const FORBIDDEN_KEYS = new Set([
  'address',
  'landmark',
  'documents',
  'providerId',
  'providerSituation',
  'storageKey',
  'fileUrl',
  'description',
  'reviewReason',
]);

async function searchAs(query, token) {
  return read(await search(request('GET', `/api/search?${query}`, { token })));
}

async function createBooking(token, listingId, hoursFromNow = 4) {
  const start = new Date(Date.now() + hoursFromNow * 3600_000);
  const end = new Date(start.getTime() + 2 * 3600_000);
  return read(
    await bookingsRoute.POST(
      request('POST', '/api/bookings', {
        token,
        body: {
          listingId,
          vehicleType: 'SEDAN',
          vehiclePlateNumber: 'KA-04-MB-1234',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          paymentMethod: 'UPI',
        },
      })
    )
  );
}

async function getBooking(id, token) {
  return read(await bookingRoute.GET(request('GET', `/api/bookings/${id}`, { token }), { params: { id } }));
}

before(() => {
  privateListing = seedVerifiedListing(db);
  publicListing = seedVerifiedListing(db, {
    title: 'Surveyed on-street bays',
    category: 'PUBLIC',
    providerName: 'VPark Survey Team',
    address: 'Service Road, Sector 4',
    landmark: 'Next to the bus stop',
    latitude: 13.1012,
    longitude: 77.5961,
    accessInstructions: 'Free parallel parking along the service road.',
    isBookable: false,
    documents: [],
  });
  const admin = db.upsertVerifiedGoogleUser({ uid: ADMIN_UID, email: 'ops-admin@example.com', grantAdmin: true });
  adminUserId = admin.user.id;
  const other = db.upsertVerifiedGoogleUser({ uid: 'other-driver-uid', email: 'other.driver@example.com', grantAdmin: false });
  otherDriverId = other.user.id;
});

after(() => app.cleanup());

describe('Public search (anonymous)', () => {
  it('does not return the exact coordinates of a private listing', async () => {
    const { status, json } = await searchAs(`lat=${EXACT.lat}&lng=${EXACT.lng}&radius=5`);
    assert.equal(status, 200);
    const item = json.data.find((d) => d.listing.id === privateListing.id);
    assert.ok(item, 'private listing should still be discoverable');
    assert.equal(item.listing.locationPrecision, 'APPROXIMATE');
    assert.notEqual(item.listing.latitude, EXACT.lat);
    assert.notEqual(item.listing.longitude, EXACT.lng);
    // (searchCenter merely echoes the caller's own query, so only the results are checked.)
    for (const [p, v] of walk(json.data)) {
      if (typeof v === 'number') {
        assert.ok(Math.abs(v - EXACT.lat) > 1e-6 && Math.abs(v - EXACT.lng) > 1e-6, `exact coordinate leaked at ${p}`);
      }
    }
  });

  it('does not return the street address, landmark, access code or provider identity', async () => {
    const { text } = await searchAs(`lat=${EXACT.lat}&lng=${EXACT.lng}&radius=5&category=PRIVATE`);
    for (const secret of SECRET_STRINGS) {
      assert.ok(!text.includes(secret), `search response leaked "${secret}"`);
    }
  });

  it('does not leak sensitive fields through nested objects', async () => {
    const { json } = await searchAs(`lat=${EXACT.lat}&lng=${EXACT.lng}&radius=5&category=PRIVATE`);
    assert.ok(json.data.length > 0);
    for (const [p] of walk(json)) {
      const key = p.split('.').pop();
      assert.ok(!FORBIDDEN_KEYS.has(key), `forbidden field ${p} present in search response`);
    }
  });

  it('returns a stable approximation that does not reveal the real point', async () => {
    const a = (await searchAs(`lat=${EXACT.lat}&lng=${EXACT.lng}&radius=5`)).json.data.find((d) => d.listing.id === privateListing.id);
    const b = (await searchAs('lat=13.12&lng=77.58&radius=10')).json.data.find((d) => d.listing.id === privateListing.id);
    assert.deepEqual([a.listing.latitude, a.listing.longitude], [b.listing.latitude, b.listing.longitude]);

    // Any real point in the same ~550 m cell maps to the same public point.
    const moved = privacy.approximateCoordinates(EXACT.lat + 0.002, EXACT.lng + 0.002, privateListing.id);
    assert.deepEqual([moved.latitude, moved.longitude], [a.listing.latitude, a.listing.longitude]);

    // ...and it is a deliberate offset (more than 100 m) rather than noise around the pin.
    const offsetKm = privacy.discoveryDistanceKm(privateListing, EXACT.lat, EXACT.lng);
    assert.ok(offsetKm >= 0.1, `approximation too close to the real pin (${offsetKm} km)`);
  });

  it('cannot be triangulated with distance values or radius filters', async () => {
    // Distance is reported to the approximate point, not to the real one.
    const { json } = await searchAs(`lat=${EXACT.lat}&lng=${EXACT.lng}&radius=5`);
    const item = json.data.find((d) => d.listing.id === privateListing.id);
    assert.equal(item.distanceKm, privacy.discoveryDistanceKm(privateListing, EXACT.lat, EXACT.lng));
    assert.ok(item.distanceKm > 0);
    assert.equal(item.ranking.distanceKm, item.distanceKm);

    // A tiny radius centred on the exact pin does not "find" the listing.
    const tiny = await searchAs(`lat=${EXACT.lat}&lng=${EXACT.lng}&radius=0.1`);
    assert.ok(!tiny.json.data.some((d) => d.listing.id === privateListing.id));

    // A tiny radius centred on the published approximate point does.
    const atApprox = await searchAs(`lat=${item.listing.latitude}&lng=${item.listing.longitude}&radius=0.1`);
    assert.ok(atApprox.json.data.some((d) => d.listing.id === privateListing.id));
  });

  it('treats PUBLIC (discovery-only) listings as exact but still hides provider/document data', async () => {
    const { json } = await searchAs('lat=13.1012&lng=77.5961&radius=5&category=PUBLIC');
    const item = json.data.find((d) => d.listing.id === publicListing.id);
    assert.ok(item);
    assert.equal(item.listing.locationPrecision, 'EXACT');
    assert.equal(item.listing.latitude, 13.1012);
    assert.equal(item.listing.landmark, 'Next to the bus stop');
    assert.equal(item.listing.isBookable, false);
    assert.equal(item.listing.providerId, undefined);
    assert.equal(item.listing.documents, undefined);
  });

  it('ignores non-numeric coordinates instead of disabling the radius filter', async () => {
    const { status, json } = await searchAs('lat=abc&lng=NaN&radius=Infinity');
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.data));
  });
});

describe('Post-booking location access', () => {
  let bookingId;
  let driverToken;

  before(async () => {
    driverToken = await sessionFor('usr_driver_1');
    const res = await createBooking(driverToken, privateListing.id);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    bookingId = res.json.booking.id;
  });

  it('gives the booking driver the exact address, pin and access instructions', async () => {
    const { status, json } = await getBooking(bookingId, driverToken);
    assert.equal(status, 200);
    assert.equal(json.booking.locationRevealed, true);
    assert.equal(json.booking.listingAddress, privateListing.address);
    assert.equal(json.booking.listingLatitude, EXACT.lat);
    assert.equal(json.booking.listingAccessInstructions, privateListing.accessInstructions);
    // The listing object a driver receives is still the public projection.
    assert.equal(json.listing.documents, undefined);
    assert.equal(json.listing.providerId, undefined);
  });

  it('refuses the booking to anonymous callers and to unrelated drivers or providers', async () => {
    assert.equal((await getBooking(bookingId)).status, 401);
    assert.equal((await getBooking(bookingId, await sessionFor(otherDriverId))).status, 403);
    assert.equal((await getBooking(bookingId, await sessionFor('usr_owner_2'))).status, 403);

    const list = await read(await bookingsRoute.GET(request('GET', '/api/bookings', { token: await sessionFor(otherDriverId) })));
    assert.ok(!list.text.includes(privateListing.address));
  });

  it('keeps the listing provider and an allowlisted admin able to see the full record', async () => {
    const provider = await getBooking(bookingId, await sessionFor('usr_owner_1'));
    assert.equal(provider.status, 200);
    assert.equal(provider.json.listing.address, privateListing.address);
    assert.equal(provider.json.booking.listingLatitude, EXACT.lat);

    const admin = await getBooking(bookingId, await sessionFor(adminUserId));
    assert.equal(admin.status, 200);
    assert.equal(admin.json.listing.address, privateListing.address);
  });

  it('does not treat a stored ADMIN role without an allowlisted UID as admin', async () => {
    const legacyAdmin = await getBooking(bookingId, await sessionFor('usr_admin_1'));
    assert.equal(legacyAdmin.status, 403);
  });

  it('withdraws the exact location from the driver once the booking is cancelled', async () => {
    const created = await createBooking(driverToken, privateListing.id, 30);
    const id = created.json.booking.id;
    const cancel = await read(
      await bookingRoute.PATCH(request('PATCH', `/api/bookings/${id}`, { token: driverToken, body: { action: 'CANCEL' } }), {
        params: { id },
      })
    );
    assert.equal(cancel.status, 200);
    assert.equal(cancel.json.booking.locationRevealed, false);

    const after = await getBooking(id, driverToken);
    assert.equal(after.json.booking.locationRevealed, false);
    assert.ok(!after.text.includes('42 Secret Lane'));
    assert.ok(!after.text.includes('Lockbox code'));
    assert.equal(after.json.booking.listingLatitude, undefined);

    const exported = await read(await exportRoute.GET(request('GET', '/api/user/export', { token: driverToken })));
    const cancelledInExport = JSON.parse(exported.text).bookings.find((b) => b.id === id);
    assert.equal(cancelledInExport.listingLatitude, undefined);
  });

  it('does not let a provider perform driver-only actions on a booking', async () => {
    const res = await read(
      await bookingRoute.PATCH(
        request('PATCH', `/api/bookings/${bookingId}`, { token: await sessionFor('usr_owner_1'), body: { action: 'EXTEND', additionalHours: 5 } }),
        { params: { id: bookingId } }
      )
    );
    assert.equal(res.status, 403);
  });
});
