// lib/ai/types.ts — Shared interfaces for the AI pipeline

export interface RawExtraction {
  document_type: string;
  extracted_fields: Record<string, unknown>;
  document_validity: {
    expiry_date: string | null;
    is_expired: boolean;
  };
  confidence_score: number;
  language: string;
  warnings: string[];
  ocr_engine?: string;
  raw_text?: string;
}

export interface DocumentValidity {
  expiry_date: string | null;
  is_expired: boolean;
  days_until_expiry: number | null;
}

export interface ScrubbedExtraction {
  document_type: string;
  document_validity: DocumentValidity;
  confidence_score: number;
  language: string;
  warnings: string[];
  field_summary: Record<string, unknown>;
}

export interface GapItem {
  item: string;
  status: 'present' | 'missing' | 'weak' | 'expired';
  severity: 'critical' | 'major' | 'minor';
  current_gap?: string;
  recommendation: string;
}

export interface ScoreBreakdown {
  documents_completeness: number;
  financial_strength: number;
  travel_history: number;
  ties_to_home_country: number;
  application_quality: number;
}

export interface AnalysisResult {
  gap_analysis: GapItem[];
  overall_score: number;
  score_breakdown: ScoreBreakdown;
  verdict: 'strong' | 'moderate' | 'weak' | 'insufficient';
  key_strengths: string[];
  critical_gaps: string[];
  recommended_actions: string[];
}

// ─── Questionnaire + personalised checklist ──────────────────────────────────

export interface QuestionnaireAnswers {
  employment_status:          'salaried' | 'self_employed' | 'student' | 'retired' | 'other';
  purpose_of_visit:           'tourism' | 'business' | 'family' | 'medical' | 'study';
  prior_travel_destination:   'approved' | 'refused' | 'never';
  prior_international_travel: 'frequent' | 'occasional' | 'none';
  property_ownership:         'yes' | 'no';
  monthly_balance_range:      'below_50k' | '50k_2l' | '2l_10l' | 'above_10l';
}

export interface ChecklistItem {
  document:     string;   // e.g. "3-year ITR + CA Certificate"
  priority:     'required' | 'recommended' | 'optional';
  reason:       string;   // personalised one-liner from Claude
  score_impact: number;   // +N points
}

export interface PersonalisedChecklist {
  checklist_items:      ChecklistItem[];
  profile_flags:        string[];
  high_risk_factors:    string[];
  strengths:            string[];
  special_instructions: string;
}

