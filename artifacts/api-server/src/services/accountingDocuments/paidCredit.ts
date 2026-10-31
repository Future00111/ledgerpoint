import { createHash } from 'node:crypto';
import { fail, uuid } from '../financialDrafts/contract';
import { withCanonicalPostingTransaction, roleHasAccountingCapability, type DatabaseTransaction } from '../accounting/canonicalPosting';
import { document, scope, transact, queryAdapter, exactFields, hash, credit, sales, type Queryable } from './core';
import { assertUncorrectedOriginal } from './amendments';
import { documentOpen, paymentEvents, appliedTo } from './settlement';
import { postPayment, previewPaymentInTransaction } from './payments';
import { postDocument } from './posting';

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
async function plan(q:Queryable,company:string,actor:string,id:string,expected:string,b:ReturnType<typeof intent>) {
  await authority(q,company,actor);
  const row=await document(q,company,id,true);
  if(!credit(row.kind)||row.status!=='draft') fail(409,'CREDIT_DRAFT_REQUIRED');
  if(row.revision!==expected) fail(409,'REVISION_CONFLICT');
  const original=await document(q,company,row.original_id,true);
  await assertUncorrectedOriginal(q,company,original);
  if(row.source.issue_date<original.source.issue_date) fail(409,'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
  const linked=(await q.query("SELECT d.*,j.posting_date::text FROM accounting_document_sources d JOIN canonical_journal_entries j ON j.id=d.journal_id AND j.company_id=d.company_id WHERE d.company_id=$1 AND d.original_id=$2 AND d.status='posted'",[company,original.id])).rows;
  if(linked.some(c=>c.posting_date>row.source.issue_date)) fail(409,'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
  for(let i=0;i<row.money.lines.length;i++) {
    const ref=row.tax_context.original_line_refs[i];
    for(const field of ['net_pence','vat_pence','gross_pence']) {
      let n=BigInt(row.money.lines[i][field]);
      for(const c of linked){const ix=c.tax_context.original_line_refs.indexOf(ref);if(ix>=0)n+=BigInt(c.money.lines[ix][field]);}
      if(n>BigInt(original.money.lines[ref][field]))fail(409,'CREDIT_EXCEEDS_COMMERCIAL_CAPACITY');
    }
  }
  const events=await paymentEvents(q,company),open=await documentOpen(q,company,original.id,events);
  const value=BigInt(row.money.gross_pence),capacity=BigInt(open.gross_minor)-BigInt(open.credited_minor);
  if(value<=0n||value>capacity) fail(409,'CREDIT_EXCEEDS_COMMERCIAL_CAPACITY');
  const excess=value>BigInt(open.open_minor)?value-BigInt(open.open_minor):0n;
  let remaining=excess;
  const releases:any[]=[];
  for(const payment of events.filter(e=>e.kind==='payment'&&e.party_id===original.party_id&&e.party_type===(sales(row.kind)?'customer':'supplier'))) {
    const applied=appliedTo(events,original.id,payment.id);
    if(applied<=0n||remaining===0n) continue;
    const n=applied<remaining?applied:remaining;
    releases.push({id:childId(b.request_id,payment.id),payment_id:payment.id,amount_minor:n.toString(),pool_account_id:payment.source.pool_account_id});
    remaining-=n;
  }
  if(remaining) fail(503,'SETTLEMENT_LEDGER_MISMATCH');
  const periods=(await q.query('SELECT *,start_date::text,end_date::text FROM accounting_document_periods WHERE company_id=$1 AND start_date<=$2::date AND end_date>=$2::date ORDER BY id FOR UPDATE',[company,row.source.issue_date])).rows;
  if(periods.length!==1||periods[0].status!=='OPEN') fail(409,'PERIOD_NOT_WRITABLE');
  for(const release of releases) if(events.some(e=>(e.id===release.payment_id||e.payment_id===release.payment_id)&&e.effective_date>row.source.issue_date)) fail(409,'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
  if(events.some(e=>e.effective_date>row.source.issue_date&&e.allocations.some((a:any)=>a.document_id===original.id))) fail(409,'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
  const configurations=(await q.query('SELECT * FROM accounting_payment_configuration WHERE company_id=$1',[company])).rows;
  const review={intent:b,document_id:id,revision:expected,original_id:original.id,date:row.source.issue_date,
    credit_minor:value.toString(),offset_minor:(value-excess).toString(),released_minor:excess.toString(),remaining_minor:(BigInt(open.open_minor)-(value-excess)).toString(),releases};
  return {...review,review_token:hash({company,actor,review,row,original,events,periods,configurations})};
}
export async function reviewPaidCredit(company:string,actor:string,id:string,expected:string,body:unknown) {
  const b=intent(body);return transact(q=>plan(q,company,actor,id,expected,b));
}
export async function commitPaidCredit(company:string,actor:string,id:string,expected:string,body:unknown,testHook?:(tx:DatabaseTransaction)=>Promise<void>) {
  const b=intent(body),input=body as any;
  if(typeof input.review_token!=='string'||!/^sha256:[a-f0-9]{64}$/.test(input.review_token)||!Array.isArray(input.releases)) fail(428,'PAID_CREDIT_REVIEW_REQUIRED');
  const requestHash=hash({company,actor,id,expected,...b,review_token:input.review_token,releases:input.releases});
  return withCanonicalPostingTransaction(async tx=>{
    const q=queryAdapter(tx);await authority(q,company,actor);
    const prior=(await q.query('SELECT * FROM accounting_paid_credit_operations WHERE company_id=$1 AND request_id=$2',[company,b.request_id])).rows[0];
    if(prior){if(prior.request_hash!==requestHash) fail(409,'IDEMPOTENCY_CONFLICT');return {...prior.result,status:'duplicate'};}
    const reviewed=await plan(q,company,actor,id,expected,b);
    if(reviewed.review_token!==input.review_token||hash(reviewed.releases)!==hash(input.releases)) fail(409,'PAID_CREDIT_REVIEW_STALE');
    const row=await document(q,company,id,true),results=[];
    for(const release of reviewed.releases) {
      const payment={id:release.id,kind:'unallocation',party_type:sales(row.kind)?'customer':'supplier',party_id:row.party_id,
        payment_id:release.payment_id,date:reviewed.date,reference:`Credit ${row.number}`.slice(0,200),amount_minor:release.amount_minor,
        allocations:[{document_id:row.original_id,amount_minor:release.amount_minor}]};
      const r=await previewPaymentInTransaction(q,company,actor,payment);
      results.push(await postPayment(company,actor,{...payment,review_token:r.review_token},undefined,tx));
    }
    await testHook?.(tx);
    const posted=await postDocument(company,actor,id,expected,undefined,tx);
    const result={status:'posted',document_id:id,journal_id:posted.journal_id,releases:results,request_id:b.request_id};
    await q.query('INSERT INTO accounting_paid_credit_operations(company_id,request_id,credit_id,actor_id,request_hash,intent,result) VALUES($1,$2,$3,$4,$5,$6,$7)',[company,b.request_id,id,actor,requestHash,reviewed,result]);
    return result;
  });
}
