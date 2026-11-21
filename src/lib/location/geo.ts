/**
 * Location helpers for parking discovery. Pure functions: no React, no storage,
 * no network. The browser Geolocation API is injected so the success and failure
 * paths are unit-tested in Node.
 *
 * Privacy model
 * - The driver's own GPS fix is used only to centre the active search. It is kept in
 *   memory (see searchLocationStore.ts), never written to localStorage, cookies,
 *   analytics, the user profile or the URL.
 * - Before it leaves the device for the search API it is rounded to 3 decimal places
 *   (~110 m), which is ample for a kilometre-scale radius search.
 * - Parking-owner locations are a separate matter: the search API keeps returning
 *   privacy-safe approximate points for non-public listings (listing-privacy.mjs).
 */

import { YELAHANKA_ANCHORS, APP_CONFIG, type DemandAnchor } from '@/lib/constants';

export interface LatLng {
  lat: number;
  lng: number;
}

/** The search API caps the radius here (src/app/api/search/route.ts). Never exceed it. */
export const MAX_SEARCH_RADIUS_KM = 25;
export const DEFAULT_SEARCH_RADIUS_KM = 5;
export const SEARCH_RADIUS_OPTIONS_KM = [2, 5, 10, 25] as const;
/** Searches centred further than this from the pilot centre are "outside coverage". */
export const PILOT_COVERAGE_KM = 10;
export const PILOT_CENTER: LatLng = { lat: APP_CONFIG.defaultCenter.lat, lng: APP_CONFIG.defaultCenter.lng };
/** A landmark name is used as a label only when the fix is this close to it. */
export const NEAR_ANCHOR_KM = 1.5;
export const GEOLOCATION_TIMEOUT_MS = 12000;

export function clampRadiusKm(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SEARCH_RADIUS_KM;
  return Math.min(value, MAX_SEARCH_RADIUS_KM);
}

/** Round a coordinate before it is sent anywhere (3 dp ≈ 110 m). */
export function roundCoordinate(value: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isWithinPilotCoverage(point: LatLng): boolean {
  return haversineKm(point, PILOT_CENTER) <= PILOT_COVERAGE_KM;
}

export function nearestAnchor(point: LatLng, anchors: readonly DemandAnchor[] = YELAHANKA_ANCHORS) {
  let best: { anchor: DemandAnchor; km: number } | null = null;
  for (const anchor of anchors) {
    const km = haversineKm(point, { lat: anchor.latitude, lng: anchor.longitude });
    if (!best || km < best.km) best = { anchor, km };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Browser geolocation
// ---------------------------------------------------------------------------

export type GeolocationFailure = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout';

export type GeolocationResult =
  | { ok: true; position: LatLng & { accuracyM: number | null } }
  | { ok: false; reason: GeolocationFailure };

interface PositionLike {
  coords: { latitude: number; longitude: number; accuracy?: number | null };
}

interface GeolocationLike {
  getCurrentPosition(
    success: (position: PositionLike) => void,
    error?: (error: { code: number; message?: string }) => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number }
  ): void;
}

export interface GeolocationEnv {
  geolocation?: GeolocationLike | null;
  isSecureContext?: boolean;
  timeoutMs?: number;
}

/** Maps GeolocationPositionError codes (1 denied, 2 unavailable, 3 timeout). */
export function classifyGeolocationError(error: { code?: number } | null | undefined): GeolocationFailure {
  if (error?.code === 1) return 'denied';
  if (error?.code === 3) return 'timeout';
  return 'unavailable';
}

/**
 * Ask the browser for one position fix. Must be called from a user gesture: the app
 * never requests location on page load. Resolves (never rejects) with a typed result.
 */
export function requestCurrentPosition(env: GeolocationEnv): Promise<GeolocationResult> {
  if (env.isSecureContext === false) return Promise.resolve({ ok: false, reason: 'insecure' });
  const geo = env.geolocation;
  if (!geo || typeof geo.getCurrentPosition !== 'function') {
    return Promise.resolve({ ok: false, reason: 'unsupported' });
  }
  const timeout = env.timeoutMs ?? GEOLOCATION_TIMEOUT_MS;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: GeolocationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      resolve(result);
    };
    // Some browsers never call back when the permission prompt is ignored.
    const guard = setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeout + 2000);
    try {
      geo.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            finish({ ok: false, reason: 'unavailable' });
            return;
          }
          finish({
            ok: true,
            position: {
              lat: latitude,
              lng: longitude,
              accuracyM: Number.isFinite(accuracy as number) ? Math.round(accuracy as number) : null,
            },
          });
        },
        (err) => finish({ ok: false, reason: classifyGeolocationError(err) }),
        { enableHighAccuracy: false, timeout, maximumAge: 60_000 }
      );
    } catch {
      finish({ ok: false, reason: 'unavailable' });
    }
  });
}

