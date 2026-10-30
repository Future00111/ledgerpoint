import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { documentIntake } from '@/api/documentIntake.mjs';
import { Button } from '@/components/ui/button';
import { ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';
import { capturePath, prepareCapturePath } from './model.mjs';
import { useIntakeSources } from './useDocumentIntake';

export function SourceDownload({ companyId, source }) {
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
  return <div><Button type="button" variant="outline" size="sm" onClick={download} disabled={state.busy} aria-label={`Download source file ${source.filename}`}>{state.busy ? 'Downloading…' : 'Download source file'}</Button>{state.error && <p role="alert" className="mt-1 text-xs text-destructive">{state.error.message}</p>}</div>;
}

export function SourceCard({ source, companyId, canManage = false, highlighted = false, compact = false }) {
  return <article id={`capture-${source.id}`} className={`rounded-xl border p-4 ${highlighted ? 'border-primary bg-primary/5' : 'bg-card'}`} aria-label={`Source file ${source.filename}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-medium">{source.filename}</h3><p className="mt-1 text-xs text-muted-foreground">{source.media_type} · {Math.ceil(source.byte_length / 1024)} KiB{source.created_at ? ` · ${new Date(source.created_at).toLocaleDateString('en-GB')}` : ''}</p><p className="mt-1 text-sm text-muted-foreground">{source.document_id ? 'Linked to an accounting document' : 'Uploaded · ready for manual entry'}</p></div><SourceDownload companyId={companyId} source={source} /></div>
    {!compact && <div className="mt-4 flex flex-wrap gap-2">{source.document_id ? <Button asChild variant="outline" size="sm"><Link to={capturePath(source)}>Open linked document</Link></Button> : canManage ? <><Button asChild size="sm"><Link to={prepareCapturePath('purchase_bill', source.id)}>Prepare bill</Link></Button><Button asChild variant="outline" size="sm"><Link to={prepareCapturePath('supplier_credit_note', source.id)}>Prepare supplier credit</Link></Button></> : <p className="text-xs text-muted-foreground">You can view this source. Preparing a draft requires editing permission.</p>}</div>}
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
