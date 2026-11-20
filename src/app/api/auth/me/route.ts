import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, errorResponse } from '@/lib/auth';
import { toPublicUser } from '@/lib/security/access-policy.mjs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    const consents = user ? await db.getUserConsents(user.id) : [];

    return NextResponse.json({
      success: true,
      user: toPublicUser(user),
      consents,
    });
  } catch (error) {
    return errorResponse(error, 'User fetch failed', 'Failed to get current user');
  }
}
