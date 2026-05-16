import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Visa AI Review — Instant Document Analysis',
  description: 'AI-powered visa application review. Upload your documents, get a gap analysis and probability score in under 3 minutes.',
};

const FEATURES = [
  { emoji: '📄', q: 'Can it actually read my documents?',   a: 'Live upload with AI vision extraction of passports, bank statements, employment letters and more.' },
  { emoji: '🔍', q: 'Does it know what\'s missing?',        a: 'Instant gap analysis against official visa checklists for UK and Schengen visas.' },
  { emoji: '📊', q: 'What\'s the score?',                   a: 'A 0–100 probability score with a visual gauge, colour banding, and a 5-category breakdown.' },
  { emoji: '🔒', q: 'Is our data safe?',                    a: 'Full PII scrubbing before any AI analysis. Passport numbers and balances never reach the cloud.' },
  { emoji: '⚡', q: 'How fast is it?',                      a: 'End-to-end review completes in under 3 minutes. Repeat uploads are instant via OCR caching.' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#080c1a] text-white">
      {/* Top nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#080c1a]/80 backdrop-blur border-b border-white/5">
        <span className="font-bold text-sm text-white/80">Visa AI Review</span>
        <div className="flex items-center gap-3">
          <Link
            href="/history"
            id="history-nav-btn"
            className="px-4 py-2 rounded-xl border border-white/10 text-white/60 text-sm font-medium hover:text-white hover:border-white/25 transition-all"
          >
            📋 History
          </Link>
          <Link
            href="/demo"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            Try Demo →
          </Link>
        </div>
      </nav>


      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-40 pb-20 text-center overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-24 left-1/4 w-[300px] h-[300px] bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            MVP Demo — AI Visa Document Review
          </div>

          <h1 className="text-5xl sm:text-6xl font-black leading-tight mb-6 bg-gradient-to-br from-white via-blue-100 to-blue-400 bg-clip-text text-transparent">
            Visa Applications<br />Reviewed in Minutes
          </h1>

          <p className="text-lg text-white/60 leading-relaxed mb-10 max-w-xl mx-auto">
            Upload your documents. Our AI reads them, checks for gaps against official checklists,
            and gives you an actionable score — all with your personal data protected.
          </p>

          <Link
            id="try-demo-btn"
            href="/demo"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold text-lg shadow-lg shadow-blue-900/40 hover:shadow-blue-900/60 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            Try Demo
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Feature cards — the 5 customer questions */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-center text-sm font-semibold text-white/40 uppercase tracking-widest mb-10">
          Five questions every customer asks
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ emoji, q, a }) => (
            <div
              key={q}
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/8 hover:border-white/20 transition-all duration-200"
            >
              <div className="text-3xl mb-3">{emoji}</div>
              <p className="font-semibold text-white mb-2">&ldquo;{q}&rdquo;</p>
              <p className="text-sm text-white/55 leading-relaxed">{a}</p>
            </div>
          ))}
          {/* Sixth card — CTA */}
          <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-900/30 to-violet-900/20 p-6 flex flex-col justify-between">
            <p className="font-semibold text-white mb-2">Ready to see it live?</p>
            <p className="text-sm text-white/55 leading-relaxed mb-4">
              Upload real documents and watch the AI work through them step by step.
            </p>
            <Link
              href="/demo"
              className="self-start px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
            >
              Start Demo →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
