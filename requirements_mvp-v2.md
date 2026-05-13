# Visa AI Review System — MVP Requirements
**Version:** 1.1 | **Date:** May 2026 | **Purpose:** POC / Customer Demo
**Build Time:** 1 week | **Deploy:** Vercel (free/hobby tier)

> **Claude Code Instruction:** This is a lean MVP to demonstrate the concept to a customer.
> Speed of delivery matters more than production hardening. Build what is listed here —
> nothing more. Every item marked ❌ DEFERRED is intentionally excluded from this build.
> The goal is a working demo that can be shown live in a browser within 7 days.

**v1.1 Changes from v1.0:**
- OCR is now **local-first by default** using a Python FastAPI service (PaddleOCR or Ollama)
- Documents never leave the local machine during development and demo
- Mistral API retained as a switchable fallback via `OCR_MODE` environment variable
- Python OCR service added as a required sidecar process alongside Next.js
- New section added: Section 3 — Local OCR Python Service (full implementation)
- Processing steps updated to reflect local OCR language
- Environment variables updated — `MISTRAL_API_KEY` now optional
- Demo cost updated — ₹0 OCR cost in local mode
- Build order updated — Python service set up on Day 1

---

## What This MVP Must Prove to the Customer

The demo needs to answer five questions the customer will have in the room:

1. **"Can it actually read my documents?"** — Live document upload and OCR extraction
2. **"Does it know what's missing?"** — Gap analysis against a real visa checklist
3. **"What's the score?"** — Probability score with visual gauge and colour banding
4. **"Is our data safe?"** — PII scrubbing shown visibly in the UI — and OCR done locally
5. **"How fast is it?"** — End-to-end review completing in under 3 minutes

If the demo answers all five, the customer signs off. Everything else is post-MVP.

---

## What Is Cut vs Kept

| Feature | MVP | Production |
|---|---|---|
| Document upload | ✅ Local upload (no Drive/OneDrive) | Google Drive + OneDrive |
| OCR extraction | ✅ **Local Python service (PaddleOCR/Ollama)** | Customer choice: local or Mistral API |
| OCR fallback | ✅ Mistral API (switchable via env var) | Same |
| OCR caching | ✅ Simple DB cache (MD5 hash) + local SQLite | Same |
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
| **OCR (primary)** | **Python FastAPI + PaddleOCR** | **100% local — documents never leave machine** |
| **OCR (fallback)** | **Mistral Small 3.1 API** | **Switch with one env var if needed** |
| **OCR cache** | **SQLite (local) + Neon PostgreSQL** | **Local cache for Python service, Neon for Next.js** |
| Analysis | Claude Sonnet 4.6 | Same as production |
| Auth | Hardcoded demo credentials | Zero setup time |
| Deployment | Next.js on Vercel + Python local | Python runs locally during demo |
| PDF | `@react-pdf/renderer` | Same as production |
| Styling | Tailwind CSS + shadcn/ui | Fast, looks professional |

> **Key principle:** Documents never leave your machine. The Python OCR service runs
> locally alongside Next.js. Claude only receives PII-scrubbed summaries — never
> raw document content. This is the strongest possible privacy story for the demo.

> **Deployment note:** For the Vercel-hosted demo URL, either run the Python service
> locally and use ngrok to expose it, OR switch `OCR_MODE=mistral` for the Vercel
> deployment. The local demo (localhost) always uses local OCR.

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
✅ Documents received and fingerprinted
⏳ Checking OCR cache...
✅ Cache miss — running local OCR (document stays on this machine)
⏳ Extracting text locally with PaddleOCR...
✅ OCR complete — 3 documents read locally, nothing sent to internet
⏳ Scrubbing personal data before AI analysis...
✅ PII scrubbed — passport numbers and financial figures removed
⏳ Sending anonymised summary to Claude for gap analysis...
✅ Analysis complete
⏳ Generating report...
✅ Done — full review in under 3 minutes
```

> This step is the most powerful moment in the demo. The customer sees:
> (a) OCR runs locally — no document leaves the machine
> (b) PII is scrubbed before anything goes to the internet
> (c) Claude only receives anonymised summaries
> Build genuine live status updates — not fake animations.

### Step 4 — Results Page
Full gap analysis report (see Section 4).

---

## 2. OCR Mode — Switchable Architecture

The OCR layer is designed to be swapped with a single environment variable.
This means you can run local OCR during development and the demo, and switch
to Mistral for any Vercel-hosted deployment without changing any code.

```typescript
// lib/ai/ocr.ts — single entry point, mode-aware

const OCR_MODE = process.env.OCR_MODE ?? 'local' // 'local' | 'mistral'
const LOCAL_OCR_URL = process.env.LOCAL_OCR_URL ?? 'http://localhost:8000'

