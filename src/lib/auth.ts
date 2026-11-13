import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';
import { User, UserRole } from '@/types';
import { hasCapability } from './engine.mjs';

export const SESSION_COOKIE_NAME = 'vpark_user_id';

// ponytail: Single-process in-memory OTP rate limit; replace with Redis/Upstash sliding window in multi-instance production.
const otpIpBuckets = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

export function getUserAgent(req: NextRequest): string {
  return req.headers.get('user-agent') || 'unknown';
}

export function checkOtpIpRateLimit(ip: string, limit = 25, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const bucket = otpIpBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    otpIpBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) {
    return false;
  }
  bucket.count += 1;
  return true;
}

export function verifySameOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ success: false, error: 'Cross-origin state-changing request rejected.' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid Origin header.' }, { status: 403 });
    }
  }
  return null;
}

export function getSessionUser(req: NextRequest): User | null {
  const userId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!userId) return null;
  const user = db.getUserById(userId);
  return user || null;
}

export function requireSession(req: NextRequest): { user: User; error?: never } | { user?: never; error: NextResponse } {
  const csrfError = verifySameOrigin(req);
  if (csrfError && req.method !== 'GET' && req.method !== 'HEAD') {
    return { error: csrfError };
  }

  const user = getSessionUser(req);
  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Authentication required. Please log in with your phone number.' },
        { status: 401 }
      ),
    };
  }
  return { user };
}

export function requireCapability(
  req: NextRequest,
  requiredRole: UserRole
): { user: User; error?: never } | { user?: never; error: NextResponse } {
  const session = requireSession(req);
  if (session.error) return session;

  if (!hasCapability(session.user, requiredRole)) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: `Forbidden: ${requiredRole} capability is required for this route.`,
        },
        { status: 403 }
      ),
    };
  }

  return { user: session.user };
}

export function setSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(SESSION_COOKIE_NAME, userId, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
  });
}

