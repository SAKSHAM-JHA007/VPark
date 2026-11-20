import type { Booking, BookingStatus, Listing, PublicListingSummary } from '@/types';

export type BookingRelation = 'ADMIN' | 'PROVIDER' | 'DRIVER';

export const APPROXIMATE_GRID_DEGREES: number;
export const APPROXIMATE_RADIUS_METERS: number;
export const PRIVATE_ACCESS_PLACEHOLDER: string;
export const LOCATION_QUALIFYING_BOOKING_STATUSES: readonly BookingStatus[];

export function isExactLocationPublic(listing: Pick<Listing, 'category'> | null | undefined): boolean;
export function approximateCoordinates(
  latitude: number,
  longitude: number,
  seed: string
): { latitude: number; longitude: number };
export function getDiscoveryCoordinates(
  listing: Pick<Listing, 'id' | 'category' | 'latitude' | 'longitude'>
): { latitude: number; longitude: number; precision: 'EXACT' | 'APPROXIMATE' };
export function discoveryDistanceKm(
  listing: Pick<Listing, 'id' | 'category' | 'latitude' | 'longitude'>,
  centerLat: number,
  centerLng: number
): number;
export function maskProviderName(name: string | undefined, category: Listing['category']): string;
export function toPublicListingSummary(listing: Listing, options?: { isStale?: boolean }): PublicListingSummary;
export function getBookingRelation(
  booking: Pick<Booking, 'driverId' | 'providerId'> | null | undefined,
  viewer: { id: string; roles: string[] } | null | undefined
): BookingRelation | null;
export function bookingRevealsExactLocation(booking: Pick<Booking, 'status'> | null | undefined): boolean;
export function toBookingView(booking: Booking, relation: BookingRelation): Booking;
export function toBookingView(booking: Booking | null | undefined, relation: BookingRelation | null): Booking | null;
