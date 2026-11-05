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

/** Frozen causal evidence, not conditional-discount eligibility. An existing
 * observation proves the ORIGINAL binding committed before this calculation;
 * the observation itself need not be a separately committed transaction. Never
 * manufacture an observation here or recertify historical transaction IDs. */
export async function conditionalPaymentSnapshot(q:Queryable,company:string,partyType:string,partyId:string,
  kind:string,parent:any,allocations:{document_id:string}[]) {
  await conditionalOriginalSchema(q);
  const prior=parent?.source?.conditional_binding_snapshot;
  if(kind==='allocation' && prior===undefined) return {version:1,bindings:[]};
  if(kind==='allocation') {
    if(prior?.version!==1 || !Array.isArray(prior.bindings) || Object.keys(prior).sort().join(',')!=='bindings,version')
      fail(503,'CONDITIONAL_PAYMENT_SNAPSHOT_INVALID');
    const verified=(await q.query(`SELECT j.id FROM canonical_journal_entries j
      JOIN accounting_posting_effects p ON p.company_id=j.company_id AND p.journal_id=j.id
      WHERE j.company_id=$1 AND j.id=$2 AND j.source_type='accounting_payment_event'
        AND j.source_id=$3 AND j.posting_kind='party_payment' AND j.status='posted' AND j.currency_code='GBP'
        AND j.economic_effect_id='payment-event:'||$3 AND j.source_revision=$4 AND j.source_evidence_hash=$4
        AND p.source_type=j.source_type AND p.source_id=j.source_id AND p.source_revision=j.source_revision
        AND p.source_evidence_hash=j.source_evidence_hash AND p.posting_kind=j.posting_kind
        AND p.economic_effect_id=j.economic_effect_id AND p.idempotency_key='payment-event:'||$3 AND p.status='posted'`,
      [company,parent.journal_id,parent.id,hash(parent.source)])).rows[0];
    if(!verified) fail(503,'PAYMENT_HISTORY_INVALID');
    if(prior.bindings.some((b:any)=>!b || typeof b!=='object' || Array.isArray(b) ||
      Object.keys(b).sort().join(',')!=='binding_hash,company_id,document_id,journal_id,observed_at' ||
      b.company_id!==company || !/^[a-f0-9-]{36}$/.test(b.document_id) || !/^[a-f0-9-]{36}$/.test(b.journal_id) ||
      !/^sha256:[a-f0-9]{64}$/.test(b.binding_hash) || typeof b.observed_at!=='string') ||
      new Set(prior.bindings.map((b:any)=>b.document_id)).size!==prior.bindings.length)
      fail(503,'CONDITIONAL_PAYMENT_SNAPSHOT_INVALID');
  }
  const selected=kind==='allocation'?prior.bindings.filter((b:any)=>allocations.some(a=>a.document_id===b.document_id)):null;
  const rows=(await q.query(`SELECT b.*,to_char(o.observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') observed_at FROM conditional_discount_original_bindings b
    JOIN conditional_discount_original_observations o ON o.company_id=b.company_id AND o.document_id=b.document_id
    JOIN accounting_document_sources d ON d.company_id=b.company_id AND d.id=b.document_id
    WHERE b.company_id=$1 AND d.party_id=$2 AND d.kind=$3
      AND ($4::uuid[] IS NULL OR b.document_id=ANY($4::uuid[])) ORDER BY b.document_id`,
    [company,partyId,partyType==='customer'?'sales_invoice':'purchase_bill',selected?.map((b:any)=>b.document_id)??null])).rows;
  const bindings:{company_id:string,document_id:string,journal_id:string,binding_hash:string,observed_at:string}[]=[];
  for(const row of rows) {
    if(!row.binding || row.binding_hash!==hash(row.binding) || canonicalConditionalPayload(row.binding)!==row.canonical_payload ||
      typeof row.observed_at!=='string' || !Number.isFinite(Date.parse(row.observed_at))) fail(503,'CONDITIONAL_BINDING_INVALID');
    const original=await verifiedOriginal(q,company,row.document_id,row.binding_hash);
    if(!original || original.journal_id!==row.journal_id || original.party_id!==partyId ||
      original.kind!==(partyType==='customer'?'sales_invoice':'purchase_bill')) fail(503,'CONDITIONAL_BINDING_INVALID');
    const expected=await prepareConditionalOriginal(q,company,original);
    if(expected.bindingHash!==row.binding_hash || expected.canonicalPayload!==row.canonical_payload) fail(503,'CONDITIONAL_BINDING_INVALID');
    bindings.push({company_id:company,document_id:row.document_id,journal_id:row.journal_id,
      binding_hash:row.binding_hash,observed_at:row.observed_at});
  }
  if(selected && (selected.length!==bindings.length || selected.some((b:any)=>!bindings.some(x=>hash(x)===hash(b)))))
    fail(503,'CONDITIONAL_PAYMENT_SNAPSHOT_INVALID');
  return {version:1,bindings};
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

/** Public credit writers remain closed for bound originals until redemption and
 * every settlement writer share atomic consumption/compensation protection. */
export async function assertNoConditionalCredit(q:Queryable,company:string,original:any) {
  if(original.source?.conditional_discount) fail(422,'CONDITIONAL_POSTING_NOT_AVAILABLE');
  await conditionalOriginalSchema(q);
  if((await q.query('SELECT document_id FROM conditional_discount_original_bindings WHERE company_id=$1 AND document_id=$2',[company,original.id])).rows.length)
    fail(422,'CONDITIONAL_POSTING_NOT_AVAILABLE');
}

/** Strict UTC microseconds: Date milliseconds must never erase causal equality. */
export function conditionalClock(value:unknown):string {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,19)!==value.slice(0,19)) fail(503,'CONDITIONAL_CLOCK_INVALID');
  return value;
}
export function conditionalEventTimely(created:string,observed:string,bindingObserved:string,effective:string,deadline:string) {
  const cutoff=new Date(Date.parse(deadline+'T00:00:00Z')+86400000).toISOString().slice(0,19)+'.000000Z';
  return conditionalClock(bindingObserved)<conditionalClock(created) && conditionalClock(created)<=conditionalClock(observed) &&
    conditionalClock(observed)<cutoff && effective<=deadline;
}

