'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CHECKLISTS = [
  { id: 'UK-SVV-01',  label: '🇬🇧  United Kingdom — Standard Visitor Visa' },
  { id: 'SCH-CSS-01', label: '🇪🇺  Schengen Zone — Short Stay (Type C)' },
];

export default function DemoPage() {
  const router = useRouter();
  const [checklistId, setChecklistId] = useState('UK-SVV-01');
  const [nationality, setNationality] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  async function handleStart() {
    if (!nationality.trim()) {
      setError('Please enter a nationality to continue.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/reviews', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ checklistId, nationality: nationality.trim() }),
      });

      if (!res.ok) throw new Error('Failed to create review');

      const { id } = await res.json() as { id: string };
      router.push(`/upload/${id}`);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080c1a] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-10 text-sm text-white/40">
          <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">1</span>
          <span className="text-white/70 font-medium">Select Visa Type</span>
          <span className="flex-1 h-px bg-white/10" />
          <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs">2</span>
          <span>Upload Docs</span>
          <span className="flex-1 h-px bg-white/10" />
          <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs">3</span>
          <span>Processing</span>
          <span className="flex-1 h-px bg-white/10" />
          <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs">4</span>
          <span>Results</span>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Start your review</h1>
            <p className="text-white/50 text-sm">Select the visa type you&apos;re applying for</p>
          </div>

          {/* Visa type selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70" htmlFor="checklist-select">
              Visa Type
            </label>
            <select
              id="checklist-select"
              value={checklistId}
              onChange={e => setChecklistId(e.target.value)}
              className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            >
              {CHECKLISTS.map(c => (
                <option key={c.id} value={c.id} className="bg-[#0f1629]">
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Nationality input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70" htmlFor="nationality-input">
              Applicant Nationality
            </label>
            <input
              id="nationality-input"
              type="text"
              placeholder="e.g. Pakistani, Jordanian, Nigerian…"
              value={nationality}
              onChange={e => { setNationality(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            id="start-review-btn"
            onClick={handleStart}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Starting…
              </>
            ) : (
              'Start Review →'
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
