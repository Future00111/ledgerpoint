import { fail, uuid } from '../financialDrafts/contract';
import { scope, transact, hash, type Queryable } from './core';
import { replacementSchema } from './conditionalReplacements';
import { canonicalConditionalPayload, frozenConditionalVector, prepareConditionalOriginal, readConditionalEvidence, verifiedOriginal } from './conditionalDiscount';
import { prepareReplacementCapacity } from './replacementCapacity';
import { remainingCreditMoney } from './creditCapacity';

export async function replacementBindingSchema(q:Queryable) {
  await replacementSchema(q);
  const present=(await q.query("SELECT to_regclass('public.conditional_discount_replacement_observations') present")).rows[0]?.present;
  if(!present) fail(503,'CONDITIONAL_REPLACEMENT_OBSERVER_UNAVAILABLE');
  const r=(await q.query(`SELECT pg_get_userbyid(relowner) owner,
    has_table_privilege('ledgerly_api',oid,'INSERT,UPDATE,DELETE,TRUNCATE') writable,
    (SELECT count(*)::int FROM pg_constraint WHERE conrelid=c.oid AND convalidated) constraints,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.conditional_discount_replacements'::regclass
      AND tgname='conditional_replacement_origin' AND tgenabled='A' AND NOT tgisinternal) origin,
    (SELECT count(*)::int FROM pg_trigger WHERE tgrelid=c.oid AND NOT tgisinternal AND tgenabled='A'
      AND tgname IN ('replacement_observation_immutable','replacement_observation_no_truncate')) guards
    FROM pg_class c WHERE oid='public.conditional_discount_replacement_observations'::regclass`)).rows[0];
  if(r?.owner!=='ledgerly_canonical_owner'||r.writable!==false||r.guards!==2||r.constraints!==5||r.origin!==true)
    fail(503,'CONDITIONAL_REPLACEMENT_OBSERVER_INVALID');
}

async function prepare(q:Queryable,company:string,row:any,replacement:any,capacity?:any) {
  const original=await prepareConditionalOriginal(q,company,row);
  if(original.bindingHash!==replacement.original_binding_hash) fail(503,'CONDITIONAL_BINDING_INVALID');
  if(!await verifiedOriginal(q,company,row.id,original.bindingHash)) fail(503,'CONDITIONAL_BINDING_INVALID');
  const evidence=await readConditionalEvidence(q,company,replacement.evidence_id);
  const terms=evidence.terms;
  if(evidence.party_id!==row.party_id || evidence.party_type!==(row.kind==='sales_invoice'?'customer':'supplier'))
    fail(503,'CONDITIONAL_REPLACEMENT_PARTY_MISMATCH');
  if(capacity && (hash(capacity.financial)!==capacity.financial_hash ||
    canonicalConditionalPayload(capacity.financial)!==capacity.financial_payload ||
    !Array.isArray(capacity.credits) || capacity.credits.some((c:any)=>hash(c.financial)!==c.evidence_hash ||
      canonicalConditionalPayload(c.financial)!==c.financial_payload) ||
    hash(capacity.remaining_money)!==hash(remainingCreditMoney(capacity.financial,capacity.credits.map((c:any)=>c.financial)))))
    fail(503,'CONDITIONAL_REPLACEMENT_IDENTITY_INVALID');
  const current=capacity?{...row,source:capacity.financial.source,money:capacity.remaining_money,tax_context:capacity.financial.tax_context}:row;
  const frozen={...original.binding,evidence_id:evidence.id,terms_hash:evidence.terms_hash,
    discount_gross_pence:terms.discount_gross_pence,deadline:terms.payment_deadline,
    ...(capacity?{revision:capacity.revision,financial_hash:capacity.financial_hash,gross_pence:capacity.remaining_money.gross_pence,
      capacity,capacity_payload:canonicalConditionalPayload(capacity),capacity_hash:hash(capacity)}:{}),
    vector:frozenConditionalVector({...current,source:{...current.source,conditional_discount:terms}})};
  return {frozen,canonical:canonicalConditionalPayload(frozen),frozenHash:hash(frozen),terms};
}

