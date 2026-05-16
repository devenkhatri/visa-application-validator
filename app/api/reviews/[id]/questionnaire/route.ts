// app/api/reviews/[id]/questionnaire/route.ts
// POST: Accept 6 questionnaire answers, call Claude to generate personalised checklist,
//       store in checklist_profiles, return the checklist.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reviews, checklistProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { buildPersonalisedChecklist } from '@/lib/ai/checklistBuilder';
import type { QuestionnaireAnswers } from '@/lib/ai/types';
import crypto from 'crypto';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reviewId } = await params;

  try {
    // Verify review exists
    const review = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!review[0]) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const answers = await req.json() as QuestionnaireAnswers;

    // Validate all 6 answers are present
    const requiredFields: (keyof QuestionnaireAnswers)[] = [
      'employment_status',
      'purpose_of_visit',
      'prior_travel_destination',
      'prior_international_travel',
      'property_ownership',
      'monthly_balance_range',
    ];
    const missing = requiredFields.filter(f => !answers[f]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing questionnaire fields: ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    // Generate personalised checklist via Claude
    const checklist = await buildPersonalisedChecklist(review[0].checklistId, answers);

    // Delete any existing profile for this review (re-run scenario)
    await db
      .delete(checklistProfiles)
      .where(eq(checklistProfiles.reviewId, reviewId));

    // Store the result
    await db.insert(checklistProfiles).values({
      id:                   crypto.randomUUID(),
      reviewId,
      baseChecklistId:      review[0].checklistId,
      questionnaireAnswers: answers as unknown as Record<string, string>,
      generatedChecklist:   checklist as unknown as Record<string, unknown>,
      profileFlags:         checklist.profile_flags,
      highRiskFactors:      checklist.high_risk_factors,
      strengths:            checklist.strengths,
      specialInstructions:  checklist.special_instructions,
    });

    return NextResponse.json({ checklist }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/reviews/[id]/questionnaire]', err);
    return NextResponse.json({ error: 'Failed to generate checklist' }, { status: 500 });
  }
}

// GET: Return the stored personalised checklist for this review (used by upload page)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reviewId } = await params;

  try {
    const profile = await db
      .select()
      .from(checklistProfiles)
      .where(eq(checklistProfiles.reviewId, reviewId))
      .limit(1);

    if (!profile[0]) {
      return NextResponse.json({ checklist: null }, { status: 200 });
    }

    return NextResponse.json({ checklist: profile[0].generatedChecklist }, { status: 200 });
  } catch (err) {
    console.error('[GET /api/reviews/[id]/questionnaire]', err);
    return NextResponse.json({ error: 'Failed to fetch checklist' }, { status: 500 });
  }
}
