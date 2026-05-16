// app/api/reviews/[id]/timeline/route.ts
// GET: Returns all application_events for this review, ordered by created_at
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { applicationEvents, reviews } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

export async function GET(
  _req: Request,
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

    const events = await db
      .select()
      .from(applicationEvents)
      .where(eq(applicationEvents.reviewId, reviewId))
      .orderBy(asc(applicationEvents.createdAt));

    return NextResponse.json({ review: review[0], events }, { status: 200 });
  } catch (err) {
    console.error('[GET /api/reviews/[id]/timeline]', err);
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 });
  }
}