export async function extractDocument(
  fileBuffer: Buffer,
  mimeType: string,
  documentType: string
): Promise<RawExtraction> {

  if (OCR_MODE === 'local') {
    return await extractLocal(fileBuffer, mimeType, documentType)
  }
  return await extractMistral(fileBuffer, mimeType, documentType)
}

// ── Local Python service call ─────────────────────────────────────────
async function extractLocal(
  fileBuffer: Buffer,
  mimeType: string,
  documentType: string
): Promise<RawExtraction> {
  const formData = new FormData()
  formData.append('file', new Blob([fileBuffer], { type: mimeType }), 'document')
  formData.append('document_type', documentType)
  formData.append('method', process.env.LOCAL_OCR_ENGINE ?? 'paddle') // 'paddle' | 'ollama'

  const res = await fetch(`${LOCAL_OCR_URL}/extract`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(60000) // 60s timeout for local OCR
  })

  if (!res.ok) throw new Error(`Local OCR failed: ${res.statusText}`)
  const json = await res.json()
  return json.data as RawExtraction
}

// ── Mistral API call (fallback) ────────────────────────────────────────
async function extractMistral(
  fileBuffer: Buffer,
  mimeType: string,
  documentType: string
): Promise<RawExtraction> {
  const Mistral = (await import('@mistralai/mistralai')).default
  const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! })

  const base64 = fileBuffer.toString('base64')
  const imageUrl = `data:${mimeType};base64,${base64}`

  const response = await mistral.chat.complete({
    model: 'mistral-small-latest',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', imageUrl: { url: imageUrl } },
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
  })

  return JSON.parse(response.choices[0].message.content as string)
}
```

---

## 3. Local OCR Python Service — Full Implementation

> **This is a required component of the MVP.** Run it alongside Next.js.
> It is a FastAPI server that accepts document uploads and returns structured
> extractions. Documents never leave the machine.

### 3.1 Setup

```bash
# Create Python environment
cd visa-ai-mvp
python3 -m venv ocr-service/venv
source ocr-service/venv/bin/activate   # Windows: ocr-service\venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn python-multipart \
            paddlepaddle paddleocr \
            pdf2image Pillow numpy \
            ollama                    # only if using Ollama engine

# Install system dependency for PDF conversion
# Mac:   brew install poppler
# Linux: apt-get install poppler-utils
# Win:   download poppler from https://github.com/oschwartz10612/poppler-windows

# Run the service
python ocr-service/main.py
# Service starts at http://localhost:8000
```

### 3.2 Full Python Service Code

```python
# ocr-service/main.py
# Run: python ocr-service/main.py
# Listens on http://localhost:8000

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import hashlib
import json
import sqlite3
import os
from datetime import datetime, timedelta
from io import BytesIO
import base64
import traceback

app = FastAPI(title="Visa AI — Local OCR Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["POST", "GET"],
    allow_headers=["*"]
)

# ── Lazy-load heavy models (only when first used) ──────────────────────
_paddle_ocr = None
def get_paddle():
    global _paddle_ocr
    if _paddle_ocr is None:
        from paddleocr import PaddleOCR
        print("Loading PaddleOCR model (first run may take 30s)...")
        _paddle_ocr = PaddleOCR(
            use_angle_cls=True,
            lang='en',        # change to 'arabic' / 'hindi' as needed
            use_gpu=False,    # set True if you have NVIDIA GPU
            show_log=False
        )
        print("PaddleOCR ready.")
    return _paddle_ocr

# ── SQLite cache (local, no cloud needed) ──────────────────────────────
DB_PATH = "ocr-service/ocr_cache.db"

