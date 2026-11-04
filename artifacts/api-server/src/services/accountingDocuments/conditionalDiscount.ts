import { createHash } from 'node:crypto';
import { conditionalTermsHash, parseConditionalTerms, type InvoiceSource } from '../financialDrafts/contract';
import { fail, uuid } from '../financialDrafts/contract';
import { hash, scope, transact, exactFields, type Queryable } from './core';
import { allocateDiscount, creditFromGross } from '../financialDrafts/discounts';
import { decimal } from '../financialDrafts/contract';

/** Original evidence is usable only with the complete protected schema. */
export async function conditionalOriginalSchema(q:Queryable) {
  const names=['conditional_discount_journal_origins','conditional_discount_original_bindings','conditional_discount_original_observations'];
  const tables=await q.query(`SELECT name,to_regclass('public.'||name) present FROM unnest($1::text[]) name`,[names]);
  if(tables.rows.length!==3 || tables.rows.some((r:any)=>!r.present)) fail(503,'CONDITIONAL_BINDING_SCHEMA_INCOMPLETE');
  const integrity=(await q.query(`SELECT count(*)::int n,
    bool_and(pg_get_userbyid(relowner)='ledgerly_canonical_owner') owned,
    bool_or(has_table_privilege('ledgerly_api',oid,'INSERT,UPDATE,DELETE,TRUNCATE')) writable
    FROM pg_class WHERE oid=ANY($1::regclass[])`,[names.map(n=>'public.'+n)])).rows[0];
  const guards=(await q.query(`SELECT count(*)::int n FROM pg_trigger t JOIN
    (VALUES ('canonical_journal_entries','conditional_discount_journal_origin'),
      ('conditional_discount_original_bindings','conditional_discount_original_bind'),
      ('conditional_discount_original_observations','conditional_discount_original_observe'),
      ('conditional_discount_journal_origins','conditional_original_immutable'),
      ('conditional_discount_journal_origins','conditional_original_no_truncate'),
      ('conditional_discount_original_bindings','conditional_original_immutable'),
      ('conditional_discount_original_bindings','conditional_original_no_truncate'),
      ('conditional_discount_original_observations','conditional_original_immutable'),
      ('conditional_discount_original_observations','conditional_original_no_truncate')) expected(rel,name)
      ON t.tgrelid=to_regclass('public.'||expected.rel) AND t.tgname=expected.name
    WHERE t.tgenabled='A' AND NOT t.tgisinternal`)).rows[0];
  const constraints=(await q.query(`SELECT count(*)::int n FROM pg_constraint
    WHERE conrelid=ANY($1::regclass[]) AND convalidated`,[names.map(n=>'public.'+n)])).rows[0];
  if(integrity?.n!==3 || integrity.owned!==true || integrity.writable!==false || guards?.n!==9 || constraints?.n!==10)
    fail(503,'CONDITIONAL_BINDING_SCHEMA_INCOMPLETE');
}

/** Internal prerequisite only. Neither public posting admission gate calls this. */
export function frozenConditionalVector(row:any) {
  const terms=row.source?.conditional_discount;
  if(!terms || !['sales_invoice','purchase_bill'].includes(row.kind) ||
    row.original_id || row.money?.lines?.length!==row.tax_context?.lines?.length) fail(422,'CONDITIONAL_BINDING_INVALID');
  const gross=BigInt(row.money.gross_pence), discount=BigInt(terms.discount_gross_pence);
  if(discount<=0n || discount>=gross ||
    row.money.lines.reduce((n:bigint,l:any)=>n+BigInt(l.gross_pence),0n)!==gross) fail(422,'CONDITIONAL_BINDING_INVALID');
  const portions=allocateDiscount(row.money.lines.map((l:any)=>BigInt(l.gross_pence)),discount);
  return portions.map((amount,i)=>{
    const tax=row.tax_context.lines[i],line=row.money.lines[i];
    const rate=decimal(String(tax.rate),false)/100n;
    const {net,vat}=creditFromGross(amount,line,rate);
    return {line_ref:String(i),net_pence:net.toString(),vat_pence:vat.toString(),
      gross_pence:amount.toString(),original:line,tax};
  });
}

