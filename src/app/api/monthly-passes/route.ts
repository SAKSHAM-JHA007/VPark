import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, requireCapability } from '@/lib/auth';
import { validatePlateNumber } from '@/lib/validation';
import type { VehicleType } from '@/types';

export const dynamic = 'force-dynamic';

const VEHICLE_TYPES: VehicleType[] = ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV', 'EV'];

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: true, data: [] });
    }
    const passes = db.getMonthlyPasses().filter((p) => p.driverId === user.id);
    return NextResponse.json({ success: true, data: passes });
  } catch (error) {
    console.error('Fetch passes error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch passes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireCapability(req, 'DRIVER');
  if (auth.error) return auth.error;

  try {
    const user = auth.user;
    const body = await req.json();
    const { listingId, vehiclePlateNumber, vehicleType, month } = body ?? {};

    if (!listingId || !vehiclePlateNumber || !month) {
      return NextResponse.json({ success: false, error: 'Missing required monthly pass details' }, { status: 400 });
    }
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ success: false, error: 'Month must be in YYYY-MM format.' }, { status: 400 });
    }
    if (!validatePlateNumber(String(vehiclePlateNumber))) {
      return NextResponse.json({ success: false, error: 'Invalid vehicle registration plate.' }, { status: 400 });
    }

    // The price is always the listing's own monthly rate; a client-supplied price is ignored.
    const listing = typeof listingId === 'string' ? db.getListingById(listingId) : undefined;
    const monthlyRate = listing?.pricing.monthlyRate;
    if (!listing || listing.status !== 'VERIFIED' || !listing.isBookable || !monthlyRate || monthlyRate <= 0) {
      return NextResponse.json(
        { success: false, error: 'This space does not offer monthly passes.' },
        { status: 400 }
      );
    }

    const pass = db.createMonthlyPass({
      listingId: listing.id,
      driverId: user.id,
      driverName: user.name || user.phone,
      vehiclePlateNumber: String(vehiclePlateNumber),
      vehicleType: VEHICLE_TYPES.includes(vehicleType) ? vehicleType : 'SEDAN',
      month,
      price: monthlyRate,
    });

    return NextResponse.json({
      success: true,
      pass,
      message: `Monthly Commuter Pass for ${month} issued successfully! Dedicated bay reserved.`,
    });
  } catch (error) {
    console.error('Create monthly pass error:', error);
    return NextResponse.json({ success: false, error: 'Failed to issue monthly pass' }, { status: 500 });
  }
}
