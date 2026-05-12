import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { reviews, reviewResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { ScrubbedExtraction } from '@/lib/ai/types';
import PIIComparison from '@/components/PIIComparison';

export const dynamic = 'force-dynamic';

export default async function PIIExplainerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const review = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  if (!review[0] || review[0].status !== 'completed') notFound();

  const result = await db.select().from(reviewResults).where(eq(reviewResults.reviewId, id)).limit(1);
  if (!result[0]) notFound();

  const scrubbed = (result[0].scrubbedInput ?? []) as unknown as ScrubbedExtraction[];

  return (
    <main className="min-h-screen bg-[#080c1a] text-white px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <Link
              href={`/results/${id}`}
              className="text-white/40 text-sm hover:text-white/70 transition-colors mb-3 inline-flex items-center gap-1"
            >
              ← Back to Results
            </Link>
            <h1 className="text-2xl font-bold">How Your Data Is Protected</h1>
            <p className="text-white/50 text-sm mt-1">
              See exactly what each AI model saw during this review
            </p>
          </div>
          <div className="px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-sm font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            PII Protection Active
          </div>
        </div>

        {/* Explainer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: '📷', step: '1', title: 'Documents uploaded', desc: 'Your files are stored locally on-premise — no cloud storage.' },
            { icon: '🔍', step: '2', title: 'Vision AI reads documents', desc: 'The OCR model extracts raw text and fields, including personal identifiers.' },
            { icon: '🛡️', step: '3', title: 'PII scrubbed before analysis', desc: 'Names, numbers and balances are replaced with anonymised summaries before the gap analyser ever sees them.' },
          ].map(item => (
            <div key={item.step} className="rounded-2xl border border-white/10 bg-white/5 p-5 flex gap-3">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="text-xs text-white/40 mb-1">Step {item.step}</p>
                <p className="font-semibold text-white text-sm mb-1">{item.title}</p>
                <p className="text-xs text-white/55 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* PII comparison — uses real scrubbed data from this review */}
        {scrubbed.length > 0 ? (
          <PIIComparison scrubbed={scrubbed} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
            No scrubbed data available for this review.
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 pt-4 border-t border-white/10">
          <Link href={`/results/${id}`} className="px-5 py-2.5 rounded-xl border border-white/20 text-white/60 text-sm hover:bg-white/5 transition-colors">
            ← Back to Results
          </Link>
          <a
            href={`/api/reviews/${id}/report.pdf`}
            download
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            ⬇ Download PDF Report
          </a>
        </div>
      </div>
    </main>
  );
}