/** Must run on the ORIGINAL posting connection. The DB compares its top xid
 * with the journal's DB-owned INSERT receipt, including released savepoints. */
export async function bindConditionalOriginal(q:Queryable,company:string,actor:string,id:string) {
  await scope(q,company,actor,true,true);
  await conditionalOriginalSchema(q);
  const row=(await q.query(`SELECT * FROM accounting_document_sources WHERE company_id=$1 AND id=$2 FOR UPDATE`,[company,uuid(id)])).rows[0];
  if(!row || row.status!=='posted') fail(409,'CONDITIONAL_ORIGINAL_NOT_POSTED');
  const {binding,canonicalPayload,bindingHash}=await prepareConditionalOriginal(q,company,row);
  const existing=(await q.query(`SELECT * FROM conditional_discount_original_bindings
    WHERE company_id=$1 AND document_id=$2`,[company,id])).rows[0];
  if(existing) {
    if(existing.journal_id!==row.journal_id || existing.binding_hash!==bindingHash || existing.canonical_payload!==canonicalPayload ||
      canonicalConditionalPayload(existing.binding)!==existing.canonical_payload) fail(503,'CONDITIONAL_BINDING_INVALID');
    if(!(await verifiedOriginal(q,company,id,bindingHash))) fail(503,'CONDITIONAL_BINDING_INVALID');
    return binding; // Exact immutable retry; never insert a new historical binding.
  }
  await q.query(`SELECT public.bind_conditional_discount_original($1::uuid,$2::uuid,$3::uuid,$4::jsonb,$5::text,$6::text,$7::text)`,
    [company,id,row.journal_id,JSON.stringify(binding),bindingHash,actor,canonicalPayload]);
  return binding;
}
/** The exact native UTF8 bytes are committed by canonical posting BEFORE its
 * journal INSERT. SQL hashes these bytes and parses for equality; it never
 * serializes JSON or recalculates discount/VAT money. Journal linkage is separate. */
export function canonicalConditionalPayload(binding:unknown):string {
  const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'
    ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  const payload=JSON.stringify(canonical(binding));
  if(typeof payload!=='string' || Buffer.byteLength(payload,'utf8')>1048576 || payload.length===0)
    fail(422,'CONDITIONAL_BINDING_INVALID');
  return payload;
}
export async function prepareConditionalOriginal(q:Queryable,company:string,row:any) {
  await validateConditionalDraft(q,company,row.source,row.kind==='sales_invoice'?'customer':'supplier',row.money.gross_pence);
  const vector=frozenConditionalVector(row);
  const evidence=await readConditionalEvidence(q,company,row.source.conditional_discount.evidence_receipt_id);
  const snapshot={source:row.source,money:row.money,tax_context:row.tax_context,accounts:row.posting_accounts};
  const binding={version:1,company_id:company,document_id:row.id,revision:row.revision,source_hash:hash(row.source),financial_hash:hash(snapshot),
    party_id:row.party_id,currency:'GBP',evidence_id:evidence.id,
    terms_hash:evidence.terms_hash,gross_pence:row.money.gross_pence,
    discount_gross_pence:row.source.conditional_discount.discount_gross_pence,
    deadline:row.source.conditional_discount.payment_deadline,vector};
  const canonicalPayload=canonicalConditionalPayload(binding);
  return {binding,canonicalPayload,bindingHash:hash(binding)};
}

