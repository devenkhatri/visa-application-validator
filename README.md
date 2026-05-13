# Visa AI Review System — MVP (v1.1)

An AI-powered visa document review platform that reads applicant documents, validates them against country-specific checklists, and delivers a probability score and gap analysis — in under 3 minutes, with full data privacy.

> **v1.1 Update (Local-First Architecture):** OCR text extraction is now **local-first by default** using a dedicated Python FastAPI sidecar service (`ocr-service`). Documents **never leave the local machine** during text parsing and extraction. Cloud-based multimodal OCR via OpenRouter or Mistral is preserved as a seamless drop-in alternative.

---

## What It Does

1. **Document Upload** — Accepts passport scans, bank statements, employment letters, and supporting documents (PDF, JPG, PNG, up to 10 MB each).
2. **Local / Vision OCR** — Extracts text using local Python engines (PaddleOCR, Ollama, Tesseract) or cloud-hosted multimodal models (Gemini 2.0 Flash via OpenRouter / Mistral API). Results are MD5-cached in SQLite for 90 days — re-uploads of the same file are instant and completely local.
3. **PII Scrubbing** — Before any external gap analysis, a strict `scrubPII()` function strips all personal identifiers (passport numbers, exact balances, full names, account numbers) and replaces them with anonymised summary logic.
4. **Gap Analysis** — A reasoning LLM compares the scrubbed, anonymised summaries against the country-specific visa checklist and returns a structured JSON evaluation report.
5. **Scored Report** — Displays an overall probability score (0–100), a 5-category component breakdown, gap analysis table, key strengths, critical gaps, and numbered recommendations on an interactive dashboard downloadable as a formatted PDF.

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
| Styling | Tailwind CSS + shadcn/ui | Component UI architecture |
| Database | SQLite via `better-sqlite3` + Drizzle ORM | Local relational storage with WAL mode enabled |
| **Local OCR Sidecar** | Python FastAPI + PaddleOCR / Ollama | **100% offline text extraction (local default)** |
| Cloud OCR Fallbacks | Gemini 2.0 Flash / Mistral Small 3.1 | Switchable via `OCR_MODE` environment override |
| AI Analysis | `deepseek/deepseek-r1:free` via OpenRouter | Free reasoning model for intelligent gap assessment |
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
python3 -m venv ocr-service/venv
source ocr-service/venv/bin/activate  # Windows: ocr-service\venv\Scripts\activate

# Install dependencies (FastAPI, Uvicorn, PaddleOCR, pdf2image, etc.)
pip install -r ocr-service/requirements.txt

# Start the sidecar service on port 8000
python ocr-service/main.py
```
> **Note:** The local OCR service listens on `http://localhost:8000`. The first run will automatically download standard lightweight OCR models (~100MB) directly into local cache.

### 3. Install Node.js Dependencies

Open a second terminal tab/window in the project root:

```bash
npm install
```
> *Installs native bindings (`better-sqlite3`, `canvas`). On macOS, ensure Xcode Command Line Tools are active (`xcode-select --install`).*

### 4. Configure Environment Variables

Copy the template file:

```bash
cp .env.example .env.local
```

Open `.env.local` and configure your API keys and preferred OCR mode:

```env
# Required — OpenRouter key for Gap Analysis
OPENROUTER_API_KEY=sk-or-your-key-here

# OCR Mode Configuration — 'local' (sidecar) | 'openrouter' (cloud default) | 'mistral'
OCR_MODE=local

# Local sidecar API endpoint (used when OCR_MODE=local)
LOCAL_OCR_URL=http://localhost:8000
# LOCAL_OCR_ENGINE=paddle   # 'paddle' (default) | 'tesseract' | 'ollama'

# Optional Model Overrides
MODEL_OCR=google/gemini-2.0-flash-exp:free
MODEL_ANALYSIS=deepseek/deepseek-r1:free

NEXT_PUBLIC_URL=http://localhost:3000
DEMO_MODE=true
```

### 5. Initialize the Database

Generate and apply local SQLite schema migrations:

```bash
mkdir -p data
npx drizzle-kit generate
npx drizzle-kit migrate
```
> *Creates `./data/visa-mvp.db` containing reviews, cache entries, and extraction payloads.*

### 6. Start the Next.js Development Server

```bash
npm run dev
```

The review interface is now fully accessible at **[http://localhost:3000](http://localhost:3000)**.

---

## Using the Demo

1. **Launch** [http://localhost:3000](http://localhost:3000) and click **"Try Demo"**.
2. **Step 1 — Select visa type:** Choose UK or Schengen, input a test nationality.
3. **Step 2 — Upload documents:** Drag and drop sample document files. Assign specific type labels (e.g., Passport, Bank Statement).
4. **Step 3 — Live Processing:** Watch real-time visual progress ticks. Notice the dedicated local-privacy messaging badge confirming **"OCR running locally — document stays on this machine"**.
5. **Step 4 — Review Results:** Assess the visual probability score gauge, sub-component breakdowns, and critical gap recommendations. Click **"How is your data protected?"** to visually inspect exact local extractions versus scrubbed cloud payloads.
6. **Re-upload Verification:** Re-submit identical files to instantly observe perfect zero-latency SQLite MD5 cache hits.

---

## Project Structure

```
visa-application-validator/
├── app/                            # Next.js App Router Page Layouts
├── components/                     # Interactive UI Components (ScoreGauge, ProcessingSteps)
├── lib/
│   ├── ai/
│   │   ├── ocr.ts                  # Multi-mode OCR Dispatcher (local | openrouter | mistral)
│   │   ├── scrubPII.ts             # Data Scrubbing safety layer
│   │   └── analysis.ts             # OpenRouter Gap Analysis adapter
│   ├── checklists/                 # Visa Rules JSON Schemas
│   └── db/                         # Drizzle ORM Config and SQLite drivers
├── ocr-service/                    # Local Python Computer Vision Sidecar
│   ├── main.py                     # FastAPI server engine supporting PaddleOCR/Ollama
│   ├── requirements.txt            # Locked pip packages
│   └── ocr_cache.db                # Auto-managed standalone local SQLite cache
├── data/                           # Application SQLite DB storage
├── index.html                      # Customer Proposal Static Page
└── .env.local                      # Runtime Configuration secrets
```

---

## Troubleshooting

* **`Local OCR service is not running` error during review processing:**
  Ensure the Python sidecar is fully activated in a separate terminal:
  ```bash
  cd ocr-service && source venv/bin/activate && python main.py
  ```
* **Address already in use (`[Errno 48]`) on port 8000:**
  Terminate lingering local server instances listening on port 8000:
  ```bash
  lsof -ti :8000 | xargs kill -9
  ```
* **Missing packages during pip install:**
  Ensure the virtual environment is successfully activated before executing pip installations.

---

## License

Internal — Intended strictly for architectural validation and customer software demonstrations.
