// app/api/reviews/[id]/result/route.ts — GET: full analysis result
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reviews, reviewResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Verify review exists
    const review = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);

    if (!review[0]) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    if (review[0].status !== 'completed') {
      return NextResponse.json(
        { error: 'Review not yet completed', status: review[0].status },
        { status: 202 },
      );
    }

    const result = await db
      .select()
      .from(reviewResults)
      .where(eq(reviewResults.reviewId, id))
      .limit(1);

    if (!result[0]) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 });
    }

    return NextResponse.json({
      review:  review[0],
      result:  result[0],
    });
  } catch (err) {
    console.error('[GET /api/reviews/[id]/result]', err);
    return NextResponse.json({ error: 'Failed to get result' }, { status: 500 });
  }
}
