# Visa AI Review System — MVP Requirements
**Version:** 1.0 | **Date:** May 2026 | **Purpose:** POC / Customer Demo
**Build Time:** 1 week | **Deploy:** Vercel (free/hobby tier)

> **Claude Code Instruction:** This is a lean MVP to demonstrate the concept to a customer.
> Speed of delivery matters more than production hardening. Build what is listed here —
> nothing more. Every item marked ❌ DEFERRED is intentionally excluded from this build.
> The goal is a working demo that can be shown live in a browser within 7 days.

---

## What This MVP Must Prove to the Customer

The demo needs to answer five questions the customer will have in the room:

1. **"Can it actually read my documents?"** — Live document upload and OCR extraction
2. **"Does it know what's missing?"** — Gap analysis against a real visa checklist
3. **"What's the score?"** — Probability score with visual gauge and colour banding
4. **"Is our data safe?"** — PII scrubbing shown visibly in the UI
5. **"How fast is it?"** — End-to-end review completing in under 3 minutes

If the demo answers all five, the customer signs off. Everything else is post-MVP.

---

## What Is Cut vs Kept

| Feature | MVP | Production |
|---|---|---|
| Document upload | ✅ Local upload (no Drive/OneDrive) | Google Drive + OneDrive |
| OCR extraction | ✅ Mistral Small 3.1 | Same |
| OCR caching | ✅ Simple DB cache (MD5 hash) | Same |
| PII scrubbing | ✅ Full scrubPII() implementation | Same |
| Gap analysis | ✅ Claude Sonnet 4.6 | Same |
| Probability score | ✅ Full 0–100 with breakdown | Same |
| Visa checklists | ✅ UK + Schengen only (2 countries) | 6 countries |
| Auth | ✅ Single hardcoded demo login | Full NextAuth + OAuth |
| Roles | ✅ One role (agent/admin combined) | 4 roles |
| PDF report | ✅ Simple downloadable PDF | Full branded PDF |
| Async review | ✅ Simple polling (setTimeout) | Vercel KV job queue |
| Database | ✅ Neon PostgreSQL (free tier) | Neon Launch plan |
| Deployment | ✅ Vercel Hobby (free) | Vercel Pro |
| MFA | ❌ DEFERRED | TOTP |
| Email notifications | ❌ DEFERRED | Resend |
| Admin checklist editor | ❌ DEFERRED | Full CRUD |
| GDPR endpoints | ❌ DEFERRED | Full erasure/export |
| Audit logging | ❌ DEFERRED | Immutable log table |
| Multi-tenant | ❌ DEFERRED | Per-tenant storage |
| OneDrive integration | ❌ DEFERRED | Full provider |
| Google Drive integration | ❌ DEFERRED | Full provider |
| Rate limiting | ❌ DEFERRED | Vercel Middleware |
| Prompt caching | ✅ Enabled (saves cost even in MVP) | Same |

---

## Tech Stack — MVP

| Layer | Technology | Why This Choice |
|---|---|---|
| Frontend + API | Next.js 14 App Router | Same as production — no throwaway code |
| Database | Neon PostgreSQL (free tier) | Free, same as production DB |
| File storage | Local upload → server memory | No OAuth setup needed for demo |
| OCR | Mistral Small 3.1 | EU endpoint, same as production |
| Analysis | Claude Sonnet 4.6 | Same as production |
| Auth | Hardcoded demo credentials | Zero setup time |
| Deployment | Vercel Hobby (free) | Live URL in minutes |
| PDF | `@react-pdf/renderer` | Same as production |
| Styling | Tailwind CSS + shadcn/ui | Fast, looks professional |

> **Key principle:** The AI pipeline (Mistral → scrubPII → Claude) is identical to production.
> Only the plumbing around it (auth, storage, email) is simplified for speed.

---

## Pages — MVP (5 Pages Only)

```
/                  → Landing / Demo intro page
/demo              → Single demo flow (no login required for demo mode)
/upload            → Document upload + review trigger
/results/[id]      → Gap analysis report + score
/pii-explainer     → Visual PII scrubbing explainer (wow factor for demo)
```

> **No login page, no dashboard, no admin panel** — the demo starts at `/demo` and
> flows linearly to `/results`. The customer sees the product, not the login screen.