def init_db():
    os.makedirs("ocr-service", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS ocr_cache (
            hash         TEXT PRIMARY KEY,
            document_type TEXT NOT NULL,
            extracted_data TEXT NOT NULL,
            ocr_engine   TEXT,
            created_at   TEXT,
            expires_at   TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

def get_cached(file_hash: str) -> dict | None:
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        'SELECT extracted_data FROM ocr_cache WHERE hash = ? AND expires_at > ?',
        (file_hash, datetime.now().isoformat())
    ).fetchone()
    conn.close()
    return json.loads(row[0]) if row else None

def save_cache(file_hash: str, doc_type: str, data: dict, engine: str):
    conn = sqlite3.connect(DB_PATH)
    expires = (datetime.now() + timedelta(days=90)).isoformat()
    conn.execute(
        'INSERT OR REPLACE INTO ocr_cache VALUES (?, ?, ?, ?, ?, ?)',
        (file_hash, doc_type, json.dumps(data),
         engine, datetime.now().isoformat(), expires)
    )
    conn.commit()
    conn.close()

# ── Main extract endpoint ──────────────────────────────────────────────
@app.post("/extract")
async def extract_document(
    file: UploadFile = File(...),
    document_type: str = Form(default="document"),
    method: str = Form(default="paddle")   # 'paddle' | 'ollama' | 'tesseract'
):
    file_bytes = await file.read()
    mime_type  = file.content_type or "application/octet-stream"

    # 1. MD5 fingerprint
    file_hash = hashlib.md5(file_bytes).hexdigest()

    # 2. Check local cache first
    cached = get_cached(file_hash)
    if cached:
        print(f"Cache HIT: {file_hash[:8]}... ({document_type})")
        return { "source": "cache", "hash": file_hash, "data": cached }

    print(f"Cache MISS: {file_hash[:8]}... — running {method} OCR")

    # 3. Run OCR
    try:
        if method == "ollama":
            result = await run_ollama(file_bytes, mime_type, document_type)
        elif method == "tesseract":
            result = run_tesseract(file_bytes, mime_type, document_type)
        else:
            result = run_paddle(file_bytes, mime_type, document_type)
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

    # 4. Ensure standard structure
    structured = ensure_structure(result, document_type)

    # 5. Save to local cache
    save_cache(file_hash, document_type, structured, method)

    return { "source": "local_ocr", "hash": file_hash, "data": structured }


# ── PaddleOCR engine ───────────────────────────────────────────────────
def run_paddle(file_bytes: bytes, mime_type: str, doc_type: str) -> dict:
    import numpy as np
    from PIL import Image
    from pdf2image import convert_from_bytes

    if 'pdf' in mime_type:
        pages = convert_from_bytes(file_bytes, dpi=300)
    else:
        pages = [Image.open(BytesIO(file_bytes))]

    ocr = get_paddle()
    full_text = ""
    all_lines = []
    total_confidence = 0
    count = 0

    for page in pages:
        img_array = np.array(page)
        result = ocr.ocr(img_array, cls=True)
        if result and result[0]:
            for line in result[0]:
                text, confidence = line[1]
                full_text += text + "\n"
                all_lines.append({"text": text, "confidence": float(confidence)})
                total_confidence += float(confidence)
                count += 1

    avg_confidence = total_confidence / count if count > 0 else 0.0

    # Parse structured fields from raw text
    extracted_fields = parse_fields_from_text(full_text, doc_type)

    return {
        "document_type":     doc_type,
        "extracted_fields":  extracted_fields,
        "raw_text":          full_text,
        "document_validity": extract_validity(extracted_fields),
        "confidence_score":  round(avg_confidence, 3),
        "language":          "en",
        "warnings":          [],
        "ocr_engine":        "paddleocr"
    }


# ── Ollama (LLaVA / minicpm-v) engine ─────────────────────────────────
async def run_ollama(file_bytes: bytes, mime_type: str, doc_type: str) -> dict:
    import ollama
    from PIL import Image
    from pdf2image import convert_from_bytes

    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "minicpm-v")  # or 'llava', 'llava:13b'

    # Convert to image
    if 'pdf' in mime_type:
        pages = convert_from_bytes(file_bytes, dpi=300)
        first_page = pages[0]
    else:
        first_page = Image.open(BytesIO(file_bytes))

    # Encode to base64
    buf = BytesIO()
    first_page.save(buf, format='PNG')
    b64_image = base64.b64encode(buf.getvalue()).decode()

    prompt = f"""You are a document extraction specialist. Extract ALL relevant 
information from this {doc_type}. Return ONLY valid JSON, no extra text:
{{
  "document_type": "{doc_type}",
  "extracted_fields": {{
    "full_name": "string or null",
    "document_number": "string or null",
    "date_of_birth": "YYYY-MM-DD or null",
    "nationality": "string or null",
    "expiry_date": "YYYY-MM-DD or null",
    "issuing_country": "string or null",
    "issuing_authority": "string or null",
    "account_number": "string or null",
    "balance": "number or null",
    "currency": "string or null",
    "employer": "string or null",
    "salary": "number or null",
    "employment_status": "string or null"
  }},
  "document_validity": {{
    "expiry_date": "YYYY-MM-DD or null",
    "is_expired": false
  }},
  "confidence_score": 0.90,
  "language": "en",
  "warnings": []
}}"""

    response = ollama.chat(
        model=OLLAMA_MODEL,
        messages=[{
            'role':    'user',
            'content': prompt,
            'images':  [b64_image]
        }]
    )

    raw = response['message']['content']
    raw = raw.replace('```json', '').replace('```', '').strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: return raw text in standard structure
        return {
            "document_type":     doc_type,
            "extracted_fields":  {},
            "raw_text":          raw,
            "document_validity": {"expiry_date": None, "is_expired": False},
            "confidence_score":  0.6,
            "language":          "en",
            "warnings":          ["JSON parse failed — raw text returned"],
            "ocr_engine":        OLLAMA_MODEL
        }


