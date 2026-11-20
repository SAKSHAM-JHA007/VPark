import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCapability } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireCapability(req, 'ADMIN');
  if (auth.error) return auth.error;

  try {
    const listings = db.getAdminListings();
    return NextResponse.json({
      success: true,
      count: listings.length,
      data: listings,
    });
  } catch (error) {
    console.error('Admin listings fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load admin listings' }, { status: 500 });
  }
}

