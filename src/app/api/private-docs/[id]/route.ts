import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// Restricted access & audit-logged verification file retrieval (PRD Section 7.3)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireSession(req);
  if (session.error) return session.error;

  const access = db.getPrivateDocumentForActor(params.id, session.user.id);
  if (!access.allowed || !access.doc) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const doc = access.doc;
  if (doc.storageKey) {
    const filePath = path.join(db.getPrivateUploadsDir(), path.basename(doc.storageKey));
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath);
      const ext = path.extname(doc.storageKey).toLowerCase();
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': MIME_MAP[ext] || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${doc.fileName}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }
  }

  // Fallback structured metadata certificate for seeded pilot verification records
  return NextResponse.json({
    success: true,
    restricted: true,
    auditLogged: true,
    document: {
      id: doc.id,
      listingTitle: access.listingTitle,
      docType: doc.docType,
      fileName: doc.fileName,
      status: doc.status,
      uploadedAt: doc.uploadedAt,
      verifiedAt: doc.verifiedAt,
    },
  });
}

