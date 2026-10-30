import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RotateCcw, ArrowRight } from 'lucide-react';
import { creditRecovery } from '@/api/creditRecovery.mjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Money, ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';
import ClaimList, { ClaimStatus } from './ClaimList';
import { buildClaimRequest, createRequestBook } from './model.mjs';
import { useCreditClaims, useMutationScope } from './useCreditClaims';

/** Rendered in the original bill table, so line identity stays visible. */
export function CreditLineControl({ index, description, claim, ready, loading, error, canManage, checked, busy, onSelect, panelId }) {
  if (loading) return <span role="status" className="text-xs text-muted-foreground">Checking credits…</span>;
  if (error || !ready) return <a href={`#${panelId}`} className="text-xs text-muted-foreground underline">Credit status unavailable</a>;
  if (claim) return <a href={`#${panelId}`} className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`View tracked credit for line ${index + 1}: ${description}`}><ClaimStatus claim={claim} /></a>;
  if (!canManage) return <span className="text-xs text-muted-foreground">Not tracked</span>;
  return <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-primary">
    <input type="checkbox" checked={checked} disabled={busy} onChange={event => onSelect(index, event.target.checked)}
      aria-label={`Select line ${index + 1} awaiting credit: ${description}`} aria-haspopup="dialog"
      className="h-4 w-4 accent-primary" />
    Select item
  </label>;
}

export function CreditSelectionAction({ ready, loading, error, canManage, busy, onOpen, panelId }) {
  if (loading) return <span role="status" className="text-xs text-muted-foreground">Checking credit status…</span>;
  if (error || !ready) return <a href={`#${panelId}`} className="text-sm text-primary underline">Check credit tracking</a>;
  if (!canManage) return null;
  return <Button type="button" variant="outline" disabled={busy} onClick={onOpen} aria-haspopup="dialog"><Plus className="h-4 w-4" />Select lines awaiting credit</Button>;
}