// ---------------------------------------------------------------------------
// Search query (one search system: the existing /api/search endpoint)
// ---------------------------------------------------------------------------

export type CategoryFilter = 'All' | 'Commercial' | 'Private' | 'Public';
export type PriceFilter = 'All' | 'Under40' | 'Under60';
export type VehicleFilter = 'All' | 'SEDAN' | 'SUV' | 'EV' | 'TWO_WHEELER';
export type CoverFilter = 'All' | 'Covered' | 'Open';
export type SortOption = 'Nearest' | 'LowestPrice' | 'HighestRated';

export interface SearchFiltersState {
  category: CategoryFilter;
  price: PriceFilter;
  vehicle: VehicleFilter;
  cover: CoverFilter;
  sort: SortOption;
}

export const DEFAULT_FILTERS: SearchFiltersState = {
  category: 'All',
  price: 'All',
  vehicle: 'All',
  cover: 'All',
  sort: 'Nearest',
};

export function hasActiveFilters(filters: SearchFiltersState): boolean {
  return filters.category !== 'All' || filters.price !== 'All' || filters.vehicle !== 'All' || filters.cover !== 'All';
}

/**
 * Query string for GET /api/search. Device coordinates are rounded here, the radius is
 * clamped to the API maximum, and nothing else about the user is included.
 */
export function buildSearchQuery(center: LatLng, radiusKm: number, filters: SearchFiltersState = DEFAULT_FILTERS): string {
  const params = new URLSearchParams();
  params.set('lat', String(roundCoordinate(center.lat)));
  params.set('lng', String(roundCoordinate(center.lng)));
  params.set('radius', String(clampRadiusKm(radiusKm)));

  if (filters.category === 'Private') params.set('category', 'PRIVATE');
  else if (filters.category === 'Commercial') params.set('category', 'COMMERCIAL');
  else if (filters.category === 'Public') params.set('category', 'PUBLIC');

  if (filters.price === 'Under40') params.set('maxPrice', '40');
  else if (filters.price === 'Under60') params.set('maxPrice', '60');

  if (filters.vehicle !== 'All') params.set('vehicleType', filters.vehicle);

  if (filters.cover === 'Covered') params.set('isCovered', 'true');
  else if (filters.cover === 'Open') params.set('isCovered', 'false');

  if (filters.sort === 'LowestPrice') params.set('sortBy', 'PRICE_LOW');
  else if (filters.sort === 'HighestRated') params.set('sortBy', 'RATING_HIGH');
  else params.set('sortBy', 'DISTANCE_NEAR');

  return params.toString();
}

export type EmptyResultsKind = 'filters' | 'outsideCoverage' | 'noneNearby';

/** Which empty state to show when a search returns no real listings. */
export function classifyEmptyResults(args: {
  center: LatLng;
  filters: SearchFiltersState;
  isDeviceLocation: boolean;
}): EmptyResultsKind {
  if (args.isDeviceLocation && !isWithinPilotCoverage(args.center)) return 'outsideCoverage';
  if (hasActiveFilters(args.filters)) return 'filters';
  return 'noneNearby';
}
