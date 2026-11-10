import {fail,uuid,canWriteDraft} from '../financialDrafts/contract';
import {bankImportSides} from '../bankImportMoney';
import {scope,transact,hash,exactFields,type Queryable} from './core';
import {normaliseBankImport} from './bankImports';

export async function statementRows(q:Queryable,company:string) {
  const rows=(await q.query(`SELECT b.*,b.date::text,
    ledgerly_bank_statement_is_native(b.company_id,b.id) native,
    coalesce((SELECT sum(m.amount_minor) FROM accounting_bank_active_matches m
      WHERE m.company_id=b.company_id AND m.bank_transaction_id=b.id),0)::text matched_minor
    FROM bank_transactions b WHERE b.company_id=$1
    AND ledgerly_bank_statement_is_native(b.company_id,b.id) ORDER BY b.date,b.id`,[company])).rows;
  return rows.map(r=>{
    const sides=bankImportSides(r),total=BigInt(sides.inPence)+BigInt(sides.outPence),remaining=total-BigInt(r.matched_minor);
    if(remaining<0n) fail(503,'BANK_MATCH_HISTORY_INVALID');
    // Receipt hashing uses JSON values, never driver Date objects (whose
    // enumerable keys differ from their persisted ISO string representation).
    return {...JSON.parse(JSON.stringify(r)),amount_minor:total.toString(),direction:sides.inPence>0n?'in':'out',remaining_minor:remaining.toString(),
      status:remaining===0n?'matched':remaining===total?'unmatched':'partial'};
  });
}
export async function nativePayments(q:Queryable,company:string) {
  const rows=(await q.query(`SELECT e.*,e.effective_date::text,j.id verified_journal,
    j.source_revision,j.source_evidence_hash,p.id verified_effect,
    coalesce((SELECT sum(m.amount_minor) FROM accounting_bank_active_matches m WHERE m.company_id=e.company_id AND m.payment_id=e.id),0)::text matched_minor,
    EXISTS(SELECT 1 FROM accounting_payment_events r WHERE r.company_id=e.company_id AND r.payment_id=e.id AND r.kind='reversal') reversed
    FROM accounting_payment_events e
    LEFT JOIN canonical_journal_entries j ON j.id=e.journal_id AND j.company_id=e.company_id
      AND j.source_type='accounting_payment_event' AND j.source_id=e.id::text
      AND j.posting_kind='party_'||e.kind AND j.economic_effect_id='payment-event:'||e.id::text
      AND j.status='posted' AND j.currency_code='GBP'
    LEFT JOIN accounting_posting_effects p ON p.company_id=e.company_id AND p.journal_id=j.id
      AND p.source_id=j.source_id AND p.source_type=j.source_type AND p.status='posted'
      AND p.posting_kind=j.posting_kind
      AND p.economic_effect_id=j.economic_effect_id AND p.idempotency_key=j.economic_effect_id
      AND p.source_revision=j.source_revision AND p.source_evidence_hash=j.source_evidence_hash
    WHERE e.company_id=$1 AND e.kind IN ('payment','refund') ORDER BY e.effective_date,e.id`,[company])).rows;
  for(const r of rows) {
    if(!r.verified_journal||!r.verified_effect||r.source.intent?.kind!==r.kind||hash(r.source)!==r.source_revision||r.source_revision!==r.source_evidence_hash)
      fail(503,'BANK_PAYMENT_HISTORY_INVALID');
    const lines=(await q.query('SELECT account_id,debit_minor::text,credit_minor::text FROM canonical_journal_lines WHERE company_id=$1 AND journal_entry_id=$2',[company,r.journal_id])).rows;
    const cash=lines.filter(l=>l.account_id===r.source.bank_account_id);
    const sign=(r.party_type==='customer'?1n:-1n)*(r.kind==='refund'?-1n:1n);
    if(cash.length!==1||BigInt(cash[0].debit_minor)-BigInt(cash[0].credit_minor)!==sign*BigInt(r.amount_minor))
      fail(503,'BANK_PAYMENT_HISTORY_INVALID');
    r.bank_ledger_account_id=r.source.bank_account_id;
    r.direction=sign>0n?'in':'out';
    r.remaining_minor=(BigInt(r.amount_minor)-BigInt(r.matched_minor)).toString();
    if(BigInt(r.remaining_minor)<0n) fail(503,'BANK_MATCH_HISTORY_INVALID');
  }
  return rows;
}
const publicPayment=(r:any)=>({id:r.id,reference:r.reference,effective_date:r.effective_date,party_type:r.party_type,
  kind:r.kind,direction:r.direction,
  amount_minor:r.amount_minor,remaining_minor:r.remaining_minor,bank_ledger_account_id:r.bank_ledger_account_id,journal_id:r.journal_id});
