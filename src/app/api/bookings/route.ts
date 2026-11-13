import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, requireCapability } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: true, count: 0, data: [] });
    }

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

    bookings = [...bookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error('Fetch bookings error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireCapability(req, 'DRIVER');
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { listingId, vehicleType, vehiclePlateNumber, startTime, endTime, paymentMethod, holdId } = body;

    if (!listingId || !vehicleType || !vehiclePlateNumber || !startTime || !endTime) {
      return NextResponse.json({ success: false, error: 'All booking fields are required' }, { status: 400 });
    }

    const result = db.createBooking({
      listingId,
      driverId: auth.user.id,
      vehicleType,
      vehiclePlateNumber,
      startTime,
      endTime,
      paymentMethod: paymentMethod || 'UPI',
      holdId,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      booking: result.booking,
      payment: result.payment,
      message: 'Booking confirmed successfully!',
    });
  } catch (error) {
    console.error('Create booking error:', error);
    return NextResponse.json({ success: false, error: 'Booking failed' }, { status: 500 });
  }
}
