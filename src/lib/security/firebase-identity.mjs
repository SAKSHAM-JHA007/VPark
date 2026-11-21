// Server-side verification of Firebase Authentication ID tokens.
//
// Cryptographic verification (RS256 signature against Google's published
// securetoken keys, plus audience / issuer / expiry checks) is delegated to the
// official Firebase Admin SDK. On top of that, this module enforces VPark's own
// identity policy on the verified claims (Google provider only, verified email,
// fresh sign-in) and re-checks the project binding as defence in depth.
//
// The verifier is injected so the policy can be unit-tested with mocks; tests
// never need live Firebase credentials.

export const GOOGLE_SIGN_IN_PROVIDER = 'google.com';
export const MAX_ID_TOKEN_LENGTH = 4096;
/** The ID token must come from a sign-in that happened within this window. */
export const DEFAULT_MAX_AUTH_AGE_SECONDS = 10 * 60;
const CLOCK_SKEW_SECONDS = 60;

const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,38}[a-z0-9]$/;
const SIGNED_JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The Firebase project whose ID tokens this server accepts. Read from server
 * configuration only; there is deliberately no hard-coded fallback.
 */
export function getFirebaseProjectId(env = process.env) {
  const raw = (env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '').trim();
  return PROJECT_ID_PATTERN.test(raw) ? raw : null;
}

/** Returns a description of why Google sign-in cannot be served, or null if configured. */
export function getFirebaseConfigError(env = process.env) {
  if (!getFirebaseProjectId(env)) {
    return 'FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID) is not configured.';
  }
  // The Admin SDK skips signature verification when pointed at the Auth emulator.
  if (env.NODE_ENV === 'production' && env.FIREBASE_AUTH_EMULATOR_HOST) {
    return 'FIREBASE_AUTH_EMULATOR_HOST must never be set in production.';
  }
  return null;
}

export function isWellFormedIdToken(token) {
  return (
    typeof token === 'string' &&
    token.length >= 20 &&
    token.length <= MAX_ID_TOKEN_LENGTH &&
    SIGNED_JWT_PATTERN.test(token)
  );
}

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function cleanHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Apply VPark's identity policy to claims that a verifier has already
 * cryptographically validated. Returns the identity derived *only* from the
 * token, never from request-body fields.
 */
export function evaluateFirebaseClaims(
  claims,
  {
    projectId,
    nowSeconds = Math.floor(Date.now() / 1000),
    maxAuthAgeSeconds = DEFAULT_MAX_AUTH_AGE_SECONDS,
    requiredProvider = GOOGLE_SIGN_IN_PROVIDER,
  } = {}
) {
  const reject = (reason) => ({ ok: false, reason });
  if (!projectId) return reject('project-not-configured');
  if (!claims || typeof claims !== 'object') return reject('malformed-claims');

  if (claims.aud !== projectId) return reject('wrong-audience');
  if (claims.iss !== `https://securetoken.google.com/${projectId}`) return reject('wrong-issuer');

  const sub = claims.sub;
  if (typeof sub !== 'string' || sub.length === 0 || sub.length > 128) return reject('invalid-subject');
  if (claims.uid !== undefined && claims.uid !== sub) return reject('invalid-subject');

  const { exp, iat } = claims;
  const authTime = claims.auth_time;
  if (!Number.isFinite(exp) || exp <= nowSeconds) return reject('expired');
  if (!Number.isFinite(iat) || iat > nowSeconds + CLOCK_SKEW_SECONDS) return reject('issued-in-future');
  if (!Number.isFinite(authTime) || authTime > nowSeconds + CLOCK_SKEW_SECONDS) return reject('invalid-auth-time');
  if (nowSeconds - authTime > maxAuthAgeSeconds) return reject('stale-sign-in');

  const provider = claims.firebase && claims.firebase.sign_in_provider;
  if (provider !== requiredProvider) return reject('wrong-provider');

  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return reject('missing-email');
  if (claims.email_verified !== true) return reject('email-not-verified');

  return {
    ok: true,
    identity: {
      uid: sub,
      email,
      name: cleanString(claims.name, 120),
      picture: cleanHttpsUrl(claims.picture),
    },
  };
}

/**
 * Verify an ID token end to end. `verifier(idToken, projectId)` must perform the
 * cryptographic verification and resolve to the decoded claims (or reject).
 */
export async function verifyFirebaseIdToken(
  idToken,
  { verifier, env = process.env, now = () => Date.now(), maxAuthAgeSeconds } = {}
) {
  const configError = getFirebaseConfigError(env);
  if (configError) {
    return { ok: false, status: 503, reason: 'not-configured', detail: configError };
  }
  if (typeof verifier !== 'function') {
    return { ok: false, status: 503, reason: 'not-configured', detail: 'No ID token verifier is available.' };
  }
  if (idToken === undefined || idToken === null || idToken === '') {
    return { ok: false, status: 400, reason: 'missing-token' };
  }
  if (!isWellFormedIdToken(idToken)) {
    return { ok: false, status: 401, reason: 'malformed-token' };
  }

  const projectId = getFirebaseProjectId(env);
  let claims;
  try {
    claims = await verifier(idToken, projectId);
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : 'verification-failed';
    return { ok: false, status: 401, reason: 'verification-failed', detail: code };
  }

  const evaluated = evaluateFirebaseClaims(claims, {
    projectId,
    nowSeconds: Math.floor(now() / 1000),
    maxAuthAgeSeconds,
  });
  if (!evaluated.ok) return { ok: false, status: 401, reason: evaluated.reason };
  return { ok: true, identity: evaluated.identity };
}

/**
 * Production verifier backed by the Firebase Admin SDK. Verifying ID tokens only
 * needs the (public) project ID: the SDK fetches Google's public signing keys.
 * No service-account credential is required or used here.
 */
export function createFirebaseAdminVerifier() {
  return async function firebaseAdminVerify(idToken, projectId) {
    const { initializeApp, getApps } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    const appName = `vpark-id-token-verifier-${projectId}`;
    const app = getApps().find((a) => a.name === appName) || initializeApp({ projectId }, appName);
    return getAuth(app).verifyIdToken(idToken, false);
  };
}
