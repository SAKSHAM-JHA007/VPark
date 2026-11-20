import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, revokeRequestSession, verifySameOrigin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrfError = verifySameOrigin(req);
  if (csrfError) return csrfError;

  // Revoke server-side first so a copied cookie cannot be replayed after sign-out.
  try {
    await revokeRequestSession(req);
  } catch (error) {
    console.error('[auth] Server-side sign-out failed:', error instanceof Error ? error.message : error);
    const failed = NextResponse.json(
      { success: false, error: 'Sign-out could not be completed on the server. Please try again.' },
      { status: 503 }
    );
    clearSessionCookie(failed);
    return failed;
  }

  const response = NextResponse.json({ success: true, message: 'Signed out.' });
  clearSessionCookie(response);
  return response;
}
