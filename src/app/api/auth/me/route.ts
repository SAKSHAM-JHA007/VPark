import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { toPublicUser } from '@/lib/security/access-policy.mjs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    const consents = user ? db.getUserConsents(user.id) : [];

    return NextResponse.json({
      success: true,
      user: toPublicUser(user),
      consents,
    });
  } catch (error) {
    console.error('Failed to get current user:', error);
    return NextResponse.json({ success: false, error: 'User fetch failed' }, { status: 500 });
  }
}
