import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCapability, errorResponse } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireCapability(req, 'ADMIN');
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { notes, refundAmount } = body;

    const refund = refundAmount === undefined || refundAmount === null || refundAmount === '' ? 0 : Number(refundAmount);
    const dispute = await db.getDisputeById(params.id);
    const booking = dispute ? await db.getBookingByIdOrReference(dispute.bookingId) : undefined;
    const maxRefund = booking?.pricingSnapshot.totalAmount ?? 0;
    if (!Number.isFinite(refund) || refund < 0 || refund > maxRefund) {
      return NextResponse.json({ success: false, error: `Refund must be between ₹0 and ₹${maxRefund}.` }, { status: 400 });
    }

    const result = await db.resolveDispute(auth.user.id, params.id, typeof notes === 'string' && notes.trim() ? notes.slice(0, 2000) : 'Resolved by admin', refund);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      dispute: result.dispute,
      message: 'Dispute successfully resolved.',
    });
  } catch (error) {
    return errorResponse(error, 'Failed to resolve dispute', 'Resolve dispute error');
  }
}
