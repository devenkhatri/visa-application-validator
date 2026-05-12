// app/api/reviews/[id]/status/route.ts — GET: poll review status
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reviews } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await db
      .select({ status: reviews.status })
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);

    if (!result[0]) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    return NextResponse.json({ status: result[0].status });
  } catch (err) {
    console.error('[GET /api/reviews/[id]/status]', err);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
