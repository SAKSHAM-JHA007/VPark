import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { ProviderType, UserRole } from '@/types';
import { issueSession, requireSession, sessionUnavailableResponse, errorResponse } from '@/lib/auth';
import { getAdminUidAllowlist, toEffectiveUser, toPublicUser } from '@/lib/security/access-policy.mjs';

export const dynamic = 'force-dynamic';

const PROVIDER_TYPES: ProviderType[] = ['OWNER', 'OPERATOR', 'MANAGER'];
const ROLES: UserRole[] = ['DRIVER', 'PROVIDER', 'ADMIN'];

export async function POST(req: NextRequest) {
  // requireSession also enforces the same-origin check for this POST.
  const session = await requireSession(req);
  if (session.error) return session.error;

  try {
    const body = await req.json();
    const { action, role, providerType } = body ?? {};

    if (action === 'ADD_CAPABILITY') {
      // ADMIN can never be self-granted; it comes only from the server-side allowlist.
      if (role !== 'DRIVER' && role !== 'PROVIDER') {
        return NextResponse.json(
          { success: false, error: 'Only DRIVER or PROVIDER capabilities can be self-added.' },
          { status: 403 }
        );
      }
      const result = await db.grantCapability(
        session.user.id,
        role,
        PROVIDER_TYPES.includes(providerType) ? (providerType as ProviderType) : undefined
      );
      if (!result.success || !result.user) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      const response = NextResponse.json({
        success: true,
        user: toPublicUser(toEffectiveUser(result.user, getAdminUidAllowlist())),
        message: `${role} mode enabled on your account.`,
      });
      // Capabilities changed: rotate the session token.
      try {
        await issueSession(response, req, session.user.id);
      } catch {
        return sessionUnavailableResponse();
      }
      return response;
    }

    // Default: SWITCH_MODE among capabilities the account is *currently* allowed to use.
    if (!ROLES.includes(role) || !session.user.roles.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Capability ${String(role)} is not enabled on this account.` },
        { status: 403 }
      );
    }
    const result = await db.switchActiveMode(session.user.id, role as UserRole);
    if (!result.success || !result.user) {
      return NextResponse.json({ success: false, error: result.error }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      user: toPublicUser(toEffectiveUser(result.user, getAdminUidAllowlist())),
      message: `Switched active mode to ${role}`,
    });
  } catch (error) {
    return errorResponse(error, 'Failed to update role', 'Role update error');
  }
}
