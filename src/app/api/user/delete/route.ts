import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearSessionCookie, requireSession, revokeAllSessionsForUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (session.error) return session.error;

  try {
    const result = db.softDeleteUser(session.user.id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    // Sign the account out everywhere, not just in this browser.
    await revokeAllSessionsForUser(session.user.id);

    const response = NextResponse.json({
      success: true,
      message: 'Account marked deletion-pending and personal identifiers purged under DPDP Act 2023.',
    });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process deletion request.' }, { status: 500 });
  }
}
