# Visa AI Review System — MVP Implementation Plan

**Version:** 1.2 | **Date:** May 2026 | **Status:** Awaiting Approval
**Scope:** Local-only demo (`localhost:3000`) — Vercel deploy is post-MVP

A 4-step demo wizard that uses LLM vision OCR + AI gap analysis to review visa
documents, designed to answer 5 key customer questions in under 3 minutes.

---

## Key Decision: OpenRouter instead of Mistral + Anthropic

Both the OCR and gap analysis calls go through **OpenRouter** using free-tier models.
This means **$0 API cost** for the demo, one API key, and one SDK.

| | Original Plan | Updated Plan |
|---|---|---|
| OCR / Vision | Mistral Small 3.1 | `google/gemma-4-26b-it:free` via OpenRouter |
| Gap Analysis | Claude Sonnet 4.6 | `deepseek/deepseek-r1:free` via OpenRouter |
| SDKs | `@mistralai/mistralai` + `@anthropic-ai/sdk` | `openai` (OpenAI-compatible, pointed at OpenRouter) |
| API Keys | `MISTRAL_API_KEY` + `ANTHROPIC_API_KEY` | `OPENROUTER_API_KEY` only |
| Prompt caching | ✅ Anthropic `cache_control` | ❌ Dropped (Anthropic-specific) |
| PDF input | Mistral handles PDFs natively | ⚠️ PDFs must be converted to images first (see §2.1) |
| Database | Neon PostgreSQL (cloud) | **SQLite** — local file, zero setup, no account |
| API cost (~20 reviews) | ~$1.60 | **$0** |
| Rate limits | None | 50 req/day free; 1,000 req/day after $10 deposit |

> **Model flexibility note:** Free model availability on OpenRouter can change.
> The integration uses a simple `MODEL_OCR` and `MODEL_ANALYSIS` env var so models
> can be swapped without touching code.

> **SQLite note:** Data is stored in `./data/visa-mvp.db` inside the project folder.
> The file is gitignored. No server, no account, no connection string needed.
> If/when this moves to Vercel production, swapping to Neon PostgreSQL requires
> only a driver change in `lib/db/index.ts` — the Drizzle schema stays the same.

---

## Open Questions

