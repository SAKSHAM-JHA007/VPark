import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCapability } from '@/lib/auth';
import type { ListingStatus } from '@/types';

const ADMIN_SETTABLE_STATUSES: ListingStatus[] = ['VERIFIED', 'REJECTED', 'NEEDS_INFO', 'SUSPENDED', 'PENDING_REVIEW'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireCapability(req, 'ADMIN');
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { status, reason } = body;

    if (!status || !ADMIN_SETTABLE_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'A valid status is required' }, { status: 400 });
    }

    const result = db.adminUpdateListingStatus(auth.user.id, params.id, status, typeof reason === 'string' ? reason.slice(0, 1000) : undefined);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      listing: result.listing,
      message: `Listing status updated to ${status}.`,
    });
  } catch (error) {
    console.error('Admin update listing error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update listing' }, { status: 500 });
  }
}