export async function matches(q:Queryable,company:string) {
  const rows=(await q.query(`SELECT m.*,c.request_id correction_request_id,c.effective_at corrected_at,
    c.reason correction_reason,c.actor_id correction_actor,(c.request_id IS NULL) active
    FROM accounting_bank_matches m LEFT JOIN accounting_bank_match_corrections c
    ON c.company_id=m.company_id AND c.match_request_id=m.request_id
    WHERE m.company_id=$1 ORDER BY m.created_at,m.request_id`,[company])).rows;
  for(const r of rows) if(hash(r.evidence)!==r.evidence_hash)fail(503,'BANK_MATCH_HISTORY_INVALID');
  return rows;
}
const matchReceipt=(r:any)=>({status:'recorded',request_id:r.request_id,bank_transaction_id:r.bank_transaction_id,
  payment_id:r.payment_id,amount_minor:r.amount_minor,journal_id:r.journal_id,active:r.active??true,
  correction_request_id:r.correction_request_id??null,corrected_at:r.corrected_at??null,
  correction_reason:r.correction_reason??null,correction_actor:r.correction_actor??null});
async function bankLedgerFor(q:Queryable,company:string,bank:string,fallback:string|null) {
  const opening=(await q.query('SELECT bank_ledger_account_id FROM accounting_bank_openings WHERE company_id=$1 AND bank_account_id=$2',[company,bank])).rows[0];
  const previous=(await q.query(`SELECT DISTINCT evidence->>'bankLedger' ledger FROM accounting_bank_matches
    WHERE company_id=$1 AND evidence->'bank'->>'id'=$2`,[company,bank])).rows;
  if(previous.length>1||(opening&&previous.some(p=>p.ledger!==opening.bank_ledger_account_id)))fail(503,'BANK_MATCH_HISTORY_INVALID');
  return opening?.bank_ledger_account_id??previous[0]?.ledger??fallback;
}
export async function bankStatementContext(company:string,actor:string) {
  return transact(async q=>{
    await scope(q,company,actor);
    const m=(await q.query('SELECT role FROM company_users WHERE company_id=$1 AND user_id=$2',[company,actor])).rows[0];
    const cfg=(await q.query('SELECT mappings FROM accounting_payment_configuration WHERE company_id=$1',[company])).rows[0];
    const banks=(await q.query("SELECT id,account_name FROM bank_accounts WHERE company_id=$1 AND currency='GBP' AND status='active' ORDER BY account_name",[company])).rows;
    for(const bank of banks)bank.bank_ledger_account_id=await bankLedgerFor(q,company,bank.id,cfg?.mappings?.bank??null);
    return {banks,supports_refund_matching:true,
      can_write:canWriteDraft(m.role,true),bank_ledger_account_id:cfg?.mappings?.bank??null,
      statements:await statementRows(q,company),payments:(await nativePayments(q,company)).filter(p=>!p.reversed).map(publicPayment),
      matches:(await matches(q,company)).map(matchReceipt)};
  },true);
}
export async function importPlan(q:Queryable,company:string,actor:string,body:unknown) {
  const b=normaliseBankImport(body);
  await scope(q,company,actor,true,true);
  const bank=(await q.query("SELECT id,currency,status FROM bank_accounts WHERE company_id=$1 AND id=$2 FOR UPDATE",[company,b.bank_account_id])).rows[0];
  if(!bank||bank.currency!=='GBP'||bank.status!=='active')fail(422,'BANK_ACCOUNT_UNAVAILABLE');
  const old=(await q.query(`SELECT date::text,description,coalesce(reference,'') reference,money_in::text,money_out::text
    FROM bank_transactions WHERE company_id=$1 AND bank_account_id=$2 ORDER BY id`,[company,b.bank_account_id])).rows;
  const key=(r:any)=>hash({date:r.date,description:r.description.trim(),reference:r.reference??'',
    in:bankImportSides(r).inPence.toString(),out:bankImportSides(r).outPence.toString()});
  let keys:string[];
  try {
    keys=old.map(r=>{
      if(!r.date||typeof r.description!=='string'||!r.description.trim())throw new Error('Unkeyable history');
      return key(r);
    });
  } catch {
    fail(409,'BANK_IMPORT_LEGACY_HISTORY_UNKEYABLE');
  }
  const prior=new Set(keys!),seen=new Set<string>(),duplicates:any[]=[];
  b.rows.forEach((r:any,index:number)=>{
    const k=key(r);if(prior.has(k)||seen.has(k))duplicates.push({index,reason:prior.has(k)?'Already imported':'Repeated in this batch'});seen.add(k);
  });
  const evidence={intent:b,bank,prior:[...prior].sort()};
  return {intent:b,rows:b.rows,duplicates,can_import:duplicates.length===0,review_token:hash(evidence)};
}
export async function reviewStatementImport(company:string,actor:string,body:unknown) {
  return transact(async q=>{
    const p=await importPlan(q,company,actor,body);
    if(p.can_import) {
      await q.query(`INSERT INTO accounting_bank_import_reviews(company_id,request_id,actor_id,bank_account_id,intent,review_token)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(company_id,request_id) DO NOTHING`,
        [company,p.intent.request_id,actor,p.intent.bank_account_id,JSON.stringify(p.intent.rows),p.review_token]);
      const old=(await q.query('SELECT * FROM accounting_bank_import_reviews WHERE company_id=$1 AND request_id=$2',[company,p.intent.request_id])).rows[0];
      if(old.actor_id!==actor||old.bank_account_id!==p.intent.bank_account_id||hash(old.intent)!==hash(p.intent.rows)||old.review_token!==p.review_token)
        fail(409,'BANK_IMPORT_REVIEW_STALE');
    }
    return p;
  });
}
export async function importStatement(company:string,actor:string,body:unknown) {
  const b=normaliseBankImport(body),expected=(body as any).review_token;
  return transact(async q=>{
    await scope(q,company,actor,true,true);
    const old=(await q.query('SELECT ledgerly_find_bank_import($1,$2,$3) receipt',[company,actor,b.request_id])).rows[0].receipt;
    if(old) {
      // Existing protected command compares the complete canonical intent.
      return (await q.query('SELECT ledgerly_record_reviewed_bank_import($1,$2,$3,$4,$5::jsonb,$6) receipt',
        [company,actor,b.bank_account_id,b.request_id,JSON.stringify(b.rows),expected])).rows[0].receipt;
    }
    const p=await importPlan(q,company,actor,body);
    if(!p.can_import)fail(409,'BANK_IMPORT_DUPLICATE');
    if(typeof expected!=='string')fail(428,'BANK_IMPORT_REVIEW_REQUIRED');
    if(p.review_token!==expected)fail(409,'BANK_IMPORT_REVIEW_STALE');
    return (await q.query('SELECT ledgerly_record_reviewed_bank_import($1,$2,$3,$4,$5::jsonb,$6) receipt',
      [company,actor,b.bank_account_id,b.request_id,JSON.stringify(b.rows),expected])).rows[0].receipt;
  });
}
function matchIntent(body:unknown) {
  const b=exactFields(body,['request_id','bank_transaction_id','payment_id','amount_minor','review_token']);
  if(typeof b.amount_minor!=='string'||!/^[1-9]\d{0,11}$/.test(b.amount_minor))fail(422,'POSITIVE_PENCE_REQUIRED');
  return {request_id:uuid(b.request_id),bank_transaction_id:uuid(b.bank_transaction_id),payment_id:uuid(b.payment_id),amount_minor:b.amount_minor as string};
}
async function matchPlan(q:Queryable,company:string,actor:string,b:ReturnType<typeof matchIntent>) {
  await scope(q,company,actor,true,true);
  const statement=(await statementRows(q,company)).find(r=>r.id===b.bank_transaction_id);
  if(!statement)fail(404,'RESOURCE_NOT_FOUND');
  if(!statement.native)fail(422,'BANK_LEGACY_MATCH_UNSUPPORTED');
  const bank=(await q.query("SELECT * FROM bank_accounts WHERE company_id=$1 AND id=$2 FOR UPDATE",[company,statement.bank_account_id])).rows[0];
  if(!bank||bank.currency!=='GBP'||bank.status!=='active')fail(422,'BANK_ACCOUNT_UNAVAILABLE');
  const payment=(await nativePayments(q,company)).find(p=>p.id===b.payment_id);
  if(!payment)fail(404,'RESOURCE_NOT_FOUND');
  if(payment.reversed)fail(409,'BANK_REVERSED_PAYMENT_UNSUPPORTED');
  const config=(await q.query('SELECT * FROM accounting_payment_configuration WHERE company_id=$1 FOR UPDATE',[company])).rows[0];
  const bankLedger=await bankLedgerFor(q,company,bank.id,config?.mappings?.bank??null);
  const assigned=(await q.query(`SELECT 1 FROM accounting_bank_matches WHERE company_id=$1
    AND evidence->>'bankLedger'=$2 AND evidence->'bank'->>'id'<>$3
    UNION ALL SELECT 1 FROM accounting_bank_openings WHERE company_id=$1 AND bank_ledger_account_id=$2::uuid AND bank_account_id<>$3::uuid`,
    [company,bankLedger,bank.id])).rowCount;
  if(assigned)fail(422,'BANK_LEDGER_ALREADY_ASSIGNED');
  if(payment.bank_ledger_account_id!==bankLedger)fail(422,'BANK_PAYMENT_ACCOUNT_MISMATCH');
  if(statement.direction!==payment.direction)fail(422,'BANK_PAYMENT_DIRECTION_MISMATCH');
  const n=BigInt(b.amount_minor);
  if(n>BigInt(statement.remaining_minor)||n>BigInt(payment.remaining_minor))fail(409,'BANK_MATCH_EXCEEDS_REMAINING');
  const evidence={intent:b,statement,payment_source_hash:hash(payment.source),payment:publicPayment(payment),
    bank:{id:bank.id,currency:bank.currency,status:bank.status},bankLedger,configuration_revision:config?.revision??null};
  return {intent:b,review_token:hash(evidence),statement,payment:publicPayment(payment),evidence,
    statement_remaining_minor:(BigInt(statement.remaining_minor)-n).toString(),payment_remaining_minor:(BigInt(payment.remaining_minor)-n).toString()};
}
export async function reviewBankMatch(company:string,actor:string,body:unknown) {
  return transact(q=>matchPlan(q,company,actor,matchIntent(body)));
}
export async function recoverBankMatch(company:string,actor:string,request:string) {
  uuid(request);return transact(async q=>{
    await scope(q,company,actor);
    const r=(await matches(q,company)).find(r=>r.request_id===request);
    return r?matchReceipt(r):{status:'unknown',request_id:request};
  },true);
}
export async function confirmBankMatch(company:string,actor:string,body:unknown,testHook?:(q:Queryable)=>Promise<void>) {
  const b=matchIntent(body),expected=(body as any).review_token;
  return transact(async q=>{
    await scope(q,company,actor,true,true);
    const prior=(await matches(q,company)).find(r=>r.request_id===b.request_id);
    if(prior){if(hash(prior.intent)!==hash(b))fail(409,'BANK_MATCH_REQUEST_CONFLICT');return matchReceipt(prior);}
    const p=await matchPlan(q,company,actor,b);
    if(typeof expected!=='string')fail(428,'BANK_MATCH_REVIEW_REQUIRED');
    if(p.review_token!==expected)fail(409,'BANK_MATCH_REVIEW_STALE');
    const r=(await q.query(`INSERT INTO accounting_bank_matches
      (company_id,request_id,bank_transaction_id,payment_id,amount_minor,journal_id,intent,evidence,evidence_hash,actor_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [company,b.request_id,b.bank_transaction_id,b.payment_id,b.amount_minor,p.payment.journal_id,JSON.stringify(b),JSON.stringify(p.evidence),p.review_token,actor])).rows[0];
    await testHook?.(q);
    return matchReceipt(r);
  });
}
