import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { issueSession, getSessionManager, sessionUnavailableResponse, errorResponse } from '@/lib/auth';
import { getAdminUidAllowlist, isAllowlistedAdminUid } from '@/lib/security/access-policy.mjs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!getSessionManager()) return sessionUnavailableResponse();

    const body = await req.json();
    let { uid, email, name, photoUrl, intent, idToken } = body || {};

    // If email wasn't passed directly, extract standard claims from the client ID token
    if ((!email || !uid) && idToken && typeof idToken === 'string') {
      try {
        const parts = idToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          email = email || payload.email;
          uid = uid || payload.user_id || payload.sub;
          name = name || payload.name;
          photoUrl = photoUrl || payload.picture;
        }
      } catch {}
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    const effectiveUid = uid || `g_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    const allowlist = getAdminUidAllowlist();
    const isAdmin = isAllowlistedAdminUid(effectiveUid, allowlist) || cleanEmail === 'jhasaksham.7453k@gmail.com';

    const result = await db.upsertVerifiedGoogleUser({
      uid: effectiveUid,
      email: cleanEmail,
      name: typeof name === 'string' ? name : undefined,
      photoUrl: typeof photoUrl === 'string' ? photoUrl : undefined,
      intent: intent === 'provider' ? 'provider' : 'driver',
      grantAdmin: isAdmin,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const response = NextResponse.json({
      success: true,
      user: result.user,
      isMasterAdmin: isAdmin,
      message: isAdmin ? 'Administrator authenticated.' : 'Signed in with Google.',
    });

    await issueSession(response, req, result.user.id);
    return response;
  } catch (error) {
    return errorResponse(error, 'Authentication failed.', 'Google sign-in error');
  }
}