/** INTERNAL, read-only admission. No witness creation, redemption or posting.
 * Caller holds the native company/original locks and validates the credit draft. */
export async function conditionalCreditAdmission(q:Queryable,company:string,original:any,credit:any,releases:{payment_id:string,amount_minor:string}[]=[]) {
  if(!original.source?.conditional_discount) fail(409,'CONDITIONAL_AGREEMENT_REQUIRED');
  const partyType=original.kind==='sales_invoice'?'customer':'supplier';
  const current=await conditionalPaymentSnapshot(q,company,partyType,original.party_id,'payment',null,[]);
  const binding=current.bindings.find(b=>b.document_id===original.id);
  if(!binding) fail(409,'CONDITIONAL_AGREEMENT_REQUIRED');
  const prepared=await prepareConditionalOriginal(q,company,original),frozen=prepared.binding;
  if(binding.binding_hash!==prepared.bindingHash || credit.money.gross_pence!==frozen.discount_gross_pence ||
    credit.tax_context.original_revision!==original.revision ||
    credit.tax_context.original_evidence_hash!==frozen.financial_hash ||
    credit.money.lines.length!==frozen.vector.length || frozen.vector.some((v,i)=>
      credit.tax_context.original_line_refs[i]!==Number(v.line_ref) ||
      ['net_pence','vat_pence','gross_pence'].some(k=>credit.money.lines[i][k]!==v[k as keyof typeof v])))
    fail(409,'CONDITIONAL_CREDIT_VECTOR_MISMATCH');
  if((await q.query("SELECT id FROM accounting_document_sources WHERE company_id=$1 AND original_id=$2 AND status='posted'",[company,original.id])).rows.length)
    fail(409,'CONDITIONAL_PRIOR_CREDIT_UNSUPPORTED');
  const installed=(await q.query("SELECT to_regclass('public.conditional_discount_commit_witnesses') present")).rows[0]?.present;
  if(!installed) fail(503,'CONDITIONAL_WITNESS_SCHEMA_INCOMPLETE');
  const integrity=(await q.query(`SELECT count(*)::int n,
    bool_and(pg_get_userbyid(relowner)='ledgerly_canonical_owner') owned,
    bool_or(has_table_privilege('ledgerly_api',oid,'UPDATE,DELETE,TRUNCATE') OR
      (relname='conditional_discount_payment_transactions' AND has_table_privilege('ledgerly_api',oid,'INSERT'))) writable
    FROM pg_class WHERE oid IN ('public.conditional_discount_commit_witnesses'::regclass,'public.conditional_discount_payment_transactions'::regclass)`)).rows[0];
  if(integrity?.n!==2 || integrity.owned!==true || integrity.writable!==false) fail(503,'CONDITIONAL_WITNESS_SCHEMA_INCOMPLETE');
  const guards=(await q.query(`SELECT count(*)::int n FROM pg_trigger
    WHERE tgrelid IN ('public.conditional_discount_commit_witnesses'::regclass,
      'public.conditional_discount_payment_transactions'::regclass,'public.accounting_payment_events'::regclass) AND NOT tgisinternal
      AND tgenabled='A' AND tgname IN ('conditional_discount_witness_immutable','conditional_discount_witness_no_truncate','conditional_discount_witness_observe',
      'conditional_discount_payment_transaction','conditional_discount_transaction_immutable','conditional_discount_transaction_no_truncate')`)).rows[0];
  const constraints=(await q.query(`SELECT count(*)::int n FROM pg_constraint
    WHERE conrelid IN ('public.conditional_discount_commit_witnesses'::regclass,'public.conditional_discount_payment_transactions'::regclass)
      AND convalidated AND conname IN ('conditional_discount_witness_pk','conditional_discount_witness_event_fk',
      'conditional_discount_witness_journal_fk','conditional_discount_witness_hash','conditional_discount_witness_clock',
      'conditional_discount_transaction_pk','conditional_discount_transaction_event_fk')`)).rows[0];
  if(guards?.n!==6 || constraints?.n!==7) fail(503,'CONDITIONAL_WITNESS_SCHEMA_INCOMPLETE');
  const events=(await q.query(`SELECT e.*,e.effective_date::text event_date,
    to_char(e.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') event_clock,
    j.id verified_journal_id,j.source_revision,p.id verified_effect_id,
    w.journal_id witness_journal,w.event_source_hash witness_hash,
    to_char(w.event_created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') witness_created,
    to_char(w.observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') witness_clock
    FROM accounting_payment_events e
    LEFT JOIN canonical_journal_entries j ON j.company_id=e.company_id AND j.id=e.journal_id
      AND j.source_type='accounting_payment_event' AND j.source_id=e.id::text AND j.status='posted'
      AND j.posting_kind='party_'||e.kind AND j.currency_code='GBP' AND j.posting_date=e.effective_date
      AND j.reference=e.reference AND j.economic_effect_id='payment-event:'||e.id::text AND j.source_evidence_hash=j.source_revision
    LEFT JOIN accounting_posting_effects p ON p.company_id=e.company_id AND p.journal_id=j.id
      AND p.source_type=j.source_type AND p.source_id=j.source_id AND p.source_revision=j.source_revision
      AND p.source_evidence_hash=j.source_evidence_hash AND p.posting_kind=j.posting_kind
      AND p.economic_effect_id=j.economic_effect_id AND p.idempotency_key='payment-event:'||e.id::text AND p.status='posted'
    LEFT JOIN conditional_discount_commit_witnesses w ON w.company_id=e.company_id AND w.event_id=e.id
    WHERE e.company_id=$1 AND e.party_id=$2 AND e.party_type=$3 ORDER BY e.created_at,e.id`,[company,original.party_id,partyType])).rows;
  const verify=(e:any)=>{
    const intent=e.source?.intent;
    if(!['payment','allocation','unallocation','refund','reversal'].includes(e.kind) ||
      !/^[1-9][0-9]{0,15}$/.test(String(e.amount_minor)) ||
      !e.verified_journal_id || !e.verified_effect_id || e.source_revision!==hash(e.source) || !intent ||
      intent.id!==e.id || intent.kind!==e.kind || intent.payment_id!==e.payment_id || intent.party_id!==e.party_id ||
      intent.party_type!==e.party_type || intent.date!==e.event_date || intent.reference!==e.reference ||
      intent.amount_minor!==String(e.amount_minor) || hash(intent.allocations)!==hash(e.allocations) ||
      !Array.isArray(e.allocations) || new Set(e.allocations.map((a:any)=>a.document_id)).size!==e.allocations.length ||
      e.allocations.some((a:any)=>!a || !/^[1-9][0-9]{0,15}$/.test(a.amount_minor)) ||
      (e.kind==='payment' && e.payment_id!==null) ||
      (e.kind!=='payment' && !e.payment_id)) fail(503,'PAYMENT_HISTORY_INVALID');
  };
  const timely=(e:any)=>{
    const snapshot=e.source.conditional_binding_snapshot;
    if(snapshot===undefined) return false;
    if(snapshot?.version!==1 || !Array.isArray(snapshot.bindings) || Object.keys(snapshot).sort().join(',')!=='bindings,version')
      fail(503,'CONDITIONAL_PAYMENT_SNAPSHOT_INVALID');
    const selected=snapshot.bindings.filter((b:any)=>b?.document_id===original.id);
    if(selected.length===0) return false;
    if(selected.length!==1 || hash(selected[0])!==hash(binding)) fail(503,'CONDITIONAL_PAYMENT_SNAPSHOT_INVALID');
    if(!e.witness_clock) return false;
    if(e.witness_journal!==e.journal_id || e.witness_hash!==e.source_revision || e.witness_created!==e.event_clock)
      fail(503,'CONDITIONAL_WITNESS_INVALID');
    return conditionalEventTimely(e.event_clock,e.witness_clock,binding.observed_at,e.event_date,frozen.deadline);
  };
  const qualifying:any[]=[];let total=0n;
  for(const e of events) {
    if(!Array.isArray(e.allocations)) fail(503,'PAYMENT_HISTORY_INVALID');
    const allocation=e.allocations.find((a:any)=>a.document_id===original.id);
    if(!allocation || !['payment','allocation'].includes(e.kind)) continue;
    verify(e);
    const parent=e.kind==='payment'?e:events.find(p=>p.id===e.payment_id && p.kind==='payment');
    if(!parent) fail(503,'PAYMENT_HISTORY_INVALID');
    verify(parent);
    const related=events.filter(x=>x.id===parent.id || x.payment_id===parent.id);
    let pool=0n;
    for(const child of related) {
      verify(child);
      if(['unallocation','reversal'].includes(child.kind)) fail(409,'CONDITIONAL_RELEASE_HISTORY_UNSUPPORTED');
      const allocated=child.allocations.reduce((n:bigint,a:any)=>n+BigInt(a.amount_minor),0n);
      if(child.kind==='refund' && allocated!==0n) fail(503,'PAYMENT_HISTORY_INVALID');
      if((child.kind==='payment' && allocated>BigInt(child.amount_minor)) ||
        (child.kind==='allocation' && allocated!==BigInt(child.amount_minor))) fail(503,'PAYMENT_HISTORY_INVALID');
      pool+=child.kind==='payment'?BigInt(child.amount_minor)-allocated:-BigInt(child.amount_minor);
    }
    if(pool<0n) fail(503,'SETTLEMENT_LEDGER_MISMATCH');
    if(!timely(parent) || !timely(e)) continue;
    const amount=BigInt(allocation.amount_minor);
    if(amount<=0n) fail(503,'PAYMENT_HISTORY_INVALID');
    total+=amount;
    qualifying.push({event_id:e.id,journal_id:e.journal_id,payment_id:parent.id,payment_journal_id:parent.journal_id,
      payment_source_hash:parent.source_revision,amount_minor:amount.toString(),
      effective_date:e.event_date,event_source_hash:e.source_revision,observed_at:e.witness_clock,payment_observed_at:parent.witness_clock});
  }
  const threshold=BigInt(frozen.gross_pence)-BigInt(frozen.discount_gross_pence);
  const remainingByParent=new Map<string,bigint>();
  for(const event of qualifying) remainingByParent.set(event.payment_id,(remainingByParent.get(event.payment_id)??0n)+BigInt(event.amount_minor));
  for(const release of releases) {
    const eligible=remainingByParent.get(release.payment_id)??0n,removed=BigInt(release.amount_minor);
    const decrease=removed<eligible?removed:eligible;
    remainingByParent.set(release.payment_id,eligible-decrease);total-=decrease;
  }
  if(total<threshold) fail(409,'CONDITIONAL_PAYMENT_THRESHOLD_NOT_MET');
  return {version:1,binding,terms_hash:frozen.terms_hash,threshold_minor:threshold.toString(),qualifying_minor:total.toString(),
    deadline:frozen.deadline,qualifying_events:qualifying,posting_available:false};
}

