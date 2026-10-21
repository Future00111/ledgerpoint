import { randomUUID } from 'node:crypto';
import { fail, uuid } from '../financialDrafts/contract';
import { postCanonicalJournal, type CanonicalLineDraft, type CanonicalPostingDependencies, type DatabaseTransaction, type LockedAuthority } from '../accounting/canonicalPosting';
import { scope, transact, exactFields, supportedCompany, hash, queryAdapter, type Queryable } from './core';
import { companyChart } from './accounts';
import { allocated, appliedTo, allocationSign, unappliedEffect, paymentEvents, documentOpen } from './settlement';

const roles=['bank','customer_credit','supplier_prepayment'];
const types:Record<string,string[]>= {bank:['asset','assets'],customer_credit:['liability','liabilities'],supplier_prepayment:['asset','assets']};
const validDate=(value:unknown):value is string=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const amount=(value:unknown)=>{
  if(typeof value!=='string'||!/^\d{1,16}$/.test(value)||BigInt(value)<=0n) fail(422,'POSITIVE_PENCE_REQUIRED');
  return BigInt(value as string).toString();
};
async function configuration(q:Queryable,company:string,lock=false) {
  return (await q.query(`SELECT * FROM accounting_payment_configuration WHERE company_id=$1${lock?' FOR UPDATE':''}`,[company])).rows[0]??null;
}
async function validateMappings(q:Queryable,company:string,mappings:any) {
  exactFields(mappings,roles);
  const ids=roles.map(r=>uuid(mappings[r]));
  if(new Set(ids).size!==3) fail(422,'PAYMENT_ACCOUNTS_MUST_DIFFER');
  const accounts=(await q.query('SELECT * FROM chart_of_accounts WHERE company_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',[company,ids])).rows;
  const config=(await q.query('SELECT mappings FROM accounting_company_configuration WHERE company_id=$1',[company])).rows[0];
  const historical=(await q.query(`SELECT DISTINCT m.value account_id FROM accounting_document_sources d,
    jsonb_each_text(d.posting_accounts) m WHERE d.company_id=$1 AND d.status='posted'`,[company])).rows;
  for(const role of roles) {
    const a=accounts.find(a=>a.id===mappings[role]);
    if(!a || a.is_active!==true || !types[role]!.includes(String(a.account_type).toLowerCase())) fail(422,'PAYMENT_ACCOUNT_INVALID',`/mappings/${role}`);
    if(Object.values(config?.mappings??{}).includes(a.id)||historical.some(h=>h.account_id===a.id)) fail(422,'PAYMENT_CONTROL_ACCOUNT_CONFLICT',`/mappings/${role}`);
  }
  return accounts;
}
export async function savePaymentConfiguration(company:string,actor:string,body:unknown) {
  const b=exactFields(body,['revision','mappings']);
  return transact(async q=>{
    supportedCompany(await scope(q,company,actor,true,true));
    const old=await configuration(q,company,true);
    if((old?.revision??null)!==b.revision) fail(409,'REVISION_CONFLICT');
    await validateMappings(q,company,b.mappings);
    const next={revision:randomUUID(),mappings:b.mappings};
    await q.query(`INSERT INTO accounting_payment_configuration(company_id,revision,mappings) VALUES($1,$2,$3)
      ON CONFLICT(company_id) DO UPDATE SET revision=$2,mappings=$3`,[company,next.revision,next.mappings]);
    await q.query(`INSERT INTO accounting_payment_config_audit(id,company_id,actor_id,before_config,after_config)
      VALUES($1,$2,$3,$4,$5)`,[randomUUID(),company,actor,old,next]);
    return next;
  });
}
export async function paymentContext(company:string,actor:string) {
  return transact(async q=>{
    await scope(q,company,actor);
    return {configuration:await configuration(q,company),accounts:await companyChart(q,company),
      customers:(await q.query('SELECT id,name FROM customers WHERE company_id=$1 ORDER BY name',[company])).rows,
      suppliers:(await q.query('SELECT id,name FROM suppliers WHERE company_id=$1 ORDER BY name',[company])).rows};
  });
}
export async function listPayments(company:string,actor:string) {
  return transact(async q=>{
    await scope(q,company,actor);const events=await paymentEvents(q,company);
    return events.filter(e=>e.kind==='payment').map(p=>{
      const related=events.filter(e=>e.id===p.id||e.payment_id===p.id);
      const allocationBalances=new Map<string,bigint>();
      for(const e of related) for(const a of e.allocations) allocationBalances.set(a.document_id,
        (allocationBalances.get(a.document_id)??0n)+allocationSign(e)*BigInt(a.amount_minor));
      return {...p,unapplied_minor:related.reduce((n,e)=>n+unappliedEffect(e),0n).toString(),
        allocated_minor:related.reduce((n,e)=>n+allocationSign(e)*allocated(e),0n).toString(),
        refunded_minor:related.filter(e=>e.kind==='refund').reduce((n,e)=>n+BigInt(e.amount_minor),0n).toString(),
        reversed:related.some(e=>e.kind==='reversal'),
        allocation_balances:[...allocationBalances].map(([document_id,n])=>({document_id,amount_minor:n.toString()})),events:related};
    });
  },true);
}
function intent(body:unknown) {
  const b=exactFields(body,['id','kind','party_type','party_id','payment_id','date','reference','amount_minor','allocations','review_token']);
  if(!['payment','allocation','unallocation','refund','reversal'].includes(b.kind)) fail(422,'PAYMENT_ACTION_INVALID');
  if(!['customer','supplier'].includes(b.party_type)) fail(422,'PARTY_TYPE_INVALID');
  if(!validDate(b.date)) fail(422,'DATE_INVALID');
  if(typeof b.reference!=='string'||!b.reference.trim()||b.reference.length>200) fail(422,'REFERENCE_REQUIRED');
  if(!Array.isArray(b.allocations)||b.allocations.length>100) fail(422,'ALLOCATIONS_INVALID');
  const allocations=b.allocations.map((v:any)=>{exactFields(v,['document_id','amount_minor']);return {document_id:uuid(v.document_id),amount_minor:amount(v.amount_minor)};})
    .sort((a:any,b:any)=>a.document_id.localeCompare(b.document_id));
  if(new Set(allocations.map((a:any)=>a.document_id)).size!==allocations.length) fail(422,'DUPLICATE_ALLOCATION');
  if(b.kind==='payment' && b.payment_id!=null) fail(422,'PAYMENT_PARENT_INVALID');
  return {id:uuid(b.id),kind:b.kind as string,party_type:b.party_type as string,party_id:uuid(b.party_id),
    payment_id:b.kind==='payment'?null:uuid(b.payment_id),date:b.date,reference:b.reference.trim(),
    amount_minor:amount(b.amount_minor),allocations};
}
async function plan(q:Queryable,company:string,actor:string,b:ReturnType<typeof intent>) {
  supportedCompany(await scope(q,company,actor,true,true));
  const party=(await q.query(`SELECT id,name FROM ${b.party_type==='customer'?'customers':'suppliers'} WHERE company_id=$1 AND id=$2`,[company,b.party_id])).rows[0];
  if(!party) fail(404,'RESOURCE_NOT_FOUND');
  const config=await configuration(q,company,true);
  if(!config) fail(422,'PAYMENT_SETUP_REQUIRED');
  await validateMappings(q,company,config.mappings);
  const periods=(await q.query(`SELECT *,start_date::text,end_date::text FROM accounting_document_periods
    WHERE company_id=$1 AND start_date<=$2::date AND end_date>=$2::date ORDER BY id FOR UPDATE`,[company,b.date])).rows;
  if(periods.length!==1||periods[0].status!=='OPEN') fail(409,'PERIOD_NOT_WRITABLE');
  const events=await paymentEvents(q,company);
  const parent=b.payment_id?events.find(e=>e.id===b.payment_id&&e.kind==='payment'):null;
  const related=parent?events.filter(e=>e.id===parent.id||e.payment_id===parent.id):[];
  if(b.payment_id && (!parent||parent.party_id!==b.party_id||parent.party_type!==b.party_type)) fail(404,'RESOURCE_NOT_FOUND');
  if(related.some(e=>e.kind==='reversal')) fail(409,'PAYMENT_ALREADY_REVERSED');
  if(related.some(e=>e.effective_date>b.date)) fail(409,'DATE_PRECEDES_PAYMENT_ACTIVITY');
  const remainder=related.reduce((n,e)=>n+unappliedEffect(e),0n);
  const value=BigInt(b.amount_minor),sum=b.allocations.reduce((n:bigint,a:any)=>n+BigInt(a.amount_minor),0n);
  if(b.kind==='payment' && sum>value) fail(422,'ALLOCATION_EXCEEDS_PAYMENT');
  if(['allocation','unallocation'].includes(b.kind) && (sum!==value||sum===0n)) fail(422,'ALLOCATION_TOTAL_MISMATCH');
  if(['refund','reversal'].includes(b.kind) && b.allocations.length) fail(422,'REFUND_ALLOCATIONS_INVALID');
  if(['allocation','refund','reversal'].includes(b.kind) && value>remainder) fail(409,'AMOUNT_EXCEEDS_UNAPPLIED');
  if(b.kind==='reversal' && (remainder!==BigInt(parent.amount_minor)||value!==remainder||related.some(e=>e.kind==='refund')))
    fail(409,'UNALLOCATE_BEFORE_REVERSAL');
  const customer=b.party_type==='customer';
  const creditRole=customer?'customer_credit':'supplier_prepayment';
  // Existing unapplied cash keeps the control account captured by its original
  // receipt/payment, even when later configuration chooses a different account.
  const poolAccount=parent?.source.pool_account_id??config.mappings[creditRole];
  const bankAccount=b.kind==='reversal'?parent.source.bank_account_id:config.mappings.bank;
  const lines:CanonicalLineDraft[]=[];
  const add=(id:string,n:bigint,debit:boolean,ref:string)=>{
    if(n) lines.push({accountId:id,debitMinor:debit?n.toString():'0',creditMinor:debit?'0':n.toString(),currencyCode:'GBP',sourceLineRef:ref,taxCode:null});
  };
  const openStates:any[]=[];
  for(const a of b.allocations) {
    const d=await documentOpen(q,company,a.document_id,events);
    if(d.party_id!==b.party_id || d.kind!==(customer?'sales_invoice':'purchase_bill')) fail(422,'ALLOCATION_PARTY_MISMATCH');
    if(d.posting_date>b.date) fail(409,'DATE_PRECEDES_DOCUMENT');
    // Do not let a backdated event invalidate a later allocation or credit.
    const later=(await q.query(`SELECT 1 FROM accounting_document_sources d JOIN canonical_journal_entries j ON j.id=d.journal_id
      WHERE d.company_id=$1 AND d.original_id=$2 AND d.status='posted' AND j.posting_date>$3::date LIMIT 1`,[company,d.id,b.date])).rowCount;
    if(later || events.some(e=>e.effective_date>b.date && e.allocations.some((x:any)=>x.document_id===d.id))) fail(409,'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
    const n=BigInt(a.amount_minor),undo=b.kind==='unallocation';
    if(undo ? n>appliedTo(related,d.id) : n>BigInt(d.open_minor)) fail(409,undo?'UNALLOCATION_EXCEEDS_APPLIED':'ALLOCATION_EXCEEDS_OPEN_AMOUNT');
    add(d.posting_accounts[customer?'receivables':'payables'],n,undo?customer:!customer,d.id);
    openStates.push({id:d.id,revision:d.revision,open_minor:d.open_minor,applied_minor:parent?appliedTo(related,d.id).toString():'0',number:d.number});
  }
  if(b.kind==='payment') {add(bankAccount,value,customer,'cash');add(poolAccount,value-sum,!customer,'unapplied');}
  if(b.kind==='allocation') add(poolAccount,value,customer,'unapplied');
  if(b.kind==='unallocation') add(poolAccount,value,!customer,'unapplied');
  if(['refund','reversal'].includes(b.kind)) {add(poolAccount,value,customer,'unapplied');add(bankAccount,value,!customer,'cash');}
  const ids=[...new Set(lines.map(l=>l.accountId))];
  const accounts=(await q.query('SELECT id,company_id,code,name,account_type,is_active FROM chart_of_accounts WHERE company_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',[company,ids])).rows;
  if(accounts.length!==ids.length||accounts.some(a=>a.is_active!==true)) fail(422,'PAYMENT_ACCOUNT_INVALID');
  const source={intent:b,lines,bank_account_id:bankAccount,pool_account_id:poolAccount,party_name:party.name,
    configuration_revision:config.revision,period_id:periods[0].id,open_states:openStates,
    parent_remainder_minor:remainder.toString(),parent_events:related.map(e=>e.id),accounts};
  return {source,review_token:hash(source),lines,period:periods[0],configuration:config,party_name:party.name,
    allocated_minor:sum.toString(),unapplied_minor:(b.kind==='payment'?value-sum:remainder+unappliedEffect({...b,allocations:b.allocations})).toString()};
}
export async function previewPayment(company:string,actor:string,body:unknown) {
  const b=intent(body);return transact(q=>plan(q,company,actor,b));
}
class Replayed extends Error {constructor(public data:any){super('Payment event already recorded');}}
export async function postPayment(company:string,actor:string,body:unknown,testHook?:(tx:DatabaseTransaction)=>Promise<void>) {
  const b=intent(body),expected=(body as any).review_token;
  if(typeof expected!=='string'||!/^sha256:[a-f0-9]{64}$/.test(expected)) fail(428,'PAYMENT_REVIEW_REQUIRED');
  const requestHash=hash(b);
  // Admission read only supplies the command envelope. Locked calculation below
  // is the authority. Retries are checked before recalculating spent remainders.
  const initial=await transact(async q=>{
    await scope(q,company,actor,true,true);
    const prior=(await q.query('SELECT * FROM accounting_payment_events WHERE company_id=$1 AND id=$2',[company,b.id])).rows[0];
    if(prior){if(prior.request_hash!==requestHash) fail(409,'IDEMPOTENCY_CONFLICT');return {replayed:prior};}
    const p=await plan(q,company,actor,b);if(p.review_token!==expected) fail(409,'PAYMENT_REVIEW_STALE');return {plan:p};
  });
  if(initial.replayed) return {status:'duplicate',id:b.id,journal_id:initial.replayed.journal_id};
  const first=initial.plan!;let current=first,transaction:DatabaseTransaction;
  const authority=<T>(value:T,keys:string[],token:string):LockedAuthority<T>=>({authority:value,recordKeys:keys,
    capturedToken:{revision:token},lockMode:'FOR UPDATE',transactionBound:true,
    validateCurrent:({command,companyId})=>companyId===company&&command.sourceRevision===expected&&command.sourceEvidenceHash===expected&&current.review_token===expected
      ?{ok:true}:{ok:false,code:'transaction_contract_invalid',message:'Reviewed payment state changed.'}});
  const deps:CanonicalPostingDependencies={
    sourceProvider:{async lockForPosting(_command,tx){
      transaction=tx;const q=queryAdapter(tx);await scope(q,company,actor,true,true);
      const prior=(await q.query('SELECT * FROM accounting_payment_events WHERE company_id=$1 AND id=$2',[company,b.id])).rows[0];
      if(prior){if(prior.request_hash!==requestHash) fail(409,'IDEMPOTENCY_CONFLICT');throw new Replayed({status:'duplicate',id:b.id,journal_id:prior.journal_id});}
      current=await plan(q,company,actor,b);if(current.review_token!==expected) fail(409,'PAYMENT_REVIEW_STALE');
      return authority({companyId:company,sourceType:'accounting_payment_event',sourceId:b.id,status:'reviewed',isPostable:true,
        sourceRevision:expected,evidenceHash:expected},[`companies:${company}`,`accounting_payment_event:${b.id}`],expected);
    }},
    contextProvider:{async lockForPosting(){
      return authority({companyId:company,financialYearId:current.period.financial_year_id,accountingPeriodId:current.period.id,
        periodStatus:'OPEN',configurationVersionId:current.configuration.revision,currencyCode:'GBP',
        accounts:Object.fromEntries(current.source.accounts.map(a=>[a.id,{id:a.id,companyId:company,isActive:a.is_active,isEligible:true,currencyCode:'GBP'}])),
        metadata:{source_revision:expected,source_evidence_hash:expected,business_accounting_basis:'accrual',payment_kind:b.kind}},
        [`accounting_document_periods:${current.period.id}`,`accounting_payment_configuration:${company}`],current.configuration.revision);
    }},lineBuilder:{async build(){return current.lines;}},
    hooks:{afterJournalInsert:async({journal})=>{
      await testHook?.(transaction!);
      await queryAdapter(transaction!).query(`INSERT INTO accounting_payment_events
        (id,company_id,party_id,party_type,kind,payment_id,effective_date,reference,amount_minor,allocations,request_hash,source,journal_id,actor_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [b.id,company,b.party_id,b.party_type,b.kind,b.payment_id,b.date,b.reference,b.amount_minor,JSON.stringify(b.allocations),requestHash,JSON.stringify(current.source),journal.id,actor]);
    }}
  };
  try {
    const result=await postCanonicalJournal({principal:{kind:'user',userId:actor,requestedCompanyId:company},requestedCompanyId:company,
      sourceType:'accounting_payment_event',sourceId:b.id,sourceRevision:expected,sourceEvidenceHash:expected,sourceStatus:'reviewed',
      postingKind:`party_${b.kind}`,economicEffectId:`payment-event:${b.id}`,idempotencyKey:`payment-event:${b.id}`,
      accountIds:[...new Set(first.lines.map(l=>l.accountId))],postingDate:b.date,configurationVersionId:first.configuration.revision,
      currencyCode:'GBP',description:`${b.party_type} ${b.kind}: ${b.reference}`,reference:b.reference},deps);
    return {status:result.status,id:b.id,journal_id:result.journalId};
  } catch(error){if(error instanceof Replayed)return error.data;throw error;}
}