/** No caller clock, injected connection, or caller-calculated financial vector. */
export async function observeConditionalReplacement(company:string,actor:string,id:string) {
  uuid(id);
  return transact(async q=>{
    await scope(q,company,actor,true,true);await replacementBindingSchema(q);
    const r=(await q.query('SELECT * FROM conditional_discount_replacements WHERE company_id=$1 AND id=$2',[company,id])).rows[0];
    if(!r) fail(404,'RESOURCE_NOT_FOUND');
    const row=(await q.query('SELECT * FROM accounting_document_sources WHERE company_id=$1 AND id=$2',[company,r.document_id])).rows[0];
    const old=await readReplacementBinding(q,company,r.document_id,id);
    if(old?.observation) return old;
    const credited=(await q.query("SELECT 1 FROM accounting_document_sources WHERE company_id=$1 AND original_id=$2 AND status='posted'",[company,row.id])).rowCount;
    const amended=(await q.query("SELECT to_regclass('public.accounting_document_amendments') present")).rows[0]?.present;
    const changed=amended&&(await q.query('SELECT 1 FROM accounting_document_amendments WHERE company_id=$1 AND document_id=$2 LIMIT 1',[company,row.id])).rowCount;
    const terms=(await readConditionalEvidence(q,company,r.evidence_id)).terms;
    const capacity=changed||credited?(await prepareReplacementCapacity(q,company,row.id,terms)).snapshot:undefined;
    const prepared=await prepare(q,company,row,r,capacity);
    await q.query('SELECT public.observe_conditional_discount_replacement($1::uuid,$2::text,$3::uuid,$4::text,$5::text)',
      [company,actor,id,prepared.canonical,prepared.frozenHash]);
    return readReplacementBinding(q,company,r.document_id,id);
  });
}

/** An explicit id verifies historical evidence; absence chooses the current head.
 * A current but unobserved replacement is NOT a fallback to original terms. */
export async function readReplacementBinding(q:Queryable,company:string,document:string,id?:string):Promise<any> {
  const available=(await q.query("SELECT to_regclass('public.conditional_discount_replacements') present")).rows[0]?.present;
  if(!available) return null;
  const replacement=(await q.query(`SELECT r.* FROM conditional_discount_replacements r
    WHERE company_id=$1 AND document_id=$2 AND ($3::uuid IS NULL OR id=$3)
    AND ($3::uuid IS NOT NULL OR NOT EXISTS(SELECT 1 FROM conditional_discount_replacements n WHERE n.company_id=r.company_id AND n.predecessor_id=r.id))`,
    [company,document,id??null])).rows[0];
  if(!replacement) {if(id) fail(503,'CONDITIONAL_REPLACEMENT_IDENTITY_INVALID');return null;}
  await replacementBindingSchema(q);
  const observation=(await q.query(`SELECT *,to_char(observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') observed_at
    FROM conditional_discount_replacement_observations WHERE company_id=$1 AND replacement_id=$2`,[company,replacement.id])).rows[0];
  if(!observation) return {replacement,observation:null};
  const row=(await q.query('SELECT * FROM accounting_document_sources WHERE company_id=$1 AND id=$2',[company,document])).rows[0];
  const expected=await prepare(q,company,row,replacement,observation.binding.capacity);
  if(observation.binding_hash!==expected.frozenHash || observation.canonical_payload!==expected.canonical ||
    hash(observation.binding)!==expected.frozenHash) fail(503,'CONDITIONAL_REPLACEMENT_IDENTITY_INVALID');
  if(!id) {
    const consumed=(await q.query("SELECT 1 FROM accounting_paid_credit_operations WHERE company_id=$1 AND intent->>'original_id'=$2::text AND intent ? 'conditional_admission' LIMIT 1",[company,document])).rowCount;
    if(!consumed) {
      if(observation.binding.capacity) {
        const current=await prepareReplacementCapacity(q,company,document,expected.terms);
        if(current.snapshot_hash!==observation.binding.capacity_hash) fail(409,'CONDITIONAL_REPLACEMENT_CONTEXT_CHANGED');
      } else {
        if((await q.query("SELECT 1 FROM accounting_document_sources WHERE company_id=$1 AND original_id=$2 AND status='posted'",[company,document])).rowCount)
          fail(409,'CONDITIONAL_REPLACEMENT_REQUIRED');
        const installed=(await q.query("SELECT to_regclass('public.accounting_document_amendments') present")).rows[0]?.present;
        if(installed&&(await q.query('SELECT 1 FROM accounting_document_amendments WHERE company_id=$1 AND document_id=$2 LIMIT 1',[company,document])).rowCount)
          fail(409,'CONDITIONAL_REPLACEMENT_REQUIRED');
      }
    }
  }
  return {replacement,observation,...expected};
}
