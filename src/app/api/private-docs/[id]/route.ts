import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { errorResponse, requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function safeFileName(name: string): string {
  return (name || 'document').replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 120);
}

// Restricted access & audit-logged verification file retrieval (PRD Section 7.3)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession(req);
  if (session.error) return session.error;

  // session.user has effective roles (ADMIN only when allowlisted).
  let access: Awaited<ReturnType<typeof db.getPrivateDocumentForActor>>;
  let uploadsDir: string | null;
  try {
    access = await db.getPrivateDocumentForActor(params.id, session.user);
    // Local private uploads exist only for the JSON development store.
    uploadsDir = await db.getPrivateUploadsDir();
  } catch (error) {
    return errorResponse(error, 'Failed to retrieve document', 'Private document error');
  }
  if (!access.allowed || !access.doc) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const doc = access.doc;
  if (doc.storageKey && uploadsDir) {
    const filePath = path.join(uploadsDir, path.basename(doc.storageKey));
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath);
      const ext = path.extname(doc.storageKey).toLowerCase();
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': MIME_MAP[ext] || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${safeFileName(doc.fileName)}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
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

