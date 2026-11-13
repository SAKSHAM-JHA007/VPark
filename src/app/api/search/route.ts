import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ParkingCategory, VehicleType } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined;
    const lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined;
    const radiusKm = searchParams.get('radius') ? parseFloat(searchParams.get('radius')!) : undefined;

    const categoryParam = searchParams.get('category');
    const category = categoryParam ? (categoryParam.split(',') as ParkingCategory[]) : undefined;

    const vehicleType = (searchParams.get('vehicleType') as VehicleType) || undefined;
    const maxHourlyRate = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined;
    const isCovered = searchParams.get('isCovered') ? searchParams.get('isCovered') === 'true' : undefined;
    const hasEvCharging = searchParams.get('hasEvCharging') ? searchParams.get('hasEvCharging') === 'true' : undefined;
    const bookableNow = searchParams.get('bookableNow') ? searchParams.get('bookableNow') === 'true' : undefined;

    const startTime = searchParams.get('startTime') || undefined;
    const endTime = searchParams.get('endTime') || undefined;
    const sortBy = (searchParams.get('sortBy') as 'BEST_MATCH' | 'PRICE_LOW' | 'DISTANCE_NEAR' | 'RATING_HIGH') || 'BEST_MATCH';

    const results = db.searchListings({
      latitude: lat,
      longitude: lng,
      radiusKm,
      category,
      vehicleType,
      maxHourlyRate,
      isCovered,
      hasEvCharging,
      bookableNow,
      startTime,
      endTime,
      sortBy,
    });

    return NextResponse.json({
      success: true,
      count: results.length,
      data: results,
      searchCenter: { lat, lng, radiusKm: radiusKm || 5 },
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to search listings' }, { status: 500 });
  }
}
