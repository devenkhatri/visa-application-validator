// lib/ai/analysis.ts — Gap analysis via OpenRouter (Claude replacement)
import { openrouter, ANALYSIS_MODEL } from './openrouter';
import { getChecklist } from '@/lib/checklists';
import { scrubPII } from './scrubPII';
import type { RawExtraction, AnalysisResult } from './types';

export async function analyseApplication(
  checklistId: string,
  rawExtractions: RawExtraction[],
): Promise<AnalysisResult> {

  const checklist = getChecklist(checklistId);
  const scrubbed  = scrubPII(rawExtractions); // ← PII scrubbed here, always

  const response = await openrouter.chat.completions.create({
    model:           ANALYSIS_MODEL,
    messages: [
      {
        role:    'system',
        content: `You are an expert visa officer with 20 years of experience.
Analyse the provided document summaries against the country checklist.
Return ONLY valid JSON with exactly this structure, no extra text or markdown:
{
  "gap_analysis": [
    {
      "item": "document name from checklist",
      "status": "present | missing | weak | expired",
      "severity": "critical | major | minor",
      "recommendation": "specific action for the applicant"
    }
  ],
  "overall_score": 72,
  "score_breakdown": {
    "documents_completeness": 85,
    "financial_strength": 70,
    "travel_history": 60,
    "ties_to_home_country": 75,
    "application_quality": 80
  },
  "verdict": "strong | moderate | weak | insufficient",
  "key_strengths": ["list of positive observations"],
  "critical_gaps": ["list of critical issues"],
  "recommended_actions": ["numbered list of specific actions"]
}

COUNTRY CHECKLIST:
${JSON.stringify(checklist, null, 2)}`,
      },
      {
        role:    'user',
        content: `Analyse these document summaries (PII already removed — do not ask for raw data):
${JSON.stringify(scrubbed, null, 2)}`,
      },
    ],
  });

  const text = response.choices[0].message.content ?? '{}';

  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim()) as AnalysisResult;
  } catch {
    // Return a structured fallback so the UI never crashes
    return {
      gap_analysis: [],
      overall_score: 0,
      score_breakdown: {
        documents_completeness: 0,
        financial_strength:     0,
        travel_history:         0,
        ties_to_home_country:   0,
        application_quality:    0,
      },
      verdict:             'insufficient',
      key_strengths:       [],
      critical_gaps:       ['Analysis failed — please retry'],
      recommended_actions: ['Please retry the review'],
    };
  }
}
