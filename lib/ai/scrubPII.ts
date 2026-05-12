// lib/ai/scrubPII.ts — Full PII scrubber (production quality, no shortcuts)
import type { RawExtraction, ScrubbedExtraction, DocumentValidity } from './types';

export function scrubPII(extractions: RawExtraction[]): ScrubbedExtraction[] {
  if (!Array.isArray(extractions)) return [];
  return extractions.map(doc => {
    const safeDoc = doc || {} as Partial<RawExtraction>;
    return {
      document_type:     safeDoc.document_type ?? 'unknown',
      document_validity: enrichValidity(safeDoc.document_validity),
      confidence_score:  safeDoc.confidence_score ?? 0,
      language:          safeDoc.language ?? 'unknown',
      warnings:          Array.isArray(safeDoc.warnings) ? safeDoc.warnings : [],
      field_summary:     scrubFields(safeDoc.document_type ?? 'unknown', safeDoc.extracted_fields || {}),
    };
  });
}

function scrubFields(type: string, fields: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case 'passport':
      return {
        has_passport_number: !!fields.passport_number,
        nationality:         fields.nationality,
        issuing_country:     fields.issuing_country,
        age_band:            toAgeBand(fields.date_of_birth as string | null),
        has_photo:           !!fields.photo,
      };
    case 'bank_statement':
      return {
        has_account_number:             !!fields.account_number,
        months_of_history:              fields.months_of_history,
        financial_range:                toFinancialRange(fields.average_balance as number | null),
        income_consistency:             toConsistencyRating(fields.monthly_transactions as unknown[]),
        has_large_unexplained_deposits: detectAnomalies(fields.transactions as Transaction[]),
        currency:                       fields.currency,
      };
    case 'employment_letter':
      return {
        employment_status: fields.employment_status,
        contract_type:     fields.contract_type,
        salary_band:       fields.salary ? toSalaryBand(fields.salary as number) : null,
        employer_sector:   fields.employer_sector,
        on_letterhead:     fields.on_letterhead,
        is_signed:         fields.is_signed,
      };
    default:
      return {
        document_present: true,
        is_signed:        fields.is_signed ?? null,
        is_dated:         fields.is_dated  ?? null,
      };
  }
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function toAgeBand(dob: string | null): string | null {
  if (!dob) return null;
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / 31_557_600_000);
  if (age < 25) return 'under-25';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  return '55-plus';
}

function toFinancialRange(amount: number | null): string | null {
  if (amount == null) return null;
  if (amount < 1_000)   return 'below_threshold';
  if (amount < 5_000)   return 'low';
  if (amount < 20_000)  return 'medium';
  if (amount < 100_000) return 'high';
  return 'very_high';
}

function toSalaryBand(monthly: number | null): string | null {
  if (!monthly) return null;
  const annual = monthly * 12;
  if (annual < 20_000)  return 'low';
  if (annual < 50_000)  return 'medium';
  if (annual < 100_000) return 'high';
  return 'very_high';
}

interface Transaction {
  type?: string;
  is_recurring?: boolean;
  amount: number;
}

function toConsistencyRating(transactions: unknown[]): string {
  if (!transactions?.length) return 'unknown';
  const txns = transactions as Transaction[];
  const regular = txns.filter(t => t.type === 'credit' && t.is_recurring);
  if (regular.length >= 10) return 'very_consistent';
  if (regular.length >= 5)  return 'consistent';
  return 'inconsistent';
}

function detectAnomalies(transactions: Transaction[]): boolean {
  if (!transactions?.length) return false;
  const avg = transactions.reduce((s, t) => s + t.amount, 0) / transactions.length;
  return transactions.some(t => t.amount > avg * 5);
}

function enrichValidity(v?: { expiry_date?: string | null; is_expired?: boolean }): DocumentValidity {
  if (!v) {
    return { expiry_date: null, is_expired: false, days_until_expiry: null };
  }
  const expiryDate = v.expiry_date ?? null;
  const days = expiryDate
    ? Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86_400_000)
    : null;
  return {
    expiry_date:       expiryDate,
    is_expired:        v.is_expired ?? false,
    days_until_expiry: days,
  };
}