/** Consumption is the immutable native paid-credit operation, not a second ledger. */
export async function conditionalConsumptionSchema(q:Queryable) {
  const row=(await q.query(`SELECT
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='accounting_paid_credit_operations'::regclass
      AND tgname='conditional_credit_consumption' AND tgenabled='A' AND NOT tgisinternal) guarded,
    EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('public.conditional_credit_one_consumption')
      AND indisunique AND indisvalid) unique_consumption`)).rows[0];
  if(row?.guarded!==true || row?.unique_consumption!==true) fail(503,'CONDITIONAL_CONSUMPTION_SCHEMA_INCOMPLETE');
}
/** All native payment writers call this under the existing company lock.
 * Positive payment/allocation cannot remove qualifying cash. Refunds use only
 * the native unapplied pool. Compensation is intentionally unavailable: reject
 * unallocation of consumed originals and reversal of their qualifying parents. */
export async function assertConditionalPaymentMutation(q:Queryable,company:string,b:any) {
  if(!['unallocation','reversal'].includes(b.kind)) return;
  const installed=(await q.query("SELECT to_regclass('public.accounting_paid_credit_operations') present")).rows[0]?.present;
  if(!installed) fail(503,'CONDITIONAL_CONSUMPTION_SCHEMA_INCOMPLETE');
  await conditionalConsumptionSchema(q);
  const records=(await q.query(`SELECT intent FROM accounting_paid_credit_operations
    WHERE company_id=$1 AND intent ? 'conditional_admission'`,[company])).rows;
  for(const {intent} of records) {
    const admission=intent.conditional_admission;
    if(!admission || admission.version!==1 || !/^[a-f0-9-]{36}$/.test(intent.original_id??'') || admission.binding?.company_id!==company || admission.binding?.document_id!==intent.original_id || !/^sha256:[a-f0-9]{64}$/.test(admission.binding?.binding_hash??'') || !Array.isArray(admission.qualifying_events) || admission.qualifying_events.length===0 || admission.qualifying_events.some((e:any)=>!e || !/^[a-f0-9-]{36}$/.test(e.payment_id??'') || !/^[a-f0-9-]{36}$/.test(e.event_id??''))) fail(503,'CONDITIONAL_CONSUMPTION_INVALID');
    if((b.kind==='unallocation' && b.allocations.some((a:any)=>a.document_id===intent.original_id)) ||
      (b.kind==='reversal' && admission.qualifying_events.some((e:any)=>e.payment_id===b.payment_id)))
      fail(409,'CONDITIONAL_CONSUMED_PAYMENT_PROTECTED');
  }
}
