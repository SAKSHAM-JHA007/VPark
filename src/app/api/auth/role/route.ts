import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ProviderType, UserRole } from '@/types';
import { requireSession, setSessionCookie, verifySameOrigin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrfError = verifySameOrigin(req);
  if (csrfError) return csrfError;

  try {
    const body = await req.json();
    const { action, role, switchDemoUser, providerType } = body;

    // Explicit demo evaluation mode switcher (cycles seeded personas without cross-account privilege escalation)
    if (switchDemoUser || action === 'SWITCH_DEMO_PERSONA') {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { success: false, error: 'Demo persona switching is disabled in production environments.' },
          { status: 403 }
        );
      }
      const targetUserId =
        role === 'ADMIN' ? 'usr_admin_1' : role === 'PROVIDER' ? 'usr_owner_1' : 'usr_driver_1';
      const demoUser = db.getUserById(targetUserId);
      if (!demoUser) {
        return NextResponse.json({ success: false, error: 'Demo user not found' }, { status: 404 });
      }
      if (role === 'DRIVER' || role === 'PROVIDER' || role === 'ADMIN') {
        if (demoUser.roles.includes(role)) {
          demoUser.activeRole = role;
        }
      }
      const response = NextResponse.json({
        success: true,
        user: demoUser,
        message: `Switched to demo profile: ${demoUser.name} (${demoUser.activeRole})`,
      });
      setSessionCookie(response, demoUser.id);
      return response;
    }

    // Authenticated capability / mode actions for real signed-in users
    const session = requireSession(req);
    if (session.error) return session.error;

    if (action === 'ADD_CAPABILITY') {
      if (role !== 'DRIVER' && role !== 'PROVIDER') {
        return NextResponse.json(
          { success: false, error: 'Only DRIVER or PROVIDER capabilities can be self-added.' },
          { status: 403 }
        );
      }
      const result = db.grantCapability(
        session.user.id,
        role,
        providerType as ProviderType | undefined
      );
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        user: result.user,
        message: `${role} mode enabled on your account.`,
      });
    }

    // Default: SWITCH_MODE among capabilities user already holds
    const result = db.switchActiveMode(session.user.id, role as UserRole);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      user: result.user,
      message: `Switched active mode to ${role}`,
    });
  } catch (error) {
    console.error('Role update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update role' }, { status: 500 });
  }
}
