import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getClientIp,
  getUserAgent,
  setSessionCookie,
  verifySameOrigin,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrfError = verifySameOrigin(req);
  if (csrfError) return csrfError;

  try {
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    const body = await req.json();
    const { action, email, password, confirmPassword, intent } = body;
    const cleanEmail = (email || '').trim().toLowerCase();

    // 1. CHECK EMAIL STATUS
    if (action === 'CHECK_EMAIL') {
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return NextResponse.json({ success: false, error: 'A valid email address is required.' }, { status: 400 });
      }
      const status = db.checkEmailStatus(cleanEmail);
      return NextResponse.json({
        success: true,
        email: cleanEmail,
        ...status,
      });
    }

    // 2. SIGN UP WITH 2-STEP PASSWORD (Password + Confirm Password)
    if (action === 'SIGNUP' || action === 'SIGNUP_EMAIL_PASSWORD') {
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return NextResponse.json({ success: false, error: 'A valid email address is required.' }, { status: 400 });
      }
      if (!password || password.length < 6) {
        return NextResponse.json({ success: false, error: 'Password must be at least 6 characters long.' }, { status: 400 });
      }
      if (confirmPassword !== undefined && password !== confirmPassword) {
        return NextResponse.json({ success: false, error: 'Passwords do not match. Please verify both password fields.' }, { status: 400 });
      }

      const result = db.registerWithEmailPassword({
        email: cleanEmail,
        password,
        intent: intent === 'provider' ? 'provider' : 'driver',
      });

      if (!result.success || !result.user) {
        return NextResponse.json({ success: false, error: result.error || 'Registration failed.' }, { status: 400 });
      }

      const response = NextResponse.json({
        success: true,
        user: result.user,
        onboardingRequired: Boolean(result.onboardingRequired),
        redirectTo: result.user.activeRole === 'PROVIDER' ? '/owner/dashboard' : '/driver/home',
        message: 'Account created successfully.',
      });

      setSessionCookie(response, result.user.id);
      return response;
    }

    // 3. LOGIN WITH EMAIL & PASSWORD (or Master Admin)
    if (action === 'LOGIN' || action === 'LOGIN_EMAIL_PASSWORD' || action === 'MASTER_LOGIN') {
      if (!cleanEmail || !password) {
        return NextResponse.json({ success: false, error: 'Email and password are required.' }, { status: 400 });
      }

      const result = db.loginWithEmailPassword({
        email: cleanEmail,
        password,
      });

      if (!result.success || !result.user) {
        return NextResponse.json({ success: false, error: result.error || 'Authentication failed.' }, { status: 401 });
      }

      const response = NextResponse.json({
        success: true,
        user: result.user,
        isMasterAdmin: Boolean(result.isMasterAdmin),
        redirectTo:
          result.user.activeRole === 'ADMIN'
            ? '/driver/home?tab=admin'
            : result.user.activeRole === 'PROVIDER'
            ? '/owner/dashboard'
            : '/driver/home',
        message: result.isMasterAdmin
          ? 'Master Administrator authenticated.'
          : 'Signed in successfully.',
      });

      setSessionCookie(response, result.user.id);
      return response;
    }

    return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error('Email auth error:', error);
    return NextResponse.json({ success: false, error: 'Authentication failed.' }, { status: 500 });
  }
}
