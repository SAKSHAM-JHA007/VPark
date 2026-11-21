type Env = Record<string, string | undefined>;

export interface VerifiedFirebaseIdentity {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
}

export type FirebaseTokenVerifier = (idToken: string, projectId: string) => Promise<Record<string, unknown>>;

export type FirebaseVerificationResult =
  | { ok: true; identity: VerifiedFirebaseIdentity }
  | { ok: false; status: 400 | 401 | 503; reason: string; detail?: string };

export const GOOGLE_SIGN_IN_PROVIDER: 'google.com';
export const MAX_ID_TOKEN_LENGTH: number;
export const DEFAULT_MAX_AUTH_AGE_SECONDS: number;

export function getFirebaseProjectId(env?: Env): string | null;
export function getFirebaseConfigError(env?: Env): string | null;
export function isWellFormedIdToken(token: unknown): token is string;
export function evaluateFirebaseClaims(
  claims: unknown,
  options: { projectId: string | null; nowSeconds?: number; maxAuthAgeSeconds?: number; requiredProvider?: string }
): { ok: true; identity: VerifiedFirebaseIdentity } | { ok: false; reason: string };
export function verifyFirebaseIdToken(
  idToken: unknown,
  options: { verifier?: FirebaseTokenVerifier; env?: Env; now?: () => number; maxAuthAgeSeconds?: number }
): Promise<FirebaseVerificationResult>;
export function createFirebaseAdminVerifier(): FirebaseTokenVerifier;