> [!IMPORTANT]
> **OpenRouter API Key** — You need one free account at [openrouter.ai](https://openrouter.ai)
> and an API key. Do you have this ready? Everything else can be set up locally
> with no credit card if you stay under 50 req/day.

> [!WARNING]
> **Existing `index.html`** — There is a 108 KB `index.html` in the workspace.
> Scaffolding Next.js into the same folder will conflict with it. Plan: rename it
> to `_old_index.html` before scaffolding. Let me know if this file is important
> and should be preserved differently.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 14 App Router** (TypeScript) |
| Styling | **Tailwind CSS + shadcn/ui** |
| Database | **SQLite** (local file) via **Drizzle ORM** + `better-sqlite3` |
| OCR (Vision) | **`google/gemma-4-26b-it:free`** via OpenRouter |
| Gap Analysis | **`deepseek/deepseek-r1:free`** via OpenRouter |
| AI SDK | `openai` npm package (OpenAI-compatible, OpenRouter base URL) |
| PDF → Image | `pdf2pic` (server-side conversion) |
| PDF report | **`@react-pdf/renderer`** |
| File storage | SQLite `BLOB` (no Drive/OneDrive) |
| Auth | None — demo mode via `DEMO_MODE=true` |

---

## Pages (5 Total)

```
/                      → Landing / Demo intro
/demo                  → Step 1: Select visa type + nationality
/upload/[id]           → Step 2: Drag-and-drop document upload
/processing/[id]       → Step 3: Live progress (real polling)
/results/[id]          → Step 4: Score + gap analysis report
/pii-explainer/[id]    → PII before/after explainer (trust demo)
```

---

## Proposed Changes — Build Order

### Phase 0 — Project Bootstrap

Archive `index.html` → `_old_index.html`, then scaffold Next.js 14:

```bash
npx create-next-app@latest ./ --typescript --tailwind --app \
  --no-src-dir --import-alias "@/*" --yes
```

Install dependencies:
```bash
# AI + DB
npm install openai drizzle-orm better-sqlite3 drizzle-kit
npm install -D @types/better-sqlite3

# PDF generation + PDF-to-image conversion
npm install @react-pdf/renderer pdf2pic

# UI
npx shadcn@latest init
```

---

### Phase 1 — Database Layer (`lib/db/`)

#### [NEW] `lib/db/schema.ts`
Drizzle schema — 4 tables, SQLite-compatible types:

- **`reviews`** — `text` PK (UUID via `crypto.randomUUID()`), checklist_id,
  nationality, status (`pending` | `processing` | `completed` | `failed`), timestamps
- **`documents`** — `text` PK, FK → reviews, filename, mime_type,
  document_hash (MD5), `file_data blob` (stores raw file bytes)
- **`document_extractions`** — `text` PK, document_hash (UNIQUE), extracted_data
  (`text` JSON), expires_at — the OCR cache (90-day TTL)
- **`review_results`** — `text` PK, FK → reviews, gap_analysis (`text` JSON),
  overall_score, score_breakdown (`text` JSON), verdict, `scrubbed_input` (`text` JSON)

#### [NEW] `lib/db/index.ts`
`better-sqlite3` client + Drizzle instance. DB file path: `./data/visa-mvp.db`.
Directory is created automatically on first run.

#### [NEW] `drizzle.config.ts`
Points to the local SQLite file, outputs migrations to `drizzle/` folder.

---

### Phase 2 — AI Pipeline (`lib/ai/`)

#### [NEW] `lib/ai/openrouter.ts` — Shared Client
```typescript
import OpenAI from 'openai';

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey:  process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000',
    'X-Title': 'Visa AI Review — MVP Demo',
  },
});

export const OCR_MODEL      = process.env.MODEL_OCR      ?? 'google/gemma-4-26b-it:free';
export const ANALYSIS_MODEL = process.env.MODEL_ANALYSIS ?? 'deepseek/deepseek-r1:free';
```

#### [NEW] `lib/ai/pdfToImages.ts` — PDF Pre-processor
Converts uploaded PDF pages to base64 PNG arrays before sending to the vision model.
JPG/PNG files pass through unchanged.

```typescript
// lib/ai/pdfToImages.ts
import { fromBuffer } from 'pdf2pic';

export async function toImageBuffers(
  buffer: Buffer,
  mimeType: string
): Promise<Buffer[]> {
  if (mimeType !== 'application/pdf') return [buffer];  // already an image

  const convert = fromBuffer(buffer, {
    density: 150,
    format: 'png',
    width: 1200,
    height: 1600,
  });

  // Convert up to 3 pages (sufficient for visa docs)
  const pages = await Promise.all([1, 2, 3].map(p =>
    convert(p, { responseType: 'buffer' }).catch(() => null)
  ));

  return pages
    .filter(Boolean)
    .map(p => p!.buffer as Buffer);
}
```

#### [NEW] `lib/ai/mistral.ts` → renamed to `lib/ai/ocr.ts`
Same interface as the original spec, now uses OpenRouter vision model:

```typescript
import { openrouter, OCR_MODEL } from './openrouter';
import { toImageBuffers } from './pdfToImages';

export async function extractDocument(
  fileBuffer: Buffer,
  mimeType: string,
  documentType: string
): Promise<RawExtraction> {

  const imageBuffers = await toImageBuffers(fileBuffer, mimeType);

  // Build image_url content parts (one per page, max 3)
  const imageContent = imageBuffers.map(buf => ({
    type: 'image_url' as const,
    image_url: { url: `data:image/png;base64,${buf.toString('base64')}` },
  }));

  const response = await openrouter.chat.completions.create({
    model: OCR_MODEL,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        ...imageContent,
        {
          type: 'text',
          text: `You are a document extraction specialist. Extract ALL relevant
information from this ${documentType}. Return ONLY valid JSON, no extra text:
{
  "document_type": string,
  "extracted_fields": { key: value },
  "document_validity": { "expiry_date": string|null, "is_expired": boolean },
  "confidence_score": number (0-1),
  "language": string,
  "warnings": [string]
}`,
        },
      ],
    }],
  });

  return JSON.parse(response.choices[0].message.content!);
}
```

#### [NEW] `lib/ai/ocrCache.ts` — MD5 Hash Cache (unchanged from spec)
```typescript
import crypto from 'crypto';
import { db } from '@/lib/db';
import { documentExtractions } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';

export function hashFile(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

export async function getCachedExtraction(hash: string) {
  const result = await db.select().from(documentExtractions)
    .where(and(
      eq(documentExtractions.documentHash, hash),
      eq(documentExtractions.isValid, true),
      gt(documentExtractions.expiresAt, new Date())
    )).limit(1);
  return result[0] ?? null;
}

export async function cacheExtraction(
  hash: string,
  documentType: string,
  extraction: RawExtraction
) {
  await db.insert(documentExtractions).values({
    documentHash:    hash,
    documentType,
    extractedData:   extraction,
    ocrModel:        OCR_MODEL,
    confidenceScore: String(extraction.confidence_score),
    expiresAt:       new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  }).onConflictDoNothing();
}
```

#### [NEW] `lib/ai/scrubPII.ts` — Full Production Implementation (unchanged)
Exact implementation from spec §2.3. No shortcuts — this is a key demo feature.
Includes all helper functions: `toAgeBand`, `toFinancialRange`, `toSalaryBand`,
`toConsistencyRating`, `detectAnomalies`, `enrichValidity`.

#### [NEW] `lib/ai/claude.ts` → renamed to `lib/ai/analysis.ts`
Same interface, now uses OpenRouter. Prompt caching removed (Anthropic-specific):

```typescript
import { openrouter, ANALYSIS_MODEL } from './openrouter';
import { getChecklist } from '@/lib/checklists';
import { scrubPII } from './scrubPII';

export async function analyseApplication(
  checklistId: string,
  rawExtractions: RawExtraction[]
): Promise<AnalysisResult> {

  const checklist = getChecklist(checklistId);
  const scrubbed  = scrubPII(rawExtractions);

  const response = await openrouter.chat.completions.create({
    model: ANALYSIS_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an expert visa officer with 20 years of experience.
Analyse the provided document summaries against the country checklist.
Return ONLY valid JSON, no extra text:
{
  "gap_analysis": [{
    "item": string,
    "status": "present" | "missing" | "weak" | "expired",
    "severity": "critical" | "major" | "minor",
    "recommendation": string
  }],
  "overall_score": number (0-100),
  "score_breakdown": {
    "documents_completeness": number,
    "financial_strength": number,
    "travel_history": number,
    "ties_to_home_country": number,
    "application_quality": number
  },
  "verdict": "strong" | "moderate" | "weak" | "insufficient",
  "key_strengths": [string],
  "critical_gaps": [string],
  "recommended_actions": [string]
}

COUNTRY CHECKLIST:
${JSON.stringify(checklist, null, 2)}`,
      },
      {
        role: 'user',
        content: `Analyse these document summaries (PII already removed):
${JSON.stringify(scrubbed, null, 2)}`,
      },
    ],
  });

  const text = response.choices[0].message.content!;
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}
```

#### [NEW] `lib/ai/types.ts`
Shared TypeScript interfaces: `RawExtraction`, `ScrubbedExtraction`,
`AnalysisResult`, `GapItem`, `ScoreBreakdown`.

---

### Phase 3 — Checklists (`lib/checklists/`)

#### [NEW] `lib/checklists/UK-SVV-01.json`
7 requirements for UK Standard Visitor — exact JSON from spec §6.

#### [NEW] `lib/checklists/SCH-CSS-01.json`
7 requirements for Schengen Short Stay — exact JSON from spec §6.

#### [NEW] `lib/checklists/index.ts`
`getChecklist(id: string)` — loads JSON by ID, throws clearly if not found.

---

### Phase 4 — API Routes (`app/api/`)

6 routes exactly as specified:

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/reviews` | Create review session → returns `{ id }` |
| `POST` | `/api/reviews/[id]/documents` | Multipart upload → stores in DB BYTEA |
| `POST` | `/api/reviews/[id]/start` | Fires background pipeline, returns immediately |
| `GET` | `/api/reviews/[id]/status` | Poll DB status column |
| `GET` | `/api/reviews/[id]/result` | Return full result JSON |
| `GET` | `/api/reviews/[id]/report.pdf` | Stream PDF download |

