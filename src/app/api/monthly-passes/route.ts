import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, requireCapability } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
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
  const auth = requireCapability(req, 'DRIVER');
  if (auth.error) return auth.error;

  try {
    const user = auth.user;
    const body = await req.json();
    const { listingId, vehiclePlateNumber, vehicleType, month, price } = body;

    if (!listingId || !vehiclePlateNumber || !month || !price) {
      return NextResponse.json({ success: false, error: 'Missing required monthly pass details' }, { status: 400 });
    }

    const pass = db.createMonthlyPass({
      listingId,
      driverId: user.id,
      driverName: user.name || user.phone,
      vehiclePlateNumber,
      vehicleType: vehicleType || 'SEDAN',
      month,
      price,
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
