'use client';
import { useEffect, useState } from 'react';

interface ProcessingStepsProps {
  reviewId: string;
  onComplete: () => void;
  onFailed:   () => void;
}

interface Step {
  id:      string;
  label:   string;
  done:    string;
  pending: string;
}

const STEPS: Step[] = [
  { id: 'received',   label: 'Documents received',                              done: 'Documents received',                              pending: 'Waiting...' },
  { id: 'ocr-start',  label: 'Extracting text with vision AI...',              done: 'OCR started',                                     pending: 'Extracting text with vision AI...' },
  { id: 'ocr-done',   label: 'OCR complete',                                   done: 'OCR complete — documents read',                   pending: 'Reading documents...' },
  { id: 'scrub',      label: 'Scrubbing personal data before AI analysis...', done: 'PII scrubbed — passport numbers & balances removed', pending: 'Scrubbing personal data before AI analysis...' },
  { id: 'analyse',    label: 'Analysing against visa checklist...',            done: 'Analysis complete',                               pending: 'Analysing against visa checklist...' },
  { id: 'report',     label: 'Generating report...',                           done: 'Report generated',                               pending: 'Generating report...' },
  { id: 'done',       label: 'Done',                                           done: '✨ Review complete',                             pending: 'Finalising...' },
];

type StepStatus = 'done' | 'active' | 'pending';

// Map backend review status → how many steps are "done"
function statusToSteps(status: string): number {
  switch (status) {
    case 'pending':    return 1;
    case 'processing': return 4; // OCR + scrub in progress
    case 'completed':  return STEPS.length;
    case 'failed':     return -1;
    default:           return 0;
  }
}

export default function ProcessingSteps({ reviewId, onComplete, onFailed }: ProcessingStepsProps) {
  const [doneCount, setDoneCount]   = useState(1);
  const [error,     setError]       = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (cancelled) return;
      try {
        const res  = await fetch(`/api/reviews/${reviewId}/status`, { cache: 'no-store' });
        const data = await res.json() as { status: string };

        if (data.status === 'completed') {
          setDoneCount(STEPS.length);
          setTimeout(onComplete, 800);
          return;
        }
        if (data.status === 'failed') {
          setError(true);
          onFailed();
          return;
        }

        // Simulate step ticks while processing
        setDoneCount(prev => Math.min(prev + 1, STEPS.length - 1));
        timer = setTimeout(poll, 2000);
      } catch {
        timer = setTimeout(poll, 3000);
      }
    }

    timer = setTimeout(poll, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [reviewId, onComplete, onFailed]);

  return (
    <div className="space-y-3 w-full max-w-lg mx-auto">
      {STEPS.map((step, i) => {
        const status: StepStatus =
          i < doneCount  ? 'done'   :
          i === doneCount ? 'active' : 'pending';

        return (
          <div
            key={step.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl transition-all duration-500 ${
              status === 'done'   ? 'bg-green-500/10 border border-green-500/20' :
              status === 'active' ? 'bg-blue-500/10 border border-blue-400/30 animate-pulse' :
                                    'bg-white/5 border border-white/5 opacity-40'
            }`}
          >
            {/* Icon */}
            <span className="text-lg mt-0.5 shrink-0">
              {status === 'done'   ? '✅' :
               status === 'active' ? '⏳' : '○'}
            </span>

            {/* Label */}
            <span className={`text-sm leading-snug ${
              status === 'done'   ? 'text-green-400 font-medium' :
              status === 'active' ? 'text-blue-300 font-medium'  :
                                    'text-white/30'
            }`}>
              {status === 'done' ? step.done : step.label}
            </span>
          </div>
        );
      })}

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          Review failed. Please try again.
        </div>
      )}
    </div>
  );
}
