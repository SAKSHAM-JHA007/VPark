// Location privacy for parking listings.
//
// Public discovery responses are built from an explicit allow-list of fields
// (never by spreading a stored Listing). For PRIVATE / COMMERCIAL / OTHER spaces
// the exact pin, street address, landmark, access instructions and provider
// identifiers are withheld until a qualifying booking exists. Discovery uses a
// deterministic approximate point instead, and every location-derived value the
// API returns (distance, radius filter, distance ranking, sort order) is computed
// from that approximate point. Repeating queries with different centres or radii
// therefore cannot triangulate anything finer than the approximation cell.
//
// PUBLIC spaces are surveyed public (on-street) parking. They are discovery-only,
// never bookable, and their exact location is the product: drivers navigate to
// them directly. They still never expose provider identity or private documents.

import crypto from 'node:crypto';
import { calculateDistance } from '../engine.mjs';

/** Size of the approximation grid cell in degrees (~550 m north-south in Bengaluru). */
export const APPROXIMATE_GRID_DEGREES = 0.005;
/** Radius shown to drivers for an approximate location. */
export const APPROXIMATE_RADIUS_METERS = 500;

export const PRIVATE_ACCESS_PLACEHOLDER =
  'Exact address, map pin and entry instructions are shared after your booking is confirmed.';

/** Booking statuses that entitle the booking driver to the exact location. */
export const LOCATION_QUALIFYING_BOOKING_STATUSES = Object.freeze([
  'CONFIRMED',
  'CHECKED_IN',
  'COMPLETED',
  'OVERSTAY',
  'DISPUTED',
]);

export function isExactLocationPublic(listing) {
  return Boolean(listing) && listing.category === 'PUBLIC';
}

function unitFromHash(buf, offset) {
  return buf.readUInt32BE(offset) / 0x100000000;
}

function round5(n) {
  return Math.round(n * 1e5) / 1e5;
}

/**
 * Deterministic approximate coordinates: the centre of the grid cell containing the
 * real point, nudged by an offset derived only from the listing ID (not from the real
 * coordinates). The output is stable for a listing and reveals nothing finer than the
 * cell. The offset just keeps neighbouring listings in one cell from stacking.
 */
export function approximateCoordinates(latitude, longitude, seed) {
  const g = APPROXIMATE_GRID_DEGREES;
  const cellLat = Math.floor(latitude / g);
  const cellLng = Math.floor(longitude / g);
  const digest = crypto.createHash('sha256').update(`vpark-approx-location:${String(seed)}`).digest();
  const jitterLat = (unitFromHash(digest, 0) - 0.5) * g * 0.6;
  const jitterLng = (unitFromHash(digest, 4) - 0.5) * g * 0.6;
  return {
    latitude: round5((cellLat + 0.5) * g + jitterLat),
    longitude: round5((cellLng + 0.5) * g + jitterLng),
  };
}

/** Coordinates that may be used for anything a discovery response can observe. */
export function getDiscoveryCoordinates(listing) {
  if (isExactLocationPublic(listing)) {
    return { latitude: listing.latitude, longitude: listing.longitude, precision: 'EXACT' };
  }
  const approx = approximateCoordinates(listing.latitude, listing.longitude, listing.id);
  return { ...approx, precision: 'APPROXIMATE' };
}

/** Distance from the search centre to the discovery point, rounded to 100 m. */
export function discoveryDistanceKm(listing, centerLat, centerLng) {
  const point = getDiscoveryCoordinates(listing);
  const km = calculateDistance(centerLat, centerLng, point.latitude, point.longitude);
  return Math.round(km * 10) / 10;
}

/**
 * First name + last initial for individual hosts (PRIVATE / OTHER). Business
 * operators (COMMERCIAL) and surveyed PUBLIC entries keep their full name.
 */
