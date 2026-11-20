import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import {
  getBookingRelation,
  toBookingView,
  toPublicListingSummary,
} from '@/lib/security/listing-privacy.mjs';
import { isListingStale } from '@/lib/engine.mjs';
import { APP_CONFIG } from '@/lib/constants';
import type { Booking, BookingStatus } from '@/types';

// Which participant may perform which action, and from which booking states.
const ACTION_RULES: Record<string, { relations: string[]; fromStatuses: BookingStatus[] }> = {
  CHECK_IN: { relations: ['DRIVER', 'ADMIN'], fromStatuses: ['CONFIRMED'] },
  CHECK_OUT: { relations: ['DRIVER', 'ADMIN'], fromStatuses: ['CHECKED_IN', 'OVERSTAY'] },
  EXTEND: { relations: ['DRIVER', 'ADMIN'], fromStatuses: ['CONFIRMED', 'CHECKED_IN'] },
  CANCEL: { relations: ['DRIVER', 'PROVIDER', 'ADMIN'], fromStatuses: ['PENDING_PAYMENT', 'CONFIRMED'] },
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession(req);
  if (session.error) return session.error;

  try {
    const booking = db.getBookings().find((b) => b.id === params.id || b.referenceNumber === params.id);
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const relation = getBookingRelation(booking, session.user);
    if (!relation) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const listing = db.getListingById(booking.listingId);
    // Providers (owners) and admins see the full listing; a driver only ever receives
    // the public projection. The driver's exact location comes from the booking view,
    // and only while the booking qualifies.
    const listingView = !listing
      ? null
      : relation === 'DRIVER'
      ? toPublicListingSummary(listing, {
          isStale: isListingStale(listing.lastConfirmedAt, APP_CONFIG.staleThresholdDays),
        })
      : listing;

    return NextResponse.json({
      success: true,
      booking: toBookingView(booking, relation),
      listing: listingView,
    });
  } catch (error) {
    console.error('Get booking error:', error);
    return NextResponse.json({ success: false, error: 'Failed to retrieve booking' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession(req);
  if (session.error) return session.error;

  try {
    const bookingId = params.id;
    const existing = db.getBookings().find((b) => b.id === bookingId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const user = session.user;
    const relation = getBookingRelation(existing, user);
    if (!relation) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action, photoUrl, reason, additionalHours, cancelledBy } = body ?? {};

    const rule = typeof action === 'string' ? ACTION_RULES[action] : undefined;
    if (!rule) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
    if (!rule.relations.includes(relation)) {
      return NextResponse.json({ success: false, error: 'Forbidden: you cannot perform this action on this booking.' }, { status: 403 });
    }
    if (!rule.fromStatuses.includes(existing.status)) {
      return NextResponse.json(
        { success: false, error: `This booking cannot be updated from status ${existing.status}.` },
        { status: 409 }
      );
    }

    const view = (b: Booking | undefined) => (b ? toBookingView(b, relation) : undefined);

    if (action === 'CHECK_IN') {
      const result = db.updateBookingStatus(bookingId, 'CHECKED_IN', {
        photoUrl: typeof photoUrl === 'string' ? photoUrl.slice(0, 2048) : undefined,
      });
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, booking: view(result.booking), message: 'Checked in successfully!' });
    }

    if (action === 'CHECK_OUT') {
      const result = db.updateBookingStatus(bookingId, 'COMPLETED');
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, booking: view(result.booking), message: 'Session completed. Thank you for parking!' });
    }

    if (action === 'CANCEL') {
      const resolvedCancelledBy =
        relation === 'PROVIDER' || (relation === 'ADMIN' && cancelledBy === 'PROVIDER') ? 'PROVIDER' : 'DRIVER';
      const status = resolvedCancelledBy === 'PROVIDER' ? 'CANCELLED_BY_PROVIDER' : 'CANCELLED_BY_DRIVER';
      const result = db.updateBookingStatus(bookingId, status, {
        reason: typeof reason === 'string' ? reason.slice(0, 500) : undefined,
        cancelledBy: resolvedCancelledBy,
      });
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({
        success: true,
        booking: view(result.booking),
        refundAmount: result.booking?.refundAmount,
        message: `Booking cancelled. Refund of ₹${result.booking?.refundAmount ?? 0} processed.`,
      });
    }

    // EXTEND
    const hours = additionalHours === undefined ? 1 : Number(additionalHours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 12) {
      return NextResponse.json({ success: false, error: 'Extensions must be between 1 and 12 whole hours.' }, { status: 400 });
    }
    const result = db.extendBooking(bookingId, hours);
    if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 409 });
    return NextResponse.json({
      success: true,
      booking: view(result.booking),
      message: `Booking extended by ${hours} hour(s). New end time: ${new Date(result.booking!.endTime).toLocaleTimeString()}`,
    });
  } catch (error) {
    console.error('Update booking error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update booking' }, { status: 500 });
  }
}
