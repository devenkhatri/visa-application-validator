'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface ReviewInfo {
  id:          string;
  checklistId: string;
  nationality: string | null;
  status:      string;
  createdAt:   string;
}

interface EventRow {
  id:            string;
  reviewId:      string;
  stage:         string;
  status:        'completed' | 'failed' | 'skipped';
  outputSummary: Record<string, unknown> | null;
  metadata:      Record<string, unknown> | null;
  durationMs:    number | null;
  createdAt:     string;
}

// ─── Stage display config ─────────────────────────────────────────────────────
const STAGE_CONFIG: Record<string, { label: string; icon: string; description: string }> = {
  QUESTIONNAIRE_COMPLETE: {
    label:       'Personalised Checklist Applied',
    icon:        '🎯',
    description: 'Questionnaire answers processed and personalised checklist generated',
  },
  OCR_CACHE_CHECK: {
    label:       'OCR Cache Check',
    icon:        '🗄️',
    description: 'Checked local database for previously extracted documents',
  },
  OCR_EXTRACTION: {
    label:       'Document Extraction (Local)',
    icon:        '📄',
    description: 'AI vision model read the document — processing happened on this machine',
  },
  PII_SCRUB: {
    label:       'PII Scrubbing',
    icon:        '🔒',
    description: 'Passport numbers, financial figures, and personal identifiers removed',
  },
  CLAUDE_ANALYSIS: {
    label:       'AI Gap Analysis',
    icon:        '🤖',
    description: 'Anonymised document summary sent to AI for checklist gap analysis',
  },
  REPORT_GENERATED: {
    label:       'Report Generated',
    icon:        '📊',
    description: 'Full review report saved — score, gaps, and recommendations ready',
  },
  PIPELINE_ERROR: {
    label:       'Pipeline Error',
    icon:        '❌',
    description: 'An error occurred during processing',
  },
};

const CHECKLIST_LABELS: Record<string, string> = {
  'UK-SVV-01':  '🇬🇧 UK Standard Visitor',
  'SCH-CSS-01': '🇪🇺 Schengen Short Stay',
};

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function OutputSummary({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-white/40 hover:text-white/60 transition-colors flex items-center gap-1"
      >
        {open ? '▼' : '▶'} {open ? 'Hide' : 'Show'} details
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-black/30 border border-white/10 p-3 space-y-1.5">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-start gap-2 text-xs">
              <span className="text-white/30 font-mono shrink-0">{k}:</span>
              <span className={`font-mono break-all ${
                v === true  ? 'text-green-400' :
                v === false ? 'text-red-400'   :
                typeof v === 'number' ? 'text-blue-300' :
                'text-white/60'
              }`}>
                {JSON.stringify(v)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TimelinePage() {
  const params   = useParams<{ id: string }>();
  const reviewId = params.id;

  const [review,  setReview]  = useState<ReviewInfo | null>(null);
  const [events,  setEvents]  = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch(`/api/reviews/${reviewId}/timeline`)
      .then(r => r.json())
      .then((data: { review: ReviewInfo; events: EventRow[] }) => {
        setReview(data.review);
        setEvents(data.events ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load timeline.');
        setLoading(false);
      });
  }, [reviewId]);

  return (
    <main className="min-h-screen bg-[#080c1a] text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/history" className="hover:text-white/70 transition-colors">History</Link>
          <span>/</span>
          {review && (
            <>
              <Link href={`/results/${reviewId}`} className="hover:text-white/70 transition-colors">
                Report
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-white/70">Timeline</span>
        </div>

        {/* Header */}
        {review && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h1 className="text-xl font-bold text-white mb-2">Stage Timeline</h1>
            <div className="flex items-center gap-3 flex-wrap text-sm text-white/50">
              <span>{CHECKLIST_LABELS[review.checklistId] ?? review.checklistId}</span>
              {review.nationality && <><span>·</span><span>{review.nationality}</span></>}
              <span>·</span>
              <span className={`font-medium ${
                review.status === 'completed' ? 'text-green-400' :
                review.status === 'failed'    ? 'text-red-400'   :
                review.status === 'processing' ? 'text-blue-400'  :
                'text-white/40'
              }`}>{review.status}</span>
              <span className="ml-auto font-mono text-xs text-white/25">{reviewId.slice(0, 8)}…</span>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <svg className="w-8 h-8 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
        )}

        {/* Empty state */}
        {!loading && !error && events.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl">⏳</div>
            <p className="text-white/60 font-medium">No events logged yet</p>
            <p className="text-white/30 text-sm">
              This application may still be processing, or the pipeline has not started.
            </p>
            {review?.status === 'processing' && (
              <Link href={`/processing/${reviewId}`} className="inline-block mt-2 text-blue-400 text-sm hover:text-blue-300">
                View live processing →
              </Link>
            )}
          </div>
        )}

        {/* Timeline */}
        {!loading && events.length > 0 && (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-white/10" aria-hidden="true" />

            <div className="space-y-4">
              {events.map((evt, i) => {
                const config = STAGE_CONFIG[evt.stage] ?? {
                  label: evt.stage.replace(/_/g, ' '),
                  icon:  '📌',
                  description: '',
                };

                const isSuccess = evt.status === 'completed';
                const isFailed  = evt.status === 'failed';

                return (
                  <div key={evt.id} className="flex items-start gap-4">
                    {/* Icon + connector */}
                    <div className="shrink-0 relative z-10">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 ${
                        isSuccess ? 'bg-green-500/15 border-green-500/30' :
                        isFailed  ? 'bg-red-500/15 border-red-500/30'    :
                                    'bg-white/5 border-white/20'
                      }`}>
                        {isFailed ? '❌' : config.icon}
                      </div>
                    </div>

                    {/* Card */}
                    <div className={`flex-1 rounded-2xl border p-4 mb-1 ${
                      isSuccess ? 'border-green-500/20 bg-green-500/5' :
                      isFailed  ? 'border-red-500/20 bg-red-500/5'    :
                                  'border-white/10 bg-white/5'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`font-semibold text-sm ${
                            isSuccess ? 'text-green-400' :
                            isFailed  ? 'text-red-400'   :
                            'text-white'
                          }`}>
                            {isSuccess ? '✅ ' : isFailed ? '❌ ' : ''}{config.label}
                          </p>
                          <p className="text-xs text-white/40 mt-0.5">{config.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-white/40 font-mono">{formatDate(evt.createdAt)}</p>
                          {evt.durationMs !== null && (
                            <p className={`text-xs font-bold mt-0.5 ${
                              isSuccess ? 'text-green-400/70' : 'text-white/30'
                            }`}>
                              {formatDuration(evt.durationMs)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Output summary */}
                      {evt.outputSummary && Object.keys(evt.outputSummary).length > 0 && (
                        <OutputSummary data={evt.outputSummary} />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* End node */}
              {review?.status === 'completed' && (
                <div className="flex items-center gap-4">
                  <div className="shrink-0 relative z-10 w-12 h-12 rounded-full flex items-center justify-center bg-green-600 border-2 border-green-400/50 text-lg">
                    🏁
                  </div>
                  <div className="flex-1 rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
                    <p className="font-semibold text-green-400 text-sm">Review Complete</p>
                    <div className="flex items-center gap-3 mt-2">
                      <Link
                        href={`/results/${reviewId}`}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                      >
                        View full report →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