---

## 1. Demo Flow — End to End

The entire demo runs as a linear wizard with 4 steps:

```
STEP 1          STEP 2            STEP 3              STEP 4
Select Visa  →  Upload Docs   →   Processing...   →   Results
Country/Type    (drag & drop)     (live progress)     (score + gaps)
```

### Step 1 — Select Visa Type
- Dropdown: United Kingdom — Standard Visitor OR Schengen — Short Stay
- Dropdown: Nationality (free text or simple list)
- "Start Review" button → goes to Step 2

### Step 2 — Upload Documents
- Drag-and-drop upload area
- Accepts: PDF, JPG, PNG (max 10MB each)
- Show document type labels: Passport, Bank Statement, Employment Letter, Photo, Supporting Docs
- Each uploaded file shows: filename, size, type badge, green tick on upload
- "Run AI Review" button activates once at least 1 document uploaded

### Step 3 — Processing (The Demo Magic Moment)
Live animated progress showing exactly what is happening:

```
✅ Documents received
⏳ Extracting text with Mistral OCR...
✅ OCR complete — 3 documents read
⏳ Scrubbing personal data before AI analysis...
✅ PII scrubbed — passport numbers and financial figures removed
⏳ Claude analysing against UK visa checklist...
✅ Analysis complete
⏳ Generating report...
✅ Done
```

> This step is critical for the demo. The customer sees their data being protected
> in real time. Build genuine live status updates — not fake animations.

### Step 4 — Results Page
Full gap analysis report (see Section 4).

---

## 2. Core AI Pipeline — No Shortcuts

> ⚠️ The AI pipeline must be identical to production quality. This is what the
> customer is buying. Do NOT mock, stub, or fake any of this.

### 2.1 OCR — Mistral Small 3.1

```typescript
// lib/ai/mistral.ts
import Mistral from '@mistralai/mistralai';

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

export async function extractDocument(
  fileBuffer: Buffer,
  mimeType: string,
  documentType: string
): Promise<RawExtraction> {

  const base64 = fileBuffer.toString('base64');
  const imageUrl = `data:${mimeType};base64,${base64}`;

  const response = await mistral.chat.complete({
    model: 'mistral-small-latest',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          imageUrl: { url: imageUrl }
        },
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
}`
        }
      ]
    }],
    responseFormat: { type: 'json_object' }
  });

  const raw = response.choices[0].message.content as string;
  return JSON.parse(raw);
}
```

### 2.2 OCR Cache — MD5 Hash Lookup

```typescript
// lib/ai/ocrCache.ts
import crypto from 'crypto';
import { db } from '@/lib/db';
import { documentExtractions } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';

