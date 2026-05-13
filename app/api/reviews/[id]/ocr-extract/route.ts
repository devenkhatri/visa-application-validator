// app/api/reviews/[id]/ocr-extract/route.ts — POST: run OCR extractions and return to frontend for editing
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reviews, documents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashFile, getCachedExtraction, cacheExtraction } from '@/lib/ai/ocrCache';
import { extractDocument } from '@/lib/ai/ocr';
import type { RawExtraction } from '@/lib/ai/types';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reviewId } = await params;

  // 1. Verify review exists
  const review = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!review[0]) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  }

  // Set status to processing to indicate pipeline activation
  await db
    .update(reviews)
    .set({ status: 'processing' })
    .where(eq(reviews.id, reviewId));

  // 2. Fetch uploaded documents
  const docs = await db
    .select()
    .from(documents)
    .where(eq(documents.reviewId, reviewId));

  if (docs.length === 0) {
    return NextResponse.json({ error: 'No documents found for this review' }, { status: 400 });
  }

  // 3. Perform OCR extractions sequentially (using SQLite caching)
  const results: Array<{
    docId:        string;
    filename:     string;
    documentType: string;
    hash:         string;
    extraction:   RawExtraction;
  }> = [];

  for (const doc of docs) {
    const buffer = doc.fileData as Buffer;
    const hash   = hashFile(buffer);

    let extraction = await getCachedExtraction(hash);

    if (extraction) {
      console.log(`[OCR Client-Extract] Cache HIT for ${doc.filename} (${hash})`);
    } else {
      console.log(`[OCR Client-Extract] Cache MISS for ${doc.filename} — running active OCR`);
      extraction = await extractDocument(buffer, doc.mimeType, doc.documentType);
      await cacheExtraction(hash, doc.documentType, extraction);
    }

    results.push({
      docId:        doc.id,
      filename:     doc.filename,
      documentType: doc.documentType,
      hash,
      extraction,
    });
  }

  return NextResponse.json({ extractions: results });
}
