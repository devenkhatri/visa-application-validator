// app/api/reviews/[id]/start/route.ts — POST: trigger the AI review pipeline
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reviews, documents, reviewResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashFile, getCachedExtraction, cacheExtraction } from '@/lib/ai/ocrCache';
import { extractDocument } from '@/lib/ai/ocr';
import { analyseApplication } from '@/lib/ai/analysis';
import { scrubPII } from '@/lib/ai/scrubPII';
import type { RawExtraction } from '@/lib/ai/types';
import crypto from 'crypto';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reviewId } = await params;

  // Verify review exists
  const review = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!review[0]) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  }

  if (review[0].status === 'completed') {
    return NextResponse.json({ status: review[0].status });
  }

  // Set status to processing immediately
  await db
    .update(reviews)
    .set({ status: 'processing' })
    .where(eq(reviews.id, reviewId));

  // Fire-and-forget — intentionally not awaited
  void processReviewInBackground(reviewId, review[0].checklistId);

  return NextResponse.json({ status: 'processing' });
}

// ─── Background pipeline ──────────────────────────────────────────────────────

async function processReviewInBackground(reviewId: string, checklistId: string) {
  try {
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.reviewId, reviewId));

    if (docs.length === 0) {
      throw new Error('No documents found for this review');
    }

    // 1. OCR each document (hash → cache check → Mistral → cache write)
    const extractions: RawExtraction[] = [];

    for (const doc of docs) {
      const buffer = doc.fileData as Buffer;
      const hash   = hashFile(buffer);

      let extraction = await getCachedExtraction(hash);

      if (extraction) {
        console.log(`[OCR] Cache HIT for ${doc.filename} (${hash})`);
      } else {
        console.log(`[OCR] Cache MISS for ${doc.filename} — calling LLM`);
        extraction = await extractDocument(buffer, doc.mimeType, doc.documentType);
        await cacheExtraction(hash, doc.documentType, extraction);
      }

      extractions.push(extraction);
    }

    // 2. Gap analysis (scrubPII happens inside analyseApplication)
    const result = await analyseApplication(checklistId, extractions);

    // 3. Store scrubbed input alongside results (used by PII explainer page)
    const scrubbedInput = scrubPII(extractions);

    await db.insert(reviewResults).values({
      id:             crypto.randomUUID(),
      reviewId,
      gapAnalysis:    result.gap_analysis as unknown as Record<string, unknown>[],
      overallScore:   result.overall_score,
      scoreBreakdown: result.score_breakdown as unknown as Record<string, number>,
      verdict:        result.verdict,
      scrubbedInput:  scrubbedInput as unknown as Record<string, unknown>[],
    });

    // 4. Mark completed
    await db
      .update(reviews)
      .set({ status: 'completed', completedAt: new Date().toISOString() })
      .where(eq(reviews.id, reviewId));

    console.log(`[Review ${reviewId}] completed — score: ${result.overall_score}`);
  } catch (err) {
    console.error(`[Review ${reviewId}] failed:`, err);
    await db
      .update(reviews)
      .set({ status: 'failed' })
      .where(eq(reviews.id, reviewId));
  }
}
