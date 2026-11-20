import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCapability, errorResponse } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireCapability(req, 'PROVIDER');
  if (auth.error) return auth.error;

  try {
    const result = await db.reconfirmAvailability(params.id, auth.user.id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error?.includes('Forbidden') ? 403 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      listing: result.listing,
      message: 'Availability reconfirmed! Freshness indicator updated and search ranking restored.',
    });
  } catch (error) {
    return errorResponse(error, 'Failed to reconfirm availability', 'Reconfirm error');
  }
}