async function verifiedOriginal(q:Queryable,company:string,id:string,bindingHash:string) {
  return (await q.query(`SELECT d.* FROM accounting_document_sources d
      JOIN canonical_journal_entries j ON j.company_id=d.company_id AND j.id=d.journal_id
      JOIN accounting_posting_effects p ON p.company_id=j.company_id AND p.journal_id=j.id
      WHERE d.company_id=$1 AND d.id=$2 AND d.status='posted' AND j.status='posted'
        AND j.posting_kind='ordinary_document' AND j.economic_effect_id='document:'||d.id::text AND j.currency_code='GBP'
        AND j.source_type=d.kind AND j.source_id=d.id::text AND j.source_revision=d.revision::text
        AND j.source_evidence_hash=$3 AND p.source_evidence_hash=j.source_evidence_hash
        AND p.source_revision=j.source_revision AND p.source_type=j.source_type
        AND p.source_id=j.source_id AND p.posting_kind=j.posting_kind
        AND p.economic_effect_id=j.economic_effect_id AND p.status='posted'`,
      [company,id,bindingHash])).rows[0];
}

/** A separately opened transaction observes an already committed original.
 * Retry returns the first DB clock, never a caller-selected replacement clock. */
export async function observeConditionalOriginal(company:string,actor:string,id:string) {
  return transact(async q=>{
    await scope(q,company,actor,true,true);
    await conditionalOriginalSchema(q);
    const row=(await q.query(`SELECT * FROM conditional_discount_original_bindings WHERE company_id=$1 AND document_id=$2`,[company,uuid(id)])).rows[0];
    if(!row) fail(404,'RESOURCE_NOT_FOUND');
    if(!row.binding || row.binding_hash!==hash(row.binding) || canonicalConditionalPayload(row.binding)!==row.canonical_payload) fail(503,'CONDITIONAL_BINDING_INVALID');
    const original=await verifiedOriginal(q,company,id,row.binding_hash);
    if(!original || original.journal_id!==row.journal_id) fail(503,'CONDITIONAL_BINDING_INVALID');
    // Reconstruct every field from native source and immutable evidence. A caller
    // recomputing the hash of a poisoned snapshot cannot make it authoritative.
    const expected=await prepareConditionalOriginal(q,company,original);
    if(expected.bindingHash!==row.binding_hash || expected.canonicalPayload!==row.canonical_payload) fail(503,'CONDITIONAL_BINDING_INVALID');
    const existing=(await q.query(`SELECT observed_at::text FROM conditional_discount_original_observations
      WHERE company_id=$1 AND document_id=$2`,[company,id])).rows[0];
    if(existing) return existing;
    await q.query(`SELECT public.observe_conditional_discount_original($1::uuid,$2::uuid,$3::text)`,[company,id,actor]);
    return (await q.query(`SELECT observed_at::text FROM conditional_discount_original_observations
      WHERE company_id=$1 AND document_id=$2`,[company,id])).rows[0];
  });
}

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

