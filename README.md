# Visa AI Review System — MVP (v1.2)

An AI-powered visa document review platform that reads applicant documents, validates them against country-specific checklists, and delivers a probability score and gap analysis — in under 3 minutes, with full data privacy.

> **v1.2 Update (Advanced Features):** Introduced **Dynamic Personalised Questionnaires** to build custom checklists, **Application History** for tracking past reviews, and **Stage Timelines** for a complete audit trail of the AI processing pipeline.

---

## What It Does

1. **Personalised Questionnaire** — Builds a custom document checklist by asking 6 profile-specific questions (employment, purpose, travel history, etc.).
2. **Document Upload** — Accepts passport scans, bank statements, employment letters, and supporting documents (PDF, JPG, PNG, up to 10 MB each).
3. **Local / Vision OCR** — Extracts text using local Python engines (PaddleOCR, Ollama, Tesseract) or cloud-hosted multimodal models (Gemini 2.0 Flash via OpenRouter / Mistral API). Results are MD5-cached in SQLite for 90 days.
4. **PII Scrubbing** — Before any external gap analysis, a strict `scrubPII()` function strips all personal identifiers and replaces them with anonymised summary logic.
5. **Gap Analysis** — A reasoning LLM compares the scrubbed summaries against the **personalised** visa checklist and returns a structured evaluation report.
6. **Audit Timeline** — Provides a stage-by-stage event log of the entire pipeline, showing durations, cache hits, and JSON output summaries for every step.
7. **Application History** — A centralised dashboard to track all past reviews, view scores/verdicts, and re-run reviews on existing document data.

### Supported Visa Types (MVP)
| ID | Country | Visa Type |
|---|---|---|
| `UK-SVV-01` | 🇬🇧 United Kingdom | Standard Visitor Visa |
| `SCH-CSS-01` | 🇪🇺 Schengen Zone | Short Stay (Type C) |

---

## Tech Stack

| Layer | Technology | Description |
|---|---|---|
| Framework | Next.js 16 (App Router, TypeScript) | Core frontend and backend dispatcher |
| Styling | Tailwind CSS | Modern responsive UI architecture |
| Database | SQLite via `better-sqlite3` + Drizzle ORM | Local storage with WAL mode and 6 relational tables |
| **Local OCR Sidecar** | Python FastAPI + PaddleOCR / Ollama | **100% offline text extraction (local default)** |
| Cloud OCR Fallbacks | Gemini 2.0 Flash / Mistral Small 3.1 | Switchable via `OCR_MODE` environment override |
| AI Analysis | Claude 3.5 / DeepSeek R1 via OpenRouter | Free reasoning models for checklist generation and gap assessment |
| PDF Generation | `@react-pdf/renderer` | Client/server PDF document builder |

---

## Prerequisites

- **Node.js** ≥ 18.17
- **Python** ≥ 3.10 (for running the local OCR sidecar service)
- **OpenRouter API key** — get yours free at [openrouter.ai/keys](https://openrouter.ai/keys)

---

## Setup — Step by Step

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd visa-application-validator
```

### 2. Set up the Local Python OCR Sidecar Service (Required for Local Mode)

Initialize the Python virtual environment and install dedicated computer vision packages:

```bash
# Create and activate virtual environment
python3.10 -m venv ocr-service/venv
source ocr-service/venv/bin/activate  # Windows: ocr-service\venv\Scripts\activate

# Install dependencies
pip install -r ocr-service/requirements.txt

# Start the sidecar service on port 8000
python ocr-service/main.py
```

### 3. Install Node.js Dependencies

Open a second terminal tab/window in the project root:

```bash
npm install
```

### 4. Configure Environment Variables

Copy the template file and add your OpenRouter key:

```bash
cp .env.example .env.local
```

### 5. Initialize the Database

Generate and apply local SQLite schema migrations:

```bash
mkdir -p data
npx drizzle-kit generate
npx drizzle-kit migrate
```
> *Creates `./data/visa-mvp.db` containing 6 tables: reviews, documents, review_results, document_extractions, checklist_profiles, and application_events.*

### 6. Start the Next.js Development Server

```bash
npm run dev
```

The review interface is now accessible at **[http://localhost:3000](http://localhost:3000)**.

---

## Using the Demo

1. **Launch** [http://localhost:3000](http://localhost:3000) and click **"Try Demo"**.
2. **Step 1 — Select visa:** Choose UK or Schengen and input nationality.
3. **Step 2 — Questionnaire:** Answer 6 questions to build your personalised profile.
4. **Step 3 — Checklist:** View the AI-generated document list with priority and score impact.
5. **Step 4 — Upload:** Drag and drop your files.
6. **Step 5 — Processing:** Watch the stage-by-stage progress with local privacy assurance.
7. **Step 6 — Results:** Review the probability score, gap analysis, and strengths.
8. **Audit & History:** Click **"History"** in the top nav to see past applications, or **"Timeline"** on any past review to see the full audit trail.

---

## Project Structure

```
visa-application-validator/
├── app/
│   ├── demo/                       # Visa selection
│   ├── questionnaire/              # Profile builder [NEW v1.2]
│   ├── upload/                     # Multi-file uploader
│   ├── processing/                 # Live status wizard
│   ├── results/                    # Scored dashboard
│   ├── history/                    # Global history view [NEW v1.2]
│   └── applications/[id]/timeline/ # Stage-by-stage audit trail [NEW v1.2]
├── components/                     # Reusable UI (ProcessingSteps, ScoreGauge)
├── lib/
│   ├── ai/
│   │   ├── checklistBuilder.ts     # Personalised checklist logic [NEW v1.2]
│   │   ├── ocr.ts                  # Multi-mode OCR Dispatcher
│   │   ├── scrubPII.ts             # Data Scrubbing safety layer
│   │   └── analysis.ts             # OpenRouter Gap Analysis adapter
│   ├── checklists/                 # Visa Rules JSON Schemas
│   └── db/                         # Drizzle ORM Config and Schema (6 tables)
├── ocr-service/                    # Local Python Computer Vision Sidecar
└── data/                           # Application SQLite DB storage
```

---

## License

Internal — Intended strictly for architectural validation and customer software demonstrations.
