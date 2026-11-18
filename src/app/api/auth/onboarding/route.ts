import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getClientIp, getUserAgent, requireSession } from '@/lib/auth';
import { normalizeIndianPhone } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// POST /api/auth/onboarding - Complete name, optional email, and record DPDP consent (PRD 6.2)
export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session.error) return session.error;

  try {
    const body = await req.json();
    const { fullName, email, phone, providerType, acceptTerms } = body;

    let normalizedPhone: string | undefined = undefined;
    if (phone && typeof phone === 'string' && phone.trim()) {
      const norm = normalizeIndianPhone(phone.trim());
      if (!norm) {
        return NextResponse.json(
          { success: false, error: 'Invalid mobile number. Please enter a valid 10-digit Indian mobile number starting with 6-9.' },
          { status: 400 }
        );
      }
      normalizedPhone = norm;
    }

    const result = db.completeOnboarding({
      userId: session.user.id,
      fullName: String(fullName || ''),
      phone: normalizedPhone,
      email: typeof email === 'string' ? email : undefined,
      providerType,
      acceptTerms: Boolean(acceptTerms),
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: result.user,
      consents: result.consents,
      message: 'Account profile & consent recorded.',
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save onboarding details.' }, { status: 500 });
  }
}

