'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { QuestionnaireAnswers, PersonalisedChecklist, ChecklistItem } from '@/lib/ai/types';

// ─── Question definitions ─────────────────────────────────────────────────────

const QUESTIONS: {
  key: keyof QuestionnaireAnswers;
  label: string;
  icon: string;
  options: { value: string; label: string; desc?: string }[];
}[] = [
  {
    key:   'employment_status',
    label: 'What is your employment status?',
    icon:  '💼',
    options: [
      { value: 'salaried',      label: 'Salaried Employee',    desc: 'Working for a company or organisation' },
      { value: 'self_employed', label: 'Self-Employed',        desc: 'Business owner, freelancer, or contractor' },
      { value: 'student',       label: 'Student',              desc: 'Currently enrolled in an educational institution' },
      { value: 'retired',       label: 'Retired',              desc: 'No longer in active employment' },
      { value: 'other',         label: 'Other',                desc: 'Homemaker, dependent, or other status' },
    ],
  },
  {
    key:   'purpose_of_visit',
    label: 'What is the purpose of your visit?',
    icon:  '✈️',
    options: [
      { value: 'tourism',  label: 'Tourism',         desc: 'Sightseeing, leisure, or holiday' },
      { value: 'business', label: 'Business',         desc: 'Meetings, conferences, or trade' },
      { value: 'family',   label: 'Visiting Family',  desc: 'Staying with relatives or friends' },
      { value: 'medical',  label: 'Medical',          desc: 'Treatment, consultation, or surgery' },
      { value: 'study',    label: 'Study',            desc: 'Short course or academic visit' },
    ],
  },
  {
    key:   'prior_travel_destination',
    label: 'Have you previously travelled to this country?',
    icon:  '🌍',
    options: [
      { value: 'approved', label: 'Yes — visa approved',  desc: 'Previously visited and entry was granted' },
      { value: 'refused',  label: 'Yes — visa refused',   desc: 'Applied before and was refused' },
      { value: 'never',    label: 'No — first time',      desc: 'Never applied or visited this country' },
    ],
  },
  {
    key:   'prior_international_travel',
    label: 'How would you describe your international travel history?',
    icon:  '🗺️',
    options: [
      { value: 'frequent',   label: 'Frequent Traveller',   desc: '5+ countries in the past 3 years' },
      { value: 'occasional', label: 'Occasional Traveller', desc: '1–4 countries in the past 3 years' },
      { value: 'none',       label: 'First-Time Traveller', desc: 'This is my first international trip' },
    ],
  },
  {
    key:   'property_ownership',
    label: 'Do you own property in your home country?',
    icon:  '🏠',
    options: [
      { value: 'yes', label: 'Yes — I own property',      desc: 'House, flat, land, or commercial property' },
      { value: 'no',  label: 'No — I do not own property', desc: 'Renting or living with family' },
    ],
  },
  {
    key:   'monthly_balance_range',
    label: 'What is your average monthly bank balance?',
    icon:  '💰',
    options: [
      { value: 'below_50k', label: 'Below ₹50,000',          desc: '' },
      { value: '50k_2l',    label: '₹50,000 – ₹2,00,000',   desc: '' },
      { value: '2l_10l',    label: '₹2,00,000 – ₹10,00,000', desc: '' },
      { value: 'above_10l', label: 'Above ₹10,00,000',        desc: '' },
    ],
  },
];

