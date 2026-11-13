import type { PriceBreakdown, User, UserRole, AvailabilityConfidence } from '@/types';

export function normalizeIndianPhone(input: string): string | null;
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number;
export function calculatePricingPaise(
  hourlyRatePaise: number,
  startTime: string,
  endTime: string
): PriceBreakdown;
export function calculateCancellationRefundPaise(params: {
  hoursBeforeStart: number;
  parkingFeePaise: number;
  totalAmountPaise: number;
  cancelledBy: 'DRIVER' | 'PROVIDER';
}): number;
export function isListingStale(
  lastConfirmedAt?: string | null,
  thresholdDays?: number,
  nowMs?: number
): boolean;
export function calculateRankingScore(params: {
  distanceKm: number;
  hourlyRate: number;
  isVerified: boolean;
  confidence: AvailabilityConfidence;
  rating: number;
  isStale: boolean;
}): number;
export function hasCapability(user: User | null | undefined, requiredRole: UserRole): boolean;
