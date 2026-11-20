import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';
import type { SessionRecord, User, UserRole } from '@/types';
import { hasCapability } from './engine.mjs';
import {
  createSessionManager,
  getSessionCookieName,
  LEGACY_SESSION_COOKIE_NAME,
  resolveSessionSecret,
  type SessionManager,
  type SessionStore,
} from './security/session.mjs';
import { createRedisRestSessionStore, resolveSessionBackend } from './security/redis-session-store.mjs';
import { getAdminUidAllowlist, toEffectiveUser, toPublicUser, type PublicUser } from './security/access-policy.mjs';

/** Browser-safe view of a stored user: effective roles only, no server-only fields. */
export function serializeUser(user: User): PublicUser;
export function serializeUser(user: User | null | undefined): PublicUser | null;
export function serializeUser(user: User | null | undefined): PublicUser | null {
  return toPublicUser(toEffectiveUser(user, getAdminUidAllowlist()));
}

// ponytail: Single-process in-memory rate limit; replace with Redis/Upstash sliding window in multi-instance production.
const authIpBuckets = new Map<string, { count: number; resetAt: number }>();

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

export function checkAuthIpRateLimit(ip: string, limit = 25, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const bucket = authIpBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    authIpBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) {
    return false;
  }
  bucket.count += 1;
  return true;
}

/**
 * CSRF defence for state-changing requests (in addition to SameSite=Lax cookies):
 * reject a browser request whose Origin is a different host, or that the browser
 * itself labels as cross-site via Fetch Metadata.
 */
export function verifySameOrigin(req: NextRequest): NextResponse | null {
  const forbidden = (error: string) => NextResponse.json({ success: false, error }, { status: 403 });
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return forbidden('Cross-origin state-changing request rejected.');
      }
    } catch {
      return forbidden('Invalid Origin header.');
    }
  }
  if (req.headers.get('sec-fetch-site') === 'cross-site') {
    return forbidden('Cross-site state-changing request rejected.');
  }
  return null;
}

// --- Sessions ---------------------------------------------------------------------

let warnedSessionConfig = '';
let warnedLocalStore = false;
// Module-scoped (not global) so the manager is always bound to the same `db`
// instance that this module imported.
let cachedSessionManager: { key: string; manager: SessionManager } | null = null;

function reportSessionConfigError(message: string) {
  if (warnedSessionConfig !== message) {
    warnedSessionConfig = message;
    console.error(`[auth] Sessions disabled (fail closed): ${message}`);
  }
}

/**
 * Returns null (fail closed) when the session secret or the session backend is
 * missing or invalid. Production requires the durable shared Redis store; it never
 * falls back to local files.
 */
export function getSessionManager(): SessionManager | null {
  const resolved = resolveSessionSecret();
  if (!resolved.secret) {
    reportSessionConfigError(resolved.error ?? 'SESSION_SECRET is invalid.');
    return null;
  }
  const backend = resolveSessionBackend();
  if (!backend.kind) {
    reportSessionConfigError(backend.error);
    return null;
  }

  const key =
    backend.kind === 'redis'
      ? `redis|${backend.config.url}|${backend.config.keyPrefix}|${resolved.secret}`
      : `local|${resolved.secret}`;
  if (cachedSessionManager && cachedSessionManager.key === key) return cachedSessionManager.manager;

  let store: SessionStore;
  if (backend.kind === 'redis') {
    store = createRedisRestSessionStore(backend.config);
  } else {
    if (!warnedLocalStore && process.env.NODE_ENV !== 'test') {
      warnedLocalStore = true;
      console.warn('[auth] Using the local development session store (.data). Configure Redis for shared, durable sessions.');
    }
    store = db.getSessionStore();
  }
  const manager = createSessionManager({ store, secret: resolved.secret });
  cachedSessionManager = { key, manager };
  return manager;
}

export class SessionConfigurationError extends Error {
  constructor() {
    super('Session configuration is missing or invalid.');
    this.name = 'SessionConfigurationError';
  }
}

export function sessionUnavailableResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error: 'Sign-in is temporarily unavailable. Please try again later.' },
    { status: 503 }
  );
}

export function getSessionCookieValue(req: NextRequest): string | undefined {
  return req.cookies.get(getSessionCookieName())?.value;
}

export interface SessionContext {
  /** The stored user with roles reduced to what the account is currently allowed to use. */
  user: User;
  session: SessionRecord;
}

/**
 * Resolve and fully revalidate the caller's session: the token must be one this
 * server issued, unexpired, not idle and not revoked, and the account must still
 * exist and be ACTIVE. ADMIN is re-derived from the server-side allowlist on every call.
 */
export async function getSessionContext(req: NextRequest): Promise<SessionContext | null> {
  const token = getSessionCookieValue(req);
  if (!token) return null;
  const manager = getSessionManager();
  if (!manager) return null;
  const session = await manager.validateSession(token);
  if (!session) return null;
  const stored = db.getUserById(session.userId);
  if (!stored) {
    // The account is unknown to this instance's user store. Do not revoke the shared
    // session from here; just refuse the request.
    return null;
  }
  if (stored.accountStatus !== 'ACTIVE') {
    await manager.revokeSession(token).catch(() => undefined);
    return null;
  }
  return { user: toEffectiveUser(stored, getAdminUidAllowlist()), session };
}

export async function getSessionUser(req: NextRequest): Promise<User | null> {
  return (await getSessionContext(req))?.user ?? null;
}

export async function requireSession(
  req: NextRequest
): Promise<{ user: User; error?: never } | { user?: never; error: NextResponse }> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const csrfError = verifySameOrigin(req);
    if (csrfError) return { error: csrfError };
  }

  const user = await getSessionUser(req);
  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in.' },
        { status: 401 }
      ),
    };
  }
  return { user };
}

export async function requireCapability(
  req: NextRequest,
  requiredRole: UserRole
): Promise<{ user: User; error?: never } | { user?: never; error: NextResponse }> {
  const session = await requireSession(req);
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

function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: maxAgeSeconds,
  };
}

/**
 * Start a new session for `userId` on `response`. Any session presented with the
 * request is revoked first (rotation on every sign-in / privilege change, which also
 * defeats session fixation). Throws SessionConfigurationError if sessions are
 * disabled, or the store's error if the session backend is unreachable.
 */
export async function issueSession(response: NextResponse, req: NextRequest, userId: string): Promise<void> {
  const manager = getSessionManager();
  if (!manager) throw new SessionConfigurationError();
  const { token } = await manager.rotateSession(getSessionCookieValue(req), {
    userId,
    userAgent: getUserAgent(req),
  });
  response.cookies.set(getSessionCookieName(), token, sessionCookieOptions(Math.floor(manager.config.absoluteTtlMs / 1000)));
  // The pre-hardening cookie carried a raw user ID; make sure it is gone.
  response.cookies.set(LEGACY_SESSION_COOKIE_NAME, '', sessionCookieOptions(0));
}

/** Revoke the session presented with this request (server-side). */
export async function revokeRequestSession(req: NextRequest): Promise<void> {
  const token = getSessionCookieValue(req);
  if (!token) return;
  await getSessionManager()?.revokeSession(token);
}

/** Revoke every session belonging to a user (e.g. account deletion). */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await getSessionManager()?.revokeAllForUser(userId);
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(getSessionCookieName(), '', sessionCookieOptions(0));
  response.cookies.set(LEGACY_SESSION_COOKIE_NAME, '', sessionCookieOptions(0));
}
