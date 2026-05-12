// app/api/reviews/[id]/documents/route.ts — POST: upload a document
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents, reviews } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashFile } from '@/lib/ai/ocrCache';
import crypto from 'crypto';

// App Router route handlers use the Web Request API natively — no bodyParser config needed

// Allowed MIME types
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reviewId } = await params;

    // Verify review exists
    const review = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!review[0]) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file         = formData.get('file') as File | null;
    const documentType = formData.get('documentType') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type '${file.type}' not allowed. Use PDF, JPG, or PNG.` },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 10 MB.` },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);
    const hash        = hashFile(buffer);
    const docId       = crypto.randomUUID();

    await db.insert(documents).values({
      id:           docId,
      reviewId,
      documentType: documentType ?? 'other',
      filename:     file.name,
      mimeType:     file.type,
      documentHash: hash,
      fileData:     buffer,
    });

    return NextResponse.json({ documentId: docId, filename: file.name, hash });
  } catch (err) {
    console.error('[POST /api/reviews/[id]/documents]', err);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
