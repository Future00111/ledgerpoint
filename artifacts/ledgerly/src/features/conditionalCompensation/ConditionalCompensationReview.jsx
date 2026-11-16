import React, { useEffect, useRef, useState } from 'react';
import { accounting, penceToDisplay } from '../../api/accountingDocuments.mjs';

export function compensationInput(item, payment, amount, date, reason, request, action = 'unallocate') {
  if (!['unallocate','reverse_payment'].includes(action)) throw Error('Choose a supported adjustment.');
  if (!item || !item.payment_ids.includes(payment) || !/^\d+(\.\d{1,2})?$/.test(amount)) throw Error('Choose the original payment and enter an amount with no more than two decimal places.');
  const [whole, fraction = ''] = amount.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (minor <= 0n || !reason.trim()) throw Error('Enter a positive amount and an adjustment reason.');
  return { request_id: request, original_id: item.original_id, credit_id: item.credit_id, payment_id: payment,
    amount_minor: minor.toString(), date, reason: reason.trim(),
    ...(action === 'reverse_payment' ? { payment_action: action } : {}) };
}
export function ConditionalCompensationReview({ review, onConfirm, busy }) {
  return <section aria-label="Discount compensation review" className="space-y-3 rounded-xl border p-4">
    <h3 className="font-semibold">Review discount compensation</h3>
    <p>Original {review.original_number}; discount credit {review.credit_number}.</p>
    <dl><dt>Full discount to reverse</dt><dd>{penceToDisplay(review.credit_money.gross_pence)}</dd>
      <dt>Original net / VAT</dt><dd>{penceToDisplay(review.credit_money.net_pence)} / {penceToDisplay(review.credit_money.vat_pence)}</dd>
      <dt>Allocation to undo</dt><dd>{penceToDisplay(review.unallocated_minor)}</dd>
      <dt>Allocated afterwards</dt><dd>{penceToDisplay(review.after_allocated_minor)}</dd>
      <dt>Outstanding afterwards</dt><dd>{penceToDisplay(review.after_open_minor)}</dd>
      {review.payment_action === 'reverse_payment' && <><dt>Full payment to reverse</dt><dd>{penceToDisplay(review.cash_reversal.amount_minor)}</dd>
        <dt>Change in bank balance</dt><dd>{penceToDisplay(review.cash_change_minor)}</dd></>}
      {review.after_unapplied_minor !== undefined && <><dt>Unapplied balance afterwards</dt><dd>{penceToDisplay(review.after_unapplied_minor)}</dd></>}
      {review.refunded_minor !== undefined && <><dt>Already refunded — unchanged</dt><dd>{penceToDisplay(review.refunded_minor)}</dd></>}
      <dt>Effective date</dt><dd>{review.intent.date}</dd><dt>Reason</dt><dd>{review.intent.reason}</dd></dl>
    <p>{review.payment_action === 'reverse_payment'
      ? 'This reverses the full payment in your accounts and changes the recorded bank balance. It does not send money or reclaim a refund. All three adjustments must commit together.'
      : 'Cash does not change. Both adjustments must commit together.'} Original documents stay read-only and the discount cannot be redeemed again.</p>
    {review.preserved_refunds?.length > 0 && <p>Existing refunds stay recorded. This adjustment does not reclaim refunded money.</p>}
    {!onConfirm && <p role="status">Review only. Posting is unavailable. Nothing has been posted.</p>}
    <button type="button" disabled={!onConfirm || busy} onClick={onConfirm} className="rounded-md border px-3 py-2">{onConfirm ? 'Confirm discount adjustment' : 'Confirm posting — unavailable'}</button>
  </section>;
}
export function CompensationRecovery({ outcome }) {
  if (!outcome) return null;
  return outcome.state === 'known' ? <p role="status">Committed request found.
    <a className="ml-2 underline" href={`/accounting/journals/${encodeURIComponent(outcome.reversal_journal_id)}`}>Discount reversal journal</a>
    <a className="ml-2 underline" href={`/accounting/journals/${encodeURIComponent(outcome.unallocation_journal_id)}`}>Allocation journal</a>
    {outcome.cash_reversal_journal_id && <a className="ml-2 underline" href={`/accounting/journals/${encodeURIComponent(outcome.cash_reversal_journal_id)}`}>Payment reversal journal</a>} <a href="/payments" className="underline">Refresh payment balances</a> to view the updated balances.</p> :
    <p role="status">No committed result was found for this request. Its outcome is unknown; do not submit another request or assume it was cancelled.</p>;
}
export const compensationKey = company => `ledgerly:compensation:${company}`;
export function readCompensationPending(storage, company) {
  const raw=storage.getItem(compensationKey(company)); if(!raw)return null;
  const value=JSON.parse(raw);
  if(value.company!==company || typeof value.request!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.request))throw Error('Saved adjustment reference is invalid. Do not submit another adjustment.');
  return value;
}
export function saveCompensationPending(storage, company, request) {
  const existing=readCompensationPending(storage,company);
  if(existing && existing.request!==request)throw Error('Another adjustment is pending. Reload to check its outcome.');
  const value={company,request}; storage.setItem(compensationKey(company),JSON.stringify(value));
  if(readCompensationPending(storage,company)?.request!==request)throw Error('Unable to save adjustment recovery reference.');
  return value;
}
export function validateCompensationOutcome(result, request) {
  if(result?.state==='unknown' && result.request_id===request)return result;
  if((result?.state!==undefined && result.state!=='known') || result?.request_id!==request || !['posted','duplicate'].includes(result.status) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(result.reversal_journal_id||'') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(result.unallocation_journal_id||'') || (result.cash_reversal_journal_id!==undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(result.cash_reversal_journal_id)))throw Error('Adjustment result could not be verified. Check its outcome.');
  return {...result,state:'known'};
}
const inputClass = 'rounded-md border bg-background px-3 py-2 w-full';
export default function ConditionalCompensationPanel({ company, client = accounting }) {
  return <CompensationSession key={company} company={company} client={client} />;
}
function CompensationSession({ company, client }) {
  const [context, setContext] = useState(null), [error, setError] = useState(null);
  const [choice, setChoice] = useState(''), [payment, setPayment] = useState('');
  const [action, setAction] = useState('unallocate');
  const [amount, setAmount] = useState(''), [date, setDate] = useState(''), [reason, setReason] = useState('');
  const [review, setReview] = useState(null), [busy, setBusy] = useState(false), [outcome, setOutcome] = useState(null);
  const [saved] = useState(() => {try{return {pending:readCompensationPending(localStorage,company)}}catch(error){return {error}}});
  const [pending,setPending]=useState(saved.pending||null);
  const [request, setRequest] = useState(() => saved.pending?.request || crypto.randomUUID());
  const locked=!!pending || !!saved.error || busy || outcome?.state==='known';
  const generation = useRef(0);
  const abort = useRef(null);
  useEffect(() => {
    const c = new AbortController();
    client.compensationContext(company, c.signal).then(result => { if (!c.signal.aborted) setContext(result); }).catch(e => { if (!c.signal.aborted) setError(e); });
    if(saved.pending) recover();
    return () => { c.abort(); generation.current++; abort.current?.abort(); };
  }, [company, client]);
  const invalidate = () => { generation.current++; abort.current?.abort(); setBusy(false); setReview(null); setOutcome(null); setError(null); };
  const item = context?.items.find(i => i.credit_id === choice);
  async function preview() {
    if(locked)return;
    invalidate();
    const token = ++generation.current, c = new AbortController(); abort.current = c; setBusy(true);
    try {
      const body = compensationInput(item, payment, amount, date, reason, request, action);
      const result = await client.reviewCompensation(company, body, c.signal);
      if(result?.posting_available!==true || !/^sha256:[a-f0-9]{64}$/.test(result.review_token||'') || Object.keys(body).some(k=>result.intent?.[k]!==body[k]) || Object.keys(result.intent||{}).some(k=>k!=='payment_action' && !(k in body)) || (result.intent?.payment_action||'unallocate')!==(body.payment_action||'unallocate'))throw Error('Adjustment review did not match the requested action.');
      if (token === generation.current) setReview(result);
    } catch (e) { if (token === generation.current) setError(e); }
    finally { if (token === generation.current) setBusy(false); }
  }
  function accept(result, id) {
    const verified=validateCompensationOutcome(result,id);
    setOutcome(verified);
    if(verified.state==='known') {
      const current=readCompensationPending(localStorage,company);
      if(current?.request===id)localStorage.removeItem(compensationKey(company));
      setPending(null);setReview(null);
    }
  }
  async function commit() {
    if(locked || !review)return;
    const token=++generation.current,c=new AbortController();abort.current=c;
    try {
      const id=review.intent.request_id;
      setPending(saveCompensationPending(localStorage,company,id));setBusy(true);setError(null);
      const result=await client.commitCompensation(company,{...review.intent,review_token:review.review_token},c.signal);
      if(token===generation.current)accept(result,id);
    }catch(e){if(token===generation.current)setError(e);}
    finally{if(token===generation.current)setBusy(false);}
  }
  async function recover() {
    invalidate(); const token = ++generation.current, c = new AbortController(); abort.current = c; setBusy(true);
    try { setPending(saveCompensationPending(localStorage,company,request)); const result = await client.recoverCompensation(company, request, c.signal); if (token === generation.current) accept(result,request); }
    catch (e) { if (token === generation.current) setError(e); }
    finally { if (token === generation.current) setBusy(false); }
  }
  const change = setter => e => { if(locked)return; invalidate(); setter(e.target.value); };
  return <details className="workspace-card space-y-3">
    <summary className="cursor-pointer font-semibold">Conditional discount adjustments</summary>
    <p className="text-sm">Review a discount adjustment with an allocation undo or a full payment reversal. Full payment reversal changes recorded cash and is unavailable after any refund or allocation to another document.</p>
    {(error||saved.error) && <p role="alert">{(error||saved.error).message} {pending ? 'The adjustment outcome is unknown. Check its outcome before any further adjustment.' : 'No new adjustment has been confirmed.'}</p>}
    {pending && <p role="status">Adjustment request pending. Its outcome is unknown; do not submit another request. Reference: {pending.request}</p>}
    {!context && !error && <p role="status">Loading discount history…</p>}
    {context && !context.available && <p>Discount compensation is unavailable in this company’s database version.</p>}
    {context?.available && !context.can_review && <p>An owner or accountant with posting and reversal permission must review this adjustment.</p>}
    {context?.available && context.can_review && <>
      <fieldset disabled={locked} className="space-y-3">
      <label className="block">Adjustment<select className={inputClass} value={action} onChange={change(setAction)}>
        <option value="unallocate">Undo an allocation — cash unchanged</option>
        <option value="reverse_payment">Reverse full payment — changes cash</option>
      </select></label>
      <label className="block">Original document and discount credit<select className={inputClass} value={choice} onChange={e => { if(locked)return; invalidate(); setChoice(e.target.value); setPayment(''); }}>
        <option value="">Choose a redeemed discount</option>
        {context.items.map(i => <option key={i.credit_id} value={i.credit_id} disabled={!!i.compensation_request_id}>{i.original_number} / {i.credit_number}{i.compensation_request_id ? ' — already compensated' : ''}</option>)}
      </select></label>
      <label className="block">Original qualifying payment<select className={inputClass} value={payment} onChange={change(setPayment)}>
        <option value="">Choose payment</option>{item?.payment_ids.map(id => <option key={id} value={id}>{id}</option>)}</select></label>
      <label className="block">{action === 'reverse_payment' ? 'Full remaining allocation to undo (£)' : 'Allocation to undo (£)'}<input className={inputClass} inputMode="decimal" value={amount} onChange={change(setAmount)} /></label>
      <label className="block">Effective adjustment date<input className={inputClass} type="date" value={date} onChange={change(setDate)} /></label>
      <label className="block">Adjustment reason<input className={inputClass} maxLength={1000} value={reason} onChange={change(setReason)} /></label>
      <div className="flex gap-3"><button type="button" className="rounded-md border px-3 py-2" disabled={busy || !item} onClick={preview}>Review adjustment</button>
        <button type="button" className="rounded-md border px-3 py-2" onClick={() => { if(locked)return; invalidate(); setRequest(crypto.randomUUID()); }}>Cancel review</button></div>
      </fieldset>
      {review && !pending && <ConditionalCompensationReview review={review} onConfirm={context.posting_available && !pending && !saved.error && outcome?.state!=='known' ? commit : undefined} busy={busy} />}
      <label className="block">Request reference<input disabled={locked} className={inputClass} value={request} onChange={change(setRequest)} /></label>
      <button type="button" className="rounded-md border px-3 py-2" disabled={busy} onClick={recover}>Check request outcome</button>
      <CompensationRecovery outcome={outcome} />
    </>}
  </details>;
}
