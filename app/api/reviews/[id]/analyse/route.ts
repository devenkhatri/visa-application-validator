// app/api/reviews/[id]/analyse/route.ts — POST: accept user-edited OCR extractions and run gap analysis
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reviews, reviewResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { analyseApplication } from '@/lib/ai/analysis';
import { scrubPII } from '@/lib/ai/scrubPII';
import type { RawExtraction } from '@/lib/ai/types';
import crypto from 'crypto';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reviewId } = await params;

  try {
    const body = await req.json() as { extractions?: RawExtraction[] };
    const extractions = body.extractions;

    if (!Array.isArray(extractions) || extractions.length === 0) {
      return NextResponse.json({ error: 'Valid extractions array required' }, { status: 400 });
    }

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

    // Ensure status remains processing
    await db
      .update(reviews)
      .set({ status: 'processing' })
      .where(eq(reviews.id, reviewId));

    // Fire background gap analysis pipeline
    void processAnalysisInBackground(reviewId, review[0].checklistId, extractions);

    return NextResponse.json({ status: 'processing' });
  } catch (err) {
    console.error(`[Analyse Route API] Error reading payload:`, err);
    return NextResponse.json({ error: 'Invalid JSON body payload' }, { status: 400 });
  }
}

// ─── Background Analysis Pipeline ─────────────────────────────────────────────

async function processAnalysisInBackground(
  reviewId:       string,
  checklistId:    string,
  rawExtractions: RawExtraction[],
) {
  try {
    console.log(`[Review ${reviewId}] Triggering Gap Analysis with verified OCR data...`);

    // 1. Execute Gap Analysis reasoning LLM
    const result = await analyseApplication(checklistId, rawExtractions);

    // 2. Perform scrubPII on the verified extractions for persistent PII Explainer views
    const scrubbedInput = scrubPII(rawExtractions);

    // 3. Save comprehensive payload to review_results table
    await db.insert(reviewResults).values({
      id:             crypto.randomUUID(),
      reviewId,
      gapAnalysis:    result.gap_analysis as unknown as Record<string, unknown>[],
      overallScore:   result.overall_score,
      scoreBreakdown: result.score_breakdown as unknown as Record<string, number>,
      verdict:        result.verdict,
      scrubbedInput:  scrubbedInput as unknown as Record<string, unknown>[],
    });

    // 4. Mark session completed
    await db
      .update(reviews)
      .set({ status: 'completed', completedAt: new Date().toISOString() })
      .where(eq(reviews.id, reviewId));

    console.log(`[Review ${reviewId}] Gap Analysis complete — Overall Score: ${result.overall_score}`);
  } catch (err) {
    console.error(`[Review ${reviewId}] Background Gap Analysis failed:`, err);
    await db
      .update(reviews)
      .set({ status: 'failed' })
      .where(eq(reviews.id, reviewId));
  }
}
