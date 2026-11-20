import { createGoogleSignInHandler } from '@/lib/auth-google';
import { createFirebaseAdminVerifier } from '@/lib/security/firebase-identity.mjs';

export const dynamic = 'force-dynamic';

// Server-side Firebase ID token verification via the Firebase Admin SDK.
// See src/lib/auth-google.ts for the identity and admin-allowlist policy.
export const POST = createGoogleSignInHandler({ verifier: createFirebaseAdminVerifier() });
