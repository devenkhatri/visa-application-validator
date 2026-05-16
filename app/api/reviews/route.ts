// app/api/reviews/route.ts — POST: create a new review session | GET: history list
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reviews, reviewResults } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';

// ─── GET: all past reviews for the history page ───────────────────────────────
export async function GET() {
  try {
    const rows = await db
      .select({
        id:             reviews.id,
        checklistId:    reviews.checklistId,
        nationality:    reviews.nationality,
        status:         reviews.status,
        createdAt:      reviews.createdAt,
        completedAt:    reviews.completedAt,
        overallScore:   reviewResults.overallScore,
        verdict:        reviewResults.verdict,
        scoreBreakdown: reviewResults.scoreBreakdown,
      })
      .from(reviews)
      .leftJoin(reviewResults, eq(reviewResults.reviewId, reviews.id))
      .orderBy(desc(reviews.createdAt));

    return NextResponse.json({ reviews: rows }, { status: 200 });
  } catch (err) {
    console.error('[GET /api/reviews]', err);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// ─── POST: create a new review session ───────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { checklistId, nationality } = body as {
      checklistId: string;
      nationality: string;
    };

    if (!checklistId) {
      return NextResponse.json({ error: 'checklistId is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();

    await db.insert(reviews).values({
      id,
      checklistId,
      nationality: nationality ?? null,
      status:      'pending',
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/reviews]', err);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}
