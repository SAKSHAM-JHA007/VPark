import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';
import {
  checkAuthIpRateLimit,
  errorResponse,
  getClientIp,
  getSessionManager,
  issueSession,
  sessionUnavailableResponse,
  verifySameOrigin,
} from './auth';
import { verifyFirebaseIdToken, type FirebaseTokenVerifier } from './security/firebase-identity.mjs';
import {
  getAdminUidAllowlist,
  isAllowlistedAdminUid,
  toEffectiveUser,
  toPublicUser,
} from './security/access-policy.mjs';

export interface GoogleSignInDependencies {
  /** Cryptographically verifies a Firebase ID token and resolves to its claims. */
  verifier: FirebaseTokenVerifier;
  now?: () => number;
}

const FAILURE_MESSAGES: Record<number, string> = {
  400: 'A Google ID token is required.',
  401: 'Google sign-in could not be verified. Please try again.',
  503: 'Google sign-in is not available on this server right now.',
};

/**
 * POST /api/auth/google
 *
 * Body: { idToken: string, intent?: 'driver' | 'provider' }
 *
 * Identity (UID, email, name, photo) is taken exclusively from the verified ID
 * token. Any uid/email/name/role fields in the body are ignored. No account is
 * created or modified until verification succeeds, and ADMIN is granted only to
 * UIDs on the server-side VPARK_ADMIN_FIREBASE_UIDS allowlist.
 */
export function createGoogleSignInHandler(deps: GoogleSignInDependencies) {
  return async function handleGoogleSignIn(req: NextRequest): Promise<NextResponse> {
    const csrfError = verifySameOrigin(req);
    if (csrfError) return csrfError;

    if (!checkAuthIpRateLimit(getClientIp(req))) {
      return NextResponse.json(
        { success: false, error: 'Too many sign-in attempts from this network. Try again later.' },
        { status: 429 }
      );
    }

    // Fail closed before touching any account if sessions cannot be issued.
    if (!getSessionManager()) return sessionUnavailableResponse();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }
    const { idToken, intent } = (body && typeof body === 'object' ? body : {}) as {
      idToken?: unknown;
      intent?: unknown;
    };

    const verification = await verifyFirebaseIdToken(idToken, { verifier: deps.verifier, now: deps.now });
    if (!verification.ok) {
      // Log the reason only; never the token itself.
      console.warn(`[auth/google] Rejected sign-in: ${verification.reason}${verification.detail ? ` (${verification.detail})` : ''}`);
      return NextResponse.json(
        { success: false, error: FAILURE_MESSAGES[verification.status] },
        { status: verification.status }
      );
    }

    const { identity } = verification;
    const allowlist = getAdminUidAllowlist();
    const isAdmin = isAllowlistedAdminUid(identity.uid, allowlist);

    let result: Awaited<ReturnType<typeof db.upsertVerifiedGoogleUser>>;
    try {
      result = await db.upsertVerifiedGoogleUser({
        uid: identity.uid,
        email: identity.email,
        name: identity.name,
        photoUrl: identity.picture,
        intent: intent === 'provider' ? 'provider' : 'driver',
        grantAdmin: isAdmin,
      });
    } catch (error) {
      return errorResponse(error, 'Google sign-in failed.', 'Google sign-in account update failed');
    }
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const effectiveUser = toEffectiveUser(result.user, allowlist);
    const onboardingRequired =
      !isAdmin &&
      (!effectiveUser.phone || (effectiveUser.vehicles.length === 0 && effectiveUser.roles.includes('DRIVER')));

    const response = NextResponse.json({
      success: true,
      user: toPublicUser(effectiveUser),
      isMasterAdmin: isAdmin,
      onboardingRequired,
      message: isAdmin ? 'Administrator authenticated via Google.' : 'Signed in with Google.',
    });

    try {
      await issueSession(response, req, result.user.id);
    } catch {
      return sessionUnavailableResponse();
    }
    return response;
  };
}
