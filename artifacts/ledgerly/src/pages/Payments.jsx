import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/lib/useCompany';
import { useLedgerSnapshot } from '@/lib/useLedgerSnapshot';
import { accounting, penceToDisplay, docPath } from '@/api/accountingDocuments.mjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ErrorBox, SkeletonRows, Money, JournalLink, today } from '@/components/accounting/AccountingUI';

const labels = { payment: 'Record payment', allocation: 'Allocate unapplied amount', unallocation: 'Undo allocation', refund: 'Record refund', reversal: 'Reverse payment' };
const pence = value => { if (!/^\d+(\.\d{1,2})?$/.test(value)) throw Error('Enter a positive amount with no more than two decimal places.'); const [a, b = ''] = value.split('.'); return (BigInt(a) * 100n + BigInt(b.padEnd(2, '0'))).toString(); };
const pounds = value => `${BigInt(value) / 100n}.${(BigInt(value) % 100n).toString().padStart(2, '0')}`;
const selectClass = 'h-10 w-full rounded-md border bg-background px-3 text-sm';

export default function Payments() {
  const { activeCompany } = useCompany(), company = activeCompany?.id;
  const [params] = useSearchParams();
  const openedDocument = useRef(null);
  const cache = useQueryClient(), ledger = useLedgerSnapshot(company);
  const [context, setContext] = useState(null), [payments, setPayments] = useState(null), [error, setError] = useState(null);
  const [tick, setTick] = useState(0), [busy, setBusy] = useState(false), [setup, setSetup] = useState(false), [mappings, setMappings] = useState({});
  const [form, setForm] = useState(null), [review, setReview] = useState(null), [result, setResult] = useState(null), [detail, setDetail] = useState(null);
  useEffect(() => {
    setContext(null); setPayments(null); setError(null); setForm(null); setReview(null); setDetail(null);
    if (!company) return;
    const c = new AbortController();
    Promise.all([accounting.paymentContext(company, c.signal), accounting.payments(company, c.signal)]).then(([ctx, rows]) => {
      if (c.signal.aborted) return;
      setContext(ctx); setPayments(rows); setMappings(ctx.configuration?.mappings || {});
      setSetup(!ctx.configuration);
      if (params.get('event')) setDetail(rows.find(p => p.events.some(e => e.id === params.get('event'))) || null);
    }).catch(e => { if (!c.signal.aborted) setError(e); });
    return () => c.abort();
  }, [company, tick]);
  useEffect(() => { setResult(null); }, [company]);
  const refresh = async () => { await cache.invalidateQueries({ queryKey: ['posted-ledger', company] }); setTick(t => t + 1); };
  const start = (kind = 'payment', payment = null) => {
    const partyType = payment?.party_type || params.get('party_type') || 'customer';
    const partyId = payment?.party_id || params.get('party_id') || '';
    const linked = ledger.data?.open_items.find(d => d.id === params.get('document') && d.party_id === partyId);
    setError(null); setReview(null); setResult(null);
    setForm({ id: crypto.randomUUID(), kind, payment, party_type: partyType, party_id: partyId,
      date: today(), reference: '', amount: kind === 'reversal' ? pounds(payment.amount_minor) : linked ? pounds(linked.open_minor) : '',
      allocations: linked ? { [linked.id]: pounds(linked.open_minor) } : {} });
  };
  useEffect(() => {
    const documentId = params.get('document');
    const key = `${company}:${documentId}`;
    if (documentId && context?.configuration && ledger.data && openedDocument.current !== key) {
      const item = ledger.data.open_items.find(d => d.id === documentId && d.party_id === params.get('party_id'));
      openedDocument.current = key;
      if (item && BigInt(item.open_minor) > 0n) start();
    }
  }, [company, context, ledger.data, params]);
  const change = fields => { setForm(f => ({ ...f, ...fields })); setReview(null); setError(null); };
  const relevant = (ledger.data?.open_items || []).filter(d => d.party_id === form?.party_id && d.party_type === form?.party_type &&
    (form?.kind === 'unallocation' ? BigInt(form.payment?.allocation_balances.find(a => a.document_id === d.id)?.amount_minor || '0') > 0n : BigInt(d.open_minor) > 0n));
  const body = () => ({ id: form.id, kind: form.kind, party_type: form.party_type, party_id: form.party_id,
    payment_id: form.payment?.id || null, date: form.date, reference: form.reference, amount_minor: pence(form.amount),
    allocations: ['refund', 'reversal'].includes(form.kind) ? [] : Object.entries(form.allocations).filter(([, v]) => v && pence(v) !== '0').map(([document_id, value]) => ({ document_id, amount_minor: pence(value) })) });
  const doReview = async () => { setBusy(true); setError(null); try { const input = body(); const plan = await accounting.reviewPayment(company, input); setReview({ ...plan, input }); } catch (e) { setError(e); } finally { setBusy(false); } };
  const post = async () => {
    if (!review || busy) return; setBusy(true); setError(null);
    try { const saved = await accounting.postPayment(company, { ...review.input, review_token: review.review_token }); setForm(null); setReview(null); await refresh(); setResult(saved); }
    catch (e) { setError(e); if (e.code === 'PAYMENT_REVIEW_STALE') setReview(null); }
    finally { setBusy(false); }
  };
  const saveSetup = async () => { setBusy(true); setError(null); try { await accounting.savePaymentConfiguration(company, { revision: context.configuration?.revision || null, mappings }); await refresh(); setSetup(false); } catch (e) { setError(e); } finally { setBusy(false); } };
  if (!company) return <p>Select a company first.</p>;
  return <div className="mx-auto max-w-6xl space-y-6 pb-28">
    <header className="flex flex-wrap justify-between gap-4"><div><p className="text-sm text-primary">Money in and out</p><h1 className="text-3xl font-semibold">Payments & unapplied cash</h1><p className="mt-2 text-sm text-muted-foreground">Record money already received or paid. Recording here does not instruct a bank transfer.</p></div><div className="flex items-start gap-2"><Button variant="outline" onClick={() => setSetup(v => !v)}>Payment setup</Button><Button disabled={!context?.configuration || !ledger.data} onClick={() => start()}>Record payment</Button></div></header>
    <ErrorBox error={!form ? error || ledger.error : null} onRetry={() => { setTick(t => t + 1); ledger.refresh(); }} />
    {result && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">Payment event recorded. <JournalLink id={result.journal_id} />{params.get('document') && <Link className="ml-4 underline" to={docPath(params.get('party_type') === 'supplier' ? 'purchase_bill' : 'sales_invoice', params.get('document'))}>Back to document</Link>}</div>}
    {!context && !error && <SkeletonRows />}
    {context && setup && <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Payment accounts</h2><p className="text-sm text-muted-foreground">Choose separate nominal accounts for bank/cash, customer credit liabilities and supplier prepayment assets. <Link to="/chart-of-accounts" className="text-primary underline">Create accounts</Link> if needed.</p><div className="grid gap-4 md:grid-cols-3">{[['bank', 'Bank / cash', 'asset'], ['customer_credit', 'Customer credit liability', 'liability'], ['supplier_prepayment', 'Supplier prepayment asset', 'asset']].map(([role, label, type]) => <div key={role}><Label htmlFor={`payment-${role}`}>{label}</Label><select id={`payment-${role}`} className={selectClass} value={mappings[role] || ''} onChange={e => setMappings(m => ({ ...m, [role]: e.target.value }))}><option value="">Choose an account</option>{context.accounts.filter(a => a.is_active && [type, `${type}s`].includes(a.account_type)).map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></div>)}</div><Button disabled={busy} onClick={saveSetup}>Save payment accounts</Button></section>}
    {payments && <div className="overflow-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr>{['Date', 'Party / reference', 'Direction', 'Amount', 'Allocated', 'Unapplied', 'Status', ''].map((h, i) => <th className="p-3 text-left" key={i}>{h}</th>)}</tr></thead><tbody>{[...payments].reverse().map(p => <tr className="border-t" key={p.id}><td className="p-3">{p.effective_date}</td><td className="p-3"><strong>{p.source.party_name}</strong><div className="text-xs text-muted-foreground">{p.reference}</div></td><td className="p-3">{p.party_type === 'customer' ? 'Received' : 'Paid'}</td><td className="p-3"><Money value={p.amount_minor} /></td><td className="p-3"><Money value={p.allocated_minor} /></td><td className="p-3"><Money value={p.unapplied_minor} /></td><td className="p-3">{p.reversed ? 'Reversed' : BigInt(p.refunded_minor) > 0n ? 'Refund recorded' : 'Posted'}</td><td className="p-3"><Button size="sm" variant="outline" onClick={() => setDetail(p)}>Review payment</Button></td></tr>)}</tbody></table>{payments.length === 0 && <p className="p-6 text-sm text-muted-foreground">No payments recorded in the posted ledger.</p>}</div>}
    <Link to="/statements" className="inline-block text-sm text-primary underline">Customer and supplier statements</Link>
    <Dialog open={!!detail && !form} onOpenChange={v => { if (!v) setDetail(null); }}><DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{detail?.reference}</DialogTitle><DialogDescription>{detail?.source.party_name} · Payment history and remaining balance</DialogDescription></DialogHeader>{detail && <><div className="grid grid-cols-3 gap-3"><div>Original amount<p><Money value={detail.amount_minor} /></p></div><div>Allocated<p><Money value={detail.allocated_minor} /></p></div><div>Unapplied<p><Money value={detail.unapplied_minor} /></p></div></div><div className="flex flex-wrap gap-2">{!detail.reversed && <><Button disabled={BigInt(detail.unapplied_minor) === 0n} onClick={() => start('allocation', detail)}>Allocate</Button><Button variant="outline" disabled={BigInt(detail.allocated_minor) === 0n} onClick={() => start('unallocation', detail)}>Undo allocation</Button><Button variant="outline" disabled={BigInt(detail.unapplied_minor) === 0n} onClick={() => start('refund', detail)}>Record refund</Button><Button variant="outline" disabled={detail.unapplied_minor !== detail.amount_minor || BigInt(detail.refunded_minor) > 0n} onClick={() => start('reversal', detail)}>Reverse payment</Button></>}</div><p className="text-xs text-muted-foreground">Undo allocations before reversing a payment. Refunds and reversals remain separate events in the audit history.</p>{detail.events.map(e => <div key={e.id} className="rounded-lg border p-3"><div className="flex justify-between"><span>{e.effective_date} · {labels[e.kind]}</span><Money value={e.amount_minor} /></div><p className="text-sm text-muted-foreground">{e.reference}</p><JournalLink id={e.journal_id} /></div>)}</>}</DialogContent></Dialog>
    <Dialog open={!!form} onOpenChange={v => { if (!v && !busy) { setForm(null); setReview(null); setError(null); } }}><DialogContent className="max-h-[92vh] overflow-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{form ? labels[form.kind] : ''}</DialogTitle><DialogDescription>Review the amount and accounting entries before confirming. No bank transfer is made.</DialogDescription></DialogHeader><ErrorBox error={error} />{form && <>
      {!review ? <><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="pay-type">Party type</Label><select id="pay-type" className={selectClass} disabled={!!form.payment} value={form.party_type} onChange={e => change({ party_type: e.target.value, party_id: '', allocations: {} })}><option value="customer">Customer receipt</option><option value="supplier">Supplier payment</option></select></div><div><Label htmlFor="pay-party">{form.party_type === 'customer' ? 'Customer' : 'Supplier'}</Label><select id="pay-party" className={selectClass} disabled={!!form.payment} value={form.party_id} onChange={e => change({ party_id: e.target.value, allocations: {} })}><option value="">Choose a party</option>{(form.party_type === 'customer' ? context.customers : context.suppliers).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div><Label htmlFor="pay-date">Accounting date</Label><Input id="pay-date" type="date" value={form.date} onChange={e => change({ date: e.target.value })} /></div><div><Label htmlFor="pay-amount">Amount (£)</Label><Input id="pay-amount" inputMode="decimal" value={form.amount} disabled={form.kind === 'reversal'} onChange={e => change({ amount: e.target.value })} /></div><div className="sm:col-span-2"><Label htmlFor="pay-reference">Reference / reason</Label><Input id="pay-reference" maxLength={200} value={form.reference} onChange={e => change({ reference: e.target.value })} /></div></div>
      {['payment', 'allocation', 'unallocation'].includes(form.kind) && <section className="space-y-3"><h3 className="font-medium">{form.kind === 'unallocation' ? 'Amounts to unallocate' : 'Allocate to posted documents'}</h3>{relevant.length ? relevant.map(d => <div key={d.id} className="grid grid-cols-[1fr_auto_120px] items-center gap-3 rounded-lg border p-3"><div><Link to={docPath(d.kind, d.id)} className="text-sm font-medium text-primary">{d.number}</Link><p className="text-xs text-muted-foreground">Due {d.due_date}</p></div><div className="text-xs">{form.kind === 'unallocation' ? 'Allocated' : 'Open'} <Money value={form.kind === 'unallocation' ? form.payment.allocation_balances.find(a => a.document_id === d.id)?.amount_minor : d.open_minor} /></div><div><Label className="sr-only" htmlFor={`allocate-${d.id}`}>Amount for {d.number}</Label><Input id={`allocate-${d.id}`} inputMode="decimal" placeholder="0.00" value={form.allocations[d.id] || ''} onChange={e => change({ allocations: { ...form.allocations, [d.id]: e.target.value } })} /></div></div>) : <p className="text-sm text-muted-foreground">No eligible posted documents for this party.</p>}<p className="text-xs text-muted-foreground">Any unallocated receipt becomes customer credit; an unallocated supplier payment becomes a supplier prepayment. Allocating later does not record cash twice.</p></section>}<Button disabled={busy || !form.party_id} onClick={doReview}>{busy ? 'Preparing review…' : 'Review accounting entries'}</Button></>
      : <div className="space-y-4"><div className="rounded-xl bg-muted/50 p-4"><p className="font-semibold">{review.party_name} · {form.reference}</p><p>{form.date} · <Money value={review.input.amount_minor} /></p><p className="text-sm">Unapplied balance after this event: <Money value={review.unapplied_minor} /></p></div><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Account</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr></thead><tbody>{review.lines.map((l, i) => { const a = review.source.accounts.find(a => a.id === l.accountId); return <tr className="border-t" key={i}><td className="p-2">{a?.code} · {a?.name}</td><td className="p-2 text-right"><Money value={l.debitMinor} /></td><td className="p-2 text-right"><Money value={l.creditMinor} /></td></tr>; })}</tbody></table><p className="text-sm text-muted-foreground">Confirming creates an immutable journal and updates balances, ageing and statements. Standard invoice-basis VAT and profit are unchanged by this payment event.</p><div className="flex gap-3"><Button variant="outline" disabled={busy} onClick={() => setReview(null)}>Back to edit</Button><Button disabled={busy} onClick={post}>{busy ? 'Recording…' : 'Confirm and record'}</Button></div></div>}
    </>}</DialogContent></Dialog>
  </div>;
}
