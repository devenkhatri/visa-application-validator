'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const CHECKLIST_LABELS: Record<string, string> = {
  'UK-SVV-01':  '🇬🇧 UK Standard Visitor',
  'SCH-CSS-01': '🇪🇺 Schengen Short Stay',
};

interface ReviewRow {
  id:             string;
  checklistId:    string;
  nationality:    string | null;
  status:         'pending' | 'processing' | 'completed' | 'failed';
  createdAt:      string;
  completedAt:    string | null;
  overallScore:   number | null;
  verdict:        string | null;
  scoreBreakdown: Record<string, number> | null;
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return null;
  const styles: Record<string, string> = {
    strong:       'bg-green-500/20 text-green-400 border-green-500/30',
    moderate:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
    weak:         'bg-amber-500/20 text-amber-400 border-amber-500/30',
    insufficient: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${styles[verdict] ?? 'bg-white/10 text-white/40 border-white/20'}`}>
      {verdict}
    </span>
  );
}

function StatusBadge({ status }: { status: ReviewRow['status'] }) {
  const styles: Record<string, string> = {
    completed:  'bg-green-500/20 text-green-400',
    processing: 'bg-blue-500/20 text-blue-400 animate-pulse',
    failed:     'bg-red-500/20 text-red-400',
    pending:    'bg-white/10 text-white/40',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

function MiniGauge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-white/30 text-sm">—</span>;

  const color =
    score >= 80 ? '#22c55e' :
    score >= 60 ? '#3b82f6' :
    score >= 40 ? '#f59e0b' : '#ef4444';

  const radius = 18;
  const circ   = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex items-center gap-2">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle
          cx="24" cy="24" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <span className="text-xl font-bold text-white tabular-nums">{score}</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoryPage() {
  const router = useRouter();
  const [rows,    setRows]    = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [rerunId, setRerunId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/reviews')
      .then(r => r.json())
      .then((data: { reviews: ReviewRow[] }) => {
        setRows(data.reviews ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load history.');
        setLoading(false);
      });
  }, []);

  async function handleRerun(reviewId: string) {
    setRerunId(reviewId);
    try {
      await fetch(`/api/reviews/${reviewId}/start`, { method: 'POST' });
      router.push(`/processing/${reviewId}`);
    } catch {
      setRerunId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#080c1a] text-white px-6 py-12">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">Application History</h1>
            <p className="text-white/50 text-sm mt-1">All past reviews — click a row to view the full report</p>
          </div>
          <Link
            href="/demo"
            id="new-application-btn"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-sm hover:opacity-90 active:scale-95 transition-all"
          >
            + New Application
          </Link>
        </div>

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
        {!loading && !error && rows.length === 0 && (
          <div className="text-center py-24 space-y-4">
            <div className="text-6xl">📋</div>
            <h2 className="text-xl font-semibold text-white/80">No applications yet</h2>
            <p className="text-white/40 text-sm max-w-sm mx-auto leading-relaxed">
              Run your first demo to see how the system tracks every application end-to-end — scores, gaps, and a full audit trail.
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors mt-4"
            >
              Run your first demo →
            </Link>
          </div>
        )}

        {/* Table */}
        {!loading && rows.length > 0 && (
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_120px_100px_auto] gap-4 px-6 py-3 border-b border-white/10 text-xs font-semibold text-white/40 uppercase tracking-wide">
              <span>Application</span>
              <span>Visa / Nationality</span>
              <span>Score</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            <div className="divide-y divide-white/5">
              {rows.map(row => (
                <div
                  key={row.id}
                  className="px-6 py-4 flex flex-col md:grid md:grid-cols-[1fr_1fr_120px_100px_auto] gap-4 items-start md:items-center hover:bg-white/3 transition-colors group"
                >
                  {/* Date + ID */}
                  <div>
                    <p className="text-sm font-medium text-white">{formatDate(row.createdAt)}</p>
                    <p className="text-xs text-white/30 font-mono mt-0.5">{row.id.slice(0, 8)}…</p>
                  </div>

                  {/* Visa + Nationality */}
                  <div>
                    <p className="text-sm text-white/80">{CHECKLIST_LABELS[row.checklistId] ?? row.checklistId}</p>
                    {row.nationality && (
                      <p className="text-xs text-white/40 mt-0.5">{row.nationality}</p>
                    )}
                  </div>

                  {/* Score gauge + verdict */}
                  <div className="flex flex-col gap-1.5">
                    <MiniGauge score={row.overallScore} />
                    <VerdictBadge verdict={row.verdict} />
                  </div>

                  {/* Status */}
                  <div>
                    <StatusBadge status={row.status} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {row.status === 'completed' && (
                      <>
                        <Link
                          href={`/results/${row.id}`}
                          className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-semibold transition-colors border border-blue-500/20"
                        >
                          View Report
                        </Link>
                        <Link
                          href={`/applications/${row.id}/timeline`}
                          className="px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/12 text-white/60 text-xs font-semibold transition-colors border border-white/10"
                        >
                          Timeline
                        </Link>
                        <button
                          onClick={() => handleRerun(row.id)}
                          disabled={rerunId === row.id}
                          className="px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 text-xs font-semibold transition-colors border border-violet-500/20 disabled:opacity-50"
                        >
                          {rerunId === row.id ? '…' : 'Re-run'}
                        </button>
                      </>
                    )}
                    {row.status === 'failed' && (
                      <button
                        onClick={() => handleRerun(row.id)}
                        disabled={rerunId === row.id}
                        className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-semibold transition-colors border border-red-500/20"
                      >
                        Retry
                      </button>
                    )}
                    {row.status === 'processing' && (
                      <Link
                        href={`/processing/${row.id}`}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/20 animate-pulse"
                      >
                        Processing…
                      </Link>
                    )}
                    {row.status === 'pending' && (
                      <Link
                        href={`/upload/${row.id}`}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 text-xs font-semibold transition-colors border border-white/10"
                      >
                        Upload Docs
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-white/20">
          {rows.length} application{rows.length !== 1 ? 's' : ''} stored locally · data never leaves this machine
        </p>
      </div>
    </main>
  );
}
