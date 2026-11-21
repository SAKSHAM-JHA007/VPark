// "Use my current location": browser geolocation outcomes, the search request built
// from the GPS centre, the in-memory hand-off, and real searches through /api/search.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { read, seedVerifiedListing, setupApp } from './support/harness.mjs';

const app = await setupApp();
const { db, request } = app;
const { GET: search } = await import('../src/app/api/search/route.ts');
const geo = await import('../src/lib/location/geo.ts');
const { pickLocality } = await import('../src/lib/location/locality.ts');
const { searchLocationStore, centerOf } = await import('../src/lib/location/searchLocationStore.ts');

const YELAHANKA_FIX = { lat: 13.10213, lng: 77.59871 };
const MG_ROAD_FIX = { lat: 12.97561, lng: 77.60502 }; // ~14 km south: outside the pilot

function fakeGeolocation(behaviour) {
  const calls = [];
  return {
    calls,
    getCurrentPosition(success, error, options) {
      calls.push(options);
      behaviour(success, error);
    },
  };
}

describe('requestCurrentPosition', () => {
  it('returns the fix when permission is granted', async () => {
    const g = fakeGeolocation((ok) => ok({ coords: { latitude: 13.1, longitude: 77.59, accuracy: 24.6 } }));
    const result = await geo.requestCurrentPosition({ geolocation: g, isSecureContext: true });
    assert.deepEqual(result, { ok: true, position: { lat: 13.1, lng: 77.59, accuracyM: 25 } });
    assert.equal(g.calls.length, 1);
    assert.ok(g.calls[0].timeout > 0, 'a timeout is always requested');
  });

  for (const [code, reason] of [
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ]) {
    it(`maps error code ${code} to "${reason}"`, async () => {
      const g = fakeGeolocation((_ok, fail) => fail({ code }));
      assert.deepEqual(await geo.requestCurrentPosition({ geolocation: g, isSecureContext: true }), { ok: false, reason });
    });
  }

  it('reports an unsupported browser without throwing', async () => {
    assert.deepEqual(await geo.requestCurrentPosition({ geolocation: null }), { ok: false, reason: 'unsupported' });
  });

  it('refuses insecure (http) contexts before prompting', async () => {
    const g = fakeGeolocation(() => assert.fail('must not prompt'));
    assert.deepEqual(await geo.requestCurrentPosition({ geolocation: g, isSecureContext: false }), { ok: false, reason: 'insecure' });
  });

  it('times out if the browser never answers (ignored permission prompt)', async () => {
    const g = fakeGeolocation(() => {});
    const result = await geo.requestCurrentPosition({ geolocation: g, isSecureContext: true, timeoutMs: 10 });
    assert.deepEqual(result, { ok: false, reason: 'timeout' });
  });

  it('treats non-numeric coordinates as unavailable', async () => {
    const g = fakeGeolocation((ok) => ok({ coords: { latitude: NaN, longitude: 77.5 } }));
    assert.deepEqual(await geo.requestCurrentPosition({ geolocation: g }), { ok: false, reason: 'unavailable' });
  });
});

describe('search request from a GPS centre', () => {
  it('rounds device coordinates to ~110 m before they leave the browser', () => {
    const qs = new URLSearchParams(geo.buildSearchQuery({ lat: 13.1021349, lng: 77.5987112 }, 5));
    assert.equal(qs.get('lat'), '13.102');
    assert.equal(qs.get('lng'), '77.599');
    assert.equal(qs.get('radius'), '5');
    assert.equal(qs.get('sortBy'), 'DISTANCE_NEAR');
  });

  it('never asks for more than the API maximum radius of 25 km', () => {
    assert.equal(new URLSearchParams(geo.buildSearchQuery(YELAHANKA_FIX, 100)).get('radius'), '25');
    assert.equal(new URLSearchParams(geo.buildSearchQuery(YELAHANKA_FIX, -3)).get('radius'), String(geo.DEFAULT_SEARCH_RADIUS_KM));
    assert.ok(geo.SEARCH_RADIUS_OPTIONS_KM.every((km) => km <= geo.MAX_SEARCH_RADIUS_KM));
  });

  it('maps filters onto the existing API parameters', () => {
    const qs = new URLSearchParams(
      geo.buildSearchQuery(YELAHANKA_FIX, 10, { category: 'Private', price: 'Under40', vehicle: 'EV', cover: 'Covered', sort: 'LowestPrice' })
    );
    assert.equal(qs.get('category'), 'PRIVATE');
    assert.equal(qs.get('maxPrice'), '40');
    assert.equal(qs.get('vehicleType'), 'EV');
    assert.equal(qs.get('isCovered'), 'true');
    assert.equal(qs.get('sortBy'), 'PRICE_LOW');
  });

  it('classifies empty results: outside coverage, filtered, or simply none nearby', () => {
    const none = geo.DEFAULT_FILTERS;
    assert.equal(geo.classifyEmptyResults({ center: MG_ROAD_FIX, filters: none, isDeviceLocation: true }), 'outsideCoverage');
    assert.equal(geo.classifyEmptyResults({ center: YELAHANKA_FIX, filters: none, isDeviceLocation: true }), 'noneNearby');
    assert.equal(
      geo.classifyEmptyResults({ center: YELAHANKA_FIX, filters: { ...none, cover: 'Open' }, isDeviceLocation: false }),
      'filters'
    );
  });

  it('labels a fix by the nearest pilot landmark only when it is close', () => {
    const near = geo.nearestAnchor(YELAHANKA_FIX);
    assert.ok(near.km < geo.NEAR_ANCHOR_KM);
    assert.ok(geo.nearestAnchor(MG_ROAD_FIX).km > geo.NEAR_ANCHOR_KM);
  });

  it('picks a neighbourhood from reverse geocoding results, never a street address', () => {
    const results = [
      {
        address_components: [
          { long_name: '42', types: ['street_number'] },
          { long_name: '3rd Cross Road', types: ['route'] },
          { long_name: 'Yelahanka New Town', types: ['sublocality_level_1', 'sublocality'] },
          { long_name: 'Bengaluru', types: ['locality'] },
        ],
      },
    ];
    assert.equal(pickLocality(results), 'Yelahanka New Town');
    assert.equal(pickLocality([{ address_components: [{ long_name: 'Bengaluru', types: ['locality'] }] }]), 'Bengaluru');
    assert.equal(pickLocality([]), null);
  });
});