# ── Tesseract engine (fallback, no extra model download needed) ────────
def run_tesseract(file_bytes: bytes, mime_type: str, doc_type: str) -> dict:
    try:
        import pytesseract
        from PIL import Image
        from pdf2image import convert_from_bytes

        if 'pdf' in mime_type:
            pages = convert_from_bytes(file_bytes, dpi=300)
        else:
            pages = [Image.open(BytesIO(file_bytes))]

        full_text = ""
        for page in pages:
            full_text += pytesseract.image_to_string(page, lang='eng')

        extracted_fields = parse_fields_from_text(full_text, doc_type)
        return {
            "document_type":     doc_type,
            "extracted_fields":  extracted_fields,
            "raw_text":          full_text,
            "document_validity": extract_validity(extracted_fields),
            "confidence_score":  0.75,
            "language":          "en",
            "warnings":          [],
            "ocr_engine":        "tesseract"
        }
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="pytesseract not installed. Run: pip install pytesseract"
        )


# ── Field parsing from raw text ────────────────────────────────────────
def parse_fields_from_text(text: str, doc_type: str) -> dict:
    """
    Basic regex parsing of raw OCR text into structured fields.
    Ollama returns structured JSON directly — this is only needed for
    PaddleOCR and Tesseract which return raw text.
    """
    import re

    fields = {}
    text_upper = text.upper()

    # Date patterns: DD MMM YYYY, YYYY-MM-DD, DD/MM/YYYY
    date_patterns = [
        r'\b(\d{2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4})\b',
        r'\b(\d{4}-\d{2}-\d{2})\b',
        r'\b(\d{2}/\d{2}/\d{4})\b',
    ]

    dates_found = []
    for pattern in date_patterns:
        dates_found.extend(re.findall(pattern, text_upper))

    if doc_type == 'passport':
        # Passport number: typically P followed by letters/numbers
        passport_match = re.search(r'\b([A-Z]{1,2}\d{7,8})\b', text_upper)
        if passport_match:
            fields['passport_number'] = passport_match.group(1)

        # MRZ line contains DOB and expiry
        mrz_match = re.search(r'([A-Z0-9<]{9,})\n([A-Z0-9<]{9,})', text_upper)
        if mrz_match:
            fields['mrz_detected'] = True

        # Expiry — usually labelled
        expiry_match = re.search(r'(?:EXPIRY|EXPIRATION|DATE OF EXPIRY)[:\s]+([0-9A-Z /\-]+)', text_upper)
        if expiry_match:
            fields['expiry_date'] = expiry_match.group(1).strip()

        # Nationality
        nat_match = re.search(r'(?:NATIONALITY|NATIONALIT)[:\s]+([A-Z]+)', text_upper)
        if nat_match:
            fields['nationality'] = nat_match.group(1).strip()

    elif doc_type == 'bank_statement':
        # Balance
        balance_match = re.search(r'(?:BALANCE|CLOSING BAL|AVAILABLE)[:\s₹£$€]+([0-9,]+\.?\d*)', text_upper)
        if balance_match:
            fields['balance'] = float(balance_match.group(1).replace(',', ''))

        # Currency
        if '£' in text or 'GBP' in text_upper: fields['currency'] = 'GBP'
        elif '$' in text or 'USD' in text_upper: fields['currency'] = 'USD'
        elif '₹' in text or 'INR' in text_upper: fields['currency'] = 'INR'
        elif '€' in text or 'EUR' in text_upper: fields['currency'] = 'EUR'

        # Count months of statements
        months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
                  'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']
        months_found = sum(1 for m in months if m in text_upper)
        if months_found > 0:
            fields['months_of_history'] = months_found

    elif doc_type == 'employment_letter':
        # Salary
        salary_match = re.search(r'(?:SALARY|CTC|REMUNERATION|PACKAGE)[:\s₹£$€]+([0-9,]+)', text_upper)
        if salary_match:
            fields['salary'] = float(salary_match.group(1).replace(',', ''))

        # Employment status
        if any(w in text_upper for w in ['PERMANENT', 'FULL-TIME', 'FULL TIME']):
            fields['employment_status'] = 'permanent'
        elif any(w in text_upper for w in ['CONTRACT', 'CONTRACTUAL']):
            fields['employment_status'] = 'contract'
        elif 'SELF' in text_upper:
            fields['employment_status'] = 'self-employed'
        else:
            fields['employment_status'] = 'employed'

        # Letterhead and signature
        fields['on_letterhead'] = any(w in text_upper for w in ['LTD', 'PVT', 'LIMITED', 'INC', 'LLC', 'PLC'])
        fields['is_signed'] = any(w in text_upper for w in ['SIGNATURE', 'SIGNED', 'AUTHORIZED'])

    # Store all found dates for caller to interpret
    if dates_found:
        fields['dates_found'] = dates_found

    return fields


