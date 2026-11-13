import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, verifySameOrigin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrfError = verifySameOrigin(req);
  if (csrfError) return csrfError;

  const response = NextResponse.json({ success: true, message: 'Signed out.' });
  clearSessionCookie(response);
  return response;
}

