import { fail } from '../financialDrafts/contract';
import type { Queryable } from './core';

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
  const remaining=BigInt(r.money.gross_pence)-BigInt(credits)-appliedTo(events??await paymentEvents(q,company),id);
  if(remaining<0n) fail(503,'SETTLEMENT_LEDGER_MISMATCH');
  return {...r,open_minor:remaining.toString()};
}
