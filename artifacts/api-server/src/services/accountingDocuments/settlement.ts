import { fail } from '../financialDrafts/contract';
import type { Queryable } from './core';
import { pounds, tables, type Kind } from './core';

export function settlementAmounts(gross:string, credited:string, paid:string) {
  const remaining=BigInt(gross)-BigInt(credited)-BigInt(paid);
  if(remaining<0n || BigInt(credited)<0n || BigInt(paid)<0n) fail(503,'SETTLEMENT_LEDGER_MISMATCH');
  return {gross_minor:gross,credited_minor:credited,paid_minor:paid,open_minor:remaining.toString(),
    settlement:remaining===0n?'settled':BigInt(paid)+BigInt(credited)>0n?'part_paid':'outstanding'};
}

export const allocated = (event:any) => (event.allocations as any[]).reduce((n,a)=>n+BigInt(a.amount_minor),0n);
export const allocationSign = (event:any) => event.kind==='unallocation'?-1n:1n;
export function unappliedEffect(event:any):bigint {
  const amount=BigInt(event.amount_minor);
  if(event.kind==='payment') return amount-allocated(event);
  if(event.kind==='allocation') return -amount;
  if(event.kind==='unallocation') return amount;
  return -amount;
}
export async function paymentEvents(q:Queryable,company:string,to='9999-12-31') {
  return (await q.query(`SELECT e.*,e.effective_date::text FROM accounting_payment_events e
    JOIN canonical_journal_entries j ON j.id=e.journal_id AND j.company_id=e.company_id
      AND j.source_id=e.id::text AND j.source_type='accounting_payment_event' AND j.status='posted'
    WHERE e.company_id=$1 AND e.effective_date<=$2::date ORDER BY e.effective_date,e.created_at,e.id`,[company,to])).rows;
}
export function appliedTo(events:any[],id:string,paymentId?:string) {
  return events.filter(e=>!paymentId || e.id===paymentId || e.payment_id===paymentId)
    .reduce((n,e)=>n+allocationSign(e)*(e.allocations as any[]).filter(a=>a.document_id===id)
      .reduce((v,a)=>v+BigInt(a.amount_minor),0n),0n);
}
export async function documentOpen(q:Queryable,company:string,id:string,events?:any[]) {
  const r=(await q.query(`SELECT d.*,j.posting_date::text FROM accounting_document_sources d
    JOIN canonical_journal_entries j ON j.id=d.journal_id AND j.company_id=d.company_id AND j.status='posted'
    WHERE d.company_id=$1 AND d.id=$2 AND d.status='posted'`,[company,id])).rows[0];
  if(!r || !['sales_invoice','purchase_bill'].includes(r.kind)) fail(422,'POSTED_DOCUMENT_REQUIRED');
  const credits=(await q.query(`SELECT coalesce(sum((money->>'gross_pence')::numeric),0)::text amount
    FROM accounting_document_sources WHERE company_id=$1 AND original_id=$2 AND status='posted'`,[company,id])).rows[0].amount;
  return {...r,...settlementAmounts(r.money.gross_pence,credits,appliedTo(events??await paymentEvents(q,company),id).toString())};
}

// Compatibility fields are read models only. Update them inside the SAME
// protected posting transaction so older collection/customer readers agree.
// Never change the original total or the immutable document/journal history.
export async function syncSettlementProjection(q:Queryable,company:string,id:string) {
  const d=await documentOpen(q,company,id);
  await q.query(`UPDATE ${tables[d.kind as Kind]} SET amount_paid=$3,balance_due=$4,status=$5,
    updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2`,
    [company,id,pounds(d.paid_minor),pounds(d.open_minor),d.settlement==='settled'?'paid':d.settlement==='part_paid'?'part_paid':'posted']);
  return d;
}

// Legacy bank matching cannot amend native balances without a protected journal.
export async function assertLegacySettlementAllowed(q:Queryable,company:string,ids:string[]) {
  if (!ids.length) return;
  const installed=(await q.query("SELECT to_regclass('public.accounting_document_sources') present")).rows[0].present;
  if (!installed) return;
  const native=await q.query('SELECT id FROM accounting_document_sources WHERE company_id=$1 AND id=ANY($2::uuid[]) LIMIT 1',[company,ids]);
  if (native.rowCount) throw new Error('Use Payments to record or allocate payment for this document. Bank matching for posted accounting documents is not connected yet.');
}
