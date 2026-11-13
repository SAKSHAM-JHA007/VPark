import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCapability } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireCapability(req, 'ADMIN');
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { notes, refundAmount } = body;

    const result = db.resolveDispute(auth.user.id, params.id, notes || 'Resolved by admin', refundAmount || 0);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      dispute: result.dispute,
      message: 'Dispute successfully resolved.',
    });
  } catch (error) {
    console.error('Resolve dispute error:', error);
    return NextResponse.json({ success: false, error: 'Failed to resolve dispute' }, { status: 500 });
  }
}
