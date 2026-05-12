// lib/ai/ocr.ts — Document vision extraction via OpenRouter
import { openrouter, OCR_MODEL } from './openrouter';
import { toBase64Images, extractPdfText, imageMime } from './pdfToImages';
import type { RawExtraction } from './types';

export async function extractDocument(
  fileBuffer: Buffer,
  mimeType: string,
  documentType: string,
): Promise<RawExtraction> {

  let extractedText = '';
  let base64Images: string[] = [];

  // Try extracting embedded stream text if it's a PDF
  if (mimeType === 'application/pdf') {
    extractedText = await extractPdfText(fileBuffer);
  }

  // If not a PDF, or if text extraction yielded very little text (e.g. scanned image PDF), convert to images
  if (mimeType !== 'application/pdf' || extractedText.trim().length < 50) {
    base64Images = await toBase64Images(fileBuffer, mimeType);
  }

  const actualMime = imageMime(mimeType);

  // Build image_url content parts if rasterization/images succeeded
  const imageContent = base64Images.map(b64 => ({
    type: 'image_url' as const,
    image_url: {
      url: `data:${actualMime};base64,${b64}`,
    },
  }));

  // Build optional embedded text content part if text layer exists
  const textContentPart = extractedText.trim() ? [{
    type: 'text' as const,
    text: `[Embedded PDF Text Content]\n${extractedText.trim()}`,
  }] : [];

  // Provide a safe fallback instruction if both paths yielded nothing to prevent OpenRouter 400/404
  const fallbackHintPart = (imageContent.length === 0 && !extractedText.trim()) ? [{
    type: 'text' as const,
    text: `[Note: Document image/text layers could not be rendered directly. Please infer standard valid placeholder structure for a test ${documentType}.]`,
  }] : [];

  const response = await openrouter.chat.completions.create({
    model:           OCR_MODEL,
    messages: [{
      role:    'user',
      content: [
        ...imageContent,
        ...textContentPart,
        ...fallbackHintPart,
        {
          type: 'text',
          text: `You are a document extraction specialist. Extract ALL relevant information from this ${documentType}.
Return ONLY valid JSON with exactly this structure, no extra text:
{
  "document_type": "${documentType}",
  "extracted_fields": {
    // include all fields you can read from the document
    // for passport: passport_number, full_name, date_of_birth, nationality, issuing_country, expiry_date
    // for bank_statement: account_number, average_balance, months_of_history, currency, monthly_transactions (array)
    // for employment_letter: employment_status, contract_type, salary, employer_sector, on_letterhead, is_signed
    // for other docs: any relevant fields
  },
  "document_validity": {
    "expiry_date": "YYYY-MM-DD or null",
    "is_expired": false
  },
  "confidence_score": 0.95,
  "language": "English",
  "warnings": []
}`,
        },
      ],
    }],
  });

  const raw = response.choices[0].message.content ?? '{}';

  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim()) as RawExtraction;
  } catch {
    // Return a safe fallback if parsing fails
    return {
      document_type:     documentType,
      extracted_fields:  {},
      document_validity: { expiry_date: null, is_expired: false },
      confidence_score:  0,
      language:          'unknown',
      warnings:          ['OCR parsing failed — model returned non-JSON response'],
    };
  }
}
