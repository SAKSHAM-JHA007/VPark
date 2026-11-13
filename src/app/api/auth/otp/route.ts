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

// POST /api/auth/otp - Phone OTP request & verification (PRD Section 6)
export async function POST(req: NextRequest) {
  const csrfError = verifySameOrigin(req);
  if (csrfError) return csrfError;

  try {
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    const body = await req.json();
    const { action, phone, otp, intent, purpose } = body;

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required.' }, { status: 400 });
    }

    if (action === 'REQUEST_OTP') {
      if (!checkOtpIpRateLimit(ipAddress)) {
        return NextResponse.json(
          { success: false, error: 'Too many OTP requests from this network. Try again later.' },
          { status: 429 }
        );
      }

      const result = db.requestOtpChallenge(phone, purpose === 'RECOVERY' ? 'RECOVERY' : 'LOGIN');
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error, retryAfterSeconds: result.retryAfterSeconds },
          { status: result.retryAfterSeconds ? 429 : 400 }
        );
      }

      // Non-enumerating response: never reveals whether phone is already registered (PRD 6.4)
      return NextResponse.json({
        success: true,
        phone: result.phone,
        expiresAt: result.expiresAt,
        cooldownSeconds: APP_CONFIG.otpResendCooldownSeconds,
        message: `If eligible, a 6-digit OTP has been sent to ${result.phone}. (Demo OTP: ${APP_CONFIG.demoOtp})`,
        demoOtp: process.env.NODE_ENV !== 'production' ? APP_CONFIG.demoOtp : APP_CONFIG.demoOtp,
      });
    }

    if (action === 'VERIFY_OTP') {
      if (!otp) {
        return NextResponse.json({ success: false, error: '6-digit OTP code is required.' }, { status: 400 });
      }

      const result = db.verifyOtpAndSignIn({
        phone,
        otp: String(otp),
        intent: intent === 'provider' || intent === 'driver' ? intent : undefined,
        ipAddress,
        userAgent,
      });

      if (!result.success || !result.user) {
        return NextResponse.json(
          { success: false, error: result.error || 'OTP verification failed.' },
          { status: result.status || 400 }
        );
      }

      const response = NextResponse.json({
        success: true,
        user: result.user,
        onboardingRequired: Boolean(result.onboardingRequired),
        redirectTo:
          result.user.activeRole === 'ADMIN'
            ? '/admin'
            : result.user.activeRole === 'PROVIDER'
            ? '/owner/dashboard'
            : '/driver/home',
        message: result.onboardingRequired
          ? 'Phone verified. Complete your name & consent to continue.'
          : 'Signed in successfully.',
      });

      setSessionCookie(response, result.user.id);
      return response;
    }

    return NextResponse.json({ success: false, error: 'Invalid auth action.' }, { status: 400 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ success: false, error: 'Authentication failed.' }, { status: 500 });
  }
}
