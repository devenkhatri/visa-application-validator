# Visa AI Review System — MVP

An AI-powered visa document review platform that reads applicant documents, validates them against country-specific checklists, and delivers a probability score and gap analysis — in under 3 minutes, with full data privacy.

> **This is a local-first MVP / proof-of-concept.** All data is stored in a local SQLite database. No cloud infrastructure or authentication is required to run the demo.

---

## What It Does

1. **Document Upload** — Accepts passport scans, bank statements, employment letters, and supporting documents (PDF, JPG, PNG, up to 10 MB each).
2. **Vision OCR** — Uses a free vision LLM (via OpenRouter) to extract structured data from every document. Results are MD5-cached for 90 days — re-uploads of the same file are instant and free.
3. **PII Scrubbing** — Before any analysis, a `scrubPII()` function strips all personal identifiers (passport numbers, exact balances, full names, account numbers) and replaces them with anonymised summaries.
4. **Gap Analysis** — A reasoning LLM (via OpenRouter) compares the scrubbed summaries against the country-specific visa checklist and returns a structured JSON report.
5. **Scored Report** — An overall probability score (0–100), a 5-category breakdown, gap analysis table, key strengths, critical gaps, and recommended actions — displayed on an interactive dashboard and downloadable as a PDF.

### Supported Visa Types (MVP)
| ID | Country | Visa Type |
|---|---|---|
| `UK-SVV-01` | 🇬🇧 United Kingdom | Standard Visitor Visa |
| `SCH-CSS-01` | 🇪🇺 Schengen Zone | Short Stay (Type C) |

---

## Solution Proposal

Open [`index.html`](./index.html) in any browser for the full customer-facing solution proposal — a mobile-responsive, single-file document covering the problem, AI pipeline, data privacy architecture, cost analysis, tech stack, and delivery roadmap.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | SQLite via `better-sqlite3` + Drizzle ORM |
| AI — OCR | `google/gemma-4-26b-it:free` via OpenRouter |
| AI — Analysis | `deepseek/deepseek-r1:free` via OpenRouter |
| PDF Generation | `@react-pdf/renderer` |
| PDF Parsing | `pdfjs-dist` + `canvas` |

---

## Prerequisites