def extract_validity(fields: dict) -> dict:
    from datetime import date
    expiry_date = fields.get('expiry_date')
    is_expired = False

    if expiry_date:
        try:
            import re
            # Try to parse various date formats
            clean = re.sub(r'[<]', '', str(expiry_date)).strip()
            for fmt in ['%d %b %Y', '%Y-%m-%d', '%d/%m/%Y', '%d%m%y']:
                try:
                    parsed = datetime.strptime(clean.upper(), fmt.upper())
                    is_expired = parsed.date() < date.today()
                    expiry_date = parsed.strftime('%Y-%m-%d')
                    break
                except ValueError:
                    continue
        except Exception:
            pass

    return {"expiry_date": expiry_date, "is_expired": is_expired}


def ensure_structure(result: dict, doc_type: str) -> dict:
    """Guarantee the result always has the expected top-level keys."""
    return {
        "document_type":     result.get("document_type", doc_type),
        "extracted_fields":  result.get("extracted_fields", {}),
        "raw_text":          result.get("raw_text", ""),
        "document_validity": result.get("document_validity", {
            "expiry_date": None, "is_expired": False
        }),
        "confidence_score":  result.get("confidence_score", 0.75),
        "language":          result.get("language", "en"),
        "warnings":          result.get("warnings", []),
        "ocr_engine":        result.get("ocr_engine", "unknown")
    }


# ── Health check ───────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":  "ok",
        "engines": ["paddle", "ollama", "tesseract"],
        "cache_db": os.path.exists(DB_PATH)
    }


if __name__ == "__main__":
    import uvicorn
    print("Starting Visa AI Local OCR Service on http://localhost:8000")
    print("Documents processed here NEVER leave this machine.")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
```

### 3.3 OCR Engine Comparison — Choose Based on Your Hardware

| Engine | Accuracy | Speed/page | RAM needed | Setup effort | Best for |
|---|---|---|---|---|---|
| **PaddleOCR** (default) | 88–94% | 5–15s | 2GB | Medium | Most documents, multilingual |
| **Ollama + minicpm-v** | 90–96% | 20–40s | 8GB | Medium | Complex layouts, structured JSON |
| **Ollama + llava:13b** | 92–97% | 30–60s | 12GB | Medium | Best quality, needs good machine |
| **Tesseract** | 70–85% | 2–5s | 500MB | Low | Simple clean text, fallback only |

**For the demo — use PaddleOCR.** It gives excellent accuracy, installs in minutes,
and works on any laptop with 4GB+ RAM. No GPU required.

**For production privacy-first deployment — use Ollama + minicpm-v** on the customer's
server. It gives near-API quality with zero internet dependency.

### 3.4 First-Time Model Download

PaddleOCR downloads its models (~100MB) on the very first run, then works offline forever.

```bash
# Test the service works before demo day
curl -X POST http://localhost:8000/extract \
  -F "file=@test_passport.jpg" \
  -F "document_type=passport" \
  -F "method=paddle"

# Expected response:
# {
#   "source": "local_ocr",
#   "hash": "a3f8c2d1...",
#   "data": { "document_type": "passport", "extracted_fields": {...}, ... }
# }

# Second call with same file — should return "source": "cache" instantly
curl -X POST http://localhost:8000/extract \
  -F "file=@test_passport.jpg" \
  -F "document_type=passport"
```

---

## 4. Core AI Pipeline — No Shortcuts on Claude

> ⚠️ The gap analysis (Claude) pipeline must be identical to production quality.
> OCR runs locally. Everything else stays the same as v1.0.

### 4.1 OCR Cache — MD5 Hash Lookup (Next.js side)

The Next.js app checks Neon DB before calling the Python OCR service.
The Python service also has its own SQLite cache. This means:
- Neon cache hit → no call to Python service at all
- Neon miss + SQLite hit → Python service returns instantly from SQLite
- Both miss → Python service runs OCR and saves to both caches

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
    documentHash:    hash,
    documentType,
    extractedData:   extraction,
    ocrModel:        extraction.ocr_engine ?? 'local',
    confidenceScore: String(extraction.confidence_score),
    expiresAt:       new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  }).onConflictDoNothing();
}
```

### 4.2 PII Scrubber — Full Implementation (unchanged from v1.0)

