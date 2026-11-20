import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, serializeUser } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
  const session = await requireSession(req);
  if (session.error) return session.error;

  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required.' }, { status: 400 });
    }

    const result = db.updateUserEmail(session.user.id, String(email));
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: serializeUser(result.user),
      message: 'Email address saved.',
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update profile.' }, { status: 500 });
  }
}

