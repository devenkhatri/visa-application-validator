import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { reviews, reviewResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getChecklist } from '@/lib/checklists';
import type { GapItem, ScoreBreakdown, AnalysisResult } from '@/lib/ai/types';
import ScoreGauge from '@/components/ScoreGauge';
import GapAnalysisTable from '@/components/GapAnalysisTable';
import ProbabilityBreakdown from '@/components/ProbabilityBreakdown';

export const dynamic = 'force-dynamic';

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const review = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  if (!review[0] || review[0].status !== 'completed') notFound();

  const result = await db.select().from(reviewResults).where(eq(reviewResults.reviewId, id)).limit(1);
  if (!result[0]) notFound();

  const checklist   = getChecklist(review[0].checklistId);
  const gapAnalysis = result[0].gapAnalysis  as unknown as GapItem[];
  const breakdown   = result[0].scoreBreakdown as unknown as ScoreBreakdown;
  const analysisExt = result[0] as unknown as AnalysisResult & typeof result[0];

  const score   = result[0].overallScore ?? 0;
  const verdict = result[0].verdict ?? 'insufficient';

  const keyStrengths   = (analysisExt as unknown as { key_strengths?: string[] }).key_strengths   ?? [];
  const criticalGaps   = (analysisExt as unknown as { critical_gaps?: string[] }).critical_gaps   ?? [];
  const recActions     = (analysisExt as unknown as { recommended_actions?: string[] }).recommended_actions ?? [];

  return (
    <main className="min-h-screen bg-[#080c1a] text-white px-6 py-12">
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-white/40 text-sm mb-1">
              {checklist.flag} {checklist.country} — {checklist.visa_type}
            </p>
            <h1 className="text-2xl font-bold">Application Review Report</h1>
            <p className="text-white/40 text-sm mt-1">Nationality: {review[0].nationality ?? 'Not specified'}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/pii-explainer/${id}`}
              className="px-4 py-2.5 rounded-xl border border-white/20 text-white/70 text-sm hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              🔒 How is your data protected?
            </Link>
            <a
              href={`/api/reviews/${id}/report.pdf`}
              download
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              ⬇ Download PDF
            </a>
          </div>
        </div>

        {/* Score gauge + breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gauge card */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 flex flex-col items-center justify-center gap-4">
            <ScoreGauge score={score} verdict={verdict} />
            <p className="text-white/50 text-sm text-center">
              {verdict === 'strong'       ? 'Application is well-prepared. Ready to submit.' :
               verdict === 'moderate'    ? 'Address the gaps below before submitting.' :
               verdict === 'weak'        ? 'Significant gaps detected. Review recommended.' :
                                           'Critical documents missing. Do not submit yet.'}
            </p>
          </div>

          {/* Breakdown card */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="font-semibold text-white mb-6">Score Breakdown</h2>
            <ProbabilityBreakdown breakdown={breakdown} />
          </div>
        </div>

        {/* Gap analysis */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Gap Analysis</h2>
          <GapAnalysisTable items={gapAnalysis} />
        </div>

        {/* Key strengths + critical gaps */}
        {(keyStrengths.length > 0 || criticalGaps.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {keyStrengths.length > 0 && (
              <div className="rounded-2xl border border-green-500/20 bg-green-950/20 p-6">
                <h2 className="font-semibold text-green-400 mb-4 flex items-center gap-2">
                  <span>✅</span> Key Strengths
                </h2>
                <ul className="space-y-2">
                  {keyStrengths.map((s, i) => (
                    <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                      <span className="text-green-400 mt-0.5 shrink-0">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {criticalGaps.length > 0 && (
              <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-6">
                <h2 className="font-semibold text-red-400 mb-4 flex items-center gap-2">
                  <span>❌</span> Critical Gaps
                </h2>
                <ul className="space-y-2">
                  {criticalGaps.map((g, i) => (
                    <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                      <span className="text-red-400 mt-0.5 shrink-0">•</span>
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Recommended actions */}
        {recActions.length > 0 && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-6">
            <h2 className="font-semibold text-blue-300 mb-4">📋 Recommended Actions</h2>
            <ol className="space-y-3">
              {recActions.map((action, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                  <span className="w-6 h-6 rounded-full bg-blue-600/40 text-blue-300 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {action}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/10">
          <Link href="/demo" className="px-5 py-2.5 rounded-xl border border-white/20 text-white/60 text-sm hover:bg-white/5 transition-colors">
            ← Start New Review
          </Link>
          <a
            href={`/api/reviews/${id}/report.pdf`}
            download
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            ⬇ Download Full PDF Report
          </a>
        </div>
      </div>
    </main>
  );
}