// ─── Priority badge ───────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: ChecklistItem['priority'] }) {
  const styles = {
    required:    'bg-red-500/20 text-red-400 border border-red-500/30',
    recommended: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    optional:    'bg-white/10 text-white/50 border border-white/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${styles[priority]}`}>
      {priority}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function QuestionnairePage() {
  const router   = useRouter();
  const params   = useParams<{ id: string }>();
  const reviewId = params.id;

  const [answers,   setAnswers]   = useState<Partial<QuestionnaireAnswers>>({});
  const [loading,   setLoading]   = useState(false);
  const [checklist, setChecklist] = useState<PersonalisedChecklist | null>(null);
  const [error,     setError]     = useState('');

  const answeredCount = Object.keys(answers).length;
  const allAnswered   = answeredCount === QUESTIONS.length;

  function select(key: keyof QuestionnaireAnswers, value: string) {
    setAnswers(prev => ({ ...prev, [key]: value as never }));
    setError('');
  }

  async function handleGenerate() {
    if (!allAnswered) {
      setError('Please answer all 6 questions before generating your checklist.');
      return;
    }

    setLoading(true);
    setError('');
    setChecklist(null);

    try {
      const res = await fetch(`/api/reviews/${reviewId}/questionnaire`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(answers),
      });

      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to generate checklist');
      }

      const data = await res.json() as { checklist: PersonalisedChecklist };
      setChecklist(data.checklist);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080c1a] text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 text-xs text-white/40 overflow-x-auto pb-2">
          {[
            { n: 1, label: 'Visa Type',   done: true  },
            { n: 2, label: 'Questionnaire', done: false, active: true },
            { n: 3, label: 'Checklist',   done: false },
            { n: 4, label: 'Upload',      done: false },
            { n: 5, label: 'Processing',  done: false },
            { n: 6, label: 'Results',     done: false },
          ].map((s, i, arr) => (
            <span key={s.n} className="flex items-center gap-1.5 shrink-0">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                s.done   ? 'bg-green-600/80 text-white' :
                s.active ? 'bg-blue-600 text-white'     :
                           'bg-white/10 text-white/40'
              }`}>{s.done ? '✓' : s.n}</span>
              <span className={s.active ? 'text-white/70 font-medium' : 'text-white/30'}>{s.label}</span>
              {i < arr.length - 1 && <span className="w-3 h-px bg-white/10" />}
            </span>
          ))}
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold mb-1">Build your personalised checklist</h1>
          <p className="text-white/50 text-sm">Answer 6 questions and our AI will generate a checklist tailored to your profile.</p>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%` }}
          />
        </div>
        <p className="text-xs text-white/40 -mt-4 text-right">{answeredCount} / {QUESTIONS.length} answered</p>

        {/* Questions */}
        <div className="space-y-6">
          {QUESTIONS.map((q) => {
            const selected = answers[q.key];
            return (
              <div
                key={q.key}
                className={`rounded-2xl border p-6 transition-all duration-300 ${
                  selected
                    ? 'border-blue-500/40 bg-blue-500/5'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">{q.icon}</span>
                  <p className="font-semibold text-white text-sm">{q.label}</p>
                  {selected && <span className="ml-auto text-green-400 text-lg">✅</span>}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {q.options.map(opt => (
                    <button
                      key={opt.value}
                      id={`q-${q.key}-${opt.value}`}
                      onClick={() => select(q.key, opt.value)}
                      className={`text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                        selected === opt.value
                          ? 'border-blue-400/60 bg-blue-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-white/70 hover:border-white/25 hover:bg-white/10'
                      }`}
                    >
                      <span className="font-medium text-sm">{opt.label}</span>
                      {opt.desc && (
                        <span className="block text-xs text-white/40 mt-0.5">{opt.desc}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* Generate button */}
        {!checklist && (
          <button
            id="generate-checklist-btn"
            onClick={handleGenerate}
            disabled={loading || !allAnswered}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                AI is building your personalised checklist…
              </>
            ) : (
              `Generate My Checklist →${!allAnswered ? ` (${QUESTIONS.length - answeredCount} question${QUESTIONS.length - answeredCount !== 1 ? 's' : ''} remaining)` : ''}`
            )}
          </button>
        )}

        {/* ── Personalised checklist result ── */}
        {checklist && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Profile summary */}
            {(checklist.profile_flags?.length > 0 || checklist.high_risk_factors?.length > 0 || checklist.strengths?.length > 0) && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
                <h2 className="font-bold text-white flex items-center gap-2">
                  🎯 Your Applicant Profile
                </h2>
                {checklist.profile_flags?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {checklist.profile_flags.map((f, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-300 text-xs font-medium">{f}</span>
                    ))}
                  </div>
                )}
                {checklist.high_risk_factors?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-400 mb-1.5">⚠️ Risk factors to address</p>
                    <ul className="space-y-1">
                      {checklist.high_risk_factors.map((r, i) => (
                        <li key={i} className="text-xs text-red-300/80 flex items-start gap-1.5">
                          <span className="mt-0.5 shrink-0">•</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {checklist.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-400 mb-1.5">✅ Your strengths</p>
                    <ul className="space-y-1">
                      {checklist.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-green-300/80 flex items-start gap-1.5">
                          <span className="mt-0.5 shrink-0">•</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {checklist.special_instructions && (
                  <p className="text-xs text-white/55 border-t border-white/10 pt-3 leading-relaxed">
                    💡 {checklist.special_instructions}
                  </p>
                )}
              </div>
            )}

            {/* Checklist items */}
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="font-bold text-white">Your Document Checklist</h2>
                <span className="text-xs text-white/40">{checklist.checklist_items?.length} documents</span>
              </div>
              <div className="divide-y divide-white/5">
                {checklist.checklist_items?.map((item, i) => (
                  <div key={i} className="px-6 py-4 flex items-start gap-4">
                    <div className={`mt-1 w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                      item.priority === 'required'    ? 'bg-red-500/20 text-red-400' :
                      item.priority === 'recommended' ? 'bg-amber-500/20 text-amber-400' :
                                                        'bg-white/10 text-white/40'
                    }`}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-sm text-white">{item.document}</p>
                        <PriorityBadge priority={item.priority} />
                        <span className="ml-auto shrink-0 text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                          +{item.score_impact} pts
                        </span>
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed">{item.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Proceed CTA */}
            <button
              id="proceed-to-upload-btn"
              onClick={() => router.push(`/upload/${reviewId}`)}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
            >
              Proceed to Upload →
            </button>

            {/* Regenerate */}
            <button
              onClick={() => { setChecklist(null); setAnswers({}); }}
              className="w-full py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:text-white/60 hover:border-white/20 transition-colors"
            >
              ← Start over (change answers)
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