```typescript
// lib/ai/scrubPII.ts
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
      has_passport_number: !!fields.passport_number || !!fields.document_number,
      nationality:         fields.nationality,
      issuing_country:     fields.issuing_country,
      age_band:            toAgeBand(fields.date_of_birth),
      has_photo:           !!fields.photo,
    };
    case 'bank_statement': return {
      has_account_number:             !!fields.account_number,
      months_of_history:              fields.months_of_history,
      financial_range:                toFinancialRange(fields.balance),
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
      is_signed:        fields.is_signed  ?? null,
      is_dated:         fields.is_dated   ?? null,
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

### 4.3 Claude Gap Analysis — With Prompt Caching (unchanged)

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
  const scrubbed  = scrubPII(rawExtractions);  // ← always runs, no exceptions

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6-20251101',
    max_tokens: 4000,
    system: [{
      type: 'text',
      text: `You are an expert visa officer with 20 years of experience.
Analyse the provided document summaries against the country checklist.
Return ONLY valid JSON, no extra text:
{
  "gap_analysis": [{ "item": string, "status": "present"|"missing"|"weak"|"expired",
    "severity": "critical"|"major"|"minor", "recommendation": string }],
  "overall_score": number (0-100),
  "score_breakdown": {
    "documents_completeness": number, "financial_strength": number,
    "travel_history": number, "ties_to_home_country": number, "application_quality": number
  },
  "verdict": "strong"|"moderate"|"weak"|"insufficient",
  "key_strengths": [string],
  "critical_gaps": [string],
  "recommended_actions": [string]
}

COUNTRY CHECKLIST:
${JSON.stringify(checklist, null, 2)}`,
      cache_control: { type: 'ephemeral' }  // ← saves 90% on input cost
    }],
    messages: [{
      role:    'user',
      content: `Analyse these document summaries (PII already removed locally):\n${JSON.stringify(scrubbed, null, 2)}`
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}
```

---

## 5. Database Schema — MVP (3 Tables, Unchanged)

```sql
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
  file_data      BYTEA,           -- file stored in DB for MVP simplicity
  ocr_engine     VARCHAR(50),     -- 'paddle' | 'ollama' | 'tesseract' | 'mistral'
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_extractions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_hash    VARCHAR(32) NOT NULL UNIQUE,
  document_type    VARCHAR(50) NOT NULL,
  extracted_data   JSONB NOT NULL,
  ocr_model        VARCHAR(100) DEFAULT 'local_paddle',
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
  scrubbed_input  JSONB,    -- store what was sent to Claude — for PII demo page
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_hash_mvp ON document_extractions(document_hash);
CREATE INDEX idx_review_docs  ON documents(review_id);
```

---

## 6. Results Page — What the Customer Must See (unchanged from v1.0)

- Animated probability score gauge (0–100, colour-coded)
- Score breakdown across 5 components (bar chart)
- Gap analysis table with status icons, severity, and recommendations
- Key strengths section (green)
- Critical gaps section (red)
- Numbered recommended actions
- PDF download button

---

## 7. PII Explainer Page — Now Even More Powerful

With local OCR, the PII story is stronger than ever. Update the explainer copy:

```
Left column header:  "What local OCR extracted (stored on YOUR machine only)"
Right column header: "What Claude received (anonymised summary sent over internet)"

Statement between columns:
"OCR runs on your machine — no document ever sent over the internet.
Only this anonymised summary reaches Claude's servers.
Passport numbers, balances, and full names never leave your infrastructure."
```

---

## 8. Async Review — Simple Polling (unchanged)

```typescript
// POST /api/reviews/[id]/start
export async function POST(req: Request, { params }: { params: { id: string } }) {
  await db.update(reviews)
    .set({ status: 'processing' })
    .where(eq(reviews.id, params.id));

  processReviewInBackground(params.id);  // fire-and-forget

  return Response.json({ status: 'processing' });
}

async function processReviewInBackground(reviewId: string) {
  try {
    const docs   = await getReviewDocuments(reviewId);
    const review = await getReview(reviewId);
    const extractions: RawExtraction[] = [];

    for (const doc of docs) {
      const buffer = doc.fileData;
      const hash   = hashFile(buffer);

      // Check Neon cache first
      let extraction = await getCachedExtraction(hash);

      if (!extraction) {
        // Call local Python OCR service (or Mistral if OCR_MODE=mistral)
        extraction = await extractDocument(buffer, doc.mimeType, doc.documentType);
        await cacheExtraction(hash, doc.documentType, extraction);
      }
      extractions.push(extraction);
    }

    // scrubPII happens inside analyseApplication — always
    const result = await analyseApplication(review.checklistId, extractions);

    await db.insert(reviewResults).values({
      reviewId,
      gapAnalysis:    result.gap_analysis,
      overallScore:   result.overall_score,
      scoreBreakdown: result.score_breakdown,
      verdict:        result.verdict,
      scrubbedInput:  scrubPII(extractions)  // save for PII explainer page
    });

    await db.update(reviews)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(reviews.id, reviewId));

  } catch (err) {
    console.error('Review failed:', err);
    await db.update(reviews)
      .set({ status: 'failed' })
      .where(eq(reviews.id, reviewId));
  }
}

// GET /api/reviews/[id]/status — client polls every 3 seconds
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const review = await db.select().from(reviews)
    .where(eq(reviews.id, params.id)).limit(1);
  return Response.json({ status: review[0]?.status ?? 'unknown' });
}
```

