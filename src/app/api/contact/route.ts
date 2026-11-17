import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getClientIp, verifySameOrigin } from '@/lib/auth';

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

    const messageRecord = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
      ip,
      userAgent: req.headers.get('user-agent') || 'unknown',
      createdAt: new Date().toISOString(),
      status: 'UNREAD',
    };

    // Save to persistent file storage in .data
    const dataDir = path.resolve(process.cwd(), '.data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const messagesFile = path.join(dataDir, 'contact_messages.json');

    let existingMessages: any[] = [];
    if (fs.existsSync(messagesFile)) {
      try {
        const fileContent = fs.readFileSync(messagesFile, 'utf-8');
        existingMessages = JSON.parse(fileContent);
        if (!Array.isArray(existingMessages)) existingMessages = [];
      } catch {
        existingMessages = [];
      }
    }

    existingMessages.push(messageRecord);
    fs.writeFileSync(messagesFile, JSON.stringify(existingMessages, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Thank you for reaching out. We have received your inquiry and will reply within 24 hours.',
      id: messageRecord.id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Invalid request payload.' },
      { status: 400 }
    );
  }
}
