import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { documentIntake } from '@/api/documentIntake.mjs';
import { Button } from '@/components/ui/button';
import { ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';
import { ACCEPTED_FILES, readCaptureFile, validateBatch, validateCaptureFile } from './model.mjs';
import { SourceCard, RequestedSource, SourceActions } from './SourceFiles';
import { useIntakeSources } from './useDocumentIntake';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/workspace/PageHeader';
import EmptyState from '@/components/workspace/EmptyState';
import { filterSources } from './presentation.mjs';

export function UploadQueue({ items, canManage, onRetry, onRemove }) {
  if (!items.length) return null;
  return <section aria-label="Upload queue" className="rounded-xl border p-4"><h2 className="font-semibold">Upload queue</h2><ul className="mt-2 divide-y">{items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{item.file.name}</p><p className="mt-1 text-xs text-muted-foreground" role="status">{item.status === 'queued' ? 'Waiting to upload' : item.status === 'reading' ? `Reading file · ${item.progress}%` : item.status === 'uploading' ? 'Uploading file…' : item.status === 'done' ? item.duplicate ? 'Already uploaded · existing source retained' : 'Uploaded · ready to prepare' : item.error}</p>{['reading', 'uploading'].includes(item.status) && <progress aria-label={`Upload progress for ${item.file.name}`} className="mt-2 h-2 w-full max-w-xs" max="100" {...(item.status === 'reading' ? { value: item.progress } : {})} />}</div><div className="flex flex-wrap gap-2">{item.source && <SourceActions source={item.source} canManage={canManage} compact />}{item.status === 'error' && item.retryable && canManage && <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => onRetry(item.id)}>Retry upload</Button>}{['done', 'error'].includes(item.status) && <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.file.name} from queue`}>Clear</Button>}</div></li>)}</ul></section>;
}

export function IntakeWorkspaceView({ companyId, state, items, batchError, onSelect, onRetry, onRemove, highlighted }) {
  const canManage = state.data?.can_manage === true && !state.error;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const sources = state.data?.sources ?? [];
  const visibleSources = filterSources(sources, search, status);
  const selectedSource = sources.find(source => source.id === highlighted);
  const active = items.some(item => ['queued', 'reading', 'uploading'].includes(item.status));
  return <div className="space-y-5">
    <PageHeader eyebrow="Purchases · Documents" title="Your document inbox" description="Upload supplier invoices and credits, then prepare their accounting drafts." />
    <section className="workspace-card space-y-4 p-5" aria-label="Upload supplier files"><div><h2 className="font-semibold">Add invoices and supplier credits</h2><p className="mt-1 text-sm text-muted-foreground">PDF, JPG or PNG · up to 5 MiB per file · up to 10 files in the queue. Files upload one at a time.</p></div><p className="rounded-lg bg-muted/50 p-3 text-sm">Automatic extraction: not connected. Email intake: not connected. Upload a file, then enter and review its details in the native bill or supplier credit form.</p>
      {canManage ? <label className="block text-sm font-medium">Choose source files<input type="file" multiple accept={ACCEPTED_FILES} disabled={active} className="mt-2 block w-full rounded-lg border p-3 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground" onChange={event => { onSelect(Array.from(event.target.files || [])); event.target.value = ''; }} /></label> : <p className="text-sm text-muted-foreground">{state.loading ? 'Checking upload permissions…' : state.error ? 'Upload permissions could not be verified. Retry below.' : 'You can view source files. Uploading and preparing drafts require editing permission.'}</p>}
      {batchError && <p role="alert" className="text-sm text-destructive">{batchError}</p>}
    </section>
    <UploadQueue items={items} canManage={canManage} onRetry={onRetry} onRemove={onRemove} />
    {highlighted && !visibleSources.some(source => source.id === highlighted) && (selectedSource ? <SourceCard companyId={companyId} source={selectedSource} canManage={canManage} highlighted /> : <RequestedSource key={`${companyId}:${highlighted}`} companyId={companyId} sourceId={highlighted} />)}
    <section className="space-y-4" aria-label="Native source files">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Source files</h2><p className="mt-1 text-sm text-muted-foreground">Latest 100 uploads. An older source opens directly from its capture link.</p></div><Button type="button" variant="outline" className="min-h-11" disabled={state.loading} onClick={state.refresh}>Refresh</Button></div>
      <div className="flex flex-wrap items-center gap-3"><Input aria-label="Search source filenames" placeholder="Find a file by name…" className="min-h-11 sm:max-w-sm" value={search} onChange={event => setSearch(event.target.value)} /><div role="group" aria-label="Source file status" className="flex flex-wrap gap-2">{[['all', 'All files'], ['prepare', 'Needs preparing'], ['linked', 'Linked documents']].map(([value, label]) => <Button key={value} type="button" variant={status === value ? 'secondary' : 'outline'} className="min-h-11" aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</Button>)}</div></div>
      <ErrorBox error={state.error} onRetry={state.refresh} />
      {state.loading && !state.data ? <SkeletonRows rows={3} /> : visibleSources.length ? visibleSources.map(source => <SourceCard key={source.id} companyId={companyId} source={source} canManage={canManage} highlighted={source.id === highlighted} />) : !state.error && <div className="workspace-card"><EmptyState title={sources.length ? 'No files match this view' : 'Your supplier files will appear here'} description={sources.length ? 'Try another filename or status.' : 'Upload a supplier invoice or credit to get started.'} action={sources.length ? <Button type="button" variant="outline" onClick={() => { setSearch(''); setStatus('all'); }}>Show all files</Button> : null} /></div>}
    </section>
  </div>;
}

/** Key this workspace by company so file bytes can never migrate into another company queue. */
export default function IntakeWorkspace({ companyId }) {
  const [params] = useSearchParams();
  const state = useIntakeSources(companyId);
  const [items, setItems] = useState([]);
  const [batchError, setBatchError] = useState(null);
  const running = useRef(null);
  const mounted = useRef(false);
  const counter = useRef(0);
  const latestCompany = useRef(companyId); latestCompany.current = companyId;
  const canManage = state.data?.can_manage === true && !state.error;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; running.current?.abort(); }; }, []);
  useEffect(() => {
    if (running.current || !canManage) return;
    const item = items.find(candidate => candidate.status === 'queued');
    if (!item) return;
    const controller = new AbortController(); running.current = controller;
    const current = () => mounted.current && !controller.signal.aborted && latestCompany.current === companyId;
    const patch = values => { if (current()) setItems(previous => previous.map(candidate => candidate.id === item.id ? { ...candidate, ...values } : candidate)); };
    (async () => {
      try {
        patch({ status: item.payload ? 'uploading' : 'reading', progress: 0 });
        const payload = item.payload || await readCaptureFile(item.file, { signal: controller.signal, onProgress: progress => patch({ progress }) });
        if (!current()) return;
        patch({ status: 'uploading', payload });
        const result = await documentIntake.upload(companyId, payload, controller.signal);
        if (!result?.source?.id || typeof result.duplicate !== 'boolean') throw new Error('The upload result could not be verified. Retry the same file.');
        if (!current()) return;
        patch({ status: 'done', source: result.source, duplicate: result.duplicate, payload: null });
        state.refresh();
      } catch (error) { patch({ status: 'error', error: error.message, retryable: true }); }
      finally { if (running.current === controller) running.current = null; if (current()) setItems(previous => [...previous]); }
    })();
  }, [items, canManage, companyId, state.refresh]);
  const select = files => {
    if (!canManage || running.current) return;
    const invalid = validateBatch(files, items.length); setBatchError(invalid);
    if (invalid) return;
    setItems(previous => [...previous, ...files.map(file => {
      const error = validateCaptureFile(file);
      return { id: ++counter.current, file, status: error ? 'error' : 'queued', error, retryable: false, progress: 0, payload: null };
    })]);
  };
  return <IntakeWorkspaceView companyId={companyId} state={state} items={items} batchError={batchError} highlighted={params.get('capture')} onSelect={select}
    onRetry={id => { if (canManage) setItems(previous => previous.map(item => item.id === id && item.retryable ? { ...item, status: 'queued', error: null } : item)); }}
    onRemove={id => setItems(previous => previous.filter(item => item.id !== id))} />;
}
