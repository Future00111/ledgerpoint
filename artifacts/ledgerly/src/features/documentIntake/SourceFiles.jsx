import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Image, CheckCircle2, Clock3, Download } from 'lucide-react';
import { documentIntake } from '@/api/documentIntake.mjs';
import { Button } from '@/components/ui/button';
import { ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';
import { capturePath, prepareCapturePath } from './model.mjs';
import { useIntakeSources } from './useDocumentIntake';
import { sourceOpenPath } from './presentation.mjs';

export function SourceActions({ source, canManage, compact = false }) {
  if (source.document_id) return <Button asChild variant="outline" size="sm" className="min-h-11"><Link to={sourceOpenPath(source)}>Open linked document</Link></Button>;
  if (!canManage) return compact ? <Button asChild variant="outline" size="sm" className="min-h-11"><Link to={capturePath(source)}>Open source</Link></Button> : <p className="text-sm text-muted-foreground">You can view this source. Preparing a draft requires editing permission.</p>;
  return <><Button asChild size="sm" className="min-h-11"><Link to={prepareCapturePath('purchase_bill', source.id)}>Prepare bill</Link></Button><Button asChild variant="outline" size="sm" className="min-h-11"><Link to={prepareCapturePath('supplier_credit_note', source.id)}>Prepare supplier credit</Link></Button></>;
}

export function SourceDownload({ companyId, source, compact = false }) {
  const [state, setState] = useState({ busy: false, error: null });
  const latest = useRef(null);
  const key = JSON.stringify([companyId, source.id]); latest.current = key;
  const controller = useRef(null);
  useEffect(() => { setState({ busy: false, error: null }); return () => { controller.current?.abort(); }; }, [key]);
  const download = async () => {
    if (state.busy) return;
    const request = new AbortController(); controller.current = request;
    setState({ busy: true, error: null });
    try {
      const blob = await documentIntake.content(companyId, source.id, request.signal);
      if (request.signal.aborted || latest.current !== key) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = source.filename; link.rel = 'noopener';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState({ busy: false, error: null });
    } catch (error) { if (!request.signal.aborted && latest.current === key) setState({ busy: false, error }); }
  };
  return <div><Button type="button" variant={compact ? 'ghost' : 'outline'} size="sm" className="min-h-11" onClick={download} disabled={state.busy} aria-label={`Download source file ${source.filename}`}><Download className="h-4 w-4" aria-hidden="true" /><span className={compact ? 'sr-only' : undefined}>{state.busy ? 'Downloading…' : 'Download source file'}</span></Button>{state.error && <p role="alert" className="mt-1 text-xs text-destructive">{state.error.message}</p>}</div>;
}

/** Compact inbox rows retain the original source identity and native draft routes. */
export function SourceRow({ source, companyId, canManage = false, highlighted = false }) {
  const linked = Boolean(source.document_id);
  const Icon = source.media_type === 'application/pdf' ? FileText : Image;
  return <article id={`capture-${source.id}`} aria-label={`Source file ${source.filename}`} className={`grid items-center gap-4 px-5 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_auto] ${highlighted ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : 'bg-card hover:bg-muted/20'}`}>
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{source.filename}</h3><p className="mt-1 text-xs text-muted-foreground">{source.media_type === 'application/pdf' ? 'PDF' : source.media_type === 'image/png' ? 'PNG' : 'JPG'} · {Math.ceil(source.byte_length / 1024)} KiB{source.created_at ? ` · ${new Date(source.created_at).toLocaleDateString('en-GB')}` : ''}</p></div>
      <span className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs sm:inline-flex ${linked ? 'bg-primary/10 text-primary' : 'bg-amber-50 text-amber-900'}`}>{linked ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />}{linked ? 'Linked' : 'Needs preparing'}</span>
    </div>
    <div className="flex flex-wrap items-center gap-2"><SourceActions source={source} canManage={canManage} compact /><SourceDownload companyId={companyId} source={source} compact /></div>
  </article>;
}

export function SourceCard({ source, companyId, canManage = false, highlighted = false, compact = false }) {
  return <article id={`capture-${source.id}`} className={`rounded-xl border p-4 ${highlighted ? 'border-primary bg-primary/5' : 'bg-card'}`} aria-label={`Source file ${source.filename}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-medium">{source.filename}</h3><p className="mt-1 text-xs text-muted-foreground">{source.media_type} · {Math.ceil(source.byte_length / 1024)} KiB{source.created_at ? ` · ${new Date(source.created_at).toLocaleDateString('en-GB')}` : ''}</p><p className="mt-1 text-sm text-muted-foreground">{source.document_id ? 'Linked to an accounting document' : 'Uploaded · ready for manual entry'}</p></div><SourceDownload companyId={companyId} source={source} /></div>
    {!compact && <div className="mt-4 flex flex-wrap gap-2"><SourceActions source={source} canManage={canManage} /></div>}
  </article>;
}

/** A source lookup must never prevent the accounting document itself from loading. */
export default function SourceAttachments({ companyId, documentId }) {
  const state = useIntakeSources(companyId, documentId);
  if (!state.loading && !state.error && !state.data?.sources?.length) return null;
  return <section className="workspace-card space-y-3 p-5" aria-label="Source attachments"><h2 className="font-semibold">Source attachments</h2><ErrorBox error={state.error} onRetry={state.refresh} />{state.loading ? <SkeletonRows rows={1} /> : state.data?.sources?.map(source => <SourceCard key={source.id} source={source} companyId={companyId} compact />)}</section>;
}

export function RequestedSourceView({ companyId, loading, source, canManage, error, refresh }) {
  return <section className="space-y-3" aria-label="Requested source file"><h2 className="font-semibold">Selected source file</h2><ErrorBox error={error} onRetry={refresh} />{loading ? <SkeletonRows rows={1} /> : source && <SourceCard companyId={companyId} source={source} canManage={canManage === true} highlighted />}</section>;
}

/** A duplicate may be older than the bounded recent-source list. Resolve it directly. */
export function RequestedSource({ companyId, sourceId }) {
  const key = JSON.stringify([companyId, sourceId]);
  const latest = useRef(key); latest.current = key;
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ key: null, loading: true, source: null, canManage: false, error: null });
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, loading: true, source: null, canManage: false, error: null });
    documentIntake.get(companyId, sourceId, controller.signal).then(data => {
      if (!data?.source?.id || typeof data.can_manage !== 'boolean') throw new Error('This source file could not be verified.');
      if (!controller.signal.aborted && latest.current === key) setState({ key, loading: false, source: data.source, canManage: data.can_manage, error: null });
    }).catch(error => { if (!controller.signal.aborted && latest.current === key) setState({ key, loading: false, source: null, canManage: false, error }); });
    return () => controller.abort();
  }, [companyId, sourceId, key, version]);
  return <RequestedSourceView companyId={companyId} {...(state.key === key ? state : { loading: true })} refresh={() => setVersion(value => value + 1)} />;
}
