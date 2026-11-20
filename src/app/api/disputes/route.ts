import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (session.error) return session.error;

  try {
    const user = session.user;
    let disputes = db.getDisputes();
    if (!user.roles.includes('ADMIN')) {
      disputes = disputes.filter((d) => d.raisedByUserId === user.id || d.againstUserId === user.id);
    }
    return NextResponse.json({ success: true, data: disputes });
  } catch (error) {
    console.error('Fetch disputes error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch disputes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (session.error) return session.error;

  try {
    const body = await req.json();
    const { bookingId, category, description, evidencePhotos } = body;

    if (!bookingId || !category || !description) {
      return NextResponse.json({ success: false, error: 'Booking ID, category, and description are required' }, { status: 400 });
    }

    const result = db.createDispute({
      bookingId,
      raisedByUserId: session.user.id,
      category,
      description,
      evidencePhotos: Array.isArray(evidencePhotos) ? evidencePhotos.filter((p: unknown) => typeof p === 'string').slice(0, 10) : [],
    });

    if (!result.success) {
      const status = result.error?.startsWith('Forbidden') ? 403 : 400;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    return NextResponse.json({
      success: true,
      dispute: result.dispute,
      message: 'Dispute ticket opened. Target first response SLA is under 4 working hours.',
    });
  } catch (error) {
    console.error('Create dispute error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create dispute' }, { status: 500 });
  }
}
