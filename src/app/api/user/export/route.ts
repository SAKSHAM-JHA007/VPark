import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { getBookingRelation, toBookingView } from '@/lib/security/listing-privacy.mjs';

export const dynamic = 'force-dynamic';

// India Digital Personal Data Protection Act, 2023 - Data Export & Consent
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (session.error) return session.error;

  try {
    const user = session.user;
    const ownBookings = db.getBookings().filter((b) => b.driverId === user.id || b.providerId === user.id);
    // Same location-privacy rules as the bookings API.
    const bookings = ownBookings.map((b) => toBookingView(b, b.providerId === user.id ? 'PROVIDER' : getBookingRelation(b, { id: user.id, roles: [] })));
    const payments = db.getPayments().filter((p) => ownBookings.some((b) => b.id === p.bookingId));
    const passes = db.getMonthlyPasses().filter((p) => p.driverId === user.id);
    const listings = db.getListingsByProvider(user.id);
    const consents = db.getUserConsents(user.id);

    const exportData = {
      compliance: 'India Digital Personal Data Protection Act, 2023 (DPDP)',
      exportedAt: new Date().toISOString(),
      userProfile: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        roles: user.roles,
        accountStatus: user.accountStatus,
        phoneVerifiedAt: user.phoneVerifiedAt,
        emailVerifiedAt: user.emailVerifiedAt,
        lastLoginAt: user.lastLoginAt,
        vehicles: user.vehicles,
        registeredOn: user.createdAt,
      },
      consents,
      listings,
      bookings,
      payments,
      monthlyPasses: passes,
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="vpark_user_data_${user.id}.json"`,
      },
    });
  } catch (error) {
    console.error('Data export error:', error);
    return NextResponse.json({ success: false, error: 'Failed to export data' }, { status: 500 });
  }
}
