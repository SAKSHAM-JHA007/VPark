import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/auth';
import { db } from '@/lib/db';
import type { ParkingCategory, SearchFilters, VehicleType } from '@/types';

export const dynamic = 'force-dynamic';

const CATEGORIES: ParkingCategory[] = ['PRIVATE', 'COMMERCIAL', 'OTHER', 'PUBLIC'];
const VEHICLE_TYPES: VehicleType[] = ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV', 'EV'];
const SORTS: NonNullable<SearchFilters['sortBy']>[] = ['BEST_MATCH', 'PRICE_LOW', 'DISTANCE_NEAR', 'RATING_HIGH'];
const MAX_RADIUS_KM = 25;

function finiteParam(value: string | null, min: number, max: number): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

function boolParam(value: string | null): boolean | undefined {
  return value === null ? undefined : value === 'true';
}

function isoParam(value: string | null): string | undefined {
  if (!value) return undefined;
  return Number.isFinite(Date.parse(value)) ? value : undefined;
}

// Public discovery endpoint: no authentication, returns only PublicListingSummary
// projections (see src/lib/security/listing-privacy.mjs).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = finiteParam(searchParams.get('lat'), -90, 90);
    const lng = finiteParam(searchParams.get('lng'), -180, 180);
    const requestedRadius = finiteParam(searchParams.get('radius'), 0.1, 1000);
    const radiusKm = requestedRadius === undefined ? undefined : Math.min(requestedRadius, MAX_RADIUS_KM);

    const categoryParam = searchParams.get('category');
    const category = categoryParam
      ? (categoryParam.split(',').filter((c) => CATEGORIES.includes(c as ParkingCategory)) as ParkingCategory[])
      : undefined;

    const vehicleTypeParam = searchParams.get('vehicleType') as VehicleType | null;
    const vehicleType = vehicleTypeParam && VEHICLE_TYPES.includes(vehicleTypeParam) ? vehicleTypeParam : undefined;
    const maxHourlyRate = finiteParam(searchParams.get('maxPrice'), 0, 100000);
    const sortParam = searchParams.get('sortBy') as SearchFilters['sortBy'] | null;
    const sortBy = sortParam && SORTS.includes(sortParam) ? sortParam : 'BEST_MATCH';

    const results = await db.searchListings({
      latitude: lat,
      longitude: lng,
      radiusKm,
      category,
      vehicleType,
      maxHourlyRate,
      isCovered: boolParam(searchParams.get('isCovered')),
      hasEvCharging: boolParam(searchParams.get('hasEvCharging')),
      bookableNow: boolParam(searchParams.get('bookableNow')),
      startTime: isoParam(searchParams.get('startTime')),
      endTime: isoParam(searchParams.get('endTime')),
      sortBy,
    });

    return NextResponse.json({
      success: true,
      count: results.length,
      data: results,
      searchCenter: { lat, lng, radiusKm: radiusKm || 5 },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to search listings', 'Search API error');
  }
}
