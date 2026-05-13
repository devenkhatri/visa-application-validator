'use client';
import { useEffect, useState } from 'react';

interface ProcessingStepsProps {
  reviewId:   string;
  onComplete: () => void;
  onFailed:   () => void;
}

// Exposed from server at build time — 'local' | 'openrouter' | 'mistral'
const OCR_MODE = process.env.NEXT_PUBLIC_OCR_MODE ?? 'openrouter';

const isLocal   = OCR_MODE === 'local';
const isMistral = OCR_MODE === 'mistral';

function ocrLabel() {
  if (isLocal)   return 'OCR running locally — document stays on this machine';
  if (isMistral) return 'Extracting text with Mistral AI...';
  return 'Extracting text with vision AI...';
}

function ocrDoneLabel() {
  if (isLocal)   return 'OCR complete — documents read locally, nothing sent to internet';
  if (isMistral) return 'OCR complete — documents read via Mistral';
  return 'OCR complete — documents read';
}

function cacheCheckLabel()  { return isLocal ? 'Checking OCR cache (local + cloud)...' : 'Checking OCR cache...'; }
function cacheMissLabel()   { return isLocal ? 'Cache miss — running local OCR...' : 'Cache miss — running cloud OCR...'; }

interface Step {
  id:      string;
  label:   string;
  done:    string;
}

const STEPS: Step[] = [
  {
    id:    'received',
    label: 'Verified OCR properties mapped successfully',
    done:  'Verified OCR properties mapped',
  },
  {
    id:    'scrub',
    label: 'Scrubbing personal data before AI gap analysis...',
    done:  'PII scrubbed — sensitive IDs & balances anonymised',
  },
  {
    id:    'analyse',
    label: isLocal
      ? 'Sending anonymised summary payload to AI for gap analysis...'
      : 'Analysing application against country visa checklist...',
    done:  'Checklist gap analysis complete',
  },
  {
    id:    'report',
    label: 'Generating formatted dashboard report...',
    done:  'Report structure finalized',
  },
  {
    id:    'done',
    label: 'Finalising review session...',
    done:  '✨ Review session complete',
  },
];

type StepStatus = 'done' | 'active' | 'pending';

export default function ProcessingSteps({ reviewId, onComplete, onFailed }: ProcessingStepsProps) {
  const [doneCount, setDoneCount] = useState(1);
  const [error,     setError]     = useState(false);

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

        // Animate steps forward while polling
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
            <span className="text-lg mt-0.5 shrink-0">
              {status === 'done'   ? '✅' :
               status === 'active' ? '⏳' : '○'}
            </span>
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

      {/* Local OCR privacy badge */}
      {isLocal && (
        <div className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-emerald-400 text-xs">🔒</span>
          <p className="text-emerald-400 text-xs font-medium">
            Documents stay on this machine — OCR runs locally
          </p>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {isLocal
            ? 'Review failed. Is the local OCR service running? (python ocr-service/main.py)'
            : 'Review failed. Please try again.'}
        </div>
      )}
    </div>
  );
}
