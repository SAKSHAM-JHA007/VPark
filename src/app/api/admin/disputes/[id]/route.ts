import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCapability } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireCapability(req, 'ADMIN');
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { notes, refundAmount } = body;

    const refund = refundAmount === undefined || refundAmount === null || refundAmount === '' ? 0 : Number(refundAmount);
    const dispute = db.getDisputes().find((d) => d.id === params.id);
    const booking = dispute ? db.getBookings().find((b) => b.id === dispute.bookingId) : undefined;
    const maxRefund = booking?.pricingSnapshot.totalAmount ?? 0;
    if (!Number.isFinite(refund) || refund < 0 || refund > maxRefund) {
      return NextResponse.json({ success: false, error: `Refund must be between ₹0 and ₹${maxRefund}.` }, { status: 400 });
    }

    const result = db.resolveDispute(auth.user.id, params.id, typeof notes === 'string' && notes.trim() ? notes.slice(0, 2000) : 'Resolved by admin', refund);
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
