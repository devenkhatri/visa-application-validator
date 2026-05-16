// app/api/reviews/[id]/start/route.ts — POST: trigger the AI review pipeline
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reviews, documents, reviewResults, checklistProfiles, applicationEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashFile, getCachedExtraction, cacheExtraction } from '@/lib/ai/ocrCache';
import { extractDocument } from '@/lib/ai/ocr';
import { analyseApplication } from '@/lib/ai/analysis';
import { scrubPII } from '@/lib/ai/scrubPII';
import type { RawExtraction, PersonalisedChecklist } from '@/lib/ai/types';
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

  // Reset status to processing (allows re-run)
  await db
    .update(reviews)
    .set({ status: 'processing', completedAt: null })
    .where(eq(reviews.id, reviewId));

  // Fire-and-forget — intentionally not awaited
  void processReviewInBackground(reviewId, review[0].checklistId);

  return NextResponse.json({ status: 'processing' });
}

// ─── Helper: log a pipeline event ─────────────────────────────────────────────
async function logEvent(
  reviewId:      string,
  stage:         string,
  outputSummary: Record<string, unknown>,
  durationMs:    number,
  status:        'completed' | 'failed' | 'skipped' = 'completed',
) {
  try {
    await db.insert(applicationEvents).values({
      id:            crypto.randomUUID(),
      reviewId,
      stage,
      status,
      outputSummary,
      durationMs,
    });
  } catch (e) {
    // Never let event logging crash the main pipeline
    console.error('[logEvent] failed to write event:', stage, e);
  }
}

// ─── Background pipeline ──────────────────────────────────────────────────────
async function processReviewInBackground(reviewId: string, checklistId: string) {
  const pipelineStart = Date.now();

  try {
    // ── Stage 0: Load personalised checklist (if questionnaire was completed) ──
    const stageQStart = Date.now();
    const profileRows = await db
      .select()
      .from(checklistProfiles)
      .where(eq(checklistProfiles.reviewId, reviewId))
      .limit(1);

    const profile = profileRows[0] ?? null;
    const personalisedChecklist = profile
      ? (profile.generatedChecklist as unknown as PersonalisedChecklist)
      : undefined;

    const checklistItemCount = personalisedChecklist?.checklist_items?.length ?? 0;

    await logEvent(reviewId, 'QUESTIONNAIRE_COMPLETE', {
      has_personalised_checklist: !!personalisedChecklist,
      checklist_item_count:       checklistItemCount,
      profile_flags:              profile?.profileFlags ?? [],
    }, Date.now() - stageQStart);

    // ── Stage 1: Load documents ───────────────────────────────────────────────
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.reviewId, reviewId));

    if (docs.length === 0) {
      throw new Error('No documents found for this review');
    }

    // ── Stage 2+3: OCR each document (cache check → extract → cache write) ───
    const extractions: RawExtraction[] = [];
    let cacheHits = 0;

    for (const doc of docs) {
      const buffer = doc.fileData as Buffer;
      const hash   = hashFile(buffer);

      const cacheCheckStart = Date.now();
      let extraction = await getCachedExtraction(hash);

      if (extraction) {
        cacheHits++;
        await logEvent(reviewId, 'OCR_CACHE_CHECK', {
          cache_hit:     true,
          filename:      doc.filename,
          document_type: doc.documentType,
        }, Date.now() - cacheCheckStart);
        console.log(`[OCR] Cache HIT for ${doc.filename} (${hash})`);
      } else {
        await logEvent(reviewId, 'OCR_CACHE_CHECK', {
          cache_hit:     false,
          filename:      doc.filename,
          document_type: doc.documentType,
        }, Date.now() - cacheCheckStart);

        const ocrStart = Date.now();
        console.log(`[OCR] Cache MISS for ${doc.filename} — calling LLM`);
        extraction = await extractDocument(buffer, doc.mimeType, doc.documentType);
        await cacheExtraction(hash, doc.documentType, extraction);

        await logEvent(reviewId, 'OCR_EXTRACTION', {
          filename:        doc.filename,
          document_type:   doc.documentType,
          confidence:      extraction.confidence_score,
          engine:          extraction.ocr_engine ?? 'openrouter',
          warnings:        extraction.warnings,
        }, Date.now() - ocrStart);
      }

      extractions.push(extraction);
    }

    // ── Stage 4: PII scrubbing ────────────────────────────────────────────────
    const piiStart  = Date.now();
    const scrubbed  = scrubPII(extractions);
    const fieldsOut = scrubbed.reduce(
      (acc, d) => acc + Object.keys(d.field_summary).length, 0,
    );
    await logEvent(reviewId, 'PII_SCRUB', {
      documents_scrubbed:   extractions.length,
      fields_in_summary:    fieldsOut,
      passport_numbers_out: true,
      balances_out:         true,
    }, Date.now() - piiStart);

    // ── Stage 5: Claude gap analysis ─────────────────────────────────────────
    const analysisStart = Date.now();
    const result = await analyseApplication(
      checklistId,
      extractions,
      scrubbed,
      personalisedChecklist,
    );
    await logEvent(reviewId, 'CLAUDE_ANALYSIS', {
      overall_score: result.overall_score,
      verdict:       result.verdict,
      gap_count:     result.gap_analysis.length,
      used_personalised_checklist: !!personalisedChecklist,
    }, Date.now() - analysisStart);

    // ── Stage 6: Save results + report generated ──────────────────────────────
    const reportStart = Date.now();

    // Delete any previous result for re-run scenario
    await db.delete(reviewResults).where(eq(reviewResults.reviewId, reviewId));

    await db.insert(reviewResults).values({
      id:             crypto.randomUUID(),
      reviewId,
      gapAnalysis:    result.gap_analysis as unknown as Record<string, unknown>[],
      overallScore:   result.overall_score,
      scoreBreakdown: result.score_breakdown as unknown as Record<string, number>,
      verdict:        result.verdict,
      scrubbedInput:  scrubbed as unknown as Record<string, unknown>[],
    });

    await logEvent(reviewId, 'REPORT_GENERATED', {
      overall_score: result.overall_score,
      verdict:       result.verdict,
      total_duration_ms: Date.now() - pipelineStart,
      cache_hits:    cacheHits,
      total_docs:    docs.length,
    }, Date.now() - reportStart);

    // Mark completed
    await db
      .update(reviews)
      .set({ status: 'completed', completedAt: new Date().toISOString() })
      .where(eq(reviews.id, reviewId));

    console.log(`[Review ${reviewId}] completed — score: ${result.overall_score} in ${Date.now() - pipelineStart}ms`);

  } catch (err) {
    console.error(`[Review ${reviewId}] failed:`, err);
    await logEvent(reviewId, 'PIPELINE_ERROR', {
      error: err instanceof Error ? err.message : String(err),
    }, Date.now() - pipelineStart, 'failed');
    await db
      .update(reviews)
      .set({ status: 'failed' })
      .where(eq(reviews.id, reviewId));
  }
}
