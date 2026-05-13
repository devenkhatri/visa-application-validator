'use client';
import { useState, useEffect, useTransition, use } from 'react';
import { useRouter } from 'next/navigation';
import type { RawExtraction } from '@/lib/ai/types';

interface ExtractionItem {
  docId:        string;
  filename:     string;
  documentType: string;
  hash:         string;
  extraction:   RawExtraction;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  passport:          '🛂 Passport',
  bank_statement:    '🏦 Bank Statement',
  employment_letter: '💼 Employment Letter',
  photo:             '📷 Passport Photo',
  other:             '📎 Supporting Document',
};

export default function ReviewOcrPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const reviewId = resolvedParams.id;
  const router   = useRouter();

  const [items,      setItems]      = useState<ExtractionItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [isPending,  startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function loadOcrData() {
      try {
        const res = await fetch(`/api/reviews/${reviewId}/ocr-extract`, {
          method: 'POST',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(data.error || 'Failed to extract document data');
        }
        const data = await res.json() as { extractions: ExtractionItem[] };
        if (cancelled) return;

        // Ensure extracted_fields is always a mutable record object
        const cleaned = (data.extractions || []).map(item => ({
          ...item,
          extraction: {
            ...item.extraction,
            extracted_fields: item.extraction?.extracted_fields ? { ...item.extraction.extracted_fields } : {},
            document_validity: item.extraction?.document_validity ? { ...item.extraction.document_validity } : { expiry_date: null, is_expired: false },
          },
        }));

        setItems(cleaned);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setLoading(false);
      }
    }
    void loadOcrData();
    return () => { cancelled = true; };
  }, [reviewId]);

  function handleFieldChange(itemIdx: number, fieldKey: string, newValue: string) {
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[itemIdx] };
      target.extraction = {
        ...target.extraction,
        extracted_fields: {
          ...target.extraction.extracted_fields,
          [fieldKey]: newValue,
        },
      };
      copy[itemIdx] = target;
      return copy;
    });
  }

  function handleValidityDateChange(itemIdx: number, newDate: string) {
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[itemIdx] };
      target.extraction = {
        ...target.extraction,
        document_validity: {
          ...target.extraction.document_validity,
          expiry_date: newDate || null,
        },
      };
      copy[itemIdx] = target;
      return copy;
    });
  }

  function handleAddNewField(itemIdx: number) {
    const key = prompt('Enter new field label (e.g. surname, balance):');
    if (!key) return;
    const cleanKey = key.toLowerCase().replace(/\s+/g, '_');
    handleFieldChange(itemIdx, cleanKey, '');
  }

  function handleDeleteField(itemIdx: number, fieldKey: string) {
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[itemIdx] };
      const fields = { ...target.extraction.extracted_fields };
      delete fields[fieldKey];
      target.extraction = { ...target.extraction, extracted_fields: fields };
      copy[itemIdx] = target;
      return copy;
    });
  }

  async function handleSubmitCorrections() {
    startTransition(async () => {
      try {
        const payload = items.map(i => i.extraction);
        const res = await fetch(`/api/reviews/${reviewId}/analyse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extractions: payload }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          alert(`Submission failed: ${err.error || res.statusText}`);
          return;
        }

        router.push(`/processing/${reviewId}`);
      } catch (err) {
        alert('Network error submitting verified fields.');
        console.error(err);
      }
    });
  }

  const activeItem = items[activeIdx];

  return (
    <main className="min-h-screen bg-[#080c1a] text-white px-4 py-8 md:py-12">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Step sequence indicator */}
        <div className="flex items-center gap-1.5 text-xs text-white/40 overflow-x-auto pb-2 justify-center max-w-2xl mx-auto">
          <span className="w-5 h-5 shrink-0 rounded-full bg-green-600/80 text-white flex items-center justify-center font-bold text-[10px]">✓</span>
          <span className="text-white/30 shrink-0">Visa Type</span>
          <span className="w-3 h-px bg-white/10 shrink-0" />
          <span className="w-5 h-5 shrink-0 rounded-full bg-green-600/80 text-white flex items-center justify-center font-bold text-[10px]">✓</span>
          <span className="text-white/30 shrink-0">Upload Docs</span>
          <span className="w-3 h-px bg-white/10 shrink-0" />
          <span className="w-5 h-5 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">3</span>
          <span className="text-white/70 font-medium shrink-0">Review OCR</span>
          <span className="w-3 h-px bg-white/10 shrink-0" />
          <span className="w-5 h-5 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-[10px]">4</span>
          <span className="shrink-0">Processing</span>
          <span className="w-3 h-px bg-white/10 shrink-0" />
          <span className="w-5 h-5 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-[10px]">5</span>
          <span className="shrink-0">Results</span>
        </div>

        {/* Page Title */}
        <div className="text-center max-w-xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Review & Correct OCR Text</h1>
          <p className="text-white/50 text-xs md:text-sm">
            Verify extracted spelling values against original parsed layout logic. Fix any small discrepancies before passing content to AI gap analysis.
          </p>
        </div>

        {/* Loading display */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4 border border-white/5 rounded-2xl bg-white/[0.02]">
            <svg className="w-10 h-10 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="text-sm font-medium text-white/70">Extracting text layout & parameters via active OCR models...</p>
            <p className="text-xs text-white/30 max-w-xs text-center">First scans download model cache arrays. Subsequent repeated document scans use lightning MD5 hashes instantly.</p>
          </div>
        )}

        {/* Error box */}
        {error && (
          <div className="max-w-md mx-auto p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center space-y-4">
            <p className="text-sm text-red-400 font-medium">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-500 transition-colors"
            >
              Retry Extractions
            </button>
          </div>
        )}

        {/* Interactive content array area */}
        {!loading && !error && items.length > 0 && (
          <div className="space-y-6">
            {/* Tabs selection bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/10">
              {items.map((item, idx) => {
                const label = DOC_TYPE_LABELS[item.documentType] || item.documentType;
                return (
                  <button
                    key={item.docId}
                    onClick={() => setActiveIdx(idx)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-2 ${
                      idx === activeIdx
                        ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/20'
                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="max-w-[100px] truncate opacity-50 text-[10px] font-normal">({item.filename})</span>
                    {idx === activeIdx && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  </button>
                );
              })}
            </div>

            {/* Currently Selected Document View Panels */}
            {activeItem && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Editable Structured Fields List (Left side) */}
                <div className="lg:col-span-7 space-y-4 p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div>
                      <h2 className="text-sm font-bold text-white">Extracted Key-Value Fields</h2>
                      <p className="text-[11px] text-white/40">Edit spelling anomalies below</p>
                    </div>
                    <button
                      onClick={() => handleAddNewField(activeIdx)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-blue-400 text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <span>+</span> Add Custom Field
                    </button>
                  </div>

                  {Object.keys(activeItem.extraction.extracted_fields || {}).length === 0 ? (
                    <p className="text-xs text-white/30 italic py-4 text-center">No structured properties pre-detected. Click 'Add Custom Field' above to assign values manually.</p>
                  ) : (
                    <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                      {Object.entries(activeItem.extraction.extracted_fields || {}).map(([key, val]) => (
                        <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 bg-black/20 p-2.5 rounded-xl border border-white/5">
                          <label className="text-xs font-medium text-blue-300 sm:w-1/3 truncate" title={key}>
                            {key.toUpperCase().replace(/_/g, ' ')}
                          </label>
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={val !== null && val !== undefined ? String(val) : ''}
                              onChange={e => handleFieldChange(activeIdx, key, e.target.value)}
                              placeholder="Empty / null value"
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                            <button
                              onClick={() => handleDeleteField(activeIdx, key)}
                              className="text-white/20 hover:text-red-400 p-1 text-xs transition-colors"
                              title="Delete field"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Document validity override parameter block */}
                  <div className="pt-3 border-t border-white/10">
                    <label className="block text-xs font-medium text-white/60 mb-1.5">
                      Parsed Expiration Date (YYYY-MM-DD)
                    </label>
                    <input
                      type="date"
                      value={activeItem.extraction.document_validity?.expiry_date || ''}
                      onChange={e => handleValidityDateChange(activeIdx, e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all w-full sm:w-1/2"
                    />
                  </div>

                  {/* Document specific engine parameters logging badge */}
                  <div className="flex items-center justify-between text-[11px] text-white/30 pt-2">
                    <span>Engine: <strong className="text-white/50">{activeItem.extraction.ocr_engine || 'vision model'}</strong></span>
                    <span>Confidence Score: <strong className="text-emerald-400">{(activeItem.extraction.confidence_score * 100).toFixed(0)}%</strong></span>
                  </div>
                </div>

                {/* Raw OCR layout preview tab stream (Right side) */}
                <div className="lg:col-span-5 space-y-3 p-5 rounded-2xl bg-black/40 border border-white/5">
                  <div>
                    <h2 className="text-sm font-bold text-white/80">Original OCR Layout Text</h2>
                    <p className="text-[11px] text-white/40">Use as raw character reference</p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 max-h-[450px] overflow-y-auto font-mono text-[11px] leading-relaxed text-white/60 whitespace-pre-wrap select-all">
                    {activeItem.extraction.raw_text ? activeItem.extraction.raw_text : (
                      <span className="italic text-white/20">No unstructured plain text stream rendered. Multimodal structural output maps field variables directly.</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom action bar */}
            <div className="pt-6 border-t border-white/10 flex flex-col items-center justify-center gap-3">
              <button
                onClick={handleSubmitCorrections}
                disabled={isPending}
                className="w-full max-w-md py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/10 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Submitting Verified Properties…
                  </>
                ) : (
                  'Confirm Corrections & Run Gap Analysis →'
                )}
              </button>
              <p className="text-[11px] text-white/30 text-center max-w-sm">
                Verified attributes will instantly map through your chosen visa checklist criteria using secure scrubbed payload containers.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
