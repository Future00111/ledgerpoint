import { compensationSchema } from './conditionalCompensation';
import { createHash } from 'node:crypto';
import { commercialCreditAdmission } from './commercialCredit';
import { fail, uuid } from '../financialDrafts/contract';
import { withCanonicalPostingTransaction, roleHasAccountingCapability, type DatabaseTransaction } from '../accounting/canonicalPosting';
import { document, scope, transact, queryAdapter, exactFields, hash, credit, sales, type Queryable } from './core';
import { creditOriginal, assertCreditCapacity } from './creditCapacity';
import { documentOpen, paymentEvents, appliedTo, unappliedEffect } from './settlement';
import { postPayment, previewPaymentInTransaction } from './payments';
import { postDocument } from './posting';
import { assertNoConditionalCredit, conditionalCreditAdmission, conditionalConsumptionSchema, canonicalConditionalPayload } from './conditionalDiscount';
import { calculateDocument, assertDiscountOutstanding } from './documents';

// Only the internal command below can create this transaction-bound capability.
// Exporting its predicate does not expose a constructor or a caller-supplied flag.
const conditionalTransactions=new WeakMap<DatabaseTransaction,{company:string,actor:string,original:string,credit:string,revision:string,rowHash:string}>();
export function hasConditionalCreditAuthority(tx:DatabaseTransaction|undefined,company:string,actor:string|undefined,row:any) {
  const held=tx?conditionalTransactions.get(tx):undefined;
  return !!held && held.company===company && held.actor===actor && held.original===row.original_id &&
    held.credit===row.id && held.revision===row.revision && held.rowHash===hash(row);
}
async function authority(q:Queryable,company:string,actor:string) {
  await scope(q,company,actor,true,true);
  const role=(await q.query('SELECT role FROM company_users WHERE company_id=$1 AND user_id=$2',[company,actor])).rows[0]?.role;
  if(!roleHasAccountingCapability(role,'accounting.post')) fail(403,'CAPABILITY_DENIED');
  // Structural reads fail before effects if a partial installation lacks columns.
  const present=(await q.query("SELECT to_regclass('public.accounting_paid_credit_operations') present")).rows[0].present;
  if(!present) fail(503,'PAID_CREDIT_SCHEMA_UNAVAILABLE');
  const guards=(await q.query("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='accounting_paid_credit_operations'::regclass AND NOT tgisinternal AND tgenabled='A' AND tgname IN ('accounting_paid_credit_immutable','accounting_paid_credit_no_truncate')")).rows[0];
  if(guards.n!==2) fail(503,'PAID_CREDIT_SCHEMA_INCOMPLETE');
  await q.query('SELECT company_id,request_id,credit_id,actor_id,request_hash,intent,result,created_at FROM accounting_paid_credit_operations LIMIT 0');
}
function intent(body:unknown) {
  const b=exactFields(body,['request_id','reason','review_token','releases']);
  if(typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000) fail(422,'CREDIT_REASON_REQUIRED');
  return {request_id:uuid(b.request_id).toLowerCase(),reason:b.reason.trim()};
}
function childId(request:string,payment:string) {
  const h=createHash('sha256').update(`paid-credit:${request}:${payment}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
// Server-selected mode only. HTTP request parsing never accepts it.
type CreditPurpose=false|true|'commercial'|'conditional-discount';
async function plan(q:Queryable,company:string,actor:string,id:string,expected:string,b:ReturnType<typeof intent>,conditional:CreditPurpose=false) {
  await authority(q,company,actor);
  if(conditional==='conditional-discount' && !await compensationSchema(q)) fail(503,'CONDITIONAL_COMPENSATION_SCHEMA_INCOMPLETE');
  const row=await document(q,company,id,true);
  if(!credit(row.kind)||row.status!=='draft') fail(409,'CREDIT_DRAFT_REQUIRED');
  if(row.revision!==expected) fail(409,'REVISION_CONFLICT');
  const original=await creditOriginal(q,company,row.original_id,row.source.issue_date);
  if(!conditional) await assertNoConditionalCredit(q,company,original);
  if(conditional) {
    for(const saved of [original,row]) {
      const fresh=await calculateDocument(q,company,saved.kind,{},saved);
      for(const field of ['source','money','tax_context','posting_accounts'])
        if(hash(fresh[field as keyof typeof fresh])!==hash(saved[field])) fail(409,'SOURCE_CONTEXT_CHANGED');
    }
  }
  if(row.source.issue_date<original.source.issue_date) fail(409,'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
  const linked=await assertCreditCapacity(q,company,original,row);
  const events=await paymentEvents(q,company),open=await documentOpen(q,company,original.id,events);
  const value=BigInt(row.money.gross_pence),capacity=BigInt(open.gross_minor)-BigInt(open.credited_minor);
  if(value<=0n||value>capacity) fail(409,'CREDIT_EXCEEDS_COMMERCIAL_CAPACITY');
  if(row.source.discount_adjustment || conditional==='conditional-discount') await assertDiscountOutstanding(q,company,original.id,row.money.gross_pence);
  const excess=value>BigInt(open.open_minor)?value-BigInt(open.open_minor):0n;
  let remaining=excess;
  const releases:any[]=[];
  for(const payment of events.filter(e=>e.kind==='payment'&&e.party_id===original.party_id&&e.party_type===(sales(row.kind)?'customer':'supplier'))) {
    const applied=appliedTo(events,original.id,payment.id);
    if(applied<=0n||remaining===0n) continue;
    const n=applied<remaining?applied:remaining;
    const unapplied=events.filter(e=>e.id===payment.id||e.payment_id===payment.id).reduce((sum,e)=>sum+unappliedEffect(e),0n);
    if(unapplied<0n)fail(503,'SETTLEMENT_LEDGER_MISMATCH');
    releases.push({id:childId(b.request_id,payment.id),payment_id:payment.id,payment_reference:payment.reference,
      payment_journal_id:payment.journal_id,amount_minor:n.toString(),pool_account_id:payment.source.pool_account_id,
      before_unapplied_minor:unapplied.toString(),after_unapplied_minor:(unapplied+n).toString()});
    remaining-=n;
  }
  if(remaining) fail(503,'SETTLEMENT_LEDGER_MISMATCH');
  const periods=(await q.query('SELECT *,start_date::text,end_date::text FROM accounting_document_periods WHERE company_id=$1 AND start_date<=$2::date AND end_date>=$2::date ORDER BY id FOR UPDATE',[company,row.source.issue_date])).rows;
  if(periods.length!==1||periods[0].status!=='OPEN') fail(409,'PERIOD_NOT_WRITABLE');
  for(const release of releases) if(events.some(e=>(e.id===release.payment_id||e.payment_id===release.payment_id)&&e.effective_date>row.source.issue_date)) fail(409,'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
  if(events.some(e=>e.effective_date>row.source.issue_date&&e.allocations.some((a:any)=>a.document_id===original.id))) fail(409,'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
  const configurations=(await q.query('SELECT * FROM accounting_payment_configuration WHERE company_id=$1',[company])).rows;
  if(conditional==='conditional-discount' && releases.length) fail(409,'DISCOUNT_EXCEEDS_OUTSTANDING');
  const admission=(conditional===true||conditional==='conditional-discount')?await conditionalCreditAdmission(q,company,original,row,releases):undefined;
  const commercial=conditional==='commercial'?await commercialCreditAdmission(q,company,original,row):undefined;
  const review={...(conditional==='conditional-discount'?{purpose:conditional}:{}),...(commercial?{commercial_admission:commercial}:{}),...(admission?{conditional_admission:admission,conditional_credit_payload:canonicalConditionalPayload({source:row.source,money:row.money,tax_context:row.tax_context,accounts:row.posting_accounts})}:{}),intent:b,document_id:id,revision:expected,original_id:original.id,original_kind:original.kind,original_number:original.number,date:row.source.issue_date,
    credit_minor:value.toString(),offset_minor:(value-excess).toString(),released_minor:excess.toString(),remaining_minor:(BigInt(open.open_minor)-(value-excess)).toString(),releases};
  return {...review,review_token:hash({company,actor,review,row,original,linked,events,periods,configurations})};
}
export async function reviewPaidCredit(company:string,actor:string,id:string,expected:string,body:unknown) {
  const b=intent(body);return transact(q=>plan(q,company,actor,id,expected,b));
}
/** Read-only calculation; HTTP previews project display fields without the internal commit token. */
export async function reviewConditionalCredit(company:string,actor:string,id:string,expected:string,body:unknown) {
  const b=intent(body);return transact(q=>plan(q,company,actor,id,expected,b,true));
}
/** Current discount policy is server-selected and bound into the review identity.
 * The HTTP endpoint still projects this as a read-only preview. */
export async function reviewPublicConditionalCredit(company:string,actor:string,id:string,expected:string,body:unknown) {
  return transact(q=>plan(q,company,actor,id,expected,intent(body),'conditional-discount'));
}
async function commitCredit(company:string,actor:string,id:string,expected:string,body:unknown,conditional:CreditPurpose,testHook?:(tx:DatabaseTransaction)=>Promise<void>) {
  const b=intent(body),input=body as any;
  if(typeof input.review_token!=='string'||!/^sha256:[a-f0-9]{64}$/.test(input.review_token)||!Array.isArray(input.releases)) fail(428,'PAID_CREDIT_REVIEW_REQUIRED');
  const requestHash=hash({company,actor,id,expected,...b,review_token:input.review_token,releases:input.releases,...(conditional?{conditional}: {})});
  return withCanonicalPostingTransaction(async tx=>{
    const q=queryAdapter(tx);await authority(q,company,actor);
    const creditRow=await document(q,company,id,true);
    if(!conditional && credit(creditRow.kind)) await assertNoConditionalCredit(q,company,await document(q,company,creditRow.original_id,true));
    if(conditional) await conditionalConsumptionSchema(q);
    const prior=(await q.query('SELECT * FROM accounting_paid_credit_operations WHERE company_id=$1 AND request_id=$2',[company,b.request_id])).rows[0];
    if(prior){if(prior.request_hash!==requestHash) fail(409,'IDEMPOTENCY_CONFLICT');return {...prior.result,status:'duplicate'};}
    const reviewed=await plan(q,company,actor,id,expected,b,conditional);
    if(reviewed.review_token!==input.review_token||hash(reviewed.releases)!==hash(input.releases)) fail(409,'PAID_CREDIT_REVIEW_STALE');
    const row=await document(q,company,id,true),results=[];
    for(const release of reviewed.releases) {
      const payment={id:release.id,kind:'unallocation',party_type:sales(row.kind)?'customer':'supplier',party_id:row.party_id,
        payment_id:release.payment_id,date:reviewed.date,reference:`Credit ${row.number}`.slice(0,200),amount_minor:release.amount_minor,
        allocations:[{document_id:row.original_id,amount_minor:release.amount_minor}]};
      const r=await previewPaymentInTransaction(q,company,actor,payment);
      results.push(await postPayment(company,actor,{...payment,review_token:r.review_token},undefined,tx));
    }
    if(!conditional) await testHook?.(tx);
    let posted;
    if(conditional) conditionalTransactions.set(tx,{company,actor,original:row.original_id,credit:id,revision:expected,rowHash:hash(row)});
    try { posted=await postDocument(company,actor,id,expected,undefined,tx); }
    finally { conditionalTransactions.delete(tx); }
    const result={status:'posted',document_id:id,journal_id:posted.journal_id,releases:results,request_id:b.request_id};
    await q.query('INSERT INTO accounting_paid_credit_operations(company_id,request_id,credit_id,actor_id,request_hash,intent,result) VALUES($1,$2,$3,$4,$5,$6,$7)',[company,b.request_id,id,actor,requestHash,reviewed,result]);
    if(conditional) await testHook?.(tx);
    return result;
  });
}

export async function commitPaidCredit(company:string,actor:string,id:string,expected:string,body:unknown,testHook?:(tx:DatabaseTransaction)=>Promise<void>) {
  return commitCredit(company,actor,id,expected,body,false,testHook);
}
/** Internal server command. Deliberately not mounted on an HTTP route. */
export async function commitConditionalCredit(company:string,actor:string,id:string,expected:string,body:unknown,testHook?:(tx:DatabaseTransaction)=>Promise<void>) {
  return commitCredit(company,actor,id,expected,body,true,testHook);
}

/** Internal ordinary price adjustment; no HTTP route and no request mode flag. */
export async function reviewCommercialCredit(company:string,actor:string,id:string,expected:string,body:unknown) {
  return transact(q=>plan(q,company,actor,id,expected,intent(body),'commercial'));
}
export async function commitCommercialCredit(company:string,actor:string,id:string,expected:string,body:unknown,testHook?:(tx:DatabaseTransaction)=>Promise<void>) {
  return commitCredit(company,actor,id,expected,body,'commercial',testHook);
}

/** Protected current-policy command. Public admission remains gated separately. */
export async function commitCurrentConditionalDiscount(company:string,actor:string,id:string,expected:string,body:unknown,testHook?:(tx:DatabaseTransaction)=>Promise<void>) {
  return commitCredit(company,actor,id,expected,body,'conditional-discount',testHook);
}

/** Recover only this purpose's immutable receipt; never expose canonical intent. */
export async function recoverCurrentConditionalDiscount(company:string,actor:string,requestId:string) {
  const request=uuid(requestId).toLowerCase();
  return transact(async q=>{
    await authority(q,company,actor);
    const op=(await q.query('SELECT actor_id,credit_id,intent,result FROM accounting_paid_credit_operations WHERE company_id=$1 AND request_id=$2',[company,request])).rows[0];
    if(!op || op.actor_id!==actor || op.intent.purpose!=='conditional-discount') return {status:'unknown',request_id:request};
    const row=await document(q,company,op.credit_id);
    const j=(await q.query(`SELECT j.*,p.id effect_id FROM canonical_journal_entries j
      LEFT JOIN accounting_posting_effects p ON p.company_id=j.company_id AND p.journal_id=j.id
        AND p.source_id=j.source_id AND p.source_type=j.source_type AND p.source_revision=j.source_revision
        AND p.source_evidence_hash=j.source_evidence_hash AND p.status='posted'
        AND p.posting_kind=j.posting_kind AND p.economic_effect_id=j.economic_effect_id
        AND p.idempotency_key='document:'||j.source_id
      WHERE j.company_id=$1 AND j.id=$2`,[company,row.journal_id])).rows;
    const payload=canonicalConditionalPayload({source:row.source,money:row.money,tax_context:row.tax_context,accounts:row.posting_accounts});
    if(row.status!=='posted'||!credit(row.kind)||row.id!==op.result.document_id||row.journal_id!==op.result.journal_id||
      op.result.request_id!==request||op.result.status!=='posted'||op.intent.document_id!==row.id||op.intent.revision!==row.revision||
      op.intent.original_id!==row.original_id||op.intent.conditional_credit_payload!==payload||!op.intent.conditional_admission||
      op.intent.released_minor!=='0'||!Array.isArray(op.intent.releases)||op.intent.releases.length||
      !Array.isArray(op.result.releases)||op.result.releases.length||
      j.length!==1||!j[0].effect_id||j[0].status!=='posted'||j[0].source_id!==row.id||j[0].source_type!==row.kind||
      j[0].posting_kind!=='ordinary_document'||j[0].economic_effect_id!==`document:${row.id}`||
      j[0].created_by_type!=='user'||j[0].created_by_id!==actor||
      j[0].source_revision!==row.revision||j[0].source_evidence_hash!==hash(JSON.parse(payload))) fail(503,'CONDITIONAL_DISCOUNT_HISTORY_INVALID');
    return {status:'recorded',request_id:request,document_id:op.result.document_id,journal_id:op.result.journal_id};
  });
}
