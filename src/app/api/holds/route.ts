import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCapability, requireSession, errorResponse } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = await requireCapability(req, 'DRIVER');
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { listingId, vehicleType, startTime, endTime } = body;

    if (!listingId || !vehicleType || !startTime || !endTime) {
      return NextResponse.json({ success: false, error: 'Missing required fields for slot hold' }, { status: 400 });
    }

    const result = await db.createSlotHold({
      listingId,
      userId: auth.user.id,
      vehicleType,
      startTime,
      endTime,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      hold: result.hold,
      message: '10-minute reservation hold secured.',
    });
  } catch (error) {
    return errorResponse(error, 'Failed to create slot hold', 'Hold error');
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireSession(req);
  if (session.error) return session.error;

  try {
    const { searchParams } = new URL(req.url);
    const holdId = searchParams.get('id');

    if (!holdId) {
      return NextResponse.json({ success: false, error: 'Hold ID is required' }, { status: 400 });
    }

    // A user may only release their own hold.
    const result = await db.releaseSlotHoldForUser(holdId, session.user.id, session.user.roles.includes('ADMIN'));
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, message: 'Hold released' });
  } catch (error) {
    return errorResponse(error, 'Failed to release hold', 'Release hold error');
  }
}
