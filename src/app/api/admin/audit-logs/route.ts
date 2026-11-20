import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCapability } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireCapability(req, 'ADMIN');
  if (auth.error) return auth.error;

  try {
    const logs = db.getAuditLogs();
    const payments = db.getPayments();
    const payouts = db.getPayouts();
    const allBookings = db.getBookings();

    const totalTransactions = payments.length;
    const reconciledTransactions = payments.filter((p) => p.reconciled).length;
    const totalProcessedVolume = payments.reduce((acc, p) => acc + p.amount, 0);
    const totalPlatformRevenue = payments.reduce((acc, p) => acc + p.platformCommission, 0);
    const totalProviderOwed = payments.reduce((acc, p) => acc + p.providerEarning, 0);

    return NextResponse.json({
      success: true,
      logs,
      reconciliation: {
        totalTransactions,
        reconciledTransactions,
        reconciliationRate: totalTransactions > 0 ? (reconciledTransactions / totalTransactions) * 100 : 100,
        totalProcessedVolume: Math.round(totalProcessedVolume * 100) / 100,
        totalPlatformRevenue: Math.round(totalPlatformRevenue * 100) / 100,
        totalProviderOwed: Math.round(totalProviderOwed * 100) / 100,
        disputeRate: allBookings.length > 0 ? (db.getDisputes().length / allBookings.length) * 100 : 0,
        payments,
        payouts,
      },
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json({ success: false, error: 'Failed to retrieve admin logs' }, { status: 500 });
  }
}
