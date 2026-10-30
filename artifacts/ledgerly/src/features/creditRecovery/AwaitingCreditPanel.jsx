import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RotateCcw, ArrowRight } from 'lucide-react';
import { creditRecovery } from '@/api/creditRecovery.mjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Money, ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';
import ClaimList from './ClaimList';
import { buildClaimRequest, createRequestBook } from './model.mjs';
import { useCreditClaims, useMutationScope } from './useCreditClaims';

function BillCreditTracker({ companyId, doc }) {
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
  const scope = useMutationScope();
  const claims = data?.claims ?? [];
  const activeLines = new Set(claims.filter(claim => !claim.cancelled).map(claim => claim.original_line_ref));
  const selected = lines.filter(line => line.selected && !activeLines.has(line.original_line_ref));
  const canManage = data?.can_manage === true && !loading;
  const changeValue = (field, value) => setValues(previous => ({ ...previous, [field]: value }));
  const changeLine = (index, field, value) => setLines(previous => previous.map(line => line.original_line_ref === index ? { ...line, [field]: value } : line));
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
  return <section className="workspace-card space-y-5 p-6" aria-label="Awaiting supplier credits" data-testid="awaiting-credit-panel">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><RotateCcw className="h-4 w-4 text-primary" />Awaiting credits</h2><p className="mt-1 text-sm text-muted-foreground">Track items you have returned or are waiting to be credited.</p></div><Link className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" to="/awaiting-credits">All awaiting credits<ArrowRight className="h-3.5 w-3.5" /></Link></div>
    <ErrorBox error={error} onRetry={refresh} />
    {loading && !data && <SkeletonRows rows={2} />}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">{message}</p>}
    {data && <>
      {claims.length > 0 ? <ClaimList claims={claims} companyId={companyId} canManage={canManage && !busy} onChanged={refresh} /> : <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">No items from this bill are being tracked yet.</p>}
      {!data.can_manage && <p className="text-xs text-muted-foreground">Your role can view this tracker. An owner, administrator or accountant can add items or confirm matches.</p>}
      {data.can_manage && !expanded && <Button type="button" variant="outline" disabled={busy || loading || activeLines.size >= doc.source.line_items.length} onClick={() => { setExpanded(true); setMessage(''); }}><Plus className="h-4 w-4" />Select items awaiting credit</Button>}
      {expanded && data.can_manage && <form onSubmit={save} className="space-y-5 border-t pt-5" aria-label="Select items awaiting credit">
        <fieldset disabled={busy || loading} className="space-y-5">
          <legend className="text-sm font-semibold">Choose the items and quantities</legend>
          <p className="text-xs text-muted-foreground">The expected credit is calculated from the original bill when you save. Selecting an item does not post a credit or change the amount due.</p>
          <div className="space-y-3">{doc.source.line_items.map((source, index) => {
            const line = lines[index]; const alreadyTracked = activeLines.has(index);
            return <div key={index} className={`rounded-lg border p-4 ${line.selected && !alreadyTracked ? 'border-primary/40 bg-primary/5' : ''}`}>
              <div className="flex items-start justify-between gap-3"><label className="flex min-w-0 items-start gap-3"><input type="checkbox" checked={line.selected && !alreadyTracked} disabled={alreadyTracked} onChange={event => changeLine(index, 'selected', event.target.checked)} className="mt-1 h-4 w-4 accent-primary" /><span className="text-sm font-medium">{source.description}<span className="mt-1 block text-xs font-normal text-muted-foreground">Original quantity {source.quantity}{alreadyTracked ? ' · Already tracked' : ''}</span></span></label><div className="shrink-0 text-right text-xs text-muted-foreground">Original line total<span className="mt-1 block text-sm font-medium text-foreground"><Money value={doc.money?.lines?.[index]?.gross_pence} /></span></div></div>
              {line.selected && !alreadyTracked && <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div><Label htmlFor={`claim-quantity-${index}`}>Quantity to credit</Label><Input id={`claim-quantity-${index}`} className="mt-1.5" required inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" value={line.quantity} onChange={event => changeLine(index, 'quantity', event.target.value)} /></div>
                <div><Label htmlFor={`claim-part-${index}`}>Part reference</Label><Input id={`claim-part-${index}`} className="mt-1.5" maxLength={200} value={line.part_reference} onChange={event => changeLine(index, 'part_reference', event.target.value)} placeholder="Optional" /></div>
                <div><Label htmlFor={`claim-job-${index}`}>Job / vehicle reference</Label><Input id={`claim-job-${index}`} className="mt-1.5" maxLength={200} value={line.job_reference} onChange={event => changeLine(index, 'job_reference', event.target.value)} placeholder="Optional" /></div>
              </div>}
            </div>;
          })}</div>
          <div><Label htmlFor="claim-reason">Reason for credit</Label><Textarea id="claim-reason" className="mt-1.5" required maxLength={1000} value={values.reason} onChange={event => changeValue('reason', event.target.value)} placeholder="For example, part returned, warranty or surcharge refund" /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="claim-return-reference">Return note reference</Label><Input id="claim-return-reference" className="mt-1.5" maxLength={200} value={values.return_reference} onChange={event => changeValue('return_reference', event.target.value)} placeholder="Optional" /></div>
            <div><Label htmlFor="claim-returned-on">Returned on</Label><Input id="claim-returned-on" className="mt-1.5" type="date" value={values.returned_on} onChange={event => changeValue('returned_on', event.target.value)} /></div>
            <div><Label htmlFor="claim-expected-by">Credit expected by</Label><Input id="claim-expected-by" className="mt-1.5" type="date" value={values.expected_by} onChange={event => changeValue('expected_by', event.target.value)} /></div>
          </div>
          <ErrorBox error={saveError} />
          {saveError && <p className="text-xs text-muted-foreground">Retrying unchanged details uses the same request reference. Refresh this tracker if another user has already added these items.</p>}
          <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={busy || loading || !selected.length || !values.reason.trim()}>{busy ? 'Saving…' : `Track ${selected.length === 1 ? '1 item' : `${selected.length} items`}`}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setExpanded(false)}>Close</Button></div>
        </fieldset>
      </form>}
    </>}
  </section>;
}

export default function AwaitingCreditPanel({ companyId, doc }) {
  if (!companyId || !doc?.id || doc.status !== 'posted' || !Array.isArray(doc.source?.line_items)) return null;
  return <BillCreditTracker key={`${companyId}:${doc.id}:${doc.revision}`} companyId={companyId} doc={doc} />;
}
