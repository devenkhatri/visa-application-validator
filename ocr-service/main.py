# ocr-service/main.py — Visa AI Local OCR Service
# Run: python ocr-service/main.py
# Listens on http://localhost:8000
#
# Engines available:
#   paddle    — PaddleOCR (default, best balance of accuracy + speed)
#   tesseract — Tesseract (lighter, no model download, less accurate)
#   ollama    — Ollama multimodal LLM (minicpm-v / llava — highest accuracy, needs GPU/16GB RAM)

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
    allow_headers=["*"],
)

# ── Lazy-load heavy models (only when first used) ──────────────────────────────
_paddle_ocr = None

def get_paddle():
    global _paddle_ocr
    if _paddle_ocr is None:
        from paddleocr import PaddleOCR
        print("Loading PaddleOCR model (first run may take 30-60s — models downloaded once)...")
        _paddle_ocr = PaddleOCR(
            use_angle_cls=True,
            lang='en',      # change to 'arabic' / 'hindi' / 'ch' as needed
            use_gpu=False,  # set True if you have NVIDIA GPU
            show_log=False,
        )
        print("PaddleOCR ready.")
    return _paddle_ocr

# ── SQLite cache (local, no cloud needed) ─────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "ocr_cache.db")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ocr_cache (
            hash          TEXT PRIMARY KEY,
            document_type TEXT NOT NULL,
            extracted_data TEXT NOT NULL,
            ocr_engine    TEXT,
            created_at    TEXT,
            expires_at    TEXT
        )
    """)
    conn.commit()
    conn.close()

init_db()

def get_cached(file_hash: str) -> dict | None:
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT extracted_data FROM ocr_cache WHERE hash = ? AND expires_at > ?",
        (file_hash, datetime.now().isoformat()),
    ).fetchone()
    conn.close()
    return json.loads(row[0]) if row else None

def save_cache(file_hash: str, doc_type: str, data: dict, engine: str):
    conn = sqlite3.connect(DB_PATH)
    expires = (datetime.now() + timedelta(days=90)).isoformat()
    conn.execute(
        "INSERT OR REPLACE INTO ocr_cache VALUES (?, ?, ?, ?, ?, ?)",
        (file_hash, doc_type, json.dumps(data), engine, datetime.now().isoformat(), expires),
    )
    conn.commit()
    conn.close()

# ── Main extract endpoint ──────────────────────────────────────────────────────
@app.post("/extract")
async def extract_document(
    file: UploadFile = File(...),
    document_type: str = Form(default="document"),
    method: str = Form(default="paddle"),   # 'paddle' | 'ollama' | 'tesseract'
):
    file_bytes = await file.read()
    mime_type  = file.content_type or "application/octet-stream"

    # 1. MD5 fingerprint
    file_hash = hashlib.md5(file_bytes).hexdigest()

    # 2. Check local SQLite cache first
    cached = get_cached(file_hash)
    if cached:
        print(f"[OCR Cache] HIT {file_hash[:8]}... ({document_type})")
        return {"source": "cache", "hash": file_hash, "data": cached}

    print(f"[OCR Cache] MISS {file_hash[:8]}... — running {method} OCR on {document_type}")

    # 3. Run selected OCR engine
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

    # 4. Guarantee standard structure
    structured = ensure_structure(result, document_type)

    # 5. Save to SQLite cache
    save_cache(file_hash, document_type, structured, method)

    return {"source": "local_ocr", "hash": file_hash, "data": structured}


# ── PaddleOCR engine ───────────────────────────────────────────────────────────
def run_paddle(file_bytes: bytes, mime_type: str, doc_type: str) -> dict:
    import numpy as np
    from PIL import Image
    from pdf2image import convert_from_bytes

    if "pdf" in mime_type:
        pages = convert_from_bytes(file_bytes, dpi=300)
    else:
        pages = [Image.open(BytesIO(file_bytes))]

    try:
        ocr = get_paddle()
        full_text       = ""
        total_confidence = 0.0
        count            = 0

        for page in pages:
            img_array = np.array(page)
            result    = ocr.ocr(img_array, cls=True)
            if result and result[0]:
                for line in result[0]:
                    text, confidence = line[1]
                    full_text       += text + "\n"
                    total_confidence += float(confidence)
                    count            += 1

        avg_confidence   = total_confidence / count if count > 0 else 0.0
        extracted_fields = parse_fields_from_text(full_text, doc_type)

        return {
            "document_type":     doc_type,
            "extracted_fields":  extracted_fields,
            "raw_text":          full_text,
            "document_validity": extract_validity(extracted_fields),
            "confidence_score":  round(avg_confidence, 3),
            "language":          "en",
            "warnings":          [],
            "ocr_engine":        "paddleocr",
        }
    except ImportError:
        print("[OCR Fallback] paddleocr module not found. Automatically falling back to Tesseract offline engine.")
        return run_tesseract(file_bytes, mime_type, doc_type)


# ── Ollama (LLaVA / minicpm-v) engine ─────────────────────────────────────────
async def run_ollama(file_bytes: bytes, mime_type: str, doc_type: str) -> dict:
    import ollama
    from PIL import Image
    from pdf2image import convert_from_bytes

    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "minicpm-v")  # or 'llava', 'llava:13b'

    if "pdf" in mime_type:
        pages      = convert_from_bytes(file_bytes, dpi=300)
        first_page = pages[0]
    else:
        first_page = Image.open(BytesIO(file_bytes))

    buf = BytesIO()
    first_page.save(buf, format="PNG")
    b64_image = base64.b64encode(buf.getvalue()).decode()

    prompt = f"""You are a document extraction specialist. Extract ALL relevant information from this {doc_type}.
