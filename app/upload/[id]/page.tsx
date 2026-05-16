'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { PersonalisedChecklist, ChecklistItem } from '@/lib/ai/types';

const DOC_TYPES = [
  { value: 'passport',          label: '🛂 Passport',           accept: '.jpg,.jpeg,.png,.pdf' },
  { value: 'bank_statement',    label: '🏦 Bank Statement',      accept: '.pdf' },
  { value: 'employment_letter', label: '💼 Employment Letter',   accept: '.pdf' },
  { value: 'photo',             label: '📷 Passport Photo',      accept: '.jpg,.jpeg,.png' },
  { value: 'other',             label: '📎 Supporting Document', accept: '.jpg,.jpeg,.png,.pdf' },
];

interface UploadedFile {
  id:        string;
  name:      string;
  size:      number;
  type:      string;
  docType:   string;
  status:    'uploading' | 'done' | 'error';
  errorMsg?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function PriorityBadge({ priority }: { priority: ChecklistItem['priority'] }) {
  const styles = {
    required:    'bg-red-500/20 text-red-400 border border-red-500/30',
    recommended: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    optional:    'bg-white/10 text-white/50 border border-white/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${styles[priority]}`}>
      {priority}
    </span>
  );
}

export default function UploadPage() {
  const router   = useRouter();
  const params   = useParams<{ id: string }>();
  const reviewId = params.id;

  const [files,     setFiles]     = useState<UploadedFile[]>([]);
  const [dragOver,  setDragOver]  = useState(false);
  const [running,   setRunning]   = useState(false);
  const [docType,   setDocType]   = useState('passport');
  const [checklist, setChecklist] = useState<PersonalisedChecklist | null>(null);

  // Fetch personalised checklist on mount (may not exist if user skipped questionnaire)
  useEffect(() => {
    fetch(`/api/reviews/${reviewId}/questionnaire`)
      .then(r => r.json())
      .then((data: { checklist: PersonalisedChecklist | null }) => {
        if (data.checklist) {
          const cl = data.checklist as unknown as PersonalisedChecklist;
          setChecklist(cl);
        }
      })
      .catch(() => { /* silently ignore — checklist is optional */ });
  }, [reviewId]);

  const uploadFile = useCallback(async (file: File, documentType: string) => {
    const tempId = crypto.randomUUID();
    const entry: UploadedFile = {
      id:      tempId,
      name:    file.name,
      size:    file.size,
      type:    file.type,
      docType: documentType,
      status:  'uploading',
    };

    setFiles(prev => [...prev, entry]);

    const form = new FormData();
    form.append('file',         file);
    form.append('documentType', documentType);

    try {
      const res = await fetch(`/api/reviews/${reviewId}/documents`, {
        method: 'POST',
        body:   form,
      });

      if (!res.ok) {
        const err = await res.json() as { error: string };
        setFiles(prev => prev.map(f =>
          f.id === tempId ? { ...f, status: 'error', errorMsg: err.error } : f
        ));
        return;
      }

      setFiles(prev => prev.map(f =>
        f.id === tempId ? { ...f, status: 'done' } : f
      ));
    } catch {
      setFiles(prev => prev.map(f =>
        f.id === tempId ? { ...f, status: 'error', errorMsg: 'Upload failed' } : f
      ));
    }
  }, [reviewId]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    Array.from(fileList).forEach(f => uploadFile(f, docType));
  }

  async function handleRunReview() {
    const uploaded = files.filter(f => f.status === 'done');
    if (uploaded.length === 0) return;

    setRunning(true);
    try {
      // Start the background pipeline
      await fetch(`/api/reviews/${reviewId}/start`, { method: 'POST' });
      router.push(`/processing/${reviewId}`);
    } catch {
      setRunning(false);
    }
  }

  const doneCount = files.filter(f => f.status === 'done').length;
  const requiredItems = checklist?.checklist_items?.filter(i => i.priority === 'required') ?? [];

  return (
    <main className="min-h-screen bg-[#080c1a] text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Step indicator */}
        <div className="flex items-center gap-1.5 text-xs text-white/40 overflow-x-auto pb-2">
          {[
            { n: 1, label: 'Select Visa',    done: true  },
            { n: 2, label: 'Questionnaire',  done: true  },
            { n: 3, label: 'Checklist',      done: true  },
            { n: 4, label: 'Upload',         done: false, active: true },
            { n: 5, label: 'Processing',     done: false },
            { n: 6, label: 'Results',        done: false },
          ].map((s, i, arr) => (
            <span key={s.n} className="flex items-center gap-1.5 shrink-0">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                s.done   ? 'bg-green-600/80 text-white' :
                s.active ? 'bg-blue-600 text-white'     :
                           'bg-white/10 text-white/40'
              }`}>{s.done ? '✓' : s.n}</span>
              <span className={s.active ? 'text-white/70 font-medium' : 'text-white/30'}>{s.label}</span>
              {i < arr.length - 1 && <span className="w-3 h-px bg-white/10" />}
            </span>
          ))}
        </div>

        <div>
          <h1 className="text-2xl font-bold mb-1">Upload your documents</h1>
          <p className="text-white/50 text-sm">PDF, JPG, PNG accepted — max 10 MB per file</p>
        </div>

        {/* Personalised checklist summary (if available) */}
        {checklist && checklist.checklist_items?.length > 0 && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
            <div className="px-5 py-3 border-b border-blue-500/15 flex items-center gap-2">
              <span className="text-blue-400 text-sm">✨</span>
              <p className="text-sm font-semibold text-blue-300">Your personalised document checklist</p>
              <span className="ml-auto text-xs text-blue-400/60">{checklist.checklist_items.length} documents</span>
            </div>
            <div className="divide-y divide-white/5">
              {checklist.checklist_items.map((item, i) => (
                <div key={i} className="px-5 py-3 flex items-start gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold ${
                    item.priority === 'required'    ? 'bg-red-500/20 text-red-400' :
                    item.priority === 'recommended' ? 'bg-amber-500/20 text-amber-400' :
                                                      'bg-white/10 text-white/40'
                  }`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white">{item.document}</p>
                      <PriorityBadge priority={item.priority} />
                      <span className="ml-auto text-xs font-bold text-emerald-400">+{item.score_impact} pts</span>
                    </div>
                    <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Document type selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/70" htmlFor="doc-type-select">
            Document type for next upload
          </label>
          <select
            id="doc-type-select"
            value={docType}
            onChange={e => setDocType(e.target.value)}
            className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          >
            {DOC_TYPES.map(t => (
              <option key={t.value} value={t.value} className="bg-[#0f1629]">
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Drop zone */}
        <label
          htmlFor="file-input"
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all duration-200 ${
            dragOver
              ? 'border-blue-400 bg-blue-500/10'
              : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/8'
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        >
          <div className="text-4xl">📁</div>
          <div className="text-center">
            <p className="font-semibold text-white">Drop files here or click to browse</p>
            <p className="text-sm text-white/40 mt-1">
              {DOC_TYPES.find(t => t.value === docType)?.label} · PDF / JPG / PNG
            </p>
          </div>
          <input
            id="file-input"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
        </label>

        {/* Uploaded files list */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map(f => (
              <div
                key={f.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  f.status === 'done'  ? 'border-green-500/30 bg-green-500/10' :
                  f.status === 'error' ? 'border-red-500/30 bg-red-500/10'    :
                                         'border-white/10 bg-white/5'
                }`}
              >
                <span className="text-xl">
                  {f.status === 'done'  ? '✅' :
                   f.status === 'error' ? '❌' : '⏳'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{f.name}</p>
                  <p className="text-xs text-white/40">
                    {DOC_TYPES.find(t => t.value === f.docType)?.label} · {formatBytes(f.size)}
                    {f.errorMsg && <span className="text-red-400 ml-2">{f.errorMsg}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Run button */}
        {requiredItems.length > 0 && doneCount === 0 && (
          <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
            ⚠️ Upload at least 1 document to run the AI review. Your checklist requires {requiredItems.length} required document{requiredItems.length !== 1 ? 's' : ''}.
          </p>
        )}

        <button
          id="run-review-btn"
          onClick={handleRunReview}
          disabled={doneCount === 0 || running}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {running ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Starting AI Review…
            </>
          ) : (
            `Run AI Review${doneCount > 0 ? ` (${doneCount} file${doneCount !== 1 ? 's' : ''})` : ''} →`
          )}
        </button>
      </div>
    </main>
  );
}
