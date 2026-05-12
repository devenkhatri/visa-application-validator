// lib/db/schema.ts — Drizzle SQLite schema (4 tables)
import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── reviews ──────────────────────────────────────────────────────────────────
export const reviews = sqliteTable('reviews', {
  id:          text('id').primaryKey(),
  checklistId: text('checklist_id').notNull(),
  nationality: text('nationality'),
  status:      text('status', {
    enum: ['pending', 'processing', 'completed', 'failed'],
  }).notNull().default('pending'),
  createdAt:   text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  completedAt: text('completed_at'),
});

// ─── documents ────────────────────────────────────────────────────────────────
export const documents = sqliteTable('documents', {
  id:           text('id').primaryKey(),
  reviewId:     text('review_id')
    .notNull()
    .references(() => reviews.id, { onDelete: 'cascade' }),
  documentType: text('document_type').notNull(),
  filename:     text('filename').notNull(),
  mimeType:     text('mime_type').notNull(),
  documentHash: text('document_hash').notNull(),
  fileData:     blob('file_data', { mode: 'buffer' }),
  createdAt:    text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

// ─── document_extractions (OCR cache) ─────────────────────────────────────────
export const documentExtractions = sqliteTable('document_extractions', {
  id:              text('id').primaryKey(),
  documentHash:    text('document_hash').notNull().unique(),
  documentType:    text('document_type').notNull(),
  extractedData:   text('extracted_data', { mode: 'json' }).notNull().$type<Record<string, unknown>>(),
  ocrModel:        text('ocr_model').default('google/gemma-4-26b-it:free'),
  confidenceScore: real('confidence_score'),
  isValid:         integer('is_valid', { mode: 'boolean' }).notNull().default(true),
  extractedAt:     text('extracted_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  expiresAt:       text('expires_at').notNull(),
});

// ─── review_results ───────────────────────────────────────────────────────────
export const reviewResults = sqliteTable('review_results', {
  id:             text('id').primaryKey(),
  reviewId:       text('review_id')
    .notNull()
    .references(() => reviews.id, { onDelete: 'cascade' }),
  gapAnalysis:    text('gap_analysis', { mode: 'json' }).notNull().$type<Record<string, unknown>[]>(),
  overallScore:   integer('overall_score'),
  scoreBreakdown: text('score_breakdown', { mode: 'json' }).$type<Record<string, number>>(),
  verdict:        text('verdict'),
  scrubbedInput:  text('scrubbed_input', { mode: 'json' }).$type<Record<string, unknown>[]>(),
  createdAt:      text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});
