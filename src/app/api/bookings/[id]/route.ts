import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireSession(req);
  if (session.error) return session.error;

  try {
    const booking = db.getBookings().find((b) => b.id === params.id || b.referenceNumber === params.id);
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const user = session.user;
    const isParticipant = booking.driverId === user.id || booking.providerId === user.id || user.roles.includes('ADMIN');
    if (!isParticipant) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const listing = db.getListingById(booking.listingId);

    return NextResponse.json({
      success: true,
      booking,
      listing,
    });
  } catch (error) {
    console.error('Get booking error:', error);
    return NextResponse.json({ success: false, error: 'Failed to retrieve booking' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireSession(req);
  if (session.error) return session.error;

  try {
    const bookingId = params.id;
    const existing = db.getBookings().find((b) => b.id === bookingId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const user = session.user;
    const isParticipant = existing.driverId === user.id || existing.providerId === user.id || user.roles.includes('ADMIN');
    if (!isParticipant) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action, photoUrl, reason, additionalHours, cancelledBy } = body;

    if (action === 'CHECK_IN') {
      const result = db.updateBookingStatus(bookingId, 'CHECKED_IN', { photoUrl });
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, booking: result.booking, message: 'Checked in successfully!' });
    }

    if (action === 'CHECK_OUT') {
      const result = db.updateBookingStatus(bookingId, 'COMPLETED');
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, booking: result.booking, message: 'Session completed. Thank you for parking!' });
    }

    if (action === 'CANCEL') {
      const isProvider = existing.providerId === user.id;
      const isAdmin = user.roles.includes('ADMIN');
      const resolvedCancelledBy = (isProvider || (isAdmin && cancelledBy === 'PROVIDER')) ? 'PROVIDER' : 'DRIVER';
      const status = resolvedCancelledBy === 'PROVIDER' ? 'CANCELLED_BY_PROVIDER' : 'CANCELLED_BY_DRIVER';
      const result = db.updateBookingStatus(bookingId, status, { reason, cancelledBy: resolvedCancelledBy });
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({
        success: true,
        booking: result.booking,
        refundAmount: result.booking?.refundAmount,
        message: `Booking cancelled. Refund of ₹${result.booking?.refundAmount ?? 0} processed.`,
      });
    }

    if (action === 'EXTEND') {
      const hours = additionalHours || 1;
      const result = db.extendBooking(bookingId, hours);
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 409 });
      return NextResponse.json({
        success: true,
        booking: result.booking,
        message: `Booking extended by ${hours} hour(s). New end time: ${new Date(result.booking!.endTime).toLocaleTimeString()}`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Update booking error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update booking' }, { status: 500 });
  }
}
