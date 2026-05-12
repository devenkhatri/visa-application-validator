// lib/ai/openrouter.ts — Shared OpenAI-compatible client for OpenRouter
import OpenAI from 'openai';

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey:  process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000',
    'X-Title':      'Visa AI Review - MVP Demo',
  },
});

// Model constants — override via env without touching code
export const OCR_MODEL      = process.env.MODEL_OCR      ?? 'google/gemini-2.0-flash-exp:free';
export const ANALYSIS_MODEL = process.env.MODEL_ANALYSIS ?? 'deepseek/deepseek-r1:free';
