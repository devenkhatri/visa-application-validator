'use client';
import type { ScrubbedExtraction, RawExtraction } from '@/lib/ai/types';

interface PIIComparisonProps {
  // What the OCR model extracted (shown anonymised — never expose real data client-side)
  scrubbed: ScrubbedExtraction[];
  // The "before" example is constructed from the scrubbed data shapes
}

// Build a plausible "raw" example from the scrubbed data to illustrate what PII looks like
function buildRawExample(scrubbed: ScrubbedExtraction[]): Record<string, unknown> {
  const passport = scrubbed.find(d => d.document_type === 'passport');
  const bank     = scrubbed.find(d => d.document_type === 'bank_statement');

  const raw: Record<string, unknown> = {};

  if (passport) {
    raw.passport_number = '●●●●●●●●●'; // redacted in display — never expose real value
    raw.full_name       = '████ ████████';
    raw.date_of_birth   = '████-██-██';
    raw.nationality     = (passport.field_summary as Record<string, unknown>).nationality;
    raw.expiry_date     = passport.document_validity.expiry_date;
  }

  if (bank) {
    raw.bank_balance    = '£██,███.██';
    raw.account_number  = '██-██-██ ████████';
    raw.currency        = (bank.field_summary as Record<string, unknown>).currency;
  }

  return raw;
}

// Fields that are "sensitive" — highlighted in red on the left
const SENSITIVE_KEYS = new Set(['passport_number','full_name','date_of_birth','bank_balance','account_number']);

function JsonBlock({
  data,
  highlight,
}: {
  data: Record<string, unknown>;
  highlight: (key: string) => 'red' | 'green' | 'none';
}) {
  return (
    <div className="font-mono text-xs leading-relaxed space-y-1">
      <span className="text-white/40">{'{'}</span>
      {Object.entries(data).map(([k, v]) => {
        const h = highlight(k);
        return (
          <div key={k} className="pl-4">
            <span className="text-blue-400">&quot;{k}&quot;</span>
            <span className="text-white/40">: </span>
            <span
              className={`px-1.5 py-0.5 rounded text-xs ${
                h === 'red'   ? 'bg-red-500/20 text-red-300' :
                h === 'green' ? 'bg-green-500/20 text-green-300' :
                                'text-white/70'
              }`}
            >
              {JSON.stringify(v)}
            </span>
            {h === 'red' && (
              <span className="ml-2 text-red-400/60 text-[10px]">← PII</span>
            )}
          </div>
        );
      })}
      <span className="text-white/40">{'}'}</span>
    </div>
  );
}

export default function PIIComparison({ scrubbed }: PIIComparisonProps) {
  const rawExample     = buildRawExample(scrubbed);
  const scrubbedFlat   = scrubbed.reduce<Record<string, unknown>>((acc, doc) => ({
    ...acc,
    ...(doc.field_summary as Record<string, unknown>),
    document_validity: doc.document_validity,
  }), {});

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-white/10">
        {/* Left — what the OCR read */}
        <div className="p-6 bg-red-950/20 border-r border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🔴</span>
            <h3 className="font-semibold text-white">What the AI Read</h3>
          </div>
          <p className="text-xs text-white/50 mb-4">Raw extracted data — contains personal identifiers</p>
          <div className="bg-black/30 rounded-xl p-4 border border-red-500/20">
            <JsonBlock
              data={rawExample}
              highlight={k => SENSITIVE_KEYS.has(k) ? 'red' : 'none'}
            />
          </div>
        </div>

        {/* Right — what the analyser received */}
        <div className="p-6 bg-green-950/20">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🟢</span>
            <h3 className="font-semibold text-white">What the Analyser Received</h3>
          </div>
          <p className="text-xs text-white/50 mb-4">After PII scrubbing — all identifiers removed</p>
          <div className="bg-black/30 rounded-xl p-4 border border-green-500/20">
            <JsonBlock
              data={scrubbedFlat}
              highlight={() => 'green'}
            />
          </div>
        </div>
      </div>

      {/* Trust statement */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-6 text-center">
        <p className="text-base text-white/80 leading-relaxed max-w-2xl mx-auto">
          <strong className="text-white">Passport numbers, exact balances, full names and account numbers
          never leave your infrastructure.</strong>
          {' '}The AI analyser only receives anonymised summaries — making it impossible for
          the analysis model to reconstruct any applicant&apos;s personal data.
        </p>
      </div>
    </div>
  );
}