Return ONLY valid JSON, no extra text:
{{
  "document_type": "{doc_type}",
  "extracted_fields": {{
    "full_name": "string or null",
    "document_number": "string or null",
    "passport_number": "string or null",
    "date_of_birth": "YYYY-MM-DD or null",
    "nationality": "string or null",
    "expiry_date": "YYYY-MM-DD or null",
    "issuing_country": "string or null",
    "account_number": "string or null",
    "balance": "number or null",
    "currency": "string or null",
    "months_of_history": "number or null",
    "employer": "string or null",
    "salary": "number or null",
    "employment_status": "string or null",
    "on_letterhead": "boolean or null",
    "is_signed": "boolean or null"
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
            "role":    "user",
            "content": prompt,
            "images":  [b64_image],
        }],
    )

    raw = response["message"]["content"]
    raw = raw.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "document_type":     doc_type,
            "extracted_fields":  {},
            "raw_text":          raw,
            "document_validity": {"expiry_date": None, "is_expired": False},
            "confidence_score":  0.6,
            "language":          "en",
            "warnings":          ["JSON parse failed — raw text returned"],
            "ocr_engine":        OLLAMA_MODEL,
        }


# ── Tesseract engine (lightweight, no model download needed) ───────────────────
def run_tesseract(file_bytes: bytes, mime_type: str, doc_type: str) -> dict:
    try:
        import pytesseract
        from PIL import Image
        from pdf2image import convert_from_bytes

        if "pdf" in mime_type:
            pages = convert_from_bytes(file_bytes, dpi=300)
        else:
            pages = [Image.open(BytesIO(file_bytes))]

        full_text = ""
        for page in pages:
            full_text += pytesseract.image_to_string(page, lang="eng")

        extracted_fields = parse_fields_from_text(full_text, doc_type)
        return {
            "document_type":     doc_type,
            "extracted_fields":  extracted_fields,
            "raw_text":          full_text,
            "document_validity": extract_validity(extracted_fields),
            "confidence_score":  0.75,
            "language":          "en",
            "warnings":          [],
            "ocr_engine":        "tesseract",
        }
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="pytesseract not installed. Run: pip install pytesseract",
        )