/** The existing tracking form, shared by the bill-header and line-table actions. */
export function CreditSelectionForm({ doc, lines, lineClaims, values, busy, loading, saveError, onSave, onLineChange, onValueChange, onClose, onViewHistory = onClose, panelId }) {
  const selected = lines.filter(line => line.selected && !lineClaims.has(line.original_line_ref));
  const allTracked = doc.source.line_items.every((_, index) => lineClaims.has(index));
  if (allTracked) return <div className="space-y-4">
    <p className="rounded-lg bg-muted/50 p-4 text-sm">All items from this bill are already tracked. Open the history to see expected credits, received amounts and possible matches.</p>
    <ul className="divide-y">{doc.source.line_items.map((source, index) => <li key={index} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span>{source.description}</span><ClaimStatus claim={lineClaims.get(index)} /></li>)}</ul>
    <Button asChild variant="outline"><a href={`#${panelId}`} onClick={onViewHistory}>View credit tracking history<ArrowRight className="h-4 w-4" /></a></Button>
  </div>;
  return <form onSubmit={onSave} className="space-y-5" aria-label="Select items awaiting credit">
    <fieldset disabled={busy || loading} className="space-y-5">
      <legend className="text-sm font-semibold">Choose the items and quantities</legend>
      <p className="text-xs text-muted-foreground">The expected credit is calculated from the original bill when you save. Selecting an item does not post a credit or change the amount due.</p>
      <div className="space-y-3">{doc.source.line_items.map((source, index) => {
        const line = lines[index], trackedClaim = lineClaims.get(index);
        return <div key={index} className={`rounded-lg border p-4 ${line.selected && !trackedClaim ? 'border-primary/40 bg-primary/5' : ''}`}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0">
            {trackedClaim ? <div className="space-y-1"><p className="text-sm font-medium">{source.description}</p><ClaimStatus claim={trackedClaim} /><p className="text-xs text-muted-foreground">This line is already tracked.</p></div>
              : <label className="flex items-start gap-3"><input type="checkbox" checked={line.selected} onChange={event => onLineChange(index, 'selected', event.target.checked)} className="mt-1 h-4 w-4 accent-primary" aria-label={`Select line ${index + 1}: ${source.description}`} /><span className="text-sm font-medium">{source.description}<span className="mt-1 block text-xs font-normal text-muted-foreground">Original quantity {source.quantity}</span></span></label>}
          </div><div className="shrink-0 text-right text-xs text-muted-foreground">Original line total<span className="mt-1 block text-sm font-medium text-foreground"><Money value={doc.money?.lines?.[index]?.gross_pence} /></span></div></div>
          {line.selected && !trackedClaim && <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div><Label htmlFor={`claim-quantity-${index}`}>Quantity to credit</Label><Input id={`claim-quantity-${index}`} className="mt-1.5" required inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" value={line.quantity} onChange={event => onLineChange(index, 'quantity', event.target.value)} /></div>
            <div><Label htmlFor={`claim-part-${index}`}>Part reference</Label><Input id={`claim-part-${index}`} className="mt-1.5" maxLength={200} value={line.part_reference} onChange={event => onLineChange(index, 'part_reference', event.target.value)} placeholder="Optional" /></div>
            <div><Label htmlFor={`claim-job-${index}`}>Job / vehicle reference</Label><Input id={`claim-job-${index}`} className="mt-1.5" maxLength={200} value={line.job_reference} onChange={event => onLineChange(index, 'job_reference', event.target.value)} placeholder="Optional" /></div>
          </div>}
        </div>;
      })}</div>
      <div><Label htmlFor="claim-reason">Reason for credit</Label><Textarea id="claim-reason" className="mt-1.5" required maxLength={1000} value={values.reason} onChange={event => onValueChange('reason', event.target.value)} placeholder="For example, part returned, warranty or surcharge refund" /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><Label htmlFor="claim-return-reference">Return note reference</Label><Input id="claim-return-reference" className="mt-1.5" maxLength={200} value={values.return_reference} onChange={event => onValueChange('return_reference', event.target.value)} placeholder="Optional" /></div>
        <div><Label htmlFor="claim-returned-on">Returned on</Label><Input id="claim-returned-on" className="mt-1.5" type="date" value={values.returned_on} onChange={event => onValueChange('returned_on', event.target.value)} /></div>
        <div><Label htmlFor="claim-expected-by">Credit expected by</Label><Input id="claim-expected-by" className="mt-1.5" type="date" value={values.expected_by} onChange={event => onValueChange('expected_by', event.target.value)} /></div>
      </div>
      <ErrorBox error={saveError} />
      {saveError && <p className="text-xs text-muted-foreground">Retrying unchanged details uses the same request reference. Refresh this tracker if another user has already added these items.</p>}
      <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={busy || loading || !selected.length || !values.reason.trim()}>{busy ? 'Saving…' : `Track ${selected.length === 1 ? '1 item' : `${selected.length} items`}`}</Button><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Close</Button></div>
    </fieldset>
  </form>;
}