#### Background pipeline (`/api/reviews/[id]/start`)
Runs without `await` after the HTTP response is sent:
1. For each uploaded doc: hash → cache check → OCR → cache write
2. `analyseApplication()` (runs `scrubPII` internally)
3. Insert `review_results` — **stores `scrubbed_input` for PII page**
4. Update review status → `completed` (or `failed` on error)

The frontend polls `/status` every **2 seconds** — not fake animations.

---

### Phase 5 — UI Components (`components/`)

#### [NEW] `components/ScoreGauge.tsx`
- Animated circular SVG gauge (0–100), fills on page load with CSS transition
- Colour bands: 🔴 0–39 Insufficient / 🟠 40–59 Weak / 🟡 60–79 Moderate / 🟢 80–100 Strong
- Verdict badge below gauge
- **This is what the customer will photograph — make it visually striking**

#### [NEW] `components/GapAnalysisTable.tsx`
- Colour-coded rows: ✅ green / ⚠️ amber / ❌ red per status
- Columns: Document | Status | Severity | Recommendation
- Severity badges: Critical (red pill), Major (amber pill), Minor (grey pill)

#### [NEW] `components/ProcessingSteps.tsx`
- 8 checkpoints driven by real API poll (`/status` every 2s), **not fake timers**
- Animated spinner on active step, green tick when done
- Maps DB status to step completion state