---

## 9. Environment Variables — MVP

```bash
# Database (Neon free tier)
DATABASE_URL=postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require

# AI Analysis (required — Claude always used for gap analysis)
ANTHROPIC_API_KEY=

# OCR Mode — 'local' (default) or 'mistral'
OCR_MODE=local

# Local OCR Service URL (only needed when OCR_MODE=local)
LOCAL_OCR_URL=http://localhost:8000

# Local OCR Engine — 'paddle' (default), 'ollama', or 'tesseract'
LOCAL_OCR_ENGINE=paddle

# Ollama model (only if LOCAL_OCR_ENGINE=ollama)
# OLLAMA_MODEL=minicpm-v

# Mistral (only needed when OCR_MODE=mistral)
# MISTRAL_API_KEY=

# App
NEXT_PUBLIC_URL=http://localhost:3000
DEMO_MODE=true
```

> Minimum to run locally: `DATABASE_URL` + `ANTHROPIC_API_KEY`.
> That's it. Python service runs separately. No Mistral key needed.

---

## 10. Project Structure — MVP

```
visa-ai-mvp/
├── app/
│   ├── page.tsx                        ← Landing with "Try Demo" CTA
│   ├── demo/page.tsx                   ← Step 1: Select visa type
│   ├── upload/page.tsx                 ← Step 2: Upload documents
│   ├── processing/[id]/page.tsx        ← Step 3: Live progress
│   ├── results/[id]/page.tsx           ← Step 4: Full report
│   ├── pii-explainer/[id]/page.tsx     ← PII demo page (real scrubbed data)
│   └── api/
│       ├── reviews/
│       │   ├── route.ts                ← POST: create review
│       │   └── [id]/
│       │       ├── documents/route.ts  ← POST: upload doc
│       │       ├── start/route.ts      ← POST: trigger review
│       │       ├── status/route.ts     ← GET: poll status
│       │       ├── result/route.ts     ← GET: full result
│       │       └── report.pdf/route.ts ← GET: PDF
├── components/
│   ├── ui/                             ← shadcn/ui
│   ├── ScoreGauge.tsx
│   ├── GapAnalysisTable.tsx
│   ├── ProcessingSteps.tsx             ← Shows "OCR running locally..."
│   ├── ProbabilityBreakdown.tsx
│   └── PIIComparison.tsx
├── lib/
│   ├── db/
│   │   ├── index.ts                    ← Neon + Drizzle
│   │   └── schema.ts
│   ├── ai/
│   │   ├── ocr.ts                      ← Mode-aware: local | mistral
│   │   ├── claude.ts                   ← Gap analysis (unchanged)
│   │   ├── scrubPII.ts                 ← PII removal (unchanged)
│   │   └── ocrCache.ts                 ← Neon cache lookup
│   └── checklists/
│       ├── index.ts
│       ├── UK-SVV-01.json
│       └── SCH-CSS-01.json
├── ocr-service/                        ← Python FastAPI service
│   ├── main.py                         ← Full service (Section 3.2)
│   ├── requirements.txt
│   ├── venv/                           ← Python virtual environment
│   └── ocr_cache.db                    ← Local SQLite cache (auto-created)
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
in PostgreSQL BYTEA. OCR runs locally via a Python FastAPI sidecar service using
PaddleOCR — documents never leave the machine. Claude Sonnet 4.6 for gap analysis.
Full PII scrubbing before any Claude call. 2 visa checklists: UK Standard Visitor
and Schengen Short Stay. Deploy Next.js on Vercel free tier. Python service runs
locally. Build a 4-step demo wizard: Select visa → Upload docs → Processing → Results.
Follow requirements_mvp.md exactly. Build fast — this is a customer demo.
```

### 11.2 Build Order — 7 Days