function BillCreditTracker({ companyId, doc, children }) {
  const { data, loading, error, refresh } = useCreditClaims(companyId, doc.id);
  const [expanded, setExpanded] = useState(false);
  const [lines, setLines] = useState(() => doc.source.line_items.map((line, index) => ({
    original_line_ref: index, selected: false, quantity: String(line.quantity), part_reference: '', job_reference: doc.source.reference || '',
  })));
  const [values, setValues] = useState({ reason: '', return_reference: '', returned_on: '', expected_by: '' });
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [message, setMessage] = useState('');
  const requests = useRef(createRequestBook());
  const openedFrom = useRef(null);
  const panelRef = useRef(null);
  const scope = useMutationScope();
  const claims = data?.claims ?? [];
  const lineClaims = new Map(claims.filter(claim => !claim.cancelled).map(claim => [claim.original_line_ref, claim]));
  const selected = lines.filter(line => line.selected && !lineClaims.has(line.original_line_ref));
  const canManage = data?.can_manage === true && !loading;
  const panelId = `awaiting-credits-${doc.id}`;
  const renderChildren = typeof children === 'function';
  const changeValue = (field, value) => setValues(previous => ({ ...previous, [field]: value }));
  const changeLine = (index, field, value) => setLines(previous => previous.map(line => line.original_line_ref === index ? { ...line, [field]: value } : line));
  const changeOpen = open => { if (!busy) setExpanded(open); };
  const openSelector = () => {
    if (canManage && !busy) {
      openedFrom.current = document.activeElement;
      setExpanded(true); setMessage('');
    }
  };
  const selectOriginalLine = (index, checked) => {
    if (!canManage || busy || lineClaims.has(index)) return;
    changeLine(index, 'selected', checked);
    if (checked) openSelector();
  };
  const save = async event => {
    event.preventDefault();
    if (!canManage || busy || !selected.length) return;
    const request = scope.begin();
    setBusy(true); setSaveError(null); setMessage('');
    try {
      const body = requests.current.forRequest('create', buildClaimRequest(doc, selected, values));
      await creditRecovery.create(companyId, body, request.signal);
      if (!request.current()) return;
      requests.current.complete('create');
      setLines(previous => previous.map(line => ({ ...line, selected: false })));
      setValues({ reason: '', return_reference: '', returned_on: '', expected_by: '' });
      setExpanded(false); setMessage('Items added to Awaiting credits. Your bill and account balances are unchanged.');
      refresh();
    } catch (e) { if (request.current()) setSaveError(e); }
    finally { if (request.current()) setBusy(false); request.finish(); }
  };
  const controlState = { ready: Boolean(data), loading, error, canManage, busy, panelId };
  const action = <CreditSelectionAction {...controlState} onOpen={openSelector} />;
  const lineControl = index => doc.source.line_items[index] ? <CreditLineControl {...controlState} index={index}
    description={doc.source.line_items[index].description} claim={lineClaims.get(index)} checked={lines[index].selected}
    onSelect={selectOriginalLine} /> : null;
  const panel = <section ref={panelRef} id={panelId} tabIndex={-1} className="workspace-card scroll-mt-6 space-y-5 p-6" aria-label="Awaiting supplier credits" data-testid="awaiting-credit-panel">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><RotateCcw className="h-4 w-4 text-primary" />Awaiting credits</h2><p className="mt-1 text-sm text-muted-foreground">Track items you have returned or are waiting to be credited.</p></div><Link className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" to="/awaiting-credits">All awaiting credits<ArrowRight className="h-3.5 w-3.5" /></Link></div>
    <ErrorBox error={error} onRetry={refresh} />
    {loading && !data && <SkeletonRows rows={2} />}
    {loading && data && <p role="status" className="text-xs text-muted-foreground">Refreshing credit tracking…</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">{message}</p>}
    {data && <>
      {claims.length > 0 ? <ClaimList claims={claims} companyId={companyId} canManage={canManage && !busy} onChanged={refresh} /> : <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">No items from this bill are being tracked yet. {data.can_manage && 'Select an item in the bill above, or use “Select lines awaiting credit”.'}</p>}
      {!data.can_manage && <p className="text-xs text-muted-foreground">Your role can view this tracker. An owner, administrator or accountant can add items or confirm matches.</p>}
    </>}
    {!renderChildren && action}
  </section>;
  return <>
    {renderChildren ? children({ action, lineControl, panel }) : panel}
    <Dialog open={expanded} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[85vh] sm:max-w-3xl overflow-y-auto" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}
        onCloseAutoFocus={event => { event.preventDefault(); (openedFrom.current?.isConnected ? openedFrom.current : panelRef.current)?.focus(); }}>
        <DialogHeader><DialogTitle>Select lines awaiting credit</DialogTitle><DialogDescription>{doc.source.invoice_number} · Choose the original items you are returning, including partial quantities.</DialogDescription></DialogHeader>
        <ErrorBox error={error} onRetry={refresh} />
        {loading && !data ? <SkeletonRows rows={3} /> : data?.can_manage ? <CreditSelectionForm doc={doc} lines={lines} lineClaims={lineClaims} values={values} busy={busy} loading={loading} saveError={saveError}
          onSave={save} onLineChange={changeLine} onValueChange={changeValue} onClose={() => changeOpen(false)}
          onViewHistory={() => { openedFrom.current = panelRef.current; changeOpen(false); }} panelId={panelId} />
          : !error && <p className="text-sm text-muted-foreground">Your role can view credit tracking, but cannot select items or change claims.</p>}
      </DialogContent>
    </Dialog>
  </>;
}

export default function AwaitingCreditPanel({ companyId, doc, children }) {
  if (!companyId || !doc?.id || doc.status !== 'posted' || !Array.isArray(doc.source?.line_items)) {
    return typeof children === 'function' ? children({ action: null, lineControl: () => null, panel: null }) : null;
  }
  return <BillCreditTracker key={`${companyId}:${doc.id}:${doc.revision}`} companyId={companyId} doc={doc}>{children}</BillCreditTracker>;
}
