// lib/ai/ocrCache.ts — MD5 hash-based OCR cache (90-day TTL)
import crypto from 'crypto';
import { db } from '@/lib/db';
import { documentExtractions } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { OCR_MODEL } from './openrouter';
import type { RawExtraction } from './types';

export function hashFile(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

export async function getCachedExtraction(hash: string): Promise<RawExtraction | null> {
  const now = new Date().toISOString();
  const result = await db
    .select()
    .from(documentExtractions)
    .where(
      and(
        eq(documentExtractions.documentHash, hash),
        eq(documentExtractions.isValid, true),
        gt(documentExtractions.expiresAt, now),
      ),
    )
    .limit(1);

  if (!result[0]) return null;
  return result[0].extractedData as unknown as RawExtraction;
}

export async function cacheExtraction(
  hash: string,
  documentType: string,
  extraction: RawExtraction,
): Promise<void> {
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  await db
    .insert(documentExtractions)
    .values({
      id:              crypto.randomUUID(),
      documentHash:    hash,
      documentType,
      extractedData:   extraction as unknown as Record<string, unknown>,
      ocrModel:        OCR_MODEL,
      confidenceScore: extraction.confidence_score,
      expiresAt,
    })
    .onConflictDoNothing();
}
