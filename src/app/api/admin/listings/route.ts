import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCapability, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireCapability(req, 'ADMIN');
  if (auth.error) return auth.error;

  try {
    const listings = await db.getAdminListings();
    return NextResponse.json({
      success: true,
      count: listings.length,
      data: listings,
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load admin listings', 'Admin listings fetch error');
  }
}

