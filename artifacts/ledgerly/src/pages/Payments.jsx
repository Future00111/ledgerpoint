import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, ArrowRight } from 'lucide-react';
import PageHeader from '@/components/workspace/PageHeader';
import EmptyState from '@/components/workspace/EmptyState';
import { PaymentFilters, PaymentList, PaymentBalanceSummary } from '@/features/paymentWorkspace/PaymentList';
import PaymentAllocations from '@/features/paymentWorkspace/PaymentAllocations';
import PaymentOverview from '@/features/paymentWorkspace/PaymentOverview';
import { filterPayments, statementPath, createPaymentShortcutGate, clearPaymentShortcut } from '@/features/paymentWorkspace/model.mjs';
import { useCompany } from '@/lib/useCompany';
import { useLedgerSnapshot } from '@/lib/useLedgerSnapshot';
import { createPaymentRequestScope, runPaymentRequest, bindPaymentReview, paymentForEvent } from '@/lib/paymentRequestScope.mjs';
import { accounting, docPath } from '@/api/accountingDocuments.mjs';
import { createPaymentRecovery, canConfigurePayments, canPostPayments, recoveryBusy, recoveryUnresolved } from '@/features/paymentRecovery/model.mjs';
import { PaymentToolbar, PaymentHistoryActions, PaymentEventHistory, PaymentRecoveryPanel } from '@/features/paymentRecovery/PaymentControls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ErrorBox, SkeletonRows, Money, JournalLink, today } from '@/components/accounting/AccountingUI';

const labels = { payment: 'Record payment', allocation: 'Allocate unapplied amount', unallocation: 'Undo allocation', refund: 'Record refund', reversal: 'Reverse payment' };
const pence = value => { if (!/^\d+(\.\d{1,2})?$/.test(value)) throw Error('Enter a positive amount with no more than two decimal places.'); const [a, b = ''] = value.split('.'); return (BigInt(a) * 100n + BigInt(b.padEnd(2, '0'))).toString(); };
const pounds = value => `${BigInt(value) / 100n}.${(BigInt(value) % 100n).toString().padStart(2, '0')}`;
const selectClass = 'h-11 w-full rounded-md border bg-background px-3 text-sm';

export default function Payments() {
  const { activeCompany, loading } = useCompany();
  if (loading && !activeCompany) return <div className="workspace-page" aria-label="Loading company"><SkeletonRows rows={3} /></div>;
  // Remount immediately on company change, before any previous request can
  // display or submit a review in the newly selected company's workspace.
  return activeCompany ? <CompanyPayments key={activeCompany.id} company={activeCompany.id} companyName={activeCompany.name} /> : <div className="workspace-page"><PageHeader eyebrow="Money in and out" title="Payments" description="Track money received, money paid and unapplied balances." /><section className="workspace-card"><EmptyState icon={Building2} title="Choose a company first" description="Select your business to view its payments and account history." action={<Button asChild><Link to="/companies">Open companies</Link></Button>} /></section></div>;
}

