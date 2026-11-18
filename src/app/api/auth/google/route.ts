import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, email, name, photoUrl, intent } = body;

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required from Google sign-in.' },
        { status: 400 }
      );
    }

    const user = db.upsertGoogleUser({
      uid: uid || `g_${Date.now()}`,
      email: cleanEmail,
      name: typeof name === 'string' ? name : undefined,
      photoUrl: typeof photoUrl === 'string' ? photoUrl : undefined,
      intent: intent === 'provider' ? 'provider' : 'driver',
    });

    const isMasterAdmin = user.email?.toLowerCase() === 'jhasaksham.7453k@gmail.com';
    const onboardingRequired =
      !isMasterAdmin && (!user.phone || (user.vehicles.length === 0 && user.roles.includes('DRIVER')));

    const response = NextResponse.json({
      success: true,
      user,
      isMasterAdmin,
      onboardingRequired,
      message: isMasterAdmin
        ? 'Master Administrator authenticated via Google Identity.'
        : 'Authenticated via Google Identity.',
    });

    setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    console.error('Google auth error:', error);
    return NextResponse.json({ success: false, error: 'Google authentication failed' }, { status: 500 });
  }
}
