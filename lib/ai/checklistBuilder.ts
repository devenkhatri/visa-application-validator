// lib/ai/checklistBuilder.ts
// Calls OpenRouter to generate a personalised document checklist from 6 questionnaire answers.
import { openrouter, ANALYSIS_MODEL } from './openrouter';
import { getChecklist } from '@/lib/checklists';
import type { QuestionnaireAnswers, PersonalisedChecklist } from './types';

const EMPLOYMENT_LABELS: Record<string, string> = {
  salaried:      'a salaried employee',
  self_employed: 'self-employed',
  student:       'a student',
  retired:       'retired',
  other:         'not formally employed',
};

const PURPOSE_LABELS: Record<string, string> = {
  tourism:  'tourism',
  business: 'a business trip',
  family:   'visiting family',
  medical:  'medical treatment',
  study:    'study',
};

const TRAVEL_LABELS: Record<string, string> = {
  approved: 'previously visited and been approved',
  refused:  'previously applied and been refused',
  never:    'never visited the destination country before',
};

const INTL_TRAVEL_LABELS: Record<string, string> = {
  frequent:   'a frequent international traveller',
  occasional: 'an occasional international traveller',
  none:       'a first-time international traveller',
};

const BALANCE_LABELS: Record<string, string> = {
  below_50k: 'below ₹50,000 monthly',
  '50k_2l':  '₹50,000–₹2,00,000 monthly',
  '2l_10l':  '₹2,00,000–₹10,00,000 monthly',
  above_10l: 'above ₹10,00,000 monthly',
};

export async function buildPersonalisedChecklist(
  baseChecklistId: string,
  answers: QuestionnaireAnswers,
): Promise<PersonalisedChecklist> {
  const baseChecklist = getChecklist(baseChecklistId);

  const profile = [
    `Employment: ${EMPLOYMENT_LABELS[answers.employment_status] ?? answers.employment_status}`,
    `Purpose: Travelling for ${PURPOSE_LABELS[answers.purpose_of_visit] ?? answers.purpose_of_visit}`,
    `Prior travel to destination: Has ${TRAVEL_LABELS[answers.prior_travel_destination] ?? answers.prior_travel_destination}`,
    `International travel history: ${INTL_TRAVEL_LABELS[answers.prior_international_travel] ?? answers.prior_international_travel}`,
    `Property ownership in home country: ${answers.property_ownership === 'yes' ? 'Yes — owns property' : 'No — does not own property'}`,
    `Bank balance range: ${BALANCE_LABELS[answers.monthly_balance_range] ?? answers.monthly_balance_range}`,
  ].join('\n');

  const systemPrompt = `You are an expert visa officer with 20+ years of experience reviewing applications.
Your job is to generate a PERSONALISED document checklist for a specific applicant profile.

Return ONLY valid JSON with exactly this structure, no markdown or extra text:
{
  "checklist_items": [
    {
      "document": "Document name (be specific, e.g. '3-year ITR + CA Certificate')",
      "priority": "required | recommended | optional",
      "reason": "One sentence personalised to this applicant's profile explaining why this document matters",
      "score_impact": 8
    }
  ],
  "profile_flags": ["List of 2-4 flags that describe this applicant's risk/strength profile"],
  "high_risk_factors": ["Any factors that could weaken the application — empty array if none"],
  "strengths": ["Any factors that strengthen the application — empty array if none"],
  "special_instructions": "One paragraph of personalised advice for this applicant type"
}

Rules:
- Generate 6-10 checklist items appropriate for this applicant profile
- Mark items as 'required' if missing them would likely cause refusal
- Mark items as 'recommended' if they significantly strengthen the application
- Mark items as 'optional' if they are helpful but not critical
- score_impact should be a number 1-15 reflecting how much that document affects the score
- The 'reason' must be personalised — reference their specific situation (e.g. "As a self-employed applicant...")
- Do NOT include items that are irrelevant to this applicant's profile`;

  const userMessage = `APPLICANT PROFILE:
${profile}

BASE VISA CHECKLIST (${baseChecklistId}):
${JSON.stringify(baseChecklist, null, 2)}

Generate a personalised checklist for this applicant.`;

  const response = await openrouter.chat.completions.create({
    model:   ANALYSIS_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage },
    ],
  });

  const text = response.choices[0].message.content ?? '{}';

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) as PersonalisedChecklist;

    // Validate and provide defaults
    return {
      checklist_items:      Array.isArray(parsed.checklist_items) ? parsed.checklist_items : [],
      profile_flags:        Array.isArray(parsed.profile_flags)   ? parsed.profile_flags   : [],
      high_risk_factors:    Array.isArray(parsed.high_risk_factors) ? parsed.high_risk_factors : [],
      strengths:            Array.isArray(parsed.strengths)        ? parsed.strengths        : [],
      special_instructions: typeof parsed.special_instructions === 'string' ? parsed.special_instructions : '',
    };
  } catch {
    // Fallback: derive a minimal checklist from the base checklist
    return {
      checklist_items: baseChecklist.requirements.map((r, i) => ({
        document:     r.document,
        priority:     (r.mandatory ? (i < 3 ? 'required' : 'recommended') : 'optional') as 'required' | 'recommended' | 'optional',
        reason:       `${r.category} document — standard requirement for ${baseChecklist.visa_type}`,
        score_impact: r.mandatory ? (i < 3 ? 10 : 6) : 3,
      })),
      profile_flags:        ['Profile generation failed — using base checklist'],
      high_risk_factors:    [],
      strengths:            [],
      special_instructions: 'Please ensure all standard documents are included.',
    };
  }
}