# ── Field parsing from raw OCR text ───────────────────────────────────────────
def parse_fields_from_text(text: str, doc_type: str) -> dict:
    """
    Regex-based structured field extraction from raw OCR text.
    Used by PaddleOCR and Tesseract which return raw text (not JSON).
    Ollama returns JSON directly and skips this function.
    """
    import re

    fields     = {}
    text_upper = text.upper()

    if doc_type == "passport":
        # Passport number: starts with letter(s) followed by 7-8 digits
        passport_match = re.search(r"\b([A-Z]{1,2}\d{7,8})\b", text_upper)
        if passport_match:
            fields["passport_number"] = passport_match.group(1)

        # Expiry date — labelled variant
        expiry_match = re.search(
            r"(?:EXPIRY|EXPIRATION|DATE OF EXPIRY|VALID UNTIL)[:\s]+([0-9A-Z /\-]+)", text_upper
        )
        if expiry_match:
            fields["expiry_date"] = expiry_match.group(1).strip()

        # MRZ line — 2 lines of 44 chars each (ICAO 9303)
        mrz_match = re.search(r"([A-Z0-9<]{9,})\n([A-Z0-9<]{9,})", text_upper)
        if mrz_match:
            fields["mrz_detected"] = True
            # Parse expiry from MRZ line 2, chars 7-12 (YYMMDD)
            mrz_line2 = mrz_match.group(2)
            if len(mrz_line2) >= 14:
                raw_exp = mrz_line2[6:12]
                try:
                    yr  = int(raw_exp[0:2])
                    mo  = int(raw_exp[2:4])
                    dy  = int(raw_exp[4:6])
                    yr  = 2000 + yr if yr < 60 else 1900 + yr
                    fields["expiry_date"] = f"{yr:04d}-{mo:02d}-{dy:02d}"
                    # Parse DOB from chars 1-6
                    raw_dob = mrz_line2[0:6]
                    yr_dob  = int(raw_dob[0:2])
                    mo_dob  = int(raw_dob[2:4])
                    dy_dob  = int(raw_dob[4:6])
                    yr_dob  = 2000 + yr_dob if yr_dob < 30 else 1900 + yr_dob
                    fields["date_of_birth"] = f"{yr_dob:04d}-{mo_dob:02d}-{dy_dob:02d}"
                except (ValueError, IndexError):
                    pass

        # Nationality
        nat_match = re.search(r"(?:NATIONALITY|NATIONALIT)[:\s]+([A-Z]+)", text_upper)
        if nat_match:
            fields["nationality"] = nat_match.group(1).strip()

        # Name — often between SURNAME and GIVEN NAME labels
        name_match = re.search(r"(?:GIVEN NAME|FORENAME)[:\s]+([A-Z ]+)", text_upper)
        if name_match:
            fields["given_name"] = name_match.group(1).strip()
        surname_match = re.search(r"(?:SURNAME|LAST NAME)[:\s]+([A-Z ]+)", text_upper)
        if surname_match:
            fields["surname"] = surname_match.group(1).strip()

    elif doc_type == "bank_statement":
        balance_match = re.search(
            r"(?:BALANCE|CLOSING BAL|AVAILABLE|TOTAL)[:\s₹£$€]+([0-9,]+\.?\d*)", text_upper
        )
        if balance_match:
            fields["balance"] = float(balance_match.group(1).replace(",", ""))

        if "£" in text or "GBP" in text_upper:
            fields["currency"] = "GBP"
        elif "$" in text or "USD" in text_upper:
            fields["currency"] = "USD"
        elif "₹" in text or "INR" in text_upper:
            fields["currency"] = "INR"
        elif "€" in text or "EUR" in text_upper:
            fields["currency"] = "EUR"

        months = [
            "JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE",
            "JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER",
        ]
        months_found = sum(1 for m in months if m in text_upper)
        if months_found > 0:
            fields["months_of_history"] = months_found

    elif doc_type == "employment_letter":
        salary_match = re.search(
            r"(?:SALARY|CTC|REMUNERATION|PACKAGE)[:\s₹£$€]+([0-9,]+)", text_upper
        )
        if salary_match:
            fields["salary"] = float(salary_match.group(1).replace(",", ""))

        if any(w in text_upper for w in ["PERMANENT", "FULL-TIME", "FULL TIME"]):
            fields["employment_status"] = "permanent"
        elif any(w in text_upper for w in ["CONTRACT", "CONTRACTUAL"]):
            fields["employment_status"] = "contract"
        elif "SELF" in text_upper:
            fields["employment_status"] = "self-employed"
        else:
            fields["employment_status"] = "employed"

        fields["on_letterhead"] = any(
            w in text_upper for w in ["LTD", "PVT", "LIMITED", "INC", "LLC", "PLC"]
        )
        fields["is_signed"] = any(
            w in text_upper for w in ["SIGNATURE", "SIGNED", "AUTHORIZED", "AUTHORISED"]
        )

    return fields


def extract_validity(fields: dict) -> dict:
    from datetime import date
    expiry_date = fields.get("expiry_date")
    is_expired  = False

    if expiry_date:
        try:
            import re
            clean = re.sub(r"[<]", "", str(expiry_date)).strip()
            for fmt in ["%d %b %Y", "%Y-%m-%d", "%d/%m/%Y", "%d%m%y", "%d-%m-%Y"]:
                try:
                    parsed    = datetime.strptime(clean.upper(), fmt.upper())
                    is_expired  = parsed.date() < date.today()
                    expiry_date = parsed.strftime("%Y-%m-%d")
                    break
                except ValueError:
                    continue
        except Exception:
            pass

    return {"expiry_date": expiry_date, "is_expired": is_expired}


def ensure_structure(result: dict, doc_type: str) -> dict:
    """Guarantee the result always has all expected top-level keys."""
    return {
        "document_type":     result.get("document_type", doc_type),
        "extracted_fields":  result.get("extracted_fields", {}),
        "raw_text":          result.get("raw_text", ""),
        "document_validity": result.get("document_validity", {
            "expiry_date": None, "is_expired": False,
        }),
        "confidence_score":  result.get("confidence_score", 0.75),
        "language":          result.get("language", "en"),
        "warnings":          result.get("warnings", []),
        "ocr_engine":        result.get("ocr_engine", "unknown"),
    }


# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":   "ok",
        "engines":  ["paddle", "ollama", "tesseract"],
        "cache_db": os.path.exists(DB_PATH),
        "cache_path": DB_PATH,
    }


if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("  Visa AI — Local OCR Service")
    print("  http://localhost:8000")
    print("  Documents processed here NEVER leave this machine.")
    print("=" * 60)
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
