import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    const consents = user ? db.getUserConsents(user.id) : [];

    return NextResponse.json({
      success: true,
      user,
      consents,
    });
  } catch (error) {
    console.error('Failed to get current user:', error);
    return NextResponse.json({ success: false, error: 'User fetch failed' }, { status: 500 });
  }
}
