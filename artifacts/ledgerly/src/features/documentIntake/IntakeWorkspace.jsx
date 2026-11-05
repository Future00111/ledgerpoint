import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { documentIntake } from '@/api/documentIntake.mjs';
import { Button } from '@/components/ui/button';
import { ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';
import { readCaptureFile, validateBatch, validateCaptureFile } from './model.mjs';
import { SourceCard, SourceRow, RequestedSource, SourceActions } from './SourceFiles';
import SourceUpload from './SourceUpload';
import { Search, RefreshCw, FileCheck2, Inbox } from 'lucide-react';
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
  const groups = status === 'all'
    ? [{ key: 'prepare', label: 'Ready to prepare', description: 'Choose whether each file is a bill or a supplier credit.', sources: visibleSources.filter(source => !source.document_id) },
       { key: 'linked', label: 'Linked to documents', description: 'Reopen the document or download its original source.', sources: visibleSources.filter(source => source.document_id) }]
    : [{ key: status, label: status === 'prepare' ? 'Ready to prepare' : 'Linked to documents', sources: visibleSources }];
  return <div className="space-y-6">
    <PageHeader eyebrow="Documents" title="Your document inbox" description="One place for supplier paperwork, from upload to a reviewed draft." />
    <SourceUpload canManage={canManage} busy={active} loading={state.loading} error={state.error} batchError={batchError} onSelect={onSelect} />
    <UploadQueue items={items} canManage={canManage} onRetry={onRetry} onRemove={onRemove} />
    {highlighted && !visibleSources.some(source => source.id === highlighted) && (selectedSource ? <SourceCard companyId={companyId} source={selectedSource} canManage={canManage} highlighted /> : <RequestedSource key={`${companyId}:${highlighted}`} companyId={companyId} sourceId={highlighted} />)}
    <section className="workspace-panel" aria-label="Native source files">
      <div className="workspace-panel-header"><div><h2 className="workspace-section-title">Source files</h2><p className="mt-1 text-xs text-muted-foreground">Latest 100 uploads. An older source opens directly from its capture link.</p></div><Button type="button" variant="ghost" className="min-h-11" disabled={state.loading} onClick={state.refresh}><RefreshCw className="h-4 w-4" aria-hidden="true" />Refresh</Button></div>
      <div className="flex flex-col justify-between gap-4 border-b px-5 py-4 sm:px-6 lg:flex-row lg:items-center">
        <div role="group" aria-label="Source file status" className="workspace-segmented w-fit">{[['all', 'All files'], ['prepare', 'Needs preparing'], ['linked', 'Linked documents']].map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{label}<span className="ml-2 text-xs tabular-nums">{state.data ? filterSources(sources, '', value).length : '—'}</span></button>)}</div>
        <div className="relative w-full lg:max-w-xs"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input aria-label="Search source filenames" placeholder="Find a file…" className="h-11 bg-background pl-9" value={search} onChange={event => setSearch(event.target.value)} /></div>
      </div>
      {state.error && <div className="p-5"><ErrorBox error={state.error} onRetry={state.refresh} /></div>}
      {state.loading && !state.data ? <div className="p-5"><SkeletonRows rows={3} /></div> : visibleSources.length ? groups.filter(group => group.sources.length).map(group => <section key={group.key} aria-label={group.label}>
        <div className="flex items-center gap-2 border-b bg-muted/35 px-5 py-3 sm:px-6">{group.key === 'prepare' ? <Inbox className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <FileCheck2 className="h-4 w-4 text-primary" aria-hidden="true" />}<h3 className="text-xs font-semibold">{group.label}</h3><span className="text-xs text-muted-foreground">{group.sources.length}</span></div>
        <div className="divide-y">{group.sources.map(source => <SourceRow key={source.id} companyId={companyId} source={source} canManage={canManage} highlighted={source.id === highlighted} />)}</div>
      </section>) : !state.error && <EmptyState icon={Inbox} title={sources.length ? 'No files match this view' : 'A clear inbox starts here'} description={sources.length ? 'Try another filename or status.' : 'Add your first supplier invoice or credit above. Your original files and linked drafts will appear here.'} action={sources.length ? <Button type="button" variant="outline" onClick={() => { setSearch(''); setStatus('all'); }}>Show all files</Button> : null} />}
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
