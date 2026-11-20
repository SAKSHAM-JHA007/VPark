import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, errorResponse } from '@/lib/auth';
import { getBookingRelation, toBookingView } from '@/lib/security/listing-privacy.mjs';

export const dynamic = 'force-dynamic';

// India Digital Personal Data Protection Act, 2023 - Data Export & Consent
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (session.error) return session.error;

  try {
    const user = session.user;
    const [asDriver, asProvider] = await Promise.all([db.getBookingsForDriver(user.id), db.getBookingsForProvider(user.id)]);
    const byId = new Map<string, (typeof asDriver)[number]>();
    for (const b of [...asDriver, ...asProvider]) byId.set(b.id, b);
    const ownBookings = Array.from(byId.values()).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
    // Same location-privacy rules as the bookings API.
    const bookings = ownBookings.map((b) => toBookingView(b, b.providerId === user.id ? 'PROVIDER' : getBookingRelation(b, { id: user.id, roles: [] })));
    const payments = await db.getPaymentsForBookings(ownBookings.map((b) => b.id));
    const passes = await db.getMonthlyPassesForDriver(user.id);
    const listings = await db.getListingsByProvider(user.id);
    const consents = await db.getUserConsents(user.id);

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
    return errorResponse(error, 'Failed to export data', 'Data export error');
  }
}
