import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, requireCapability } from '@/lib/auth';
import { validatePlateNumber } from '@/lib/validation';
import { getBookingRelation, toBookingView } from '@/lib/security/listing-privacy.mjs';
import type { Booking, PaymentMethod, VehicleType } from '@/types';

export const dynamic = 'force-dynamic';

const VEHICLE_TYPES: VehicleType[] = ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV', 'EV'];
const PAYMENT_METHODS: PaymentMethod[] = ['UPI', 'CARD', 'NETBANKING'];

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: true, count: 0, data: [] });
    }

    // `user` carries effective roles: ADMIN only when backed by the server allowlist.
    const { searchParams } = new URL(req.url);
    const filterRole = searchParams.get('role');
    let bookings = db.getBookings();

    if (filterRole === 'PROVIDER' && user.roles.includes('PROVIDER')) {
      bookings = bookings.filter((b) => b.providerId === user.id);
    } else if (filterRole === 'ADMIN' && user.roles.includes('ADMIN')) {
      // Admin views all
    } else if (user.activeRole === 'PROVIDER' && user.roles.includes('PROVIDER')) {
      bookings = bookings.filter((b) => b.providerId === user.id);
    } else if (user.activeRole === 'ADMIN' && user.roles.includes('ADMIN')) {
      // Admin views all
    } else {
      bookings = bookings.filter((b) => b.driverId === user.id);
    }

    const views = [...bookings]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((b) => toBookingView(b, getBookingRelation(b, user)))
      .filter((b): b is Booking => b !== null);

    return NextResponse.json({
      success: true,
      count: views.length,
      data: views,
    });
  } catch (error) {
    console.error('Fetch bookings error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireCapability(req, 'DRIVER');
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { listingId, vehicleType, vehiclePlateNumber, startTime, endTime, paymentMethod, holdId } = body;

    if (!listingId || !vehicleType || !vehiclePlateNumber || !startTime || !endTime) {
      return NextResponse.json({ success: false, error: 'All booking fields are required' }, { status: 400 });
    }

    if (typeof listingId !== 'string' || !VEHICLE_TYPES.includes(vehicleType)) {
      return NextResponse.json({ success: false, error: 'Invalid listing or vehicle type.' }, { status: 400 });
    }

    const startMs = Date.parse(String(startTime));
    const endMs = Date.parse(String(endTime));
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || endMs - startMs > 31 * 24 * 3600 * 1000) {
      return NextResponse.json({ success: false, error: 'Invalid booking time window.' }, { status: 400 });
    }

    if (!validatePlateNumber(String(vehiclePlateNumber))) {
      return NextResponse.json(
        { success: false, error: 'Invalid vehicle registration plate. Must match Indian format (e.g. KA-04-MB-1234 or 22-BH-1234-AA).' },
        { status: 400 }
      );
    }

    const result = db.createBooking({
      listingId,
      driverId: auth.user.id,
      vehicleType,
      vehiclePlateNumber: String(vehiclePlateNumber),
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      paymentMethod: PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : 'UPI',
      holdId: typeof holdId === 'string' ? holdId : undefined,
    });

    if (!result.success || !result.booking) {
      return NextResponse.json({ success: false, error: result.error }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      booking: toBookingView(result.booking, 'DRIVER'),
      payment: result.payment,
      message: 'Booking confirmed successfully!',
    });
  } catch (error) {
    console.error('Create booking error:', error);
    return NextResponse.json({ success: false, error: 'Booking failed' }, { status: 500 });
  }
}