```
Day 1 AM:  Python OCR service setup (ocr-service/main.py)
           Install PaddleOCR, test with a sample document
           Verify http://localhost:8000/health returns ok

Day 1 PM:  Next.js project + Neon DB + Drizzle schema
           lib/ai/ocr.ts (mode-aware wrapper)
           lib/ai/ocrCache.ts (MD5 + Neon cache)

Day 2:     scrubPII() + Claude gap analysis + prompt caching
           End-to-end pipeline test: upload → local OCR → scrub → Claude → result

Day 3:     4-step demo wizard UI (all 4 pages)
           ProcessingSteps.tsx with live polling

Day 4:     Results page (ScoreGauge + GapAnalysisTable + ProbabilityBreakdown)

Day 5:     PII explainer page (PIIComparison.tsx with real scrubbed data)
           PDF download (@react-pdf/renderer)

Day 6:     Polish, error handling, demo script rehearsal
           Test with all 3 demo documents at least 5 times

Day 7:     Deploy Next.js to Vercel
           Prepare local machine for in-person demo
           Run full demo script 3 times — ensure OCR cache kicks in on repeat runs
```

### 11.3 MVP Non-Negotiable Rules

1. **Local OCR by default** — `OCR_MODE=local` in `.env.local`. Python service must be running before Next.js.
2. **AI pipeline is real** — No mocks. PaddleOCR and Claude must do real work on real documents.
3. **PII scrubbing is real** — `scrubPII()` runs before every Claude call. Store scrubbed output for PII demo page.
4. **OCR cache is real** — Check Neon DB cache before calling Python service. Check SQLite cache inside Python before running OCR. Show "cache hit" vs "cache miss" in processing steps.
5. **Prompt caching enabled** — `cache_control: { type: 'ephemeral' }` on Claude system prompt.
6. **Processing steps show OCR location** — Display "Extracting locally — document stays on this machine" not just "Extracting...".
7. **Score must look impressive** — Animated, colour-coded, prominent. This is what the customer photographs.
8. **No broken states** — If Python service is down, show clear error: "Local OCR service not running. Start with: python ocr-service/main.py". Never show a stack trace.

### 11.4 Demo Script (For the Sales Meeting)

```
BEFORE the meeting:
  - Start Python service: python ocr-service/main.py
  - Start Next.js: npm run dev
  - Run the full demo once so OCR cache is warm

IN the meeting:
  1. Open http://localhost:3000 (or Vercel URL)
  2. Click "Try Demo"
  3. Select "UK Standard Visitor Visa" + nationality "Pakistani"
  4. Upload 3 pre-prepared test files (see Section 11.5)
  5. Click "Run AI Review"
  6. Point out: "OCR is running on this machine — nothing leaves the room"
  7. Watch processing steps tick off live
  8. Show results: score ~65–70, bank statement flagged as weak
  9. Click "How is your data protected?" → PII explainer
  10. Show "what local OCR extracted" vs "what Claude received"
  11. Download PDF report
  12. Run again with same files — OCR cache kicks in, result is instant
  13. Say: "Second time is instant because we've already read these documents"
  14. Say: "This is what every applicant gets in under 3 minutes —
            and their documents never leave your server"
```

### 11.5 Test Documents for Demo

| File | Content | Purpose |
|---|---|---|
| `passport_scan.jpg` | Fictional passport (clear, high-res scan) | Tests PaddleOCR vision |
| `bank_statement.pdf` | 3-month statement, balance ~₹8,00,000 | Intentionally weak — triggers gap |
| `employment_letter.pdf` | Letter on letterhead, signed | Passes cleanly |

> **Tip:** After first run, OCR results are cached. Demo the caching explicitly —
> run again with the same files and say "instant this time — it recognised the
> documents." This makes the technical architecture feel tangible.

---

## 12. Cost for the MVP Build

| Item | Cost |
|---|---|
| Vercel Hobby | Free |
| Neon PostgreSQL (free tier) | Free |
| PaddleOCR (local) | ₹0 — completely free |
| Anthropic API (~20 demo reviews) | ~₹143 (~$1.50) |
| Mistral API | ₹0 — not used in local mode |
| **Total to build and demo** | **~₹143** |

> Local OCR cuts the demo cost from ~₹152 to ~₹143. The real saving is in
> production — if the customer runs 1,000 applications/month on local OCR,
> that's ~₹5,000–7,000/month saved vs Mistral API.

---

## What Comes After MVP — Path to Production

Once the customer approves the demo, the production build (`requirements.md v1.1`)
adds the following. The local OCR service becomes a **production deployment decision**:

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
| **Production OCR decision:** | |
| → Option A: Deploy Python OCR on customer's server (max privacy) | 3 days |
| → Option B: Switch to Mistral API with signed DPA (simpler ops) | 1 day |
| Load testing + launch | 1 week |

**Total path to production: ~6–7 weeks after demo approval.**

---

*End of MVP Requirements | Visa AI Review System | v1.1 | May 2026*
*This is a demo build — not for production use with real applicant data.*