#### [NEW] `components/ProbabilityBreakdown.tsx`
- 5 horizontal bars that animate in on mount
- Documents Completeness / Financial Strength / Travel History /
  Ties to Home Country / Application Quality

#### [NEW] `components/PIIComparison.tsx`
- Two-column layout: "What the LLM Read" (left) vs "What the Analyser Received" (right)
- Left: raw JSON with sensitive fields highlighted red
- Right: scrubbed JSON with safe fields highlighted green
- Bold trust statement between columns (from spec §5)
- Uses **real `scrubbed_input`** from DB — not hardcoded examples

---

### Phase 6 — Pages (`app/`)

#### [MODIFY] `app/page.tsx` — Landing
- Hero: product name, tagline, "Try Demo" CTA
- The 5 customer questions answered as feature cards
- Dark, premium design with gradient

#### [NEW] `app/demo/page.tsx` — Step 1
- Dropdown: Visa type (UK Standard Visitor / Schengen Short Stay)
- Text input: Nationality
- "Start Review" → `POST /api/reviews` → redirect to `/upload/[id]`

#### [NEW] `app/upload/[id]/page.tsx` — Step 2
- Drag-and-drop zone (PDF, JPG, PNG, max 10 MB each)
- Document type labels: Passport, Bank Statement, Employment Letter, Photo, Supporting Docs
- Per-file: filename, size, type badge, green tick on upload success
- "Run AI Review" (enabled when ≥ 1 doc uploaded) → `POST /api/reviews/[id]/start` → redirect to `/processing/[id]`

#### [NEW] `app/processing/[id]/page.tsx` — Step 3
- Renders `<ProcessingSteps />` with live 2-second polling
- Auto-redirects to `/results/[id]` when status = `completed`
- Friendly error + retry button when status = `failed` (never a stack trace)

#### [NEW] `app/results/[id]/page.tsx` — Step 4
- Top: `<ScoreGauge />` with score + verdict
- `<ProbabilityBreakdown />` (5 animated bars)
- `<GapAnalysisTable />`
- Key Strengths (green card) + Critical Gaps (red card)
- Recommended Actions (numbered list)
- "Download PDF Report" → `GET /api/reviews/[id]/report.pdf`
- "How is your data protected?" → `/pii-explainer/[id]`

#### [NEW] `app/pii-explainer/[id]/page.tsx`
- Fetches real `scrubbed_input` from DB
- `<PIIComparison />` side-by-side
- Trust statement

---

### Phase 7 — Configuration & Environment

#### [NEW] `.env.local` (gitignored)
```bash
# AI — single key for all LLM calls
OPENROUTER_API_KEY=sk-or-...

# Model overrides (optional — defaults set in code)
MODEL_OCR=google/gemma-4-26b-it:free
MODEL_ANALYSIS=deepseek/deepseek-r1:free

# App
NEXT_PUBLIC_URL=http://localhost:3000
DEMO_MODE=true

# SQLite DB path (optional override — default: ./data/visa-mvp.db)
# SQLITE_DB_PATH=./data/visa-mvp.db
```