export function hashFile(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

export async function getCachedExtraction(hash: string) {
  const result = await db
    .select()
    .from(documentExtractions)
    .where(
      and(
        eq(documentExtractions.documentHash, hash),
        eq(documentExtractions.isValid, true),
        gt(documentExtractions.expiresAt, new Date())
      )
    )
    .limit(1);
  return result[0] ?? null;
}

export async function cacheExtraction(
  hash: string,
  documentType: string,
  extraction: RawExtraction
) {
  await db.insert(documentExtractions).values({
    documentHash: hash,
    documentType,
    extractedData: extraction,
    ocrModel: 'mistral-small-3.1',
    confidenceScore: String(extraction.confidence_score),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  }).onConflictDoNothing();
}
```

### 2.3 PII Scrubber — Full Implementation

```typescript
// lib/ai/scrubPII.ts
// Same as production — no shortcuts here, this is a key demo feature

export function scrubPII(extractions: RawExtraction[]): ScrubbedExtraction[] {
  return extractions.map(doc => ({
    document_type:     doc.document_type,
    document_validity: enrichValidity(doc.document_validity),
    confidence_score:  doc.confidence_score,
    language:          doc.language,
    warnings:          doc.warnings,
    field_summary:     scrubFields(doc.document_type, doc.extracted_fields)
  }));
}

function scrubFields(type: string, fields: Record<string, any>) {
  switch (type) {
    case 'passport': return {
      has_passport_number: !!fields.passport_number,
      nationality:         fields.nationality,
      issuing_country:     fields.issuing_country,
      age_band:            toAgeBand(fields.date_of_birth),
      has_photo:           !!fields.photo,
    };
    case 'bank_statement': return {
      has_account_number:             !!fields.account_number,
      months_of_history:              fields.months_of_history,
      financial_range:                toFinancialRange(fields.average_balance),
      income_consistency:             toConsistencyRating(fields.monthly_transactions),
      has_large_unexplained_deposits: detectAnomalies(fields.transactions),
      currency:                       fields.currency,
    };
    case 'employment_letter': return {
      employment_status: fields.employment_status,
      contract_type:     fields.contract_type,
      salary_band:       fields.salary ? toSalaryBand(fields.salary) : null,
      employer_sector:   fields.employer_sector,
      on_letterhead:     fields.on_letterhead,
      is_signed:         fields.is_signed,
    };
    default: return {
      document_present: true,
      is_signed:        fields.is_signed ?? null,
      is_dated:         fields.is_dated  ?? null,
    };
  }
}

function toAgeBand(dob: string | null): string | null {
  if (!dob) return null;
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
  if (age < 25) return 'under-25';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  return '55-plus';
}

function toFinancialRange(amount: number | null): string | null {
  if (!amount) return null;
  if (amount < 1000)   return 'below_threshold';
  if (amount < 5000)   return 'low';
  if (amount < 20000)  return 'medium';
  if (amount < 100000) return 'high';
  return 'very_high';
}

function toSalaryBand(monthly: number | null): string | null {
  if (!monthly) return null;
  const annual = monthly * 12;
  if (annual < 20000)  return 'low';
  if (annual < 50000)  return 'medium';
  if (annual < 100000) return 'high';
  return 'very_high';
}

function toConsistencyRating(transactions: any[]): string {
  if (!transactions?.length) return 'unknown';
  const regular = transactions.filter(t => t.type === 'credit' && t.is_recurring);
  if (regular.length >= 10) return 'very_consistent';
  if (regular.length >= 5)  return 'consistent';
  return 'inconsistent';
}

function detectAnomalies(transactions: any[]): boolean {
  if (!transactions?.length) return false;
  const avg = transactions.reduce((s, t) => s + t.amount, 0) / transactions.length;
  return transactions.some(t => t.amount > avg * 5);
}

function enrichValidity(v: { expiry_date: string | null; is_expired: boolean }) {
  const days = v.expiry_date
    ? Math.floor((new Date(v.expiry_date).getTime() - Date.now()) / 86400000)
    : null;
  return { ...v, days_until_expiry: days };
}
```

### 2.4 Claude Gap Analysis — With Prompt Caching

```typescript
// lib/ai/claude.ts
import Anthropic from '@anthropic-ai/sdk';
import { getChecklist } from '@/lib/checklists';
import { scrubPII } from './scrubPII';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function analyseApplication(
  checklistId: string,
  rawExtractions: RawExtraction[]
): Promise<AnalysisResult> {

  const checklist = getChecklist(checklistId);
  const scrubbed  = scrubPII(rawExtractions);   // ← PII scrubbed here, always

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6-20251101',
    max_tokens: 4000,
    system: [{
      type: 'text',
      text: `You are an expert visa officer with 20 years of experience.
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
      cache_control: { type: 'ephemeral' }  // ← Prompt caching enabled
    }],
    messages: [{
      role: 'user',
      content: `Analyse these document summaries (PII already removed):
${JSON.stringify(scrubbed, null, 2)}`
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}
```

---

## 3. Database Schema — MVP (Minimal Tables)

```sql
-- Only 3 tables needed for MVP

CREATE TABLE reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id   VARCHAR(50) NOT NULL,
  nationality    VARCHAR(100),
  status         VARCHAR(20) DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','completed','failed')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

CREATE TABLE documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id      UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  document_type  VARCHAR(50) NOT NULL,
  filename       VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(100) NOT NULL,
  document_hash  VARCHAR(32) NOT NULL,
  file_data      BYTEA,          -- Store file in DB for MVP (no Drive/OneDrive)
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_extractions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_hash    VARCHAR(32) NOT NULL UNIQUE,
  document_type    VARCHAR(50) NOT NULL,
  extracted_data   JSONB NOT NULL,
  ocr_model        VARCHAR(100) DEFAULT 'mistral-small-3.1',
  confidence_score DECIMAL(4,3),
  is_valid         BOOLEAN DEFAULT true,
  extracted_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days'
);

CREATE TABLE review_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id       UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  gap_analysis    JSONB NOT NULL,
  overall_score   INTEGER,
  score_breakdown JSONB,
  verdict         VARCHAR(20),
  scrubbed_input  JSONB,   -- Store what was sent to Claude — show in PII demo
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_hash_mvp ON document_extractions(document_hash);
CREATE INDEX idx_review_docs  ON documents(review_id);
```

> **Why `file_data BYTEA`?** For the MVP, storing files directly in PostgreSQL
> eliminates the need for Google Drive/OneDrive OAuth setup. Neon free tier
> handles this fine for demo volumes (< 50 documents). Replace with
> Drive/OneDrive in production.

---

## 4. Results Page — What the Customer Must See

This is the most important page. Make it visually impressive.

### 4.1 Score Section (Top of Page)

```
┌──────────────────────────────────────────────────┐
│                                                  │
│   UK Standard Visitor Visa — Jordanian National  │
│                                                  │
│          ╔══════════════╗                        │
│          ║      72      ║  ← Animated gauge      │
│          ║    /100      ║     fills on load      │
│          ╚══════════════╝                        │
│                                                  │
│         🟡 MODERATE                              │
│    Address gaps before submitting                │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 4.2 Score Breakdown (5 Components)

Horizontal bar chart — 5 bars:
- Documents Completeness — 85/100
- Financial Strength — 70/100
- Travel History — 60/100
- Ties to Home Country — 75/100
- Application Quality — 80/100

### 4.3 Gap Analysis Table

| Document | Status | Severity | What to Do |
|---|---|---|---|
| Valid Passport | ✅ Present | — | Valid for 3+ years — good |
| Bank Statement | ⚠️ Weak | Major | Only 3 months shown — need 6 months |
| Employment Letter | ✅ Present | — | On letterhead, signed |
| Travel History | ❌ Missing | Critical | No previous UK/Schengen history shown |
| Return Ticket | ❌ Missing | Minor | Hotel/flight booking would strengthen |

Colour coding: ✅ green / ⚠️ amber / ❌ red per row.

### 4.4 Key Strengths

Green section:
- Passport valid well beyond travel dates
- Employment letter professionally formatted and signed
- Consistent income demonstrated

### 4.5 Critical Gaps

Red section:
- Bank statements only cover 3 months — UK requires 6 months minimum
- No prior UK or Schengen travel history — increases scrutiny

### 4.6 Recommended Actions

Numbered actionable checklist:
1. Obtain bank statements for the last 6 months from your bank
2. If applicable, include any previous travel documents (even non-UK)
3. Consider adding a detailed cover letter explaining purpose of visit
4. Hotel booking confirmation and return flight would strengthen the application

### 4.7 PDF Download Button

Simple PDF with all the above. Generated with `@react-pdf/renderer`.

---

## 5. PII Explainer Page — The Trust Builder

> This page is a key differentiator in the demo. It shows the customer exactly
> how their applicants' data is protected. Build it as a visual side-by-side.

### Layout: Two Columns

**Left column — "What Mistral Read"** (raw extraction):
```json
{
  "passport_number": "GH8234521",
  "full_name": "Mohammed Al-Rashid",
  "date_of_birth": "1985-03-12",
  "nationality": "Jordanian",
  "expiry_date": "2029-06-30",
  "bank_balance": "£23,847.50",
  "account_number": "12-34-56 87654321"
}
```
Sensitive fields highlighted in red.

**Right column — "What Claude Received"** (after scrubPII):
```json
{
  "has_passport_number": true,
  "nationality": "Jordanian",
  "age_band": "35-44",
  "expiry_date": "2029-06-30",
  "has_account_number": true,
  "financial_range": "medium",
  "income_consistency": "very_consistent"
}
```
Safe fields highlighted in green. Sensitive fields gone.

**Bold statement between columns:**
> "Passport numbers, exact balances, full names and account numbers never leave
> your infrastructure. Claude only receives anonymised summaries."

> **Store `scrubbed_input` in `review_results` table** so the real scrubbed data
> from the actual demo review can be shown here — not hardcoded examples.

---

## 6. Visa Checklists — 2 Countries for MVP

Store as JSON files in `/checklists/`. No database editor needed for MVP.

### UK Standard Visitor — `UK-SVV-01.json`

```json
{
  "checklist_id": "UK-SVV-01",
  "country": "United Kingdom",
  "visa_type": "Standard Visitor",
  "flag": "🇬🇧",
  "requirements": [
    { "id": "REQ-001", "category": "Identity",    "document": "Valid Passport",
      "mandatory": true,  "validity_months": 6 },
    { "id": "REQ-002", "category": "Financial",   "document": "Bank Statements (6 months)",
      "mandatory": true,  "months_required": 6, "min_balance_gbp": 2000 },
    { "id": "REQ-003", "category": "Employment",  "document": "Employment Letter",
      "mandatory": true },
    { "id": "REQ-004", "category": "Identity",    "document": "Passport Photo",
      "mandatory": true },
    { "id": "REQ-005", "category": "Travel",      "document": "Travel Itinerary",
      "mandatory": false },
    { "id": "REQ-006", "category": "Accommodation","document": "Hotel / Accommodation Proof",
      "mandatory": false },
    { "id": "REQ-007", "category": "Financial",   "document": "Payslips (3 months)",
      "mandatory": false }
  ]
}
```

### Schengen Short Stay — `SCH-CSS-01.json`

```json
{
  "checklist_id": "SCH-CSS-01",
  "country": "Schengen Zone",
  "visa_type": "Short Stay (Type C)",
  "flag": "🇪🇺",
  "requirements": [
    { "id": "REQ-001", "category": "Identity",    "document": "Valid Passport",
      "mandatory": true,  "validity_months": 3 },
    { "id": "REQ-002", "category": "Financial",   "document": "Bank Statements (3 months)",
      "mandatory": true,  "months_required": 3 },
    { "id": "REQ-003", "category": "Insurance",   "document": "Travel Insurance (min €30k)",
      "mandatory": true },
    { "id": "REQ-004", "category": "Identity",    "document": "Passport Photo",
      "mandatory": true },
    { "id": "REQ-005", "category": "Travel",      "document": "Return Flight Booking",
      "mandatory": true },
    { "id": "REQ-006", "category": "Accommodation","document": "Hotel Booking",
      "mandatory": true },
    { "id": "REQ-007", "category": "Employment",  "document": "Employment Letter or NOC",
      "mandatory": false }
  ]
}
```

---

## 7. API Routes — MVP (6 Routes Only)

```typescript
POST  /api/reviews                    // Create review session, return review ID
POST  /api/reviews/[id]/documents     // Upload document (multipart, stores in DB)
POST  /api/reviews/[id]/start         // Trigger async AI review
GET   /api/reviews/[id]/status        // Poll processing status
GET   /api/reviews/[id]/result        // Get completed gap analysis
GET   /api/reviews/[id]/report.pdf    // Download PDF report
```

---

## 8. Async Review — Simple Polling Pattern

No Vercel KV needed for MVP. Use a simple DB status column + polling:

```typescript
// POST /api/reviews/[id]/start
export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Update status to 'processing' immediately
  await db.update(reviews)
    .set({ status: 'processing' })
    .where(eq(reviews.id, params.id));

  // Fire-and-forget background job
  processReviewInBackground(params.id);   // does NOT await

  return Response.json({ status: 'processing' });
}

// Background function — runs independently of the HTTP response
async function processReviewInBackground(reviewId: string) {
  try {
    const docs = await getReviewDocuments(reviewId);
    const review = await getReview(reviewId);

    // 1. Hash + cache check + OCR each document
    const extractions: RawExtraction[] = [];
    for (const doc of docs) {
      const buffer = doc.fileData;
      const hash = hashFile(buffer);
      let extraction = await getCachedExtraction(hash);

      if (!extraction) {
        extraction = await extractDocument(buffer, doc.mimeType, doc.documentType);
        await cacheExtraction(hash, doc.documentType, extraction);
      }
      extractions.push(extraction);
    }

    // 2. Analyse with Claude (scrubPII happens inside analyseApplication)
    const result = await analyseApplication(review.checklistId, extractions);

    // 3. Save result
    await db.insert(reviewResults).values({
      reviewId,
      gapAnalysis:    result.gap_analysis,
      overallScore:   result.overall_score,
      scoreBreakdown: result.score_breakdown,
      verdict:        result.verdict,
      scrubbedInput:  scrubPII(extractions)   // store for PII demo page
    });

    await db.update(reviews)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(reviews.id, reviewId));

  } catch (err) {
    await db.update(reviews)
      .set({ status: 'failed' })
      .where(eq(reviews.id, reviewId));
  }
}

// GET /api/reviews/[id]/status — frontend polls every 3 seconds
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const review = await db.select().from(reviews)
    .where(eq(reviews.id, params.id)).limit(1);
  return Response.json({ status: review[0]?.status ?? 'unknown' });
}
```

---

## 9. Environment Variables — MVP

```bash
# Database (Neon free tier — get from neon.tech)
DATABASE_URL=postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require

# AI (both required — no mocking)
ANTHROPIC_API_KEY=
MISTRAL_API_KEY=

# App
NEXT_PUBLIC_URL=http://localhost:3000  # or Vercel URL once deployed
DEMO_MODE=true                         # Enables demo features, skips auth
```

> That's it. 3 env vars to run the full AI pipeline. No OAuth setup. No email service.
> No KV store. The demo can be running locally in under 30 minutes.

---

## 10. Project Structure — MVP

```
visa-ai-mvp/
├── app/
│   ├── page.tsx                    ← Landing page with "Try Demo" CTA
│   ├── demo/page.tsx               ← Step 1: Select visa type
│   ├── upload/page.tsx             ← Step 2: Upload documents
│   ├── processing/[id]/page.tsx    ← Step 3: Live progress
│   ├── results/[id]/page.tsx       ← Step 4: Full report
│   ├── pii-explainer/[id]/page.tsx ← PII demo page (uses real scrubbed data)
│   └── api/
│       ├── reviews/
│       │   ├── route.ts            ← POST: create review
│       │   └── [id]/
│       │       ├── documents/route.ts  ← POST: upload doc
│       │       ├── start/route.ts      ← POST: trigger review
│       │       ├── status/route.ts     ← GET: poll status
│       │       ├── result/route.ts     ← GET: full result
│       │       └── report.pdf/route.ts ← GET: PDF download
├── components/
│   ├── ui/                         ← shadcn/ui
│   ├── ScoreGauge.tsx              ← Animated 0-100 circular gauge
│   ├── GapAnalysisTable.tsx        ← Colour-coded gap table
│   ├── ProcessingSteps.tsx         ← Live progress with real status
│   ├── ProbabilityBreakdown.tsx    ← 5-bar score chart
│   └── PIIComparison.tsx           ← Side-by-side before/after
├── lib/
│   ├── db/
│   │   ├── index.ts                ← Neon + Drizzle
│   │   └── schema.ts
│   ├── ai/
│   │   ├── mistral.ts              ← OCR extraction
│   │   ├── claude.ts               ← Gap analysis
│   │   ├── scrubPII.ts             ← PII scrubbing
│   │   └── ocrCache.ts             ← Hash + cache logic
│   └── checklists/
│       ├── index.ts                ← getChecklist() loader
│       ├── UK-SVV-01.json
│       └── SCH-CSS-01.json
├── drizzle/
├── drizzle.config.ts
├── next.config.ts
├── .env.local
├── .env.example
└── requirements_mvp.md
```

---

## 11. Claude Code Instructions

### 11.1 Kick-Off Prompt

```
Build an MVP demo of a visa AI document review system using Next.js 14 App Router.
TypeScript. Neon PostgreSQL + Drizzle ORM. No auth — demo mode only. Files stored
in PostgreSQL BYTEA for simplicity (no Google Drive/OneDrive). Mistral Small 3.1
for OCR. Claude Sonnet 4.6 for gap analysis. Full PII scrubbing pipeline. 2 visa
checklists: UK Standard Visitor and Schengen Short Stay. Deploy on Vercel free tier.
Build a 4-step demo wizard: Select visa → Upload docs → Processing → Results.
Follow requirements_mvp.md exactly. Build fast — this is a customer demo.
```

### 11.2 Build Order (Follow Exactly)

```
Day 1:  DB schema + Drizzle setup + Neon connection
Day 2:  Mistral OCR integration + MD5 cache logic
Day 3:  scrubPII() + Claude gap analysis + prompt caching
Day 4:  4-step demo wizard UI (all 4 pages)
Day 5:  Results page (ScoreGauge + GapAnalysisTable + breakdown chart)
Day 6:  PII explainer page + PDF download
Day 7:  Deploy to Vercel + end-to-end test with real documents
```

### 11.3 MVP Non-Negotiable Rules

1. **AI pipeline is real** — No mocks. Mistral and Claude must do real work on real documents.
2. **PII scrubbing is real** — `scrubPII()` must run before every Claude call. Store scrubbed output to show on PII page.
3. **OCR cache is real** — MD5 hash check before every Mistral call. Show cache hit/miss in processing steps.
4. **Prompt caching enabled** — `cache_control: { type: 'ephemeral' }` on Claude system prompt. This keeps demo costs low.
5. **Processing steps are live** — Poll `/api/reviews/[id]/status` every 2 seconds. Show real status — not fake animations.
6. **Score must look impressive** — `ScoreGauge` must be animated, colour-coded, and visually prominent. This is what the customer will photograph.
7. **No broken states in demo** — Handle errors gracefully. If Mistral or Claude fails, show a friendly error with retry option. Never show a stack trace to the customer.

### 11.4 Demo Script (For the Sales Meeting)

Tell the developer: build the app so this script flows without any hitches.

```
1. Open https://visa-ai-mvp.vercel.app
2. Click "Try Demo"
3. Select "UK Standard Visitor Visa" + nationality "Pakistani"
4. Upload 3 pre-prepared test files:
   - passport_scan.jpg  (a real or fake passport image)
   - bank_statement.pdf (3 months only — intentionally weak)
   - employment_letter.pdf
5. Click "Run AI Review"
6. Watch the processing steps tick off live
7. Show the results: score ~65-70, bank statement flagged as weak
8. Click "How is your data protected?" → PII explainer page
9. Show passport number and balance on left, scrubbed version on right
10. Download PDF report
11. Say: "This is what every applicant gets in under 3 minutes"
```

### 11.5 Test Documents for Demo

Prepare these before the demo meeting. Use real-looking but fictional data.

| File | Content | Purpose |
|---|---|---|
| `passport_scan.jpg` | Photo of a fictional passport | Tests vision OCR |
| `bank_statement.pdf` | 3-month statement, balance ~£8,000 | Intentionally weak — triggers gap |
| `employment_letter.pdf` | Letter on letterhead, signed | Passes cleanly |

> Tip: Run the demo at least 3 times before the meeting. After the first run,
> the OCR cache kicks in and subsequent runs are faster — shows the caching
> feature working naturally.

---

## 12. Cost for the MVP Build

| Item | Cost |
|---|---|
| Vercel Hobby | Free |
| Neon PostgreSQL (free tier) | Free |
| Mistral API (demo volume ~20 reviews) | ~$0.10 |
| Anthropic API (demo volume ~20 reviews) | ~$1.50 |
| **Total to build and demo** | **~$1.60** |

---

## What Comes After MVP — Path to Production

Once the customer approves the demo, the production build (`requirements.md v1.1`)
adds the following on top of this MVP:

| Upgrade | Effort |
|---|---|
| Google Drive + OneDrive storage | 1 week |
| Full auth (NextAuth + OAuth) | 3 days |
| 4 remaining visa checklists | 2 days |
| GDPR endpoints + audit logging | 1 week |
| Multi-role access control | 3 days |
| Email notifications | 1 day |
| MFA | 2 days |
| Rate limiting + security hardening | 1 week |
| Load testing + launch | 1 week |

**Total path to production: ~6–7 weeks after demo approval.**

---

*End of MVP Requirements | Visa AI Review System | v1.0 | May 2026*
*This is a demo build — not for production use with real applicant data.*