describe('results heading', () => {
  it('never reports "0 parking spaces" when the search request failed', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../src/components/VParkApp.tsx', import.meta.url), 'utf8');
    assert.match(src, /: searchError\s*\?\s*t\('search\.empty\.errorTitle'\)\s*:\s*tn\('search\.results'/);
  });
});

describe('manual fallback and in-memory hand-off', () => {
  it('switches between a device location and pilot landmarks', () => {
    const seen = [];
    const unsubscribe = searchLocationStore.subscribe(() => seen.push(searchLocationStore.get().kind));
    searchLocationStore.setDevice({ ...YELAHANKA_FIX, accuracyM: 30, label: null, nearAnchorId: null });
    assert.deepEqual(centerOf(searchLocationStore.get()), YELAHANKA_FIX);
    searchLocationStore.setDeviceLabel('Yelahanka');
    assert.equal(searchLocationStore.get().label, 'Yelahanka');
    searchLocationStore.setAnchor('anchor-yelahanka-station');
    assert.equal(searchLocationStore.get().kind, 'anchor');
    searchLocationStore.setAnchor('not-a-real-anchor');
    assert.equal(searchLocationStore.get().anchorId, 'anchor-mother-dairy');
    unsubscribe();
    assert.deepEqual(seen, ['device', 'device', 'anchor', 'anchor']);
  });

  it('never writes the device position to browser storage', () => {
    const touched = [];
    const trap = new Proxy({}, { get: (_t, prop) => (touched.push(String(prop)), () => null) });
    globalThis.localStorage = trap;
    globalThis.sessionStorage = trap;
    try {
      searchLocationStore.setDevice({ ...MG_ROAD_FIX, accuracyM: 10, label: null, nearAnchorId: null });
      searchLocationStore.setDeviceLabel('MG Road');
      searchLocationStore.reset();
    } finally {
      delete globalThis.localStorage;
      delete globalThis.sessionStorage;
    }
    assert.deepEqual(touched, []);
  });
});

describe('GET /api/search with a GPS centre (real records)', () => {
  let listing;
  before(async () => {
    listing = await seedVerifiedListing(db);
  });
  after(() => app.cleanup());

  async function searchFrom(center, radiusKm) {
    return read(await search(request('GET', `/api/search?${geo.buildSearchQuery(center, radiusKm)}`)));
  }

  it('returns the verified listing near the device position, with an approximate location only', async () => {
    const { status, json } = await searchFrom(YELAHANKA_FIX, 5);
    assert.equal(status, 200);
    const item = json.data.find((d) => d.listing.id === listing.id);
    assert.ok(item, 'the stored listing is returned');
    assert.equal(item.listing.locationPrecision, 'APPROXIMATE');
    assert.equal(item.listing.address, undefined);
    assert.notEqual(item.listing.latitude, listing.latitude);
    assert.equal(json.searchCenter.lat, 13.102);
  });

  it('returns nothing outside the pilot within 5 km (no fabricated spaces)', async () => {
    const { json } = await searchFrom(MG_ROAD_FIX, 5);
    assert.equal(json.count, 0);
    assert.deepEqual(json.data, []);
  });

  it('finds the pilot listing again only when the user widens to 25 km', async () => {
    const { json } = await searchFrom(MG_ROAD_FIX, 25);
    assert.equal(json.searchCenter.radiusKm, 25);
    assert.ok(json.data.some((d) => d.listing.id === listing.id));
  });
});