function CompanyPayments({ company, companyName }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [shortcutGate] = useState(createPaymentShortcutGate);
  const [filters, setFilters] = useState({ search: '', direction: 'all', balance: 'all' });
  const openedDocument = useRef(null);
  const [requestScope] = useState(() => createPaymentRequestScope(company));
  useEffect(() => () => requestScope.invalidate(), [requestScope]);
  const cache = useQueryClient(), ledger = useLedgerSnapshot(company);
  const [context, setContext] = useState(null), [payments, setPayments] = useState(null), [error, setError] = useState(null);
  const [tick, setTick] = useState(0), [requestBusy, setBusy] = useState(false), [setup, setSetup] = useState(false), [mappings, setMappings] = useState({});
  const [form, setForm] = useState(null), [review, setReview] = useState(null), [result, setResult] = useState(null), [detail, setDetail] = useState(null);
  const [recovery] = useState(() => createPaymentRecovery(company, accounting));
  const recoveryState = useSyncExternalStore(recovery.subscribe, recovery.getSnapshot, recovery.getSnapshot);
  const unresolved = recoveryUnresolved(recoveryState), busy = requestBusy || recoveryBusy(recoveryState);
  const [closingRecovery, setClosingRecovery] = useState(false), [abandoned, setAbandoned] = useState(null);
  const canPost = canPostPayments(context?.capabilities), canConfigure = canConfigurePayments(context?.capabilities);
  useEffect(() => () => recovery.reset(), [recovery]);
  useEffect(() => {
    if (!unresolved) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unresolved]);
  useEffect(() => {
    if (recoveryState?.phase !== 'recorded') return;
    setResult(recoveryState.result); setForm(null); setReview(null); setError(null); setClosingRecovery(false); setAbandoned(null);
    // A later refresh error must never turn a confirmed recording into an unknown result.
    cache.invalidateQueries({ queryKey: ['posted-ledger', company] }).catch(() => {});
    setTick(t => t + 1);
  }, [recoveryState, cache, company]);
  useEffect(() => {
    setContext(null); setPayments(null); setError(null); setDetail(null);
    if (!company) return;
    const c = new AbortController();
    Promise.all([accounting.paymentContext(company, c.signal), accounting.payments(company, c.signal)]).then(([ctx, rows]) => {
      if (c.signal.aborted) return;
      setContext(ctx); setPayments(rows); setMappings(ctx.configuration?.mappings || {});
      setSetup(canConfigurePayments(ctx.capabilities) && !ctx.configuration);
    }).catch(e => { if (!c.signal.aborted) setError(e); });
    return () => c.abort();
  }, [company, tick]);
  const eventId = params.get('event');
  useEffect(() => { setDetail(paymentForEvent(payments, eventId)); }, [payments, eventId]);
  const refresh = async ticket => {
    await cache.invalidateQueries({ queryKey: ['posted-ledger', ticket.companyId] });
    if (ticket.isCurrent()) setTick(t => t + 1);
  };
  const start = (kind = 'payment', payment = null) => {
    if (busy || unresolved || !canPost || !context?.configuration || !ledger.data || ledger.error) return false;
    requestScope.invalidate(); recovery.clearRecorded(); setClosingRecovery(false);
    const partyType = payment?.party_type || (params.get('party_type') === 'supplier' ? 'supplier' : 'customer');
    const requestedParty = payment?.party_id || params.get('party_id') || '';
    const partyId = (partyType === 'customer' ? context.customers : context.suppliers).some(party => party.id === requestedParty) ? requestedParty : '';
    const linked = ledger.data?.open_items.find(d => d.id === params.get('document') && d.party_id === partyId);
    setError(null); setReview(null); setResult(null);
    setForm({ id: crypto.randomUUID(), kind, payment, party_type: partyType, party_id: partyId,
      date: today(), reference: '', amount: kind === 'reversal' ? pounds(payment.amount_minor) : linked ? pounds(linked.open_minor) : '',
      allocations: linked ? { [linked.id]: pounds(linked.open_minor) } : {} });
    if (params.get('document')) openedDocument.current = `${company}:${params.get('document')}`;
    return true;
  };
  useEffect(() => {
    const shortcut = shortcutGate.take({ entry: location.key, intent: params.get('new'), contextLoaded: !!context,
      canPost, configured: !!context?.configuration, ledgerReady: !!ledger.data && !ledger.error && !ledger.loading,
      busy, unresolved, formOpen: !!form });
    if (shortcut === 'open' || shortcut === 'discard') {
      if (shortcut === 'open') start();
      // Replace this entry after consuming it: close, refresh and Back cannot replay creation.
      setParams(clearPaymentShortcut(params), { replace: true });
      return;
    }
    if (shortcut === 'wait' || form || busy || unresolved) return;
    const documentId = params.get('document');
    const key = `${company}:${documentId}`;
    if (documentId && canPost && context?.configuration && ledger.data && !ledger.error && openedDocument.current !== key) {
      const item = ledger.data.open_items.find(d => d.id === documentId && d.party_id === params.get('party_id'));
      openedDocument.current = key;
      if (item && BigInt(item.open_minor) > 0n) start();
    }
  }, [company, context, ledger.data, ledger.error, ledger.loading, params, location.key, canPost, unresolved, busy, !!form, shortcutGate, setParams]);
  const change = fields => { if (busy || unresolved || !canPost) return; requestScope.invalidate(); setForm(f => ({ ...f, ...fields })); setReview(null); setError(null); };
  const relevant = (ledger.data?.open_items || []).filter(d => d.party_id === form?.party_id && d.party_type === form?.party_type &&
    (form?.kind === 'unallocation' ? BigInt(form.payment?.allocation_balances.find(a => a.document_id === d.id)?.amount_minor || '0') > 0n : BigInt(d.open_minor) > 0n));
  const body = () => ({ id: form.id, kind: form.kind, party_type: form.party_type, party_id: form.party_id,
    payment_id: form.payment?.id || null, date: form.date, reference: form.reference, amount_minor: pence(form.amount),
    allocations: ['refund', 'reversal'].includes(form.kind) ? [] : Object.entries(form.allocations).filter(([, v]) => v && pence(v) !== '0').map(([document_id, value]) => ({ document_id, amount_minor: pence(value) })) });
  const doReview = async () => {
    if (busy || unresolved || !canPost) return; setBusy(true); setError(null);
    await runPaymentRequest(requestScope, async requestCompany => {
      const input = body();
      const plan = await accounting.reviewPayment(requestCompany, input);
      return bindPaymentReview(requestCompany, input, plan);
    }, { success: setReview, failure: setError, finished: () => setBusy(false) });
  };
  const post = async () => {
    if (!review || busy || unresolved || !canPost) return;
    setError(null);
    await recovery.record(review, context.capabilities);
  };
  const closeForm = () => {
    if (busy) return;
    if (unresolved) { setClosingRecovery(true); return; }
    requestScope.invalidate(); setForm(null); setReview(null); setError(null);
  };
  const abandonRecovery = () => {
    const id = recoveryState?.body.id;
    if (!recovery.abandon()) return;
    requestScope.invalidate(); setAbandoned(id); setClosingRecovery(false); setForm(null); setReview(null); setError(null);
  };
  const saveSetup = async () => {
    if (busy || unresolved || !canConfigure) return; setBusy(true); setError(null);
    const input = { revision: context.configuration?.revision || null, mappings: { ...mappings } };
    await runPaymentRequest(requestScope, requestCompany => accounting.savePaymentConfiguration(requestCompany, input), {
      success: async (_saved, ticket) => { await refresh(ticket); if (ticket.isCurrent()) setSetup(false); },
      failure: setError, finished: () => setBusy(false),
    });
  };
  const shownPayments = filterPayments(payments || [], filters).slice().reverse();
  const partyStatementPath = detail ? statementPath(context, detail) : null;
  return <div className="workspace-page">
    <PageHeader eyebrow="Money in and out" title="Payments" description="Record money already received or paid, then follow its allocations and remaining balance." context={companyName}
      actions={<PaymentToolbar capabilities={context?.capabilities} busy={busy || unresolved} ready={!!context?.configuration && !!ledger.data && !ledger.error} onSetup={() => setSetup(value => !value)} onStart={() => start()} />} />
    <PaymentOverview payments={payments} filters={filters} onChange={setFilters} />
    {context && !canPost && <p className="text-sm text-muted-foreground">You can view payment history{canConfigure ? ' and manage payment setup' : ''}. An owner or accountant must record payments, allocations, refunds and reversals.</p>}
    {abandoned && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">The outcome of payment event <span className="break-all">{abandoned}</span> is still unknown. Closing its view did not cancel it. Check payment history before recording it again.</div>}
    <ErrorBox error={!form ? error || ledger.error : null} onRetry={() => { setTick(t => t + 1); ledger.refresh(); }} />
    {result && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">Payment event recorded. <JournalLink id={result.journal_id} />{params.get('document') && <Link className="ml-4 underline" to={docPath(params.get('party_type') === 'supplier' ? 'purchase_bill' : 'sales_invoice', params.get('document'))}>Back to document</Link>}</div>}
    {context && canConfigure && setup && <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Payment accounts</h2><p className="text-sm text-muted-foreground">Choose separate nominal accounts for bank/cash, customer credit liabilities and supplier prepayment assets. <Link to="/chart-of-accounts" className="text-primary underline">Create accounts</Link> if needed.</p><div className="grid gap-4 md:grid-cols-3">{[['bank', 'Bank / cash', 'asset'], ['customer_credit', 'Customer credit liability', 'liability'], ['supplier_prepayment', 'Supplier prepayment asset', 'asset']].map(([role, label, type]) => <div key={role}><Label htmlFor={`payment-${role}`}>{label}</Label><select id={`payment-${role}`} className={selectClass} disabled={busy || unresolved} value={mappings[role] || ''} onChange={e => setMappings(m => ({ ...m, [role]: e.target.value }))}><option value="">Choose an account</option>{context.accounts.filter(a => a.is_active && [type, `${type}s`].includes(a.account_type)).map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></div>)}</div><Button disabled={busy || unresolved} onClick={saveSetup}>Save payment accounts</Button></section>}
    {context && !context.configuration && !canConfigure && <p role="status" className="rounded-xl border bg-card p-4 text-sm">Payment accounts need to be set up by an owner, admin or accountant before payments can be recorded.</p>}
    {payments && eventId && !paymentForEvent(payments, eventId) && <p role="status" className="rounded-xl border bg-card p-4 text-sm">The linked payment event is not available in this company. Choose a payment from the current history.</p>}
    <section className="workspace-card overflow-hidden" aria-label="Recorded payments">
      <div className="workspace-panel-header"><div><h2 className="workspace-section-title">Payment activity</h2><p className="mt-1 text-sm text-muted-foreground">Select a payment to review its allocations, refunds and history.</p></div><Link to="/statements" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary">Account statements<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
      <PaymentFilters filters={filters} onChange={setFilters} disabled={!payments} />
      {!payments && !error && <div role="status" className="p-5"><p className="mb-3 text-sm text-muted-foreground">Loading payment history…</p><SkeletonRows rows={4} /></div>}
      {payments && <PaymentList payments={shownPayments} total={payments.length} disabled={busy || unresolved} onReview={setDetail} onClear={() => setFilters({ search: '', direction: 'all', balance: 'all' })} />}
    </section>
    <p className="text-xs leading-5 text-muted-foreground">Recording a payment here does not instruct a bank transfer. Allocations, refunds and reversals are reviewed before they change your accounts.</p>
    <Dialog open={!!detail && !form} onOpenChange={v => { if (!v) setDetail(null); }}><DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{detail?.reference}</DialogTitle><DialogDescription>{detail?.source.party_name} · Payment history and remaining balance</DialogDescription></DialogHeader>{detail && <><PaymentBalanceSummary payment={detail} />{partyStatementPath && <Link to={partyStatementPath} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">View account statement<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}<PaymentHistoryActions capabilities={context?.capabilities} payment={detail} disabled={busy || unresolved} onStart={start} /><p className="text-xs text-muted-foreground">Undo allocations before reversing a payment. Refunds and reversals remain separate events in the audit history.</p><PaymentEventHistory events={detail.events} labels={labels} /></>}</DialogContent></Dialog>
    <Dialog open={!!form} onOpenChange={v => { if (!v) closeForm(); }}><DialogContent className="max-h-[92vh] overflow-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{form ? labels[form.kind] : ''}</DialogTitle><DialogDescription>Review the amount and accounting entries before confirming. No bank transfer is made.</DialogDescription></DialogHeader><ErrorBox error={unresolved ? null : error} />{unresolved && <PaymentRecoveryPanel state={recoveryState} capabilities={context?.capabilities} closing={closingRecovery} onCheck={() => recovery.check()} onRetry={() => recovery.retry(context?.capabilities)} onClose={() => setClosingRecovery(true)} onKeep={() => setClosingRecovery(false)} onAbandon={abandonRecovery} />}{form && <>
      {!review ? <fieldset disabled={busy || unresolved || !canPost} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="pay-type">Party type</Label><select id="pay-type" className={selectClass} disabled={!!form.payment} value={form.party_type} onChange={e => change({ party_type: e.target.value, party_id: '', allocations: {} })}><option value="customer">Customer receipt</option><option value="supplier">Supplier payment</option></select></div><div><Label htmlFor="pay-party">{form.party_type === 'customer' ? 'Customer' : 'Supplier'}</Label><select id="pay-party" className={selectClass} disabled={!!form.payment} value={form.party_id} onChange={e => change({ party_id: e.target.value, allocations: {} })}><option value="">Choose a party</option>{(form.party_type === 'customer' ? context.customers : context.suppliers).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div><Label htmlFor="pay-date">Accounting date</Label><Input className="h-11" id="pay-date" type="date" value={form.date} onChange={e => change({ date: e.target.value })} /></div><div><Label htmlFor="pay-amount">Amount (£)</Label><Input className="h-11" id="pay-amount" inputMode="decimal" value={form.amount} disabled={form.kind === 'reversal'} onChange={e => change({ amount: e.target.value })} /></div><div className="sm:col-span-2"><Label htmlFor="pay-reference">Reference / reason</Label><Input className="h-11" id="pay-reference" maxLength={200} value={form.reference} onChange={e => change({ reference: e.target.value })} /></div></div>
      {['payment', 'allocation', 'unallocation'].includes(form.kind) && <PaymentAllocations documents={relevant} form={form} onChange={change} />}<Button className="min-h-11" disabled={busy || !form.party_id} onClick={doReview}>{busy ? 'Preparing review…' : 'Review accounting entries'}</Button></fieldset>
      : <div className="space-y-4"><div className="rounded-xl bg-muted/50 p-4"><p className="font-semibold">{review.party_name} · {review.input.reference}</p><p>{review.input.date} · <Money value={review.input.amount_minor} /></p><p className="text-sm">Unapplied balance after this event: <Money value={review.unapplied_minor} /></p></div><div className="overflow-auto" role="region" tabIndex={0} aria-label="Reviewed accounting entries"><table className="w-full text-sm"><caption className="sr-only">The exact accounting entries included in this review</caption><thead><tr><th scope="col" className="p-2 text-left">Account</th><th scope="col" className="p-2 text-right">Debit</th><th scope="col" className="p-2 text-right">Credit</th></tr></thead><tbody>{review.lines.map((l, i) => { const a = review.source.accounts.find(a => a.id === l.accountId); return <tr className="border-t" key={i}><td className="p-2">{a?.code} · {a?.name}</td><td className="whitespace-nowrap p-2 text-right"><Money value={l.debitMinor} /></td><td className="whitespace-nowrap p-2 text-right"><Money value={l.creditMinor} /></td></tr>; })}</tbody></table></div><p className="text-sm text-muted-foreground">Confirming creates an immutable journal and updates balances, ageing and statements. Standard invoice-basis VAT and profit are unchanged by this payment event.</p>{!unresolved && <div className="flex flex-wrap gap-3"><Button className="min-h-11" variant="outline" disabled={busy || !canPost} onClick={() => { requestScope.invalidate(); setReview(null); }}>Back to edit</Button>{canPost && <Button className="min-h-11" disabled={busy} onClick={post}>Confirm and record</Button>}</div>}</div>}
    </>}</DialogContent></Dialog>
  </div>;
}