> No `DATABASE_URL` needed. The SQLite file is created automatically on first `npm run dev`.

#### [NEW] `.env.example` (committed to repo)
Same keys, empty values — safe to commit.

#### [MODIFY] `next.config.ts`
- Increase API body size limit for file uploads
- Add `serverExternalPackages` for `@react-pdf/renderer` and `pdf2pic`

---

## Project Structure

```
visa-application-validator/
├── app/
│   ├── page.tsx                        ← Landing
│   ├── demo/page.tsx                   ← Step 1: Select visa
│   ├── upload/[id]/page.tsx            ← Step 2: Upload docs
│   ├── processing/[id]/page.tsx        ← Step 3: Live progress
│   ├── results/[id]/page.tsx           ← Step 4: Report
│   ├── pii-explainer/[id]/page.tsx     ← PII demo
│   └── api/
│       └── reviews/
│           ├── route.ts                ← POST: create review
│           └── [id]/
│               ├── documents/route.ts  ← POST: upload doc
│               ├── start/route.ts      ← POST: trigger review
│               ├── status/route.ts     ← GET: poll status
│               ├── result/route.ts     ← GET: full result
│               └── report.pdf/route.ts ← GET: PDF download
├── components/
│   ├── ui/                             ← shadcn/ui
│   ├── ScoreGauge.tsx
│   ├── GapAnalysisTable.tsx
│   ├── ProcessingSteps.tsx
│   ├── ProbabilityBreakdown.tsx
│   └── PIIComparison.tsx
├── lib/
│   ├── db/
│   │   ├── index.ts                    ← Neon + Drizzle
│   │   └── schema.ts
│   ├── ai/
│   │   ├── openrouter.ts               ← Shared OpenAI-compat client
│   │   ├── ocr.ts                      ← Vision extraction (was mistral.ts)
│   │   ├── pdfToImages.ts              ← PDF → PNG conversion
│   │   ├── analysis.ts                 ← Gap analysis (was claude.ts)
│   │   ├── scrubPII.ts                 ← PII scrubber (unchanged)
│   │   ├── ocrCache.ts                 ← MD5 hash cache (unchanged)
│   │   └── types.ts                    ← Shared interfaces
│   └── checklists/
│       ├── index.ts
│       ├── UK-SVV-01.json
│       └── SCH-CSS-01.json
├── drizzle/                            ← Generated migrations
├── drizzle.config.ts
├── next.config.ts
├── .env.local                          ← gitignored
├── .env.example
├── _old_index.html                     ← archived original file
└── requirements_mvp.md
```

---

## Verification Plan

### Phase 1 — DB
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```
Verify `./data/visa-mvp.db` is created and `sqlite3 ./data/visa-mvp.db ".tables"` shows all 4 tables.

### Phase 2 — AI Pipeline
Run a quick smoke test with a real image to confirm OCR model returns valid JSON
and the scrubPII transform produces the expected scrubbed shape.

### Phase 4 — API Routes
```bash
# 1. Create review
curl -X POST http://localhost:3000/api/reviews \
  -H 'Content-Type: application/json' \
  -d '{"checklistId":"UK-SVV-01","nationality":"Pakistani"}'

# 2. Upload doc, trigger review, poll status, fetch result
```

### End-to-End Demo Script (from spec §11.4)
1. Open `http://localhost:3000`
2. Click **"Try Demo"**
3. Select **UK Standard Visitor Visa** + nationality **Pakistani**
4. Upload 3 test files: `passport_scan.jpg`, `bank_statement.pdf`, `employment_letter.pdf`
5. Click **"Run AI Review"**
6. Watch processing steps tick off live (real API polling)
7. Confirm results show score ~65–70, bank statement flagged as weak
8. Click **"How is your data protected?"** → PII explainer page
9. Confirm real scrubbed data shown (not hardcoded)
10. Download PDF — confirm it opens and contains the report

### Visual Non-Negotiables
- Score gauge must **animate** on page load
- Processing steps must show **real state** — no fake `setTimeout` progress
- Errors show a **friendly message + retry** — never a stack trace
- The results page must be **visually impressive** — this is what the customer photographs

---

*End of Implementation Plan | Visa AI Review System MVP v1.1 | May 2026*
*Local-only build — Vercel deploy is post-MVP*
