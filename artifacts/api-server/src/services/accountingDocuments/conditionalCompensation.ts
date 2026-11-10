import { createHash } from 'node:crypto';
import { fail, uuid } from '../financialDrafts/contract';
import { withCanonicalPostingTransaction, reverseCanonicalJournalInTransaction, roleHasAccountingCapability,
  type DatabaseTransaction, type CanonicalPostingDependencies } from '../accounting/canonicalPosting';
import { document, scope, transact, queryAdapter, exactFields, hash, sales, type Queryable } from './core';
import { amendmentHistory } from './amendments';
import { canonicalConditionalPayload, conditionalConsumptionSchema } from './conditionalDiscount';
import { readReplacementBinding } from './replacementBindings';
import { paymentEvents, appliedTo, unappliedEffect, syncSettlementProjection } from './settlement';
import { postPayment, previewPaymentInTransaction } from './payments';

// Not constructible by HTTP input, and valid only while this service executes
// the exact reviewed unallocation inside its protected transaction.
const held = new WeakMap<DatabaseTransaction,{company:string,actor:string,intentHash:string}>();
export function hasConditionalCompensationAuthority(tx:DatabaseTransaction|undefined,company:string,actor:string,b:unknown) {
  const value=tx && held.get(tx);
  return !!value && value.company===company && value.actor===actor && value.intentHash===hash(b);
}
export async function compensationSchema(q:Queryable) {
  if(!(await q.query("SELECT to_regclass('public.conditional_discount_compensations') present")).rows[0]?.present) return false;
  const r=(await q.query(`SELECT count(*)::int n FROM pg_trigger
    WHERE tgrelid='public.conditional_discount_compensations'::regclass AND NOT tgisinternal AND tgenabled='A'
    AND tgname IN ('conditional_discount_compensation_guard','conditional_discount_compensation_immutable','conditional_discount_compensation_no_truncate')`)).rows[0];
  if(r.n!==3) fail(503,'CONDITIONAL_COMPENSATION_SCHEMA_INCOMPLETE');
  return true;
}
function intent(body:unknown) {
  const b=exactFields(body,['request_id','original_id','credit_id','payment_id','date','amount_minor','reason','review_token','payment_action']);
  if(b.payment_action!==undefined && b.payment_action!=='reverse_payment') fail(422,'COMPENSATION_ACTION_INVALID');
  if(typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000) fail(422,'COMPENSATION_REASON_REQUIRED');
  if(typeof b.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||
    !Number.isFinite(Date.parse(b.date+'T00:00:00Z'))||new Date(b.date+'T00:00:00Z').toISOString().slice(0,10)!==b.date)
    fail(422,'DATE_INVALID');
  if(typeof b.amount_minor!=='string'||!/^[1-9]\d{0,12}$/.test(b.amount_minor)) fail(422,'AMOUNT_INVALID');
  return {request_id:uuid(b.request_id).toLowerCase(),original_id:uuid(b.original_id).toLowerCase(),
    credit_id:uuid(b.credit_id).toLowerCase(),payment_id:uuid(b.payment_id).toLowerCase(),
    date:b.date,amount_minor:b.amount_minor,reason:b.reason.trim(),
    ...(b.payment_action==='reverse_payment'?{payment_action:'reverse_payment' as const}:{})};
}
function childId(id:string) {
  const s=createHash('sha256').update('conditional-compensation:'+id).digest('hex');
  return `${s.slice(0,8)}-${s.slice(8,12)}-4${s.slice(13,16)}-a${s.slice(17,20)}-${s.slice(20,32)}`;
}
async function authority(q:Queryable,company:string,actor:string) {
  await scope(q,company,actor,true,true);
  const role=(await q.query('SELECT role FROM company_users WHERE company_id=$1 AND user_id=$2 AND is_active=true',[company,actor])).rows[0]?.role;
  if(!roleHasAccountingCapability(role,'accounting.post')||!roleHasAccountingCapability(role,'accounting.reverse')) fail(403,'CAPABILITY_DENIED');
  if(!await compensationSchema(q)) fail(503,'CONDITIONAL_COMPENSATION_SCHEMA_UNAVAILABLE');
  await conditionalConsumptionSchema(q);
}
async function plan(q:Queryable,company:string,actor:string,b:ReturnType<typeof intent>) {
  await authority(q,company,actor);
  const original=await document(q,company,b.original_id,true),credit=await document(q,company,b.credit_id,true);
  const history=await amendmentHistory(q,company,original);
  if(original.status!=='posted'||credit.status!=='posted'||credit.original_id!==original.id||
    credit.party_id!==original.party_id||credit.kind!==(sales(original.kind)?'sales_credit_note':'supplier_credit_note'))
    fail(409,'COMPENSATION_SOURCE_INVALID');
  const ops=(await q.query(`SELECT * FROM accounting_paid_credit_operations
    WHERE company_id=$1 AND credit_id=$2 AND intent ? 'conditional_admission'`,[company,credit.id])).rows;
  if(ops.length!==1) fail(409,'CONDITIONAL_CONSUMPTION_REQUIRED');
  const op=ops[0],admission=op.intent.conditional_admission;
  if(op.intent.original_id!==original.id||admission.binding?.document_id!==original.id||
    admission.binding?.company_id!==company||op.result.journal_id!==credit.journal_id||
    credit.money.gross_pence!==op.intent.credit_minor||
    op.intent.conditional_credit_payload!==canonicalConditionalPayload({source:credit.source,money:credit.money,tax_context:credit.tax_context,accounts:credit.posting_accounts}))
    fail(503,'CONDITIONAL_CONSUMPTION_INVALID');
  if((await q.query('SELECT 1 FROM conditional_discount_compensations WHERE company_id=$1 AND credit_id=$2',[company,credit.id])).rowCount)
    fail(409,'CONDITIONAL_ALREADY_COMPENSATED');
  const linked=(await q.query("SELECT * FROM accounting_document_sources WHERE company_id=$1 AND original_id=$2 AND status='posted'",[company,original.id])).rows;
  const relations=(await q.query('SELECT * FROM canonical_journal_relations WHERE company_id=$1 AND original_journal_id IN ($2,$3)',[company,original.journal_id,credit.journal_id])).rows;
  if(relations.length!==history.rows.length || relations.some(r=>r.original_journal_id!==original.journal_id ||
    r.relation_type!=='correction' || !history.rows.some(a=>a.journal_id===r.related_journal_id))) fail(409,'COMPENSATION_CHANGED_ORIGINAL');
  const events=await paymentEvents(q,company);
  const parent=events.find(e=>e.id===b.payment_id&&e.kind==='payment');
  if(!parent||parent.party_id!==original.party_id||parent.party_type!==(sales(original.kind)?'customer':'supplier')||
    !admission.qualifying_events?.some((e:any)=>e.payment_id===parent.id)) fail(409,'COMPENSATION_PAYMENT_INVALID');
  const related=events.filter(e=>e.id===parent.id||e.payment_id===parent.id);
  // A completed refund of surplus remains an immutable cash effect. Compensation
  // only releases more applied money; it neither needs nor reclaims refunded cash.
  // Cross-document reallocations and full cash reversals remain unsupported.
  if(related.some(e=>e.kind==='reversal'||
    e.allocations.some((a:any)=>a.document_id!==original.id))) fail(409,'COMPENSATION_DOWNSTREAM_UNSUPPORTED');
  const refunds=related.filter(e=>e.kind==='refund');
  const unapplied=related.reduce((n,e)=>n+unappliedEffect(e),0n);
  const refunded=refunds.reduce((n,e)=>n+BigInt(e.amount_minor),0n);
  if(refunds.some(e=>e.party_id!==parent.party_id||e.party_type!==parent.party_type||
      e.allocations.length!==0||BigInt(e.amount_minor)<=0n)||
    unapplied<0n||refunded<0n||
    appliedTo(events,original.id,parent.id)+unapplied+refunded!==BigInt(parent.amount_minor))
    fail(503,'COMPENSATION_PAYMENT_HISTORY_INVALID');
  if(events.some(e=>e.effective_date>b.date && (e.id===parent.id||e.payment_id===parent.id||
    e.allocations.some((a:any)=>a.document_id===original.id)))||credit.source.issue_date>b.date)
    fail(409,'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
  const applied=appliedTo(events,original.id,parent.id);
  if(BigInt(b.amount_minor)>applied) fail(409,'UNALLOCATION_EXCEEDS_APPLIED');
  if(b.payment_action==='reverse_payment') {
    const guard=(await q.query(`SELECT 1 FROM pg_trigger WHERE tgrelid='public.conditional_discount_compensations'::regclass
      AND tgname='conditional_discount_cash_reversal_guard' AND tgenabled='A' AND NOT tgisinternal`)).rowCount;
    if(!guard) fail(503,'COMPENSATION_CASH_REVERSAL_SCHEMA_UNAVAILABLE');
    if(refunds.length) fail(409,'COMPENSATION_REFUNDED_PAYMENT_CANNOT_REVERSE');
    if(BigInt(b.amount_minor)!==applied) fail(409,'COMPENSATION_FULL_UNALLOCATION_REQUIRED');
    if(appliedTo(events,original.id)!==applied) fail(409,'COMPENSATION_OTHER_PAYMENTS_UNSUPPORTED');
  }
  const periods=(await q.query(`SELECT *,start_date::text,end_date::text FROM accounting_document_periods
    WHERE company_id=$1 AND start_date<=$2::date AND end_date>=$2::date ORDER BY id FOR UPDATE`,[company,b.date])).rows;
  if(periods.length!==1||periods[0].status!=='OPEN') fail(409,'PERIOD_NOT_WRITABLE');
  // These rows enter the review hash. PostgreSQL's physical row order can
  // change after a rolled-back reversal; it is not a financial context change.
  const journals=(await q.query(`SELECT *,posting_date::text FROM canonical_journal_entries WHERE company_id=$1 AND id IN ($2,$3) ORDER BY id`,[company,original.journal_id,credit.journal_id])).rows;
  const binding=(await q.query('SELECT * FROM conditional_discount_original_bindings WHERE company_id=$1 AND document_id=$2',[company,original.id])).rows[0];
  const replacement=admission.binding.replacement_id?await readReplacementBinding(q,company,original.id,admission.binding.replacement_id):null;
  const frozen=replacement?.frozen??binding?.binding;
  const prior=frozen?.capacity?.credits??[];
  if(linked.length!==prior.length+1 || linked.some(c=>c.id!==credit.id && !prior.some((p:any)=>p.id===c.id &&
    p.revision===c.revision && p.journal_id===c.journal_id &&
    p.evidence_hash===hash({source:c.source,money:c.money,tax_context:c.tax_context,accounts:c.posting_accounts}))))
    fail(409,'COMPENSATION_PRIOR_CREDITS_UNSUPPORTED');
  if(history.rows.length && (frozen?.capacity?.revision!==history.head_revision ||
    frozen?.financial_hash!==hash({source:history.current.source,money:history.current.money,tax_context:history.current.tax_context,accounts:history.current.posting_accounts})))
    fail(409,'COMPENSATION_CHANGED_ORIGINAL');
  if(!binding||binding.binding_hash!==hash(binding.binding)||binding.binding_hash!==admission.binding.binding_hash||
    (replacement&&replacement.observation?.binding_hash!==admission.binding.replacement_hash)||
    frozen.discount_gross_pence!==credit.money.gross_pence||
    binding.binding.financial_hash!==hash({source:original.source,money:original.money,tax_context:original.tax_context,accounts:original.posting_accounts}))
    fail(503,'COMPENSATION_SOURCE_IDENTITY_INVALID');
  for(const d of [original,credit]) {
    const j=journals.find(j=>j.id===d.journal_id);
    const payload=canonicalConditionalPayload({source:d.source,money:d.money,tax_context:d.tax_context,accounts:d.posting_accounts});
    const effects=(await q.query('SELECT * FROM accounting_posting_effects WHERE company_id=$1 AND journal_id=$2',[company,d.journal_id])).rows;
    if(!j||j.status!=='posted'||j.source_type!==d.kind||j.source_id!==d.id||j.source_revision!==d.revision||
      j.source_evidence_hash!==(d.id===original.id?binding.binding_hash:hash(JSON.parse(payload)))||effects.length!==1||
      effects[0].source_revision!==j.source_revision||effects[0].source_evidence_hash!==j.source_evidence_hash)
      fail(503,'COMPENSATION_SOURCE_IDENTITY_INVALID');
  }
  const lines=(await q.query('SELECT * FROM canonical_journal_lines WHERE company_id=$1 AND journal_entry_id=$2 ORDER BY line_number',[company,credit.journal_id])).rows;
  const accountIds=[...new Set(lines.map(l=>l.account_id))];
  const accounts=(await q.query('SELECT * FROM chart_of_accounts WHERE company_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',[company,accountIds])).rows;
  if(accounts.length!==accountIds.length||accounts.some(a=>!a.is_active)) fail(409,'COMPENSATION_ACCOUNT_UNAVAILABLE');
  const config=(await q.query('SELECT * FROM accounting_payment_configuration WHERE company_id=$1',[company])).rows;
  const payment={id:childId(b.request_id),kind:'unallocation',party_type:parent.party_type,party_id:parent.party_id,
    payment_id:parent.id,date:b.date,reference:`Discount compensation ${credit.number}`.slice(0,200),
    amount_minor:b.amount_minor,allocations:[{document_id:original.id,amount_minor:b.amount_minor}]};
  const review={intent:b,original_id:original.id,original_number:original.number,credit_id:credit.id,credit_number:credit.number,
    credit_revision:credit.revision,credit_journal_id:credit.journal_id,credit_money:credit.money,
    canonical_credit_payload:canonicalConditionalPayload({source:credit.source,money:credit.money,tax_context:credit.tax_context,accounts:credit.posting_accounts}),
    consumption_request_id:op.request_id,unallocated_minor:b.amount_minor,payment,
    preserved_refunds:refunds.map(e=>({id:e.id,journal_id:e.journal_id,effective_date:e.effective_date,amount_minor:e.amount_minor})),
    refunded_minor:refunded.toString(),before_unapplied_minor:unapplied.toString(),
    after_unapplied_minor:b.payment_action==='reverse_payment'?'0':(unapplied+BigInt(b.amount_minor)).toString(),
    cash_change_minor:b.payment_action==='reverse_payment'?(sales(original.kind)?'-':'')+parent.amount_minor:'0',
    ...(b.payment_action==='reverse_payment'?{payment_action:b.payment_action,cash_reversal:{
      ...payment,id:childId('cash:'+b.request_id),kind:'reversal',amount_minor:parent.amount_minor,allocations:[],
      reference:`Reverse qualifying payment ${original.number}`.slice(0,200)}}:{}),
    after_allocated_minor:(applied-BigInt(b.amount_minor)).toString(),
    after_open_minor:(BigInt(history.current.money.gross_pence)-prior.reduce((n:bigint,c:any)=>n+BigInt(c.financial.money.gross_pence),0n)-appliedTo(events,original.id)+BigInt(b.amount_minor)).toString(),
    posting_available:false};
  return {review,review_token:hash({company,actor,review,original,credit,op,events,periods,journals,lines,accounts,config}),
    period:periods[0],accounts,credit};
}
export async function reviewConditionalCompensation(company:string,actor:string,body:unknown) {
  return transact(async q=>{const p=await plan(q,company,actor,intent(body));return {...p.review,review_token:p.review_token};});
}
export async function conditionalCompensationContext(company:string,actor:string) {
  return transact(async q=>{
    await scope(q,company,actor);
    if(!await compensationSchema(q)) return {available:false,posting_available:false,can_review:false,items:[]};
    const role=(await q.query('SELECT role FROM company_users WHERE company_id=$1 AND user_id=$2 AND is_active=true',[company,actor])).rows[0]?.role;
    const rows=(await q.query(`SELECT o.credit_id,o.intent,d.number credit_number,d.money credit_money,
      original.number original_number,c.request_id compensation_request_id
      FROM accounting_paid_credit_operations o JOIN accounting_document_sources d ON d.company_id=o.company_id AND d.id=o.credit_id
      JOIN accounting_document_sources original ON original.company_id=d.company_id AND original.id=d.original_id
      LEFT JOIN conditional_discount_compensations c ON c.company_id=o.company_id AND c.credit_id=o.credit_id
      WHERE o.company_id=$1 AND o.intent ? 'conditional_admission' ORDER BY d.number,d.id`,[company])).rows;
    return {available:true,posting_available:false,
      can_review:roleHasAccountingCapability(role,'accounting.post')&&roleHasAccountingCapability(role,'accounting.reverse'),
      items:rows.map(r=>({original_id:r.intent.original_id,original_number:r.original_number,credit_id:r.credit_id,
        credit_number:r.credit_number,credit_money:r.credit_money,compensation_request_id:r.compensation_request_id,
        payment_ids:[...new Set(r.intent.conditional_admission.qualifying_events.map((e:any)=>e.payment_id))]}))};
  },true);
}
/** Exact request recovery: read-only; unknown never resubmits or invents a new ID. */
export async function recoverConditionalCompensation(company:string,actor:string,id:string) {
  return transact(async q=>{
    await scope(q,company,actor);if(!await compensationSchema(q)) fail(503,'CONDITIONAL_COMPENSATION_SCHEMA_UNAVAILABLE');
    const r=(await q.query('SELECT * FROM conditional_discount_compensations WHERE company_id=$1 AND request_id=$2',[company,uuid(id)])).rows[0];
    if(r) await compensationHistory(q,company,await document(q,company,r.credit_id));
    return r?{state:'known',request_id:id,...r.result}:{state:'unknown',request_id:id};
  },true);
}
/** INTERNAL ONLY: public conditional posting remains closed pending independent acceptance. */
export async function commitConditionalCompensation(company:string,actor:string,body:unknown,hook?:(stage:string,tx:DatabaseTransaction)=>Promise<void>) {
  const b=intent(body),token=(body as any).review_token;
  if(typeof token!=='string'||!/^sha256:[a-f0-9]{64}$/.test(token)) fail(428,'COMPENSATION_REVIEW_REQUIRED');
  const requestHash=hash({company,actor,intent:b,review_token:token});
  return withCanonicalPostingTransaction(async tx=>{
    const q=queryAdapter(tx);await authority(q,company,actor);
    const prior=(await q.query('SELECT * FROM conditional_discount_compensations WHERE company_id=$1 AND request_id=$2',[company,b.request_id])).rows[0];
    if(prior) {if(prior.request_hash!==requestHash) fail(409,'IDEMPOTENCY_CONFLICT');return {...prior.result,status:'duplicate'};}
    const p=await plan(q,company,actor,b);
    if(p.review_token!==token) fail(409,'COMPENSATION_REVIEW_STALE');
    const identity=`conditional-compensation:${b.original_id}:${b.request_id}`;
    const contextProvider:CanonicalPostingDependencies['contextProvider']={async lockForPosting(){
      return {authority:{companyId:company,financialYearId:p.period.financial_year_id,accountingPeriodId:p.period.id,
        periodStatus:'OPEN',configurationVersionId:p.credit.mapping_revision,currencyCode:'GBP',
        accounts:Object.fromEntries(p.accounts.map(a=>[a.id,{id:a.id,companyId:company,isActive:true,isEligible:true,currencyCode:'GBP'}]))},
        recordKeys:[`accounting_document_periods:${p.period.id}`],capturedToken:{revision:token},lockMode:'FOR UPDATE',transactionBound:true,
        validateCurrent:({companyId,command,context})=>companyId===company && command.postingDate===b.date &&
          command.sourceRevision===p.credit.revision &&
          command.sourceEvidenceHash===hash(JSON.parse(p.review.canonical_credit_payload)) &&
          context?.accountingPeriodId===p.period.id && context?.periodStatus==='OPEN' &&
          context.configurationVersionId===p.credit.mapping_revision
          ? {ok:true}:{ok:false,code:'transaction_contract_invalid',message:'Locked compensation authority changed.'}};
    }};
    const reversal=await reverseCanonicalJournalInTransaction(tx,{principal:{kind:'user',userId:actor,requestedCompanyId:company},
      requestedCompanyId:company,originalJournalId:p.credit.journal_id,reason:b.reason,postingDate:b.date,
      economicEffectId:identity,idempotencyKey:identity,postingKind:'conditional_discount_compensation',
      configurationVersionId:p.credit.mapping_revision}, {contextProvider});
    await hook?.('reversal',tx);
    held.set(tx,{company,actor,intentHash:hash(p.review.payment)});
    let unallocation;
    try {
      const review=await previewPaymentInTransaction(q,company,actor,p.review.payment,tx);
      unallocation=await postPayment(company,actor,{...p.review.payment,review_token:review.review_token},undefined,tx);
    } finally {held.delete(tx);}
    await hook?.('unallocation',tx);
    let cashResult;
    if(p.review.cash_reversal) {
      held.set(tx,{company,actor,intentHash:hash(p.review.cash_reversal)});
      try {
        const review=await previewPaymentInTransaction(q,company,actor,p.review.cash_reversal,tx);
        cashResult=await postPayment(company,actor,{...p.review.cash_reversal,review_token:review.review_token},undefined,tx);
      } finally {held.delete(tx);}
      await hook?.('cash_reversal',tx);
    }
    const result={status:'posted',request_id:b.request_id,original_id:b.original_id,credit_id:b.credit_id,
      reversal_journal_id:reversal.journalId,unallocation_id:unallocation.id,unallocation_journal_id:unallocation.journal_id,
      ...(cashResult?{cash_reversal_id:cashResult.id,cash_reversal_journal_id:cashResult.journal_id}:{})};
    await q.query(`INSERT INTO conditional_discount_compensations
      (company_id,request_id,original_id,credit_id,consumption_request_id,payment_id,unallocation_id,journal_id,effective_date,actor_id,reason,request_hash,review_token,evidence,result,source_xid)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,pg_current_xact_id())`,
      [company,b.request_id,b.original_id,b.credit_id,p.review.consumption_request_id,b.payment_id,unallocation.id,reversal.journalId,b.date,actor,b.reason,requestHash,token,p.review,result]);
    await hook?.('evidence',tx);
    await syncSettlementProjection(q,company,b.original_id);
    await hook?.('projection',tx);
    return result;
  });
}

/** Validate immutable children even before a historical cutoff; never erase the credit. */
export async function compensationHistory(q:Queryable,company:string,credit:any) {
  if(!await compensationSchema(q)) return [];
  const rows=(await q.query('SELECT *,effective_date::text FROM conditional_discount_compensations WHERE company_id=$1 AND credit_id=$2',[company,credit.id])).rows;
  for(const r of rows) {
    const j=(await q.query('SELECT *,posting_date::text FROM canonical_journal_entries WHERE company_id=$1 AND id=$2',[company,r.journal_id])).rows[0];
    const lines=(await q.query('SELECT * FROM canonical_journal_lines WHERE company_id=$1 AND journal_entry_id IN ($2,$3) ORDER BY journal_entry_id,line_number',[company,credit.journal_id,r.journal_id])).rows;
    const original=lines.filter(l=>l.journal_entry_id===credit.journal_id),inverse=lines.filter(l=>l.journal_entry_id===r.journal_id);
    const e=(await q.query('SELECT * FROM accounting_payment_events WHERE company_id=$1 AND id=$2',[company,r.unallocation_id])).rows[0];
    const relation=(await q.query("SELECT * FROM canonical_journal_relations WHERE company_id=$1 AND original_journal_id=$2 AND related_journal_id=$3 AND relation_type='reversal'",[company,credit.journal_id,r.journal_id])).rows;
    const effect=(await q.query('SELECT * FROM accounting_posting_effects WHERE company_id=$1 AND journal_id=$2',[company,r.journal_id])).rows;
    const identity=`conditional-compensation:${credit.original_id}:${r.request_id}`;
    if(rows.length!==1||!j||j.status!=='posted'||j.reversal_of_id!==credit.journal_id||j.posting_date!==r.effective_date||
      j.source_type!=='canonical_journal'||j.source_id!==credit.journal_id||j.posting_kind!=='conditional_discount_compensation'||
      j.economic_effect_id!==identity||j.created_by_type!=='user'||j.created_by_id!==r.actor_id||j.correction_reason!==r.reason||
      r.evidence.canonical_credit_payload!==canonicalConditionalPayload({source:credit.source,money:credit.money,tax_context:credit.tax_context,accounts:credit.posting_accounts})||
      j.source_revision!==credit.revision||j.source_evidence_hash!==hash(JSON.parse(r.evidence.canonical_credit_payload))||
      hash(r.evidence.credit_money)!==hash(credit.money)||relation.length!==1||effect.length!==1||
      relation[0].reason!==r.reason||relation[0].actor_id!==r.actor_id||relation[0].idempotency_key!==identity||
      effect[0].status!=='posted'||effect[0].idempotency_key!==identity||
      effect[0].source_revision!==j.source_revision||effect[0].source_evidence_hash!==j.source_evidence_hash||
      !original.length||inverse.length!==original.length||inverse.some((l,i)=>l.account_id!==original[i].account_id||
        l.debit_minor!==original[i].credit_minor||l.credit_minor!==original[i].debit_minor)||
      !e||e.kind!=='unallocation'||e.payment_id!==r.payment_id||e.journal_id!==r.result.unallocation_journal_id||
      e.amount_minor!==r.evidence.unallocated_minor||e.actor_id!==r.actor_id||
      r.result.reversal_journal_id!==r.journal_id||r.result.request_id!==r.request_id||
      hash(e.allocations)!==hash(r.evidence.payment.allocations))
      fail(503,'CONDITIONAL_COMPENSATION_HISTORY_INVALID');
    if(r.evidence.payment_action==='reverse_payment') {
      const cash=(await q.query(`SELECT e.*,e.effective_date::text,j.source_evidence_hash,j.source_revision,j.status journal_status
        FROM accounting_payment_events e JOIN canonical_journal_entries j ON j.company_id=e.company_id AND j.id=e.journal_id
        WHERE e.company_id=$1 AND e.id=$2`,[company,r.result.cash_reversal_id])).rows[0];
      const parent=(await q.query('SELECT * FROM accounting_payment_events WHERE company_id=$1 AND id=$2',[company,r.payment_id])).rows[0];
      if(!cash||!parent||cash.kind!=='reversal'||cash.payment_id!==parent.id||parent.kind!=='payment'||
        cash.amount_minor!==parent.amount_minor||cash.party_id!==parent.party_id||cash.party_type!==parent.party_type||
        cash.actor_id!==r.actor_id||cash.effective_date!==r.effective_date||cash.allocations.length||
        cash.journal_id!==r.result.cash_reversal_journal_id||cash.id!==r.evidence.cash_reversal?.id||
        cash.request_hash!==hash(r.evidence.cash_reversal)||cash.journal_status!=='posted'||
        cash.source_evidence_hash!==hash(cash.source))
        fail(503,'CONDITIONAL_COMPENSATION_CASH_HISTORY_INVALID');
    }
  }
  return rows;
}
