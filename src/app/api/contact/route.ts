import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getClientIp, verifySameOrigin } from '@/lib/auth';
import { db, isDataStoreUnavailable } from '@/lib/db';

export const dynamic = 'force-dynamic';

const contactIpBuckets = new Map<string, { count: number; resetAt: number }>();

function checkContactRateLimit(ip: string, limit = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const bucket = contactIpBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    contactIpBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) {
    return false;
  }
  bucket.count += 1;
  return true;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const csrfError = verifySameOrigin(req);
  if (csrfError) return csrfError;

  const ip = getClientIp(req);
  if (!checkContactRateLimit(ip)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many messages sent from your network. Please wait a few minutes before trying again.',
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { name, email, subject, message, hp } = body;

    // Spam honeypot detection: bots fill hidden hp field
    if (hp && String(hp).trim().length > 0) {
      // Deceive bot with 200 OK without saving
      return NextResponse.json({
        success: true,
        message: 'Your inquiry has been received. Our team will get back to you shortly.',
      });
    }

    // Validation
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim() : '';
    const cleanSubject = typeof subject === 'string' ? subject.trim() : '';
    const cleanMessage = typeof message === 'string' ? message.trim() : '';

    if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid name between 2 and 80 characters.' },
        { status: 400 }
      );
    }

    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail) || cleanEmail.length > 120) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (!cleanSubject || cleanSubject.length < 3 || cleanSubject.length > 150) {
      return NextResponse.json(
        { success: false, error: 'Please provide a descriptive subject between 3 and 150 characters.' },
        { status: 400 }
      );
    }

    if (!cleanMessage || cleanMessage.length < 10 || cleanMessage.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Message must be between 10 and 2000 characters.' },
        { status: 400 }
      );
    }

    // Stored in the application data store (PostgreSQL in production), not a local file.
    const messageRecord = await db.createContactMessage({
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
      ip,
      userAgent: (req.headers.get('user-agent') || 'unknown').slice(0, 300),
    });

    return NextResponse.json({
      success: true,
      message: 'Thank you for reaching out. We have received your inquiry and will reply within 24 hours.',
      id: messageRecord.id,
    });
  } catch (err: unknown) {
    if (isDataStoreUnavailable(err)) return errorResponse(err, 'Unable to send your message right now.', 'Contact message store');
    return NextResponse.json(
      { success: false, error: 'Invalid request payload.' },
      { status: 400 }
    );
  }
}
