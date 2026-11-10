import { fail, uuid } from '../financialDrafts/contract';
import { postCanonicalJournal, roleHasAccountingCapability, type CanonicalPostingDependencies, type DatabaseTransaction, type LockedAuthority } from '../accounting/canonicalPosting';
import { scope, transact, exactFields, supportedCompany, hash, queryAdapter, type Queryable } from './core';
import { companyChart } from './accounts';

const sourceType='accounting_bank_opening';
function intent(body:unknown) {
  const b=exactFields(body,['request_id','bank_account_id','bank_ledger_account_id','balancing_account_id','effective_date','amount_minor','direction','review_token']);
  if(typeof b.effective_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.effective_date)||
    !Number.isFinite(Date.parse(b.effective_date+'T00:00:00Z'))||
    new Date(b.effective_date+'T00:00:00Z').toISOString().slice(0,10)!==b.effective_date) fail(422,'DATE_INVALID');
  if(typeof b.amount_minor!=='string'||!/^[1-9]\d{0,11}$/.test(b.amount_minor)) fail(422,'POSITIVE_PENCE_REQUIRED');
  if(!['debit','credit'].includes(b.direction)) fail(422,'OPENING_DIRECTION_INVALID');
  return {request_id:uuid(b.request_id),bank_account_id:uuid(b.bank_account_id),
    bank_ledger_account_id:uuid(b.bank_ledger_account_id),balancing_account_id:uuid(b.balancing_account_id),
    effective_date:b.effective_date as string,amount_minor:b.amount_minor as string,direction:b.direction as string};
}
async function postAdmission(q:Queryable,company:string,actor:string) {
  supportedCompany(await scope(q,company,actor,true,true));
  const member=(await q.query('SELECT role FROM company_users WHERE company_id=$1 AND user_id=$2',[company,actor])).rows[0];
  if(!roleHasAccountingCapability(member.role,'accounting.post')) fail(403,'CAPABILITY_DENIED');
}
async function receipt(q:Queryable,company:string,bank:string) {
  const r=(await q.query(`SELECT o.*,j.source_revision,j.source_evidence_hash,j.status,
    j.id verified_journal,p.id verified_effect FROM accounting_bank_openings o
    LEFT JOIN canonical_journal_entries j ON j.company_id=o.company_id AND j.id=o.journal_id
      AND j.source_type='accounting_bank_opening' AND j.source_id=o.bank_account_id::text
      AND j.posting_kind='bank_opening' AND j.economic_effect_id='bank-opening:'||o.bank_account_id::text
    LEFT JOIN accounting_posting_effects p ON p.company_id=o.company_id AND p.journal_id=j.id
      AND p.source_type=j.source_type AND p.source_id=j.source_id AND p.economic_effect_id=j.economic_effect_id
      AND p.idempotency_key='bank-opening:'||o.bank_account_id::text AND p.status='posted'
      AND p.source_revision=j.source_revision AND p.source_evidence_hash=j.source_evidence_hash
    WHERE o.company_id=$1 AND o.bank_account_id=$2`,[company,bank])).rows[0];
  if(!r) return null;
  if(!r.verified_journal||!r.verified_effect||r.status!=='posted'||hash(r.source)!==r.source_revision||
    r.source_evidence_hash!==r.source_revision||hash(r.intent)!==hash(r.source.intent)) fail(503,'OPENING_HISTORY_INVALID');
  const balance=(await q.query(`SELECT coalesce(sum(l.debit_minor-l.credit_minor),0)::text n
    FROM canonical_journal_lines l JOIN canonical_journal_entries j ON j.id=l.journal_entry_id AND j.company_id=l.company_id
    WHERE l.company_id=$1 AND l.account_id=$2 AND j.status='posted' AND j.posting_date<=CURRENT_DATE`,
    [company,r.bank_ledger_account_id])).rows[0].n;
  return {status:'recorded',bank_account_id:bank,journal_id:r.journal_id,intent:r.intent,balance_minor:balance};
}
export async function recoverBankOpening(company:string,actor:string,bank:string) {
  uuid(bank);return transact(async q=>{
    await scope(q,company,actor);
    if(!(await q.query('SELECT id FROM bank_accounts WHERE company_id=$1 AND id=$2',[company,bank])).rowCount) fail(404,'RESOURCE_NOT_FOUND');
    return await receipt(q,company,bank)??{status:'unknown',bank_account_id:bank};
  },true);
}
export async function bankOpeningContext(company:string,actor:string) {
  return transact(async q=>{
    await scope(q,company,actor);
    const m=(await q.query('SELECT role FROM company_users WHERE company_id=$1 AND user_id=$2',[company,actor])).rows[0];
    const config=(await q.query('SELECT mappings FROM accounting_payment_configuration WHERE company_id=$1',[company])).rows[0];
    return {banks:(await q.query('SELECT * FROM bank_accounts WHERE company_id=$1 ORDER BY account_name',[company])).rows,
      accounts:await companyChart(q,company),bank_ledger_account_id:config?.mappings?.bank??null,can_post:roleHasAccountingCapability(m.role,'accounting.post')};
  });
}
async function plan(q:Queryable,company:string,actor:string,b:ReturnType<typeof intent>) {
  await postAdmission(q,company,actor);
  const bank=(await q.query('SELECT * FROM bank_accounts WHERE company_id=$1 AND id=$2 FOR UPDATE',[company,b.bank_account_id])).rows[0];
  if(!bank) fail(404,'RESOURCE_NOT_FOUND');
  if(bank.status!=='active'||bank.currency!=='GBP') fail(422,'BANK_ACCOUNT_UNAVAILABLE');
  const prior=await receipt(q,company,b.bank_account_id);
  if(prior) fail(409,'OPENING_ALREADY_POSTED');
  if(b.bank_ledger_account_id===b.balancing_account_id) fail(422,'OPENING_ACCOUNTS_MUST_DIFFER');
  const accounts=(await q.query('SELECT id,company_id,code,name,account_type,is_active FROM chart_of_accounts WHERE company_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',
    [company,[b.bank_ledger_account_id,b.balancing_account_id]])).rows;
  const cash=accounts.find(a=>a.id===b.bank_ledger_account_id),equity=accounts.find(a=>a.id===b.balancing_account_id);
  if(!cash||!equity||accounts.some(a=>a.is_active!==true)||!['asset','assets'].includes(cash.account_type)||equity.account_type!=='equity')
    fail(422,'OPENING_ACCOUNT_INVALID');
  // No document or party-pool opening: those require real subledger migration.
  const documentConfig=(await q.query('SELECT mappings FROM accounting_company_configuration WHERE company_id=$1 FOR UPDATE',[company])).rows[0];
  const paymentConfig=(await q.query('SELECT * FROM accounting_payment_configuration WHERE company_id=$1 FOR UPDATE',[company])).rows[0];
  const forbidden=[...Object.values(documentConfig?.mappings??{}),paymentConfig?.mappings?.customer_credit,paymentConfig?.mappings?.supplier_prepayment];
  if(accounts.some(a=>forbidden.includes(a.id))) fail(422,'OPENING_SUBLEDGER_UNSUPPORTED');
  const history=(await q.query(`SELECT 1 FROM accounting_document_sources d,jsonb_each_text(d.posting_accounts) m
    WHERE d.company_id=$1 AND m.value=ANY($2::text[]) LIMIT 1`,[company,accounts.map(a=>a.id)])).rowCount;
  const pools=(await q.query(`SELECT 1 FROM accounting_payment_events WHERE company_id=$1
    AND source->>'pool_account_id'=ANY($2::text[]) LIMIT 1`,[company,accounts.map(a=>a.id)])).rowCount;
  if(history||pools) fail(422,'OPENING_SUBLEDGER_UNSUPPORTED');
  // An initial opening must precede all existing activity in this bank ledger.
  if((await q.query('SELECT 1 FROM canonical_journal_lines WHERE company_id=$1 AND account_id=$2 LIMIT 1',[company,cash.id])).rowCount||
    (await q.query('SELECT 1 FROM accounting_bank_openings WHERE company_id=$1 AND bank_ledger_account_id=$2',[company,cash.id])).rowCount)
    fail(409,'OPENING_BANK_HAS_ACTIVITY');
  const periods=(await q.query(`SELECT *,start_date::text,end_date::text FROM accounting_document_periods
    WHERE company_id=$1 AND start_date<=$2::date AND end_date>=$2::date ORDER BY id FOR UPDATE`,[company,b.effective_date])).rows;
  if(periods.length!==1||periods[0].status!=='OPEN') fail(409,'PERIOD_NOT_WRITABLE');
  // The current reviewed payment-bank mapping is mandatory: reports and future
  // payment postings must share this same ledger, not an invented shadow balance.
  if(!paymentConfig||paymentConfig.mappings.bank!==cash.id) fail(422,'OPENING_PAYMENT_BANK_SETUP_REQUIRED');
  const debit=b.direction==='debit';
  const lines=[{accountId:cash.id,debitMinor:debit?b.amount_minor:'0',creditMinor:debit?'0':b.amount_minor,currencyCode:'GBP',sourceLineRef:'bank',taxCode:null},
    {accountId:equity.id,debitMinor:debit?'0':b.amount_minor,creditMinor:debit?b.amount_minor:'0',currencyCode:'GBP',sourceLineRef:'balancing',taxCode:null}];
  const source={intent:b,accounts,lines,period:periods[0],configuration:paymentConfig,
    bank:{id:bank.id,name:bank.account_name,status:bank.status,currency:bank.currency},document_mappings:documentConfig?.mappings??{}};
  return {intent:b,source,review_token:hash(source),lines,accounts,period:periods[0],configuration:paymentConfig};
}
export async function reviewBankOpening(company:string,actor:string,body:unknown) {
  return transact(q=>plan(q,company,actor,intent(body)));
}
class Replayed extends Error {constructor(public data:any){super('Opening already recorded');}}
export async function postBankOpening(company:string,actor:string,body:unknown,testHook?:(tx:DatabaseTransaction)=>Promise<void>) {
  const b=intent(body),expected=(body as any).review_token;
  if(typeof expected!=='string'||!/^sha256:[a-f0-9]{64}$/.test(expected)) fail(428,'OPENING_REVIEW_REQUIRED');
  const priorOrPlan=async(q:Queryable)=>{
    await postAdmission(q,company,actor);
    const prior=await receipt(q,company,b.bank_account_id);
    if(prior) {if(hash(prior.intent)!==hash(b)) fail(409,'OPENING_REQUEST_CONFLICT');return {prior};}
    if((await q.query('SELECT 1 FROM accounting_bank_openings WHERE company_id=$1 AND request_id=$2',[company,b.request_id])).rowCount)
      fail(409,'OPENING_REQUEST_CONFLICT');
    const p=await plan(q,company,actor,b);if(p.review_token!==expected) fail(409,'OPENING_REVIEW_STALE');return {plan:p};
  };
  const initial=await transact(priorOrPlan);if(initial.prior)return initial.prior;
  let current=initial.plan!,transaction:DatabaseTransaction;
  const authority=<T>(value:T,keys:string[]):LockedAuthority<T>=>({authority:value,recordKeys:keys,capturedToken:{revision:expected},
    lockMode:'FOR UPDATE',transactionBound:true,validateCurrent:({command,companyId})=>
      companyId===company&&command.sourceRevision===expected&&command.sourceEvidenceHash===expected&&current.review_token===expected
        ?{ok:true}:{ok:false,code:'transaction_contract_invalid',message:'Opening review changed.'}});
  const deps:CanonicalPostingDependencies={
    sourceProvider:{async lockForPosting(_command,tx){
      transaction=tx;const next=await priorOrPlan(queryAdapter(tx));if(next.prior)throw new Replayed(next.prior);current=next.plan!;
      return authority({companyId:company,sourceType,sourceId:b.bank_account_id,status:'reviewed',isPostable:true,sourceRevision:expected,evidenceHash:expected},
        [`companies:${company}`,`bank_accounts:${b.bank_account_id}`]);
    }},
    contextProvider:{async lockForPosting(){return authority({companyId:company,financialYearId:current.period.financial_year_id,
      accountingPeriodId:current.period.id,periodStatus:'OPEN',configurationVersionId:current.configuration.revision,currencyCode:'GBP',
      accounts:Object.fromEntries(current.accounts.map(a=>[a.id,{id:a.id,companyId:company,isActive:a.is_active,isEligible:true,currencyCode:'GBP'}])),
      metadata:{source_revision:expected,source_evidence_hash:expected,business_accounting_basis:'accrual'}},
      [`accounting_document_periods:${current.period.id}`,`accounting_payment_configuration:${company}`]);}},
    lineBuilder:{async build(){return current.lines;}},
    hooks:{afterJournalInsert:async({journal})=>{
      await testHook?.(transaction!);
      await queryAdapter(transaction!).query(`INSERT INTO accounting_bank_openings
        (company_id,bank_account_id,bank_ledger_account_id,request_id,intent,source,journal_id,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [company,b.bank_account_id,b.bank_ledger_account_id,b.request_id,JSON.stringify(b),JSON.stringify(current.source),journal.id,actor]);
    }}
  };
  try {
    await postCanonicalJournal({principal:{kind:'user',userId:actor,requestedCompanyId:company},requestedCompanyId:company,
      sourceType,sourceId:b.bank_account_id,sourceRevision:expected,sourceEvidenceHash:expected,sourceStatus:'reviewed',
      postingKind:'bank_opening',economicEffectId:`bank-opening:${b.bank_account_id}`,idempotencyKey:`bank-opening:${b.bank_account_id}`,
      accountIds:current.accounts.map(a=>a.id),postingDate:b.effective_date,configurationVersionId:current.configuration.revision,
      currencyCode:'GBP',description:`Bank opening: ${current.source.bank.name}`,reference:'Opening balance'},deps);
  }catch(error){if(error instanceof Replayed)return error.data;throw error;}
  return recoverBankOpening(company,actor,b.bank_account_id);
}
