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
