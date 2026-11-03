import { fail, uuid } from '../financialDrafts/contract';
import { hash, scope, transact } from './core';

/** A receipt of observation, not the payment's actual commit timestamp. Only a
 * fresh transaction can establish that the source was already committed. Never
 * accept an injected transaction, connection, timestamp, hash or source row. */
export async function captureCommittedPaymentWitness(company:string, actor:string, eventId:string) {
  uuid(eventId);
  return transact(async q=>{
    await scope(q,company,actor,true,true);
    const installed=(await q.query("SELECT to_regclass('public.conditional_discount_commit_witnesses') present")).rows[0]?.present;
    if(!installed) return {status:'unavailable' as const};
    const guards=(await q.query(`SELECT count(*)::int n FROM pg_trigger
      WHERE tgrelid IN ('public.conditional_discount_commit_witnesses'::regclass,
        'public.conditional_discount_payment_transactions'::regclass,'public.accounting_payment_events'::regclass) AND NOT tgisinternal
      AND tgenabled='A' AND tgname IN ('conditional_discount_witness_immutable','conditional_discount_witness_no_truncate','conditional_discount_witness_observe',
        'conditional_discount_payment_transaction','conditional_discount_transaction_immutable','conditional_discount_transaction_no_truncate')`)).rows[0];
    if(guards?.n!==6) fail(503,'CONDITIONAL_WITNESS_SCHEMA_INCOMPLETE');
    const constraints=(await q.query(`SELECT count(*)::int n FROM pg_constraint
      WHERE conrelid IN ('public.conditional_discount_commit_witnesses'::regclass,
        'public.conditional_discount_payment_transactions'::regclass) AND convalidated
      AND conname IN ('conditional_discount_witness_pk','conditional_discount_witness_event_fk',
        'conditional_discount_witness_journal_fk','conditional_discount_witness_hash','conditional_discount_witness_clock',
        'conditional_discount_transaction_pk','conditional_discount_transaction_event_fk')`)).rows[0];
    if(constraints?.n!==7) fail(503,'CONDITIONAL_WITNESS_SCHEMA_INCOMPLETE');
    const read=async(id:string)=>{
      const e=(await q.query(`SELECT e.*,e.effective_date::text event_effective_date,e.created_at::text event_created_at,
        j.id verified_journal_id,j.source_revision,p.id verified_effect_id
        FROM accounting_payment_events e
        LEFT JOIN canonical_journal_entries j ON j.id=e.journal_id AND j.company_id=e.company_id
          AND j.source_id=e.id::text AND j.source_type='accounting_payment_event' AND j.status='posted'
          AND j.currency_code='GBP' AND j.posting_kind='party_'||e.kind
          AND j.posting_date=e.effective_date AND j.reference=e.reference
          AND j.economic_effect_id='payment-event:'||e.id::text
        LEFT JOIN accounting_posting_effects p ON p.company_id=e.company_id AND p.journal_id=j.id
          AND p.source_type=j.source_type AND p.source_id=j.source_id AND p.posting_kind=j.posting_kind
          AND p.economic_effect_id=j.economic_effect_id AND p.idempotency_key='payment-event:'||e.id::text
          AND p.status='posted' AND p.source_revision=j.source_revision
        WHERE e.company_id=$1 AND e.id=$2`,[company,id])).rows[0];
      if(!e) fail(404,'RESOURCE_NOT_FOUND');
      if(!e.verified_journal_id || !e.verified_effect_id || e.source_revision!==hash(e.source)) fail(503,'PAYMENT_HISTORY_INVALID');
      const intent=e.source?.intent;
      if(!intent || intent.id!==e.id || intent.kind!==e.kind || intent.payment_id!==e.payment_id ||
        intent.party_id!==e.party_id || intent.party_type!==e.party_type ||
        intent.date!==e.event_effective_date || intent.reference!==e.reference ||
        hash(intent.allocations)!==hash(e.allocations) || intent.amount_minor!==String(e.amount_minor)) fail(503,'PAYMENT_HISTORY_INVALID');
      return e;
    };
    const event=await read(eventId);
    if(!['payment','allocation'].includes(event.kind)) return {status:'not_applicable' as const};
    if(event.kind==='allocation') {
      const parent=await read(event.payment_id);
      if(parent.kind!=='payment'||parent.party_id!==event.party_id||parent.party_type!==event.party_type) fail(503,'PAYMENT_HISTORY_INVALID');
    }
    const existing=(await q.query(`SELECT company_id,event_id,journal_id,event_source_hash,
      observed_at::text, event_created_at::text FROM conditional_discount_commit_witnesses
      WHERE company_id=$1 AND event_id=$2`,[company,event.id])).rows[0];
    // An immutable historical observation survives a verified restore. Do not
    // recertify its transaction id in another cluster or replace its first clock.
    let witness=existing;
    if(!witness) {
      // Trigger requires the recorded TOP xid to be committed in its original
      // cluster, then obtains a fresh observation clock. No historical backfill.
      await q.query(`INSERT INTO conditional_discount_commit_witnesses
        (company_id,event_id,journal_id,event_source_hash,actor_id)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(company_id,event_id) DO NOTHING`,
        [company,event.id,event.journal_id,event.source_revision,actor]);
      witness=(await q.query(`SELECT company_id,event_id,journal_id,event_source_hash,
        observed_at::text, event_created_at::text FROM conditional_discount_commit_witnesses
        WHERE company_id=$1 AND event_id=$2`,[company,event.id])).rows[0];
    }
    if(!witness || witness.journal_id!==event.journal_id || witness.event_source_hash!==event.source_revision ||
      witness.event_created_at!==event.event_created_at) fail(503,'CONDITIONAL_WITNESS_INVALID');
    return {status:'recorded' as const,witness};
  });
}

/** A post-commit observer must never turn an already committed payment into an
 * apparent failure. Admission will require a verified persisted witness, never
 * this response status. In-transaction paid-credit children are not observable. */
export async function observePaymentOutcome<T>(result:T, company:string, actor:string, eventId:string,
  kind:string, existingTransaction:boolean) {
  if(existingTransaction || !['payment','allocation'].includes(kind)) return result;
  try {
    const receipt=await captureCommittedPaymentWitness(company,actor,eventId);
    return {...result,conditional_discount_witness:receipt.status};
  } catch {
    return {...result,conditional_discount_witness:'unavailable'};
  }
}
