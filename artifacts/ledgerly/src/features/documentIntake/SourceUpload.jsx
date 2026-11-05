import { useRef, useState } from 'react';
import { Camera, FileUp, Upload, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACCEPTED_FILES } from './model.mjs';

/** File choice and drop share the same permission gate and native validation queue. */
export function selectSourceFiles(files, { canManage, busy, onSelect }) {
  const selected = Array.from(files || []);
  if (!canManage || busy || !selected.length) return false;
  onSelect(selected);
  return true;
}

export function dropSourceFiles(event, options) {
  // A denied drop must not navigate away or pass file bytes to the upload queue.
  event.preventDefault();
  event.stopPropagation();
  return selectSourceFiles(event.dataTransfer?.files, options);
}

export default function SourceUpload({ canManage, busy, loading, error, batchError, onSelect }) {
  const files = useRef(null);
  const camera = useRef(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const selection = { canManage, busy, onSelect };
  const choose = event => {
    selectSourceFiles(event.target.files, selection);
    event.target.value = '';
  };
  return <section className="workspace-hero grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]" aria-label="Upload supplier files">
    <div className="flex flex-col justify-center">
      <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-white/70 px-3 py-1.5 text-xs font-medium text-primary"><FileUp className="h-3.5 w-3.5" aria-hidden="true" />Invoices &amp; supplier credits</span>
      <h2 className="max-w-sm text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">Less paperwork.<br />A clearer place to start.</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">Add your files here, prepare the details and review a draft. Every original stays linked to its document.</p>
      <ol className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-xs font-medium" aria-label="Capture steps">{['Add files', 'Check details', 'Save a draft'].map((step, index) => <li key={step} className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/20 bg-white text-primary">{index + 1}</span>{step}</li>)}</ol>
    </div>
    <div className={`flex min-h-56 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition-colors sm:p-7 ${dragging ? 'border-primary bg-white' : 'border-primary/25 bg-white/65'}`}
      onDragEnter={event => { event.preventDefault(); depth.current++; if (canManage && !busy) setDragging(true); }}
      onDragOver={event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = canManage && !busy ? 'copy' : 'none'; }}
      onDragLeave={event => { event.preventDefault(); depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false); }}
      onDrop={event => { depth.current = 0; setDragging(false); dropSourceFiles(event, selection); }}>
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary shadow-sm"><Upload className="h-6 w-6" aria-hidden="true" /></span>
      <p className="font-semibold">{busy ? 'Your files are uploading' : dragging ? 'Drop your files here' : 'Drop files here to get started'}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">PDF, JPG or PNG · up to 5 MiB per file<br />Up to 10 files in the queue, uploaded one at a time.</p>
      {canManage ? <>
        <div className="mt-5 flex w-full flex-wrap justify-center gap-2">
          <Button type="button" disabled={busy} className="min-h-11" onClick={() => files.current?.click()}><FileUp aria-hidden="true" />Choose files</Button>
          <Button type="button" disabled={busy} variant="outline" className="min-h-11 bg-white" onClick={() => camera.current?.click()}><Camera aria-hidden="true" />Take a photo</Button>
        </div>
        <input ref={files} className="sr-only" tabIndex={-1} aria-label="Choose source files" type="file" multiple accept={ACCEPTED_FILES} disabled={busy} onChange={choose} />
        <input ref={camera} className="sr-only" tabIndex={-1} aria-label="Take a source photo or choose an image" type="file" accept="image/jpeg,image/png" capture="environment" disabled={busy} onChange={choose} />
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Photo opens your camera when supported, or an image picker. Use JPG or PNG.</p>
      </> : <p className="mt-4 text-sm text-muted-foreground">{loading ? 'Checking upload permissions…' : error ? 'Upload permissions could not be verified. Retry below.' : 'You can view source files. Uploading and preparing drafts require editing permission.'}</p>}
      {batchError && <p role="alert" className="mt-3 text-sm text-destructive">{batchError}</p>}
    </div>
    <p className="flex items-start gap-2 border-t border-primary/10 pt-4 text-xs leading-5 text-muted-foreground lg:col-span-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span>Automatic extraction: not connected. Email intake: not connected. Enter and check the details before saving; nothing is posted automatically.</span></p>
  </section>;
}