- **Node.js** ≥ 18.17 (check with `node -v`)
- **npm** ≥ 9 (check with `npm -v`)
- **OpenRouter API key** — free account at [openrouter.ai/keys](https://openrouter.ai/keys)

---

## Setup — Step by Step

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd visa-application-validator
```

### 2. Install dependencies

```bash
npm install
```

> This installs all packages including `better-sqlite3` (native binary — requires a C++ build toolchain). On macOS, Xcode Command Line Tools must be installed (`xcode-select --install`).

### 3. Configure environment variables

Copy the example file and fill in your OpenRouter key:

```bash
cp .env.example .env.local
```

Open `.env.local` and set your key:

```env
# Required — get yours free at https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-your-key-here

# Optional — these are the defaults, change only if needed
MODEL_OCR=google/gemma-4-26b-it:free
MODEL_ANALYSIS=deepseek/deepseek-r1:free

NEXT_PUBLIC_URL=http://localhost:3000
DEMO_MODE=true
```

> **Note:** `.env.local` is gitignored and will never be committed. `.env.example` is the safe committed template.

### 4. Set up the database

Create the local SQLite database and run migrations:

```bash
mkdir -p data
npx drizzle-kit generate
npx drizzle-kit migrate
```

This creates `./data/visa-mvp.db` — a local SQLite file that stores all reviews, documents, extractions, and results. It is gitignored.

### 5. Start the development server

```bash
npm run dev
```

The app will be available at **[http://localhost:3000](http://localhost:3000)**.

---

## Using the Demo

1. **Open** [http://localhost:3000](http://localhost:3000) — you'll see the landing page.
2. **Click** "Try Demo" to begin.
3. **Step 1 — Select visa type:** Choose UK or Schengen, enter a nationality.
4. **Step 2 — Upload documents:** Drag and drop files (passport, bank statement, employment letter, etc.). Select the document type for each upload.
5. **Step 3 — Processing:** Watch the live step indicator as the AI pipeline runs (OCR → PII scrub → gap analysis). Takes 1–3 minutes on first run; repeat uploads use the cache and are near-instant.
6. **Step 4 — Results:** View the probability score, breakdown chart, and gap analysis table. Download the PDF report. Click "How is your data protected?" to see the PII explainer.

---

## Project Structure

```
visa-application-validator/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── demo/page.tsx               # Step 1 — select visa type
│   ├── upload/[id]/page.tsx        # Step 2 — upload documents
│   ├── processing/[id]/page.tsx    # Step 3 — live AI progress
│   ├── results/[id]/page.tsx       # Step 4 — report
│   ├── pii-explainer/[id]/page.tsx # PII before/after explainer
│   └── api/
│       └── reviews/
│           ├── route.ts                    # POST — create review
│           └── [id]/
│               ├── documents/route.ts      # POST — upload file
│               ├── start/route.ts          # POST — trigger AI pipeline
│               ├── status/route.ts         # GET  — poll status
│               ├── result/route.ts         # GET  — fetch result
│               └── report.pdf/route.ts     # GET  — download PDF
├── components/
│   ├── ScoreGauge.tsx              # Animated circular score gauge
│   ├── GapAnalysisTable.tsx        # Colour-coded gap table
│   ├── ProbabilityBreakdown.tsx    # 5-bar animated breakdown
│   ├── ProcessingSteps.tsx         # Live step tracker (polls /status)
│   └── PIIComparison.tsx           # Side-by-side PII before/after
├── lib/
│   ├── ai/
│   │   ├── openrouter.ts           # Shared OpenAI-compat client
│   │   ├── ocr.ts                  # Vision extraction
│   │   ├── ocrCache.ts             # MD5 hash-based cache (90-day TTL)
│   │   ├── pdfToImages.ts          # PDF → PNG for vision models
│   │   ├── scrubPII.ts             # Full PII scrubber
│   │   ├── analysis.ts             # Gap analysis
│   │   └── types.ts                # Shared TypeScript interfaces
│   ├── checklists/
│   │   ├── UK-SVV-01.json          # UK Standard Visitor checklist
│   │   ├── SCH-CSS-01.json         # Schengen Short Stay checklist
│   │   └── index.ts                # Checklist loader
│   └── db/
│       ├── schema.ts               # Drizzle SQLite schema
│       └── index.ts                # DB client (WAL mode enabled)
├── data/                           # SQLite DB lives here (gitignored)
├── drizzle/                        # Auto-generated migration files
├── index.html                      # Customer-facing solution proposal
├── drizzle.config.ts
├── next.config.ts
├── .env.example                    # Safe template — commit this
└── .env.local                      # Your secrets — never commit this
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `reviews` | Review sessions — status, checklist ID, nationality |
| `documents` | Uploaded files — stored as BLOBs with MD5 hash |
| `document_extractions` | OCR cache — keyed by MD5 hash, 90-day TTL |
| `review_results` | Final gap analysis output + scrubbed input for PII explainer |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/reviews` | Create a new review session |
| `POST` | `/api/reviews/:id/documents` | Upload a document (multipart/form-data) |
| `POST` | `/api/reviews/:id/start` | Trigger the AI pipeline (fires background job) |
| `GET` | `/api/reviews/:id/status` | Poll processing status |
| `GET` | `/api/reviews/:id/result` | Fetch full gap analysis result |
| `GET` | `/api/reviews/:id/report.pdf` | Download PDF report |

---

## Resetting the Database

To wipe all data and start fresh:

```bash
rm data/visa-mvp.db
npx drizzle-kit migrate
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | ✅ Yes | — | Your OpenRouter API key |
| `MODEL_OCR` | No | `google/gemma-4-26b-it:free` | Vision model for OCR extraction |
| `MODEL_ANALYSIS` | No | `deepseek/deepseek-r1:free` | Reasoning model for gap analysis |
| `NEXT_PUBLIC_URL` | No | `http://localhost:3000` | App base URL (used in API headers) |
| `DEMO_MODE` | No | `true` | Enables demo mode (bypasses auth) |
| `SQLITE_DB_PATH` | No | `./data/visa-mvp.db` | Custom path for the SQLite database |

---

## Troubleshooting

**`Cannot open database because the directory does not exist`**
```bash
mkdir -p data && npx drizzle-kit migrate
```

**`better-sqlite3` build error on install**
```bash
xcode-select --install   # macOS only
npm install
```

**OCR returns empty or garbled results**
- Ensure `OPENROUTER_API_KEY` is set correctly in `.env.local`
- Check the model is available free at [openrouter.ai/models](https://openrouter.ai/models?q=free)
- Try switching `MODEL_OCR` to `google/gemini-2.0-flash-exp:free`

**Review stays in `processing` forever**
- Check the terminal running `npm run dev` for error logs — the background pipeline logs all steps
- The review will be marked `failed` after an error, and you can retry from the processing page

---

## License

Internal — For customer review and demonstration purposes only.