export function maskProviderName(name, category) {
  const clean = typeof name === 'string' ? name.trim() : '';
  if (!clean) return 'VPark Host';
  if (category === 'COMMERCIAL' || category === 'PUBLIC') return clean;
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function copyPricing(pricing) {
  const p = pricing || {};
  return {
    hourlyRate: p.hourlyRate,
    dailyRate: p.dailyRate,
    monthlyRate: p.monthlyRate,
    hourlyRatePaise: p.hourlyRatePaise,
    dailyRatePaise: p.dailyRatePaise,
    monthlyRatePaise: p.monthlyRatePaise,
    currency: 'INR',
  };
}

function copyCapacity(c) {
  const cap = c || {};
  return {
    twoWheeler: cap.twoWheeler ?? 0,
    hatchback: cap.hatchback ?? 0,
    sedan: cap.sedan ?? 0,
    suv: cap.suv ?? 0,
    ev: cap.ev ?? 0,
  };
}

function copyHours(h) {
  const hours = h || {};
  return {
    is24x7: Boolean(hours.is24x7),
    openTime: hours.openTime,
    closeTime: hours.closeTime,
    daysOfWeek: Array.isArray(hours.daysOfWeek) ? [...hours.daysOfWeek] : [],
  };
}

/**
 * The only shape in which a listing may leave the server to an unauthenticated
 * or non-participant viewer. Every field is copied explicitly.
 */
export function toPublicListingSummary(listing, { isStale } = {}) {
  const exact = isExactLocationPublic(listing);
  const point = getDiscoveryCoordinates(listing);
  const summary = {
    id: listing.id,
    title: listing.title,
    category: listing.category,
    status: listing.status,
    providerName: maskProviderName(listing.providerName, listing.category),
    providerType: listing.providerType,
    locality: listing.locality,
    city: listing.city,
    latitude: point.latitude,
    longitude: point.longitude,
    locationPrecision: point.precision,
    approximateRadiusMeters: exact ? undefined : APPROXIMATE_RADIUS_METERS,
    totalCapacity: listing.totalCapacity,
    vehicleTypes: Array.isArray(listing.vehicleTypes) ? [...listing.vehicleTypes] : undefined,
    capacityBreakdown: copyCapacity(listing.capacityBreakdown),
    isCovered: Boolean(listing.isCovered),
    heightClearanceMeters: listing.heightClearanceMeters,
    dimensionsNotes: listing.dimensionsNotes,
    hasEvCharging: Boolean(listing.hasEvCharging),
    evChargerType: listing.evChargerType,
    pricing: copyPricing(listing.pricing),
    accessMethod: listing.accessMethod,
    accessInstructions: exact ? listing.accessInstructions : PRIVATE_ACCESS_PLACEHOLDER,
    houseRules: Array.isArray(listing.houseRules) ? [...listing.houseRules] : [],
    photos: Array.isArray(listing.photos) ? [...listing.photos] : [],
    operatingHours: copyHours(listing.operatingHours),
    availabilityConfidence: listing.availabilityConfidence,
    lastConfirmedAt: listing.lastConfirmedAt,
    isStale: isStale === undefined ? Boolean(listing.isStale) : Boolean(isStale),
    surveyDate: listing.surveyDate,
    isBookable: Boolean(listing.isBookable),
    rating: listing.rating ?? 0,
    reviewCount: listing.reviewCount ?? 0,
  };
  if (exact) {
    summary.address = listing.address;
    summary.landmark = listing.landmark;
  }
  return summary;
}

/**
 * How a viewer relates to a booking. Admin status must already reflect the
 * server-side allowlist (pass an effective user, not a stored one).
 */
export function getBookingRelation(booking, viewer) {
  if (!booking || !viewer) return null;
  if (Array.isArray(viewer.roles) && viewer.roles.includes('ADMIN')) return 'ADMIN';
  if (booking.providerId === viewer.id) return 'PROVIDER';
  if (booking.driverId === viewer.id) return 'DRIVER';
  return null;
}

export function bookingRevealsExactLocation(booking) {
  return Boolean(booking) && LOCATION_QUALIFYING_BOOKING_STATUSES.includes(booking.status);
}

/**
 * Booking as seen by a participant. Providers and admins always see the listing
 * location (it is the provider's own space). The booking driver sees the exact
 * address, pin and access instructions only while the booking qualifies; a
 * cancelled, expired or unpaid booking does not keep them.
 */
export function toBookingView(booking, relation) {
  if (!booking || !relation) return null;
  const view = { ...booking, pricingSnapshot: { ...booking.pricingSnapshot } };
  if (relation === 'ADMIN' || relation === 'PROVIDER') {
    return { ...view, locationRevealed: true };
  }
  if (bookingRevealsExactLocation(booking)) {
    return { ...view, locationRevealed: true };
  }
  return {
    ...view,
    listingAddress: 'Exact location is only available for active bookings.',
    listingAccessInstructions: undefined,
    listingLatitude: undefined,
    listingLongitude: undefined,
    locationRevealed: false,
  };
}
