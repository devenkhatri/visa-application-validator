// app/api/reviews/route.ts — POST: create a new review session
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reviews } from '@/lib/db/schema';
import crypto from 'crypto';

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
