'use client';
import { useRouter, useParams } from 'next/navigation';
import { useState, useCallback } from 'react';
import ProcessingSteps from '@/components/ProcessingSteps';

export default function ProcessingPage() {
  const router   = useRouter();
  const params   = useParams<{ id: string }>();
  const reviewId = params.id;

  const [failed, setFailed] = useState(false);

  const handleComplete = useCallback(() => {
    router.push(`/results/${reviewId}`);
  }, [router, reviewId]);

  const handleFailed = useCallback(() => {
    setFailed(true);
  }, []);

  return (
    <main className="min-h-screen bg-[#080c1a] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-lg text-center space-y-10">
        {/* Animated header */}
        <div className="space-y-3">
          <div className="text-5xl">🤖</div>
          <h1 className="text-2xl font-bold">AI Review in Progress</h1>
          <p className="text-white/50 text-sm max-w-sm mx-auto">
            Your documents are being read and analysed. This usually takes 1–2 minutes.
          </p>
        </div>

        {/* Live steps */}
        <ProcessingSteps
          reviewId={reviewId}
          onComplete={handleComplete}
          onFailed={handleFailed}
        />

        {/* Failed state */}
        {failed && (
          <div className="space-y-4">
            <p className="text-red-400 text-sm">
              The review encountered an error. Please try again.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push(`/upload/${reviewId}`)}
                className="px-5 py-2.5 rounded-xl border border-white/20 text-white/70 text-sm hover:bg-white/5 transition-colors"
              >
                ← Back to Upload
              </button>
              <button
                onClick={async () => {
                  setFailed(false);
                  await fetch(`/api/reviews/${reviewId}/start`, { method: 'POST' });
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors"
              >
                Retry Review
              </button>
            </div>
          </div>
        )}

        {/* Privacy note */}
        <p className="text-xs text-white/25 max-w-xs mx-auto">
          Personal data is scrubbed before AI analysis.{' '}
          <span className="text-white/40 underline cursor-pointer"
            onClick={() => router.push(`/pii-explainer/${reviewId}`)}>
            Learn how →
          </span>
        </p>
      </div>
    </main>
  );
}
