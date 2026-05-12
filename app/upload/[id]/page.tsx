'use client';
import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

const DOC_TYPES = [
  { value: 'passport',          label: '🛂 Passport',           accept: '.jpg,.jpeg,.png,.pdf' },
  { value: 'bank_statement',    label: '🏦 Bank Statement',      accept: '.pdf' },
  { value: 'employment_letter', label: '💼 Employment Letter',   accept: '.pdf' },
  { value: 'photo',             label: '📷 Passport Photo',      accept: '.jpg,.jpeg,.png' },
  { value: 'other',             label: '📎 Supporting Document', accept: '.jpg,.jpeg,.png,.pdf' },
];

interface UploadedFile {
  id:          string;
  name:        string;
  size:        number;
  type:        string;
  docType:     string;
  status:      'uploading' | 'done' | 'error';
  errorMsg?:   string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)          return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadPage() {
  const router    = useRouter();
  const params    = useParams<{ id: string }>();
  const reviewId  = params.id;

  const [files,     setFiles]     = useState<UploadedFile[]>([]);
  const [dragOver,  setDragOver]  = useState(false);
  const [running,   setRunning]   = useState(false);
  const [docType,   setDocType]   = useState('passport');

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
      await fetch(`/api/reviews/${reviewId}/start`, { method: 'POST' });
      router.push(`/processing/${reviewId}`);
    } catch {
      setRunning(false);
    }
  }

  const doneCount = files.filter(f => f.status === 'done').length;

  return (
    <main className="min-h-screen bg-[#080c1a] text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <span className="w-7 h-7 rounded-full bg-green-600/80 text-white flex items-center justify-center font-bold text-xs">✓</span>
          <span className="text-white/30">Visa Type</span>
          <span className="flex-1 h-px bg-white/10" />
          <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">2</span>
          <span className="text-white/70 font-medium">Upload Docs</span>
          <span className="flex-1 h-px bg-white/10" />
          <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs">3</span>
          <span>Processing</span>
          <span className="flex-1 h-px bg-white/10" />
          <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs">4</span>
          <span>Results</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold mb-1">Upload your documents</h1>
          <p className="text-white/50 text-sm">PDF, JPG, PNG accepted — max 10 MB per file</p>
        </div>

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
                  f.status === 'done'      ? 'border-green-500/30 bg-green-500/10' :
                  f.status === 'error'     ? 'border-red-500/30 bg-red-500/10'    :
                                             'border-white/10 bg-white/5'
                }`}
              >
                <span className="text-xl">
                  {f.status === 'done'      ? '✅' :
                   f.status === 'error'     ? '❌' : '⏳'}
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
