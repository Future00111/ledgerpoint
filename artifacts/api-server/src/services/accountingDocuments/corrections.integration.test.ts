import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import pg from 'pg';
import { pool } from '@workspace/db';
import { createAccountingRouter } from '../../routes/accountingDocuments';
import { correctionContext, reviewCorrection, commitCorrection, correctionHistory } from './corrections';
import { queryAdapter } from './core';
import { previewPayment, postPayment } from './payments';
import { createClaims, cancelClaim } from '../creditTracking/service';

const socket = process.env.ACCOUNTING_FLOW_TEST_SOCKET ?? '';
if (!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]+\/socket$/.test(socket)) throw Error('Disposable socket required');
const admin = new pg.Pool({ host: socket, port: 55441, user: 'w03_bootstrap', database: 'ledgerly_accounting_flow_test',
  password: () => '', ssl: false, options: '-c timezone=UTC' });
const actor = 'synthetic-correction-owner', reader = 'synthetic-correction-reader';
let server: ReturnType<ReturnType<typeof express>['listen']>, base: string;
before(async () => {
  assert.deepEqual((await pool.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0],
    { db: 'ledgerly_accounting_flow_test', role: 'ledgerly_api', addr: null });
  const app = express(); app.use(express.json());
  app.use('/companies/:companyId', createAccountingRouter((req, res, next) => {
    const user = req.get('x-test-actor'); if (!user) { res.sendStatus(401); return; }
    (req as any).userId = user; next();
  }));
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end(); await admin.end();
});
async function request(company: string, path: string, method = 'GET', body?: unknown, revision?: string, user: string | null = actor) {
  const response = await fetch(`${base}/companies/${company}${path}`, { method, headers: {
    ...(user ? { 'x-test-actor': user } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(revision ? { 'If-Match': `"${revision}"` } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const raw = await response.text();
  return { status: response.status, ...(raw && raw.startsWith('{') ? JSON.parse(raw) : {}) } as any;
}
async function fixture(vat = true) {
  const company = randomUUID(), customer = randomUUID(), supplier = randomUUID();
  await admin.query(`INSERT INTO companies(id,name,country,base_currency,vat_registered,vat_scheme,vat_accounting_basis,status)
    VALUES($1,'Synthetic correction','GB','GBP',$2,'standard','invoice','active')`, [company, vat]);
  for (const [user, role] of [[actor, 'owner'], [reader, 'read_only']]) await admin.query(
    'INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,$4,true)', [randomUUID(), company, user, role]);
  await admin.query("INSERT INTO customers(id,company_id,name,status) VALUES($1,$2,'Synthetic VAT customer','active')", [customer, company]);
  await admin.query("INSERT INTO suppliers(id,company_id,name,status) VALUES($1,$2,'Synthetic VAT supplier','active')", [supplier, company]);
  const mappings: Record<string, string> = {};
  for (const [role, type] of [['receivables', 'asset'], ['payables', 'liability'], ['revenue', 'income'], ['expense', 'expense'], ['output_vat', 'liability'], ['input_vat', 'asset']]) {
    const id = randomUUID(); mappings[role!] = id;
    await admin.query('INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,$3,$3,$4,true)', [id, company, role, type]);
  }
  assert.equal((await request(company, '/accounting-configuration', 'PUT', { revision: null, mappings, business_accounting_basis: 'accrual' })).status, 200);
  assert.equal((await request(company, '/accounting-periods', 'POST', { start_date: '2026-01-01', end_date: '2026-12-31', financial_year_label: 'Synthetic 2026' })).status, 201);
  for (const [code, rate, treatment] of [['STANDARD', '20', 'standard'], ['REDUCED', '5', 'reduced'], ['ZERO', '0', 'zero'],
    ['EXEMPT', '0', 'exempt'], ['OUTSIDE', '0', 'outside_scope'], ['NO_VAT', '0', 'no_vat']]) await admin.query(
    `INSERT INTO vat_tax_rules(id,company_id,code,label,rate,treatment,effective_from,is_active)
      VALUES($1,$2,$3,$3,$4,$5,'2026-01-01',true)`, [randomUUID(), company, code, rate, treatment]);
  const paymentMappings: Record<string,string> = {};
  for (const [role,type] of [['bank','asset'],['customer_credit','liability'],['supplier_prepayment','asset']]) {
    const id=randomUUID();paymentMappings[role!]=id;
    await admin.query('INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,$3,$3,$4,true)',[id,company,role,type]);
  }
  assert.equal((await request(company,'/accounting-payments/configuration','PUT',{revision:null,mappings:paymentMappings})).status,200);
  return { company, customer, supplier, mappings };
}
function source(party: string, basis = 'excluding_vat', codes = ['STANDARD', 'REDUCED', 'ZERO', 'EXEMPT', 'OUTSIDE']) {
  return { contract: 'w03.draft.v1', currency: 'GBP', price_basis: basis, customer_id: party, invoice_number: `SYN-VAT-${randomUUID()}`,
    issue_date: '2026-10-10', due_date: '2026-10-10', payment_terms: 0, reference: '', notes: 'Synthetic correction fixture',
    line_items: codes.map(tax_code => ({ description: tax_code, quantity: '1', unit_price: '100', tax_code })) };
}
async function postNew(f: any, kind: string, value: any, extra: any = {}) {
  const saved = await request(f.company, '/accounting-documents', 'POST', { kind, source: value,
    purchase_vat_eligible: kind === 'purchase_bill', ...extra });
  assert.equal(saved.status, 201, JSON.stringify(saved));
  const posted = await request(f.company, `/accounting-documents/${saved.data.id}/post`, 'POST', {}, saved.data.revision);
  assert.equal(posted.status, 200, JSON.stringify(posted)); return saved.data;
}

function intent(doc:any,price='90',date='2026-10-22') {
  return {request_id:randomUUID(),reason:'Correct the agreed price',effective_date:date,
    line_items:doc.source.line_items.map((line:any)=>({quantity:line.quantity,unit_price:price}))};
}
async function review(f:any,doc:any,value=intent(doc)) {return reviewCorrection(f.company,actor,doc.id,doc.revision,value);}
async function commit(f:any,doc:any,r:any,hook?:any) {return commitCorrection(f.company,actor,doc.id,doc.revision,{...r.intent,review_token:r.review_token},hook);}
async function pay(f:any,doc:any,amount='5000',date='2026-10-15') {
  const body={id:randomUUID(),kind:'payment',party_type:doc.kind==='sales_invoice'?'customer':'supplier',party_id:doc.party_id,
    payment_id:null,date,reference:'Synthetic part payment',amount_minor:amount,allocations:[{document_id:doc.id,amount_minor:amount}]};
  const r=await request(f.company,'/accounting-payments/review','POST',body);assert.equal(r.status,200,JSON.stringify(r));
  const p=await request(f.company,'/accounting-payments','POST',{...body,review_token:r.data.review_token});assert.equal(p.status,200,JSON.stringify(p));return p;
}
async function rejected(fn:()=>Promise<unknown>,code:string) {await assert.rejects(fn,(e:any)=>e.code===code);}
async function current(f:any,doc:any) {const r=await request(f.company,`/accounting-documents/${doc.id}`);assert.equal(r.status,200,JSON.stringify(r));return r.data;}
async function report(f:any,to='2026-10-31',from='2026-10-01') {const r=await request(f.company,`/accounting-reports?from=${from}&to=${to}`);assert.equal(r.status,200,JSON.stringify(r));return r.data;}
async function counts(f:any) {return (await admin.query(`SELECT
  (SELECT count(*) FROM accounting_document_amendments WHERE company_id=$1)::int amendments,
  (SELECT count(*) FROM canonical_journal_entries WHERE company_id=$1)::int journals,
  (SELECT count(*) FROM accounting_posting_effects WHERE company_id=$1)::int effects,
  (SELECT count(*) FROM accounting_document_audit WHERE company_id=$1)::int document_audit,
  (SELECT count(*) FROM accounting_audit_events WHERE company_id=$1)::int canonical_audit`,[f.company])).rows[0];}

test('correction HTTP routes require authentication, company scope, capability and revision before posting an exact reviewed command',async()=>{
  const f=await fixture(),foreign=await fixture(),doc=await postNew(f,'sales_invoice',source(f.customer,'excluding_vat',['STANDARD']));
  const path=`/accounting-documents/${doc.id}`,body=intent(doc),before=await counts(f);
  assert.equal((await request(f.company,`${path}/correction-context`,'GET',undefined,undefined,null)).status,401);
  assert.equal((await request(foreign.company,`${path}/correction-context`)).status,404);
  const context=await request(f.company,`${path}/correction-context`);assert.equal(context.status,200);assert.equal(context.data.document.id,doc.id);
  assert.equal((await request(f.company,`${path}/corrections/review`,'POST',body)).status,428);
  assert.equal((await request(f.company,`${path}/corrections/review`,'POST',body,doc.revision,reader)).status,403);
  const r=await request(f.company,`${path}/corrections/review`,'POST',body,doc.revision);assert.equal(r.status,200,JSON.stringify(r));
  assert.deepEqual(await counts(f),before);
  const command={...r.data.intent,review_token:r.data.review_token};
  assert.equal((await request(f.company,`${path}/corrections`,'POST',command)).status,428);
  assert.equal((await request(f.company,`${path}/corrections`,'POST',command,doc.revision,reader)).status,403);
  const posted=await request(f.company,`${path}/corrections`,'POST',command,doc.revision);assert.equal(posted.status,200,JSON.stringify(posted));assert.equal(posted.data.status,'posted');
  const retry=await request(f.company,`${path}/corrections`,'POST',command,doc.revision);assert.equal(retry.status,200);assert.equal(retry.data.status,'duplicate');
  const history=await request(f.company,`${path}/corrections`);assert.equal(history.status,200);assert.equal(history.data.amendments.length,1);assert.equal(history.data.amendments[0].journal_id,posted.data.journal_id);
});

test('posted invoice correction keeps original facts and partial cash immutable while every current/historical projection agrees',async()=>{
  const f=await fixture(),doc=await postNew(f,'sales_invoice',source(f.customer,'excluding_vat',['STANDARD']));
  const immutable=(await admin.query('SELECT source,money,revision,journal_id FROM accounting_document_sources WHERE id=$1',[doc.id])).rows[0];
  const journal=(await admin.query('SELECT * FROM canonical_journal_entries WHERE id=$1',[immutable.journal_id])).rows[0];
  await pay(f,doc);const before=await report(f);
  const r=await review(f,doc);assert.equal(r.after.money.gross_pence,'10800');assert.equal(r.settlement.after_open_minor,'5800');
  const result=await commit(f,doc,r);assert.equal(result.id,r.intent.request_id);assert.equal(result.status,'posted');
  assert.deepEqual((await admin.query('SELECT source,money,revision,journal_id FROM accounting_document_sources WHERE id=$1',[doc.id])).rows[0],immutable);
  assert.deepEqual((await admin.query('SELECT * FROM canonical_journal_entries WHERE id=$1',[immutable.journal_id])).rows[0],journal);
  const now=await current(f,doc);assert.equal(now.money.gross_pence,'10800');assert.equal(now.original_money.gross_pence,'12000');assert.equal(now.correction_count,1);assert.equal(now.revision,result.revision);
  const today=await report(f);assert.equal(today.open_items[0].open_minor,'5800');assert.equal(today.cash.balance_minor,before.cash.balance_minor);assert.equal(today.vat.box1_pence,'1800');assert.equal(today.pnl.revenue_minor,'9000');assert.equal(today.balance_sheet.balanced,true);
  assert.equal(today.journal_movements.debit_minor,today.journal_movements.credit_minor);
  const movement=today.posted_documents.find((m:any)=>m.movement_kind==='financial_correction');assert.equal(movement.gross_minor,'-1200');assert.equal(movement.id,doc.id);assert.equal(movement.movement_id,result.journal_id);
  const trace=today.general_ledger.find((l:any)=>l.journal_id===result.journal_id);assert.equal(trace.source_type,'canonical_journal');assert.equal(trace.source_id,immutable.journal_id);assert.equal(trace.document_id,doc.id);
  const earlier=await report(f,'2026-10-20');assert.equal(earlier.open_items[0].open_minor,'7000');assert.equal(earlier.vat.box1_pence,'2000');assert.equal(earlier.posted_documents.length,1);
  const period=await report(f,'2026-10-31','2026-10-22');assert.equal(period.vat.box1_pence,'-200');assert.equal(period.vat.box6_pence,'-1000');assert.equal(period.vat_coverage.movement_count,1);
  const retry=await commit(f,doc,r);assert.equal(retry.status,'duplicate');assert.equal(retry.journal_id,result.journal_id);
  const originalRetry=await request(f.company,`/accounting-documents/${doc.id}/post`,'POST',{},doc.revision);assert.equal(originalRetry.status,200,JSON.stringify(originalRetry));assert.equal(originalRetry.data.status,'duplicate');
  const second=await review(f,now,intent(now,'95','2026-10-25'));await commit(f,now,second);
  assert.equal((await current(f,doc)).money.gross_pence,'11400');assert.equal((await correctionHistory(f.company,actor,doc.id)).amendments.length,2);
  assert.equal((await commit(f,doc,r)).journal_id,result.journal_id);
  const audits=(await admin.query("SELECT action FROM accounting_document_audit WHERE company_id=$1 AND document_id=$2 AND action='correct'",[f.company,doc.id])).rows;assert.equal(audits.length,2);
  assert.equal((await admin.query("SELECT count(*)::int n FROM accounting_audit_events WHERE company_id=$1 AND action='correction'",[f.company])).rows[0].n,2);
  const compatibility=(await admin.query('SELECT total::text,amount_paid::text,balance_due::text,status FROM sales_invoices WHERE id=$1',[doc.id])).rows[0];assert.deepEqual(compatibility,{total:'114.00',amount_paid:'50.00',balance_due:'64.00',status:'part_paid'});
  const paymentBody={id:randomUUID(),kind:'payment',party_type:'customer',party_id:doc.party_id,payment_id:null,date:'2026-10-26',reference:'Cap check',amount_minor:'6500',allocations:[{document_id:doc.id,amount_minor:'6500'}]};
  const over=await request(f.company,'/accounting-payments/review','POST',paymentBody);assert.equal(over.status,409);assert.equal(over.error.code,'ALLOCATION_EXCEEDS_OPEN_AMOUNT');
  const back=await request(f.company,'/accounting-payments/review','POST',{...paymentBody,amount_minor:'100',allocations:[{document_id:doc.id,amount_minor:'100'}],date:'2026-10-24'});assert.equal(back.status,409);assert.equal(back.error.code,'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
  await pay(f,doc,'6400','2026-10-26');assert.equal((await report(f)).open_items[0].open_minor,'0');
});

test('inclusive/exclusive mixed-rate and discounted bills preserve native VAT precision and recoverability',async()=>{
  for(const basis of ['including_vat','excluding_vat']) for(const eligible of [true,false]) {
    const f=await fixture(),src={...source(f.supplier,basis,['STANDARD','REDUCED','ZERO']),discount:{type:'percentage',value:'10'}};
    const doc=await postNew(f,'purchase_bill',src,{purchase_vat_eligible:eligible}),r=await review(f,doc,intent(doc,'75.1234'));
    const result=await commit(f,doc,r),now=await current(f,doc),data=await report(f);
    assert.deepEqual(now.money,r.after.money);assert.equal(data.open_items[0].gross_minor,now.money.gross_pence);assert.equal(data.balance_sheet.balanced,true);
    assert.equal(data.vat.box4_pence,eligible?now.money.vat_pence:'0');assert.equal(data.vat.box7_pence,now.money.net_pence);
    const legs=data.general_ledger.filter((l:any)=>l.journal_id===result.journal_id);assert.equal(legs.reduce((n:bigint,l:any)=>n+BigInt(l.debit_minor)-BigInt(l.credit_minor),0n),0n);
    if(!eligible) assert.ok(legs.every((l:any)=>l.account_id!==f.mappings.input_vat));
  }
});

test('review authority, stale payments, settlement limits, replay identity and concurrent head changes fail safely',async()=>{
  const f=await fixture(),doc=await postNew(f,'sales_invoice',source(f.customer,'excluding_vat',['STANDARD']));
  await rejected(()=>reviewCorrection(f.company,reader,doc.id,doc.revision,intent(doc)),'CAPABILITY_DENIED');
  await rejected(()=>reviewCorrection(f.company,'foreign',doc.id,doc.revision,intent(doc)),'RESOURCE_NOT_FOUND');
  const administrator='admin-'+randomUUID();await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'admin',true)",[randomUUID(),f.company,administrator]);
  await rejected(()=>reviewCorrection(f.company,administrator,doc.id,doc.revision,intent(doc)),'CAPABILITY_DENIED');
  const r=await review(f,doc);await pay(f,doc,'5000');await rejected(()=>commit(f,doc,r),'CORRECTION_REVIEW_STALE');
  await rejected(()=>review(f,doc,intent(doc,'10')),'CORRECTION_BELOW_PAID');
  await rejected(()=>review(f,doc,intent(doc,'100')),'CORRECTION_ZERO_CHANGE_UNSUPPORTED');
  await rejected(()=>review(f,doc,intent(doc,'90','2026-10-11')),'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
  const one=await review(f,doc),two=await review(f,doc,intent(doc,'95'));
  const outcomes=await Promise.allSettled([commit(f,doc,one),commit(f,doc,two)]);assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);assert.equal((await counts(f)).amendments,1);
  const winner=outcomes[0].status==='fulfilled'?one:two;await rejected(()=>commit(f,doc,{...winner,intent:{...winner.intent,reason:'Different'}}),'IDEMPOTENCY_CONFLICT');
  await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2',[f.company,actor]);await rejected(()=>commit(f,doc,winner),'RESOURCE_NOT_FOUND');
});

test('atomic failure after journal, relation, amendment, head, projection and document audit leaves no partial correction',async()=>{
  const f=await fixture(),doc=await postNew(f,'purchase_bill',source(f.supplier,'including_vat',['STANDARD'])),r=await review(f,doc);
  const before=await counts(f),projection=(await admin.query('SELECT total::text,balance_due::text FROM purchase_bills WHERE id=$1',[doc.id])).rows[0];
  await assert.rejects(()=>commit(f,doc,r,async(tx:any)=>{await queryAdapter(tx).query('SELECT 1/0');}));
  assert.deepEqual(await counts(f),before);assert.equal((await correctionHistory(f.company,actor,doc.id)).amendments.length,0);
  assert.deepEqual((await admin.query('SELECT total::text,balance_due::text FROM purchase_bills WHERE id=$1',[doc.id])).rows[0],projection);
  assert.equal((await commit(f,doc,r)).status,'posted');
});

test('dependent credits are blocked before and after correction; new account legs cannot enter through zero VAT origins',async()=>{
  const f=await fixture(),doc=await postNew(f,'sales_invoice',source(f.customer,'excluding_vat',['STANDARD']));
  const body={kind:'sales_credit_note',source:{...doc.source,invoice_number:'C-'+randomUUID(),line_items:[{...doc.source.line_items[0],quantity:'0.1'}]},original_id:doc.id,reason:'Return',adjustment_method:'offset_outstanding',effective_adjustment_date:doc.source.issue_date,original_line_refs:[0]};
  const credit=await request(f.company,'/accounting-documents','POST',body);assert.equal(credit.status,201,JSON.stringify(credit));await rejected(()=>review(f,doc),'CORRECTION_CHILD_CREDITS');
  const other=await postNew(f,'sales_invoice',source(f.customer,'excluding_vat',['STANDARD']));await commit(f,other,await review(f,other));
  const future=await request(f.company,'/accounting-documents','POST',{...body,original_id:other.id,source:{...body.source,invoice_number:'C-'+randomUUID()}});assert.equal(future.status,409);assert.equal(future.error.code,'CORRECTED_DOCUMENT_DEPENDENCY_UNSUPPORTED');
  const tiny=await postNew(f,'sales_invoice',{...source(f.customer,'excluding_vat',['STANDARD']),line_items:[{description:'Tiny',quantity:'1',unit_price:'0.01',tax_code:'STANDARD'}]});
  await rejected(()=>review(f,tiny,intent(tiny,'1')),'CORRECTION_NEW_ACCOUNT_LEG_UNSUPPORTED');
});

test('active claims block correction, cancelled claims persist, and corrected bills reject new tracking',async()=>{
  const f=await fixture(),doc=await postNew(f,'purchase_bill',source(f.supplier,'including_vat',['STANDARD']));
  const body={request_id:randomUUID(),bill_id:doc.id,bill_revision:doc.revision,reason:'Returned part',return_reference:'RN-1',returned_on:'2026-10-11',expected_by:'2026-10-20',lines:[{original_line_ref:0,quantity:'0.5',part_reference:'PART',job_reference:'JOB'}]};
  const claim=await createClaims(f.company,actor,body);await rejected(()=>review(f,doc),'CORRECTION_ACTIVE_CLAIMS');
  const saved=(await admin.query('SELECT * FROM supplier_credit_claims WHERE id=$1',[claim.ids[0]])).rows[0];
  await cancelClaim(f.company,actor,saved.id,saved.revision,{request_id:randomUUID()});
  await commit(f,doc,await review(f,doc));await rejected(()=>createClaims(f.company,actor,{...body,request_id:randomUUID()}),'CORRECTED_DOCUMENT_DEPENDENCY_UNSUPPORTED');
  assert.equal((await admin.query('SELECT cancelled FROM supplier_credit_claims WHERE id=$1',[saved.id])).rows[0].cancelled,true);
});

test('SQL boundaries enforce runtime grants, owner immutable triggers, strict head succession and tenant FKs',async()=>{
  const f=await fixture(),doc=await postNew(f,'sales_invoice',source(f.customer,'excluding_vat',['STANDARD']));await commit(f,doc,await review(f,doc));
  const first=await current(f,doc);await commit(f,first,await review(f,first,intent(first,'95','2026-10-25')));
  for(const client of [pool,admin]) {
    for(const sql of ["UPDATE accounting_document_amendments SET reason='changed' WHERE company_id=$1",'DELETE FROM accounting_document_amendments WHERE company_id=$1']) await assert.rejects(()=>client.query(sql,[f.company]),(e:any)=>client===pool?e.code==='42501':e.code==='P0001');
    await assert.rejects(()=>client.query('TRUNCATE accounting_document_amendments CASCADE'),(e:any)=>client===pool?e.code==='42501':e.code==='P0001');
    for(const sql of ['UPDATE accounting_document_amendment_heads SET sequence=sequence+2 WHERE company_id=$1','UPDATE accounting_document_amendment_heads SET current_revision=$2,sequence=1 WHERE company_id=$1','UPDATE accounting_document_amendment_heads SET document_id=$2 WHERE company_id=$1']) await assert.rejects(()=>client.query(sql,sql.includes('$2')?[f.company,first.revision]:[f.company]));
  }
  const row=(await admin.query('SELECT * FROM accounting_document_amendments WHERE company_id=$1 ORDER BY sequence',[f.company])).rows[0];
  const another=await fixture(),foreignOne=await postNew(another,'sales_invoice',source(another.customer,'excluding_vat',['STANDARD'])),foreignTwo=await postNew(another,'sales_invoice',source(another.customer,'excluding_vat',['STANDARD']));
  const foreignJournals=(await admin.query('SELECT id,journal_id FROM accounting_document_sources WHERE id=ANY($1::uuid[])',[[foreignOne.id,foreignTwo.id]])).rows;
  await assert.rejects(()=>pool.query(`INSERT INTO accounting_document_amendments SELECT $1::uuid,$2::uuid,document_id,sequence,previous_revision,revision,$3::uuid,request_hash,review_token,actor_id,reason,effective_date,$5::uuid,$6::uuid,financial_context_hash,before_source,after_source,before_money,after_money,delta_money,after_tax_context,created_at FROM accounting_document_amendments WHERE id=$4`,[randomUUID(),another.company,randomUUID(),row.id,foreignJournals[0].journal_id,foreignJournals[1].journal_id]),(e:any)=>e.code==='23503');
  assert.equal((await current(f,doc)).correction_count,2);
});

test('an inserted amendment without its head or relation fails closed even for an earlier report cutoff',async()=>{
  const fixtureSource=await fixture(),valid=await postNew(fixtureSource,'sales_invoice',source(fixtureSource.customer,'excluding_vat',['STANDARD']));await commit(fixtureSource,valid,await review(fixtureSource,valid));
  const template=(await admin.query('SELECT id FROM accounting_document_amendments WHERE company_id=$1',[fixtureSource.company])).rows[0];
  const f=await fixture(),original=await postNew(f,'sales_invoice',source(f.customer,'excluding_vat',['STANDARD'])),unrelated=await postNew(f,'sales_invoice',source(f.customer,'excluding_vat',['STANDARD']));
  const journals=(await admin.query('SELECT id,journal_id FROM accounting_document_sources WHERE company_id=$1',[f.company])).rows;
  await pool.query(`INSERT INTO accounting_document_amendments SELECT $1::uuid,$2::uuid,$3::uuid,1,$4::uuid,$5::uuid,$6::uuid,request_hash,review_token,actor_id,reason,effective_date,$7::uuid,$8::uuid,financial_context_hash,before_source,after_source,before_money,after_money,delta_money,after_tax_context,created_at FROM accounting_document_amendments WHERE id=$9`,[randomUUID(),f.company,original.id,original.revision,randomUUID(),randomUUID(),journals.find(j=>j.id===original.id).journal_id,journals.find(j=>j.id===unrelated.id).journal_id,template.id]);
  await rejected(()=>correctionContext(f.company,actor,original.id),'CORRECTION_HISTORY_INVALID');
  const result=await request(f.company,'/accounting-reports?from=2026-10-01&to=2026-10-05');assert.equal(result.status,503);assert.equal(result.error.code,'CORRECTION_HISTORY_INVALID');
});

test('period closure and changed accounting authority invalidate an uncommitted review',async()=>{
  const f=await fixture(),doc=await postNew(f,'sales_invoice',source(f.customer,'excluding_vat',['STANDARD'])),r=await review(f,doc);
  await admin.query("UPDATE accounting_document_periods SET status='CLOSED' WHERE company_id=$1",[f.company]);
  await rejected(()=>commit(f,doc,r),'PERIOD_NOT_WRITABLE');
  await admin.query("UPDATE accounting_document_periods SET status='OPEN' WHERE company_id=$1",[f.company]);
  const configuration=(await request(f.company,'/accounting-configuration')).data;
  assert.equal((await request(f.company,'/accounting-configuration','PUT',{revision:configuration.revision,mappings:f.mappings,business_accounting_basis:'accrual'})).status,200);
  await rejected(()=>commit(f,doc,r),'CORRECTION_AUTHORITY_CHANGED');
  assert.equal((await counts(f)).amendments,0);
});

test('concurrent correction and payment cannot allocate more than the final corrected amount',async()=>{
  const f=await fixture(),doc=await postNew(f,'sales_invoice',source(f.customer,'excluding_vat',['STANDARD'])),r=await review(f,doc);
  const intent={id:randomUUID(),kind:'payment',party_type:'customer',party_id:doc.party_id,payment_id:null,date:'2026-10-22',reference:'Concurrent payment',amount_minor:'11500',allocations:[{document_id:doc.id,amount_minor:'11500'}]};
  const payment=await previewPayment(f.company,actor,intent);
  const outcomes=await Promise.allSettled([commit(f,doc,r),postPayment(f.company,actor,{...intent,review_token:payment.review_token})]);
  assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
  const data=await report(f),open=data.open_items[0];assert.ok(BigInt(open.paid_minor)<=BigInt(open.gross_minor));assert.equal(BigInt(open.open_minor),BigInt(open.gross_minor)-BigInt(open.paid_minor));assert.equal(data.balance_sheet.balanced,true);assert.equal(data.journal_movements.debit_minor,data.journal_movements.credit_minor);
  const state=await counts(f);assert.equal(state.journals,2);assert.equal(state.effects,2);assert.equal(state.amendments,outcomes[0].status==='fulfilled'?1:0);
});
