// lib/ai/analysis.ts — Gap analysis via OpenRouter (Claude replacement)
import { openrouter, ANALYSIS_MODEL } from './openrouter';
import { getChecklist } from '@/lib/checklists';
import { scrubPII } from './scrubPII';
import type { RawExtraction, ScrubbedExtraction, AnalysisResult, PersonalisedChecklist } from './types';

export async function analyseApplication(
  checklistId: string,
  rawExtractions: RawExtraction[],
  preScrubbed?: ScrubbedExtraction[],
  personalisedChecklist?: PersonalisedChecklist,
): Promise<AnalysisResult> {

  const scrubbed = preScrubbed ?? scrubPII(rawExtractions);

  // Use personalised checklist if provided, otherwise fall back to base checklist
  const checklistContent = personalisedChecklist
    ? {
        type: 'personalised',
        items: personalisedChecklist.checklist_items,
        profile_flags:        personalisedChecklist.profile_flags,
        high_risk_factors:    personalisedChecklist.high_risk_factors,
        strengths:            personalisedChecklist.strengths,
        special_instructions: personalisedChecklist.special_instructions,
      }
    : { type: 'standard', ...getChecklist(checklistId) };

  const response = await openrouter.chat.completions.create({
    model:    ANALYSIS_MODEL,
    messages: [
      {
        role:    'system',
        content: `You are an expert visa officer with 20 years of experience.
Analyse the provided document summaries against the ${checklistContent.type === 'personalised' ? 'PERSONALISED' : 'country'} checklist.
Return ONLY valid JSON with exactly this structure, no extra text or markdown:
{
  "gap_analysis": [
    {
      "item": "document name from checklist",
      "status": "present | missing | weak | expired",
      "severity": "critical | major | minor",
      "current_gap": "clear description of the specific gap observed before recommendation",
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

CRITICAL RULES ON EXPIRATION:
Examine the 'document_validity' object closely. If 'is_expired' is false or if 'days_until_expiry' is a positive number (meaning the date is in the future), the document is completely VALID and ACTIVE. Do NOT mark the status as "expired" under any circumstances if the expiration date is in the future.

${checklistContent.type === 'personalised' ? 'PERSONALISED' : 'COUNTRY'} CHECKLIST:
${JSON.stringify(checklistContent, null, 2)}`,
      },
      {
        role:    'user',
        content: `Analyse these document summaries (PII already removed — do not ask for raw data):\n${JSON.stringify(scrubbed, null, 2)}`,
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
