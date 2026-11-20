import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, serializeUser, errorResponse } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
  const session = await requireSession(req);
  if (session.error) return session.error;

  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required.' }, { status: 400 });
    }

    const result = await db.updateUserEmail(session.user.id, String(email));
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: serializeUser(result.user),
      message: 'Email address saved.',
    });
  } catch (error) {
    return errorResponse(error, 'Failed to update profile.', 'Update profile error');
  }
}