/** Native text evidence is immutable preparation only; it cannot admit posting. */
export function evidenceBytes(value: unknown): Buffer {
  if(typeof value!=='string' || !value.trim() || value.includes('\u0000') ||
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) fail(422,'CONDITIONAL_EVIDENCE_INVALID');
  const bytes=Buffer.from(value,'utf8');
  if(bytes.length>65536) fail(422,'CONDITIONAL_EVIDENCE_TOO_LARGE');
  return bytes;
}
async function evidenceSchema(q:Queryable) {
  const installed=(await q.query("SELECT to_regclass('public.conditional_discount_evidence') present")).rows[0]?.present;
  if(!installed) fail(503,'CONDITIONAL_EVIDENCE_SCHEMA_UNAVAILABLE');
  const guards=(await q.query(`SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='public.conditional_discount_evidence'::regclass
    AND tgenabled='A' AND NOT tgisinternal AND tgname IN ('conditional_discount_evidence_immutable','conditional_discount_evidence_no_truncate')`)).rows[0];
  if(guards?.n!==2) fail(503,'CONDITIONAL_EVIDENCE_SCHEMA_INCOMPLETE');
  const integrity=(await q.query(`SELECT (SELECT count(*)::int FROM pg_constraint WHERE conrelid='public.conditional_discount_evidence'::regclass AND convalidated) n,
    pg_get_userbyid(relowner) owner,has_table_privilege('ledgerly_api',oid,'INSERT,UPDATE,DELETE,TRUNCATE') writable
    FROM pg_class WHERE oid='public.conditional_discount_evidence'::regclass`)).rows[0];
  if(integrity?.n!==11 || integrity.owner!=='ledgerly_canonical_owner' || integrity.writable) fail(503,'CONDITIONAL_EVIDENCE_SCHEMA_INCOMPLETE');
}
function verifyEvidence(row:any) {
  if(!row || row.version!==1 || row.attested!==true || row.currency!=='GBP' ||
    row.evidence_hash!==`sha256:${createHash('sha256').update(evidenceBytes(row.evidence_text)).digest('hex')}` ||
    row.terms_hash!==conditionalTermsHash(row.terms) || row.party_id!==row.terms.party_id ||
    row.party_type!==row.terms.party_type || row.currency!==row.terms.currency) fail(503,'CONDITIONAL_EVIDENCE_INVALID');
  return row;
}
export async function readConditionalEvidence(q:Queryable,company:string,id:string) {
  await evidenceSchema(q);
  const row=(await q.query(`SELECT *,recorded_at::text AS recorded_at FROM conditional_discount_evidence
    WHERE company_id=$1 AND id=$2`,[company,uuid(id)])).rows[0];
  if(!row) fail(404,'RESOURCE_NOT_FOUND');
  return verifyEvidence(row);
}
export async function getConditionalEvidence(company:string,actor:string,id:string) {
  return transact(async q=>{await scope(q,company,actor,true);return readConditionalEvidence(q,company,id);},true);
}
export async function captureConditionalEvidence(company:string,actor:string,input:unknown) {
  const body=exactFields(input,['request_id','terms','evidence_text','attested']);
  const request=uuid(body.request_id),terms=parseConditionalTerms(body.terms);
  evidenceBytes(body.evidence_text);
  if(body.attested!==true) fail(422,'CONDITIONAL_ATTESTATION_REQUIRED');
  return transact(async q=>{
    await scope(q,company,actor,true,true);
    await evidenceSchema(q);
    const termsHash=conditionalTermsHash(terms);
    const existing=(await q.query('SELECT * FROM conditional_discount_evidence WHERE company_id=$1 AND request_id=$2',[company,request])).rows[0];
    if(existing) {
      if(existing.actor_id!==actor || existing.evidence_text!==body.evidence_text || existing.terms_hash!==termsHash) fail(409,'CONDITIONAL_EVIDENCE_REQUEST_CONFLICT');
      return readConditionalEvidence(q,company,existing.id);
    }
    const result=(await q.query(`SELECT public.capture_conditional_discount_evidence($1::uuid,$2::text,$3::uuid,$4::jsonb,$5::text,true) id`,
      [company,actor,request,JSON.stringify(terms),body.evidence_text])).rows[0];
    return readConditionalEvidence(q,company,result.id);
  });
}
export async function validateConditionalDraft(q:Queryable,company:string,source:InvoiceSource,partyType:'customer'|'supplier',gross:string) {
  const terms=source.conditional_discount;
  if(!terms) return;
  if(terms.party_type!==partyType || terms.party_id!==source.customer_id.toLowerCase() || BigInt(terms.discount_gross_pence)>=BigInt(gross)) fail(422,'CONDITIONAL_TERMS_INVALID');
  const evidence=await readConditionalEvidence(q,company,terms.evidence_receipt_id);
  if(evidence.terms_hash!==conditionalTermsHash(terms) || evidence.party_type!==partyType || evidence.party_id!==source.customer_id.toLowerCase()) fail(409,'CONDITIONAL_EVIDENCE_TERMS_MISMATCH');
}
