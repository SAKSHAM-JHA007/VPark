import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { APP_CONFIG } from '@/lib/constants';
import {
  checkOtpIpRateLimit,
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
    const { action, email, phone, password, otp, intent, purpose } = body;

    // 1. MASTER ADMIN LOGIN (Direct Hidden Password Authentication)
    if (action === 'MASTER_LOGIN' || action === 'VERIFY_PASSWORD') {
      const targetEmail = (email || '').trim().toLowerCase();
      if (!targetEmail || !password) {
        return NextResponse.json(
          { success: false, error: 'Email and master password are required.' },
          { status: 400 }
        );
      }

      const masterResult = db.verifyMasterAdmin(targetEmail, password);
      if (!masterResult.success || !masterResult.user) {
        return NextResponse.json(
          { success: false, error: masterResult.error || 'Invalid credentials.' },
          { status: 401 }
        );
      }

      const response = NextResponse.json({
        success: true,
        user: masterResult.user,
        isMasterAdmin: true,
        redirectTo: '/driver/home?tab=admin',
        message: 'Master Administrator authenticated successfully.',
      });

      setSessionCookie(response, masterResult.user.id);
      return response;
    }

    // 1.1 CHECK EMAIL STATUS
    if (action === 'CHECK_EMAIL') {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return NextResponse.json({ success: false, error: 'A valid email address is required.' }, { status: 400 });
      }
      const status = db.checkEmailStatus(cleanEmail);
      return NextResponse.json({ success: true, email: cleanEmail, ...status });
    }

    // 1.2 SIGNUP WITH EMAIL & PASSWORD (2-step setup: password + confirm)
    if (action === 'SIGNUP' || action === 'SIGNUP_EMAIL_PASSWORD') {
      const cleanEmail = (email || '').trim().toLowerCase();
      const confirmPassword = body.confirmPassword;
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

    // 1.3 LOGIN WITH EMAIL & PASSWORD
    if (action === 'LOGIN' || action === 'LOGIN_EMAIL_PASSWORD') {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !password) {
        return NextResponse.json({ success: false, error: 'Email and password are required.' }, { status: 400 });
      }

      const result = db.loginWithEmailPassword({ email: cleanEmail, password });
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
        message: result.isMasterAdmin ? 'Master Administrator authenticated.' : 'Signed in successfully.',
      });

      setSessionCookie(response, result.user.id);
      return response;
    }

    // 2. REQUEST OTP (Email Primary with Phone fallback)
    if (action === 'REQUEST_OTP') {
      const identifier = (email || phone || '').trim();

      if (!identifier) {
        return NextResponse.json({ success: false, error: 'Email address is required.' }, { status: 400 });
      }

      // Check if user entered master admin email
      if (identifier.toLowerCase() === 'jhasaksham.7453k@gmail.com') {
        return NextResponse.json({
          success: true,
          isMasterAdmin: true,
          message: 'Master Administrator account recognized. Please enter master password.',
        });
      }

      if (!checkOtpIpRateLimit(ipAddress)) {
        return NextResponse.json(
          { success: false, error: 'Too many verification requests from this network. Try again later.' },
          { status: 429 }
        );
      }

      const result = db.requestOtpChallenge(identifier, purpose === 'RECOVERY' ? 'RECOVERY' : 'LOGIN');
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error, retryAfterSeconds: result.retryAfterSeconds },
          { status: result.retryAfterSeconds ? 429 : 400 }
        );
      }

      return NextResponse.json({
        success: true,
        identifier: result.identifier,
        email: result.email,
        phone: result.phone,
        expiresAt: result.expiresAt,
        cooldownSeconds: APP_CONFIG.otpResendCooldownSeconds,
        message:
          process.env.NODE_ENV === 'production'
            ? `If eligible, a 6-digit verification code has been dispatched to ${result.identifier}.`
            : `If eligible, a 6-digit OTP has been sent to ${result.identifier}. (Demo OTP: ${APP_CONFIG.demoOtp})`,
        demoOtp: process.env.NODE_ENV !== 'production' ? APP_CONFIG.demoOtp : undefined,
      });
    }

    // 3. VERIFY OTP
    if (action === 'VERIFY_OTP') {
      if (!otp) {
        return NextResponse.json({ success: false, error: '6-digit OTP code is required.' }, { status: 400 });
      }

      const result = db.verifyOtpAndSignIn({
        email: email ? String(email).trim() : undefined,
        phone: phone ? String(phone).trim() : undefined,
        otp: String(otp),
        intent: intent === 'provider' || intent === 'driver' ? intent : undefined,
        ipAddress,
        userAgent,
      });

      if (!result.success || !result.user) {
        return NextResponse.json(
          { success: false, error: result.error || 'Verification code failed.' },
          { status: result.status || 400 }
        );
      }

      const response = NextResponse.json({
        success: true,
        user: result.user,
        onboardingRequired: Boolean(result.onboardingRequired),
        redirectTo:
          result.user.activeRole === 'ADMIN'
            ? '/driver/home?tab=admin'
            : result.user.activeRole === 'PROVIDER'
            ? '/owner/dashboard'
            : '/driver/home',
        message: result.onboardingRequired
          ? 'Email verified. Complete your details to continue.'
          : 'Signed in successfully.',
      });

      setSessionCookie(response, result.user.id);
      return response;
    }

    return NextResponse.json({ success: false, error: 'Invalid authentication action.' }, { status: 400 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ success: false, error: 'Authentication failed.' }, { status: 500 });
  }
}
