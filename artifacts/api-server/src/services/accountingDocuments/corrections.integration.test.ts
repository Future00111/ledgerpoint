import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import express from 'express';
import pg from 'pg';
import { pool } from '@workspace/db';
import { createAccountingRouter } from '../../routes/accountingDocuments';
import { correctionContext, reviewCorrection, commitCorrection, correctionHistory } from './corrections';
import { queryAdapter, scope, transact } from './core';
import { prepareReplacementCapacity } from './replacementCapacity';
import { previewPayment, postPayment } from './payments';
import { linkedCreditDocuments, documentOpen } from './settlement';
import { reviewPaidCredit, commitPaidCredit } from './paidCredit';
import { reconcileLifecycleReport } from './reportAcceptance.testSupport';
import { createClaims, cancelClaim, confirmReceipt, listClaims } from '../creditTracking/service';

const socket = process.env.ACCOUNTING_FLOW_TEST_SOCKET ?? '';
if (!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]+\/socket$/.test(socket)) throw Error('Disposable socket required');
const admin = new pg.Pool({ host: socket, port: 55441, user: 'w03_bootstrap', database: 'ledgerly_accounting_flow_test',
  password: () => '', ssl: false, options: '-c timezone=UTC' });
const actor = 'synthetic-correction-owner', reader = 'synthetic-correction-reader';
let server: ReturnType<ReturnType<typeof express>['listen']>, base: string;
let browserHtml = '';
before(async () => {
  assert.deepEqual((await pool.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0],
    { db: 'ledgerly_accounting_flow_test', role: 'ledgerly_api', addr: null });
  const app = express(); app.use(express.json());
  app.get('/synthetic-correction-browser', (_req,res) => res.type('html').send(browserHtml));
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

for (const kind of ['sales_invoice', 'purchase_bill']) test(`isolated Chromium ${kind}: cancel, stale/denied review, lost response reload and company isolation`, async () => {
  const f=await fixture(),foreign=await fixture();
  const doc=await postNew(f,kind,source(kind==='sales_invoice'?f.customer:f.supplier,'excluding_vat',['STANDARD']));
  const before=await counts(f),foreignBefore=await counts(foreign);
  const original=(await admin.query('SELECT source,money,revision,journal_id FROM accounting_document_sources WHERE id=$1',[doc.id])).rows[0];
  const dir=mkdtempSync(path.join(path.dirname(socket),'correction-browser-'));
  try {
    const frontend=path.join(process.cwd(),'artifacts/ledgerly/src'),bundle=path.join(dir,'bundle.js');
    execFileSync('pnpm',['--filter','@workspace/api-server','exec','esbuild',
      path.join(frontend,'features/documentCorrections/browserAcceptance.jsx'),'--bundle','--platform=browser','--format=iife',
      '--jsx=automatic','--alias:@='+frontend,'--outfile='+bundle],{stdio:'pipe'});
    browserHtml=`<!doctype html><html><head><meta charset="utf-8"><title>SYNTHETIC CORRECTION TEST — not Clerk acceptance</title></head><body><div id="root"></div><script>window.syntheticFixture=${JSON.stringify({company:f.company,documentId:doc.id,foreignCompany:foreign.company,actor,reader})};${readFileSync(bundle,'utf8').replaceAll('</script','<\\/script')}</script></body></html>`;
    const child=spawn('chromium',['--headless','--no-first-run','--disable-gpu','--disable-background-networking',
      '--disable-component-update','--disable-sync','--user-data-dir='+path.join(dir,'profile'),
      '--dump-dom','--virtual-time-budget=20000',base+'/synthetic-correction-browser'],{stdio:['ignore','pipe','pipe']});
    let html='',stderr='';
    child.stdout.on('data',b=>{html+=b.toString();});child.stderr.on('data',b=>{stderr+=b.toString();});
    const code=await new Promise<number>((resolve,reject)=>{
      const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Bounded correction browser timed out'));},45000);
      child.once('error',e=>{clearTimeout(timer);reject(e);});
      child.once('exit',n=>{clearTimeout(timer);resolve(n??1);});
    });
    writeFileSync(path.join(process.cwd(),`generated-artifacts/correction-browser-${kind}.log`),stderr+'\n'+html.slice(-10000));
    assert.equal(code,0);assert.match(html,/data-correction-acceptance="passed"/,html.slice(-2000));
    const now=await counts(f);
    assert.equal(now.amendments,before.amendments+1);assert.equal(now.journals,before.journals+1);
    assert.equal(now.effects,before.effects+1);
    assert.deepEqual(await counts(foreign),foreignBefore);
    assert.deepEqual((await admin.query('SELECT source,money,revision,journal_id FROM accounting_document_sources WHERE id=$1',[doc.id])).rows[0],original);
    assert.equal((await current(f,doc)).money.gross_pence,'10800');
    const r=await report(f);assert.equal(r.journal_movements.debit_minor,r.journal_movements.credit_minor);
    console.log('CORRECTION_BROWSER_ACCEPTANCE',JSON.stringify({kind,loopbackOnly:true,syntheticAuth:true,realNativeRoutes:true,
      cancel:true,staleInput:true,staleRevision:true,permissionDenied:true,lostResponse:true,fullReload:true,
      companySwitch:true,readOnlyRole:true,exactlyOneCorrection:true,originalUnchanged:true}));
  } finally {browserHtml='';rmSync(dir,{recursive:true,force:true});}
});

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

test('correction outcome recovers committed history read-only after reload; rollback stays unknown and permissions are current',async()=>{
  const f=await fixture(),doc=await postNew(f,'sales_invoice',source(f.customer,'excluding_vat',['STANDARD']));
  const r=await review(f,doc),path=`/accounting-documents/${doc.id}/corrections/operations/${r.intent.request_id}`;
  const before=await counts(f);
  assert.equal((await request(f.company,path)).data.state,'unknown');
  assert.deepEqual(await counts(f),before);
  const posted=await commit(f,doc,r); // Simulate losing this response at the client.
  const snapshot=await counts(f);
  const found=await request(f.company,path);assert.equal(found.status,200,JSON.stringify(found));
  assert.equal(found.data.state,'known');assert.equal(found.data.receipt.journal_id,posted.journal_id);
  assert.equal(found.data.receipt.id,r.intent.request_id);
  assert.equal((await request(f.company,path)).data.receipt.journal_id,posted.journal_id);
  assert.deepEqual(await counts(f),snapshot);
  assert.equal((await request(f.company,path,'GET',undefined,undefined,null)).status,401);
  assert.equal((await request(f.company,path,'GET',undefined,undefined,reader)).status,403);
  const foreign=await fixture();assert.equal((await request(foreign.company,path)).status,404);
  const later=await current(f,doc),second=await review(f,later,intent(later,'95','2026-10-25'));
  const unknown=`/accounting-documents/${doc.id}/corrections/operations/${second.intent.request_id}`;
  await assert.rejects(()=>commit(f,later,second,async()=>{throw Error('recovery rollback');}),/recovery rollback/);
  assert.equal((await request(f.company,unknown)).data.state,'unknown');assert.deepEqual(await counts(f),snapshot);
  await commit(f,later,second);
  assert.equal((await request(f.company,path)).data.receipt.revision,posted.revision);
  await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2',[f.company,actor]);
  assert.equal((await request(f.company,path)).status,404);
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

test('existing credits still block later correction and credits cannot predate a correction; no new zero VAT account legs',async()=>{
  const f=await fixture(),doc=await postNew(f,'sales_invoice',source(f.customer,'excluding_vat',['STANDARD']));
  const body={kind:'sales_credit_note',source:{...doc.source,invoice_number:'C-'+randomUUID(),line_items:[{...doc.source.line_items[0],quantity:'0.1'}]},original_id:doc.id,reason:'Return',adjustment_method:'offset_outstanding',effective_adjustment_date:doc.source.issue_date,original_line_refs:[0]};
  const credit=await request(f.company,'/accounting-documents','POST',body);assert.equal(credit.status,201,JSON.stringify(credit));await rejected(()=>review(f,doc),'CORRECTION_CHILD_CREDITS');
  const other=await postNew(f,'sales_invoice',source(f.customer,'excluding_vat',['STANDARD']));await commit(f,other,await review(f,other));
  const future=await request(f.company,'/accounting-documents','POST',{...body,original_id:other.id,source:{...body.source,invoice_number:'C-'+randomUUID()}});assert.equal(future.status,409);assert.equal(future.error.code,'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
  const tiny=await postNew(f,'sales_invoice',{...source(f.customer,'excluding_vat',['STANDARD']),line_items:[{description:'Tiny',quantity:'1',unit_price:'0.01',tax_code:'STANDARD'}]});
  await rejected(()=>review(f,tiny,intent(tiny,'1')),'CORRECTION_NEW_ACCOUNT_LEG_UNSUPPORTED');
});

async function correctedCredit(f:any,doc:any,price:string,ref=0,date='2026-10-24') {
  const now=await current(f,doc);
  const saved=await request(f.company,'/accounting-documents','POST',{
    kind:doc.kind==='sales_invoice'?'sales_credit_note':'supplier_credit_note',
    source:{...now.source,invoice_number:'CAP-'+randomUUID(),issue_date:date,due_date:date,
      line_items:[{...now.source.line_items[ref],quantity:'1',unit_price:price}]},
    original_id:doc.id,reason:'Agreed price decrease offset against liability',
    adjustment_method:'offset_outstanding',effective_adjustment_date:date,original_line_refs:[ref]});
  assert.equal(saved.status,201,JSON.stringify(saved));
  assert.equal(saved.data.tax_context.original_revision,now.revision);
  const reopened=await request(f.company,`/accounting-documents/${saved.data.id}`);
  assert.equal(reopened.status,200);assert.deepEqual(reopened.data.money,saved.data.money);
  return saved.data;
}
async function creditReview(f:any,c:any) {
  const b={request_id:randomUUID(),reason:'Reviewed corrected original capacity'};
  const r=await request(f.company,`/accounting-documents/${c.id}/paid-credit/review`,'POST',b,c.revision);
  assert.equal(r.status,200,JSON.stringify(r));
  return {...b,review_token:r.data.review_token,releases:r.data.releases};
}
for(const kind of ['sales_invoice','purchase_bill']) {
  test(`Job11 ${kind}: correction preserves posted credit and updates outstanding with per-line caps`,async()=>{
    const f=await fixture(),party=kind==='sales_invoice'?f.customer:f.supplier;
    const doc=await postNew(f,kind,source(party,'including_vat',['STANDARD']));
    // £100 inclusive original; £24 inclusive credit; corrected face value £90.
    const c=await correctedCredit(f,doc,'24',0,'2026-10-20'),body=await creditReview(f,c);
    await commitPaidCredit(f.company,actor,c.id,c.revision,body);
    const saved=(await admin.query('SELECT * FROM accounting_document_sources WHERE company_id=$1 AND id=$2',[f.company,c.id])).rows;
    const r=await review(f,doc,intent(doc,'90','2026-10-22'));
    assert.equal(r.settlement.credited_minor,'2400');
    assert.equal(r.settlement.before_open_minor,'7600');assert.equal(r.settlement.after_open_minor,'6600');
    const baseline=await counts(f);
    await assert.rejects(()=>commit(f,doc,r,()=>{throw Error('credit correction rollback');}),/credit correction rollback/);
    assert.deepEqual(await counts(f),baseline);
    await commit(f,doc,r);
    const terms={version:1 as const,party_type:kind==='sales_invoice'?'customer' as const:'supplier' as const,
      party_id:party,currency:'GBP' as const,agreement_id:randomUUID(),agreement_date:'2026-10-22',
      payment_deadline:'2026-10-30',discount_gross_pence:'600'};
    const capacity=()=>transact(async q=>{await scope(q,f.company,actor,true,true);return prepareReplacementCapacity(q,f.company,doc.id,terms);});
    const frozen=await capacity();
    assert.equal(frozen.money.gross_pence,'6600');
    assert.equal(frozen.snapshot.credits.length,1);
    assert.equal(frozen.snapshot.credits[0].id,c.id);
    assert.equal(frozen.snapshot.journal_origins.length,3);
    assert.equal(new Set(frozen.snapshot.journal_origins.map((o:any)=>o.cluster_id)).size,1);
    await assert.rejects(()=>pool.query('SELECT public.conditional_capacity_origins($1,$2::uuid[])',
      [randomUUID(),frozen.snapshot.journal_origins.map((o:any)=>o.journal_id)]),/origin unavailable/);
    await assert.rejects(()=>pool.query('SELECT public.conditional_capacity_origins($1,$2::uuid[])',
      [f.company,[doc.journal_id,doc.journal_id]]),/identity invalid/);
    assert.equal(frozen.vector.reduce((n:bigint,line:any)=>n+BigInt(line.gross_pence),0n),600n);
    assert.equal((await capacity()).snapshot_hash,frozen.snapshot_hash);
    await rejected(()=>transact(async q=>{await scope(q,f.company,actor,true,true);
      return prepareReplacementCapacity(q,f.company,doc.id,{...terms,agreement_date:'2026-10-21'});}),
      'CONDITIONAL_REPLACEMENT_PRECEDES_ACTIVITY');
    await rejected(()=>prepareReplacementCapacity(pool,randomUUID(),doc.id,terms),'RESOURCE_NOT_FOUND');
    assert.deepEqual((await admin.query('SELECT * FROM accounting_document_sources WHERE company_id=$1 AND id=$2',[f.company,c.id])).rows,saved);
    assert.equal((await report(f,'2026-10-21')).open_items.find((d:any)=>d.id===doc.id).open_minor,'7600');
    assert.equal((await report(f)).open_items.find((d:any)=>d.id===doc.id).open_minor,'6600');
    await rejected(()=>review(f,doc,intent(doc,'90','2026-10-22')),'REVISION_CONFLICT');
    const now=await current(f,doc);
    await rejected(()=>review(f,now,intent(now,'20','2026-10-23')),'CORRECTION_BELOW_CREDIT_CAPACITY');
    await pay(f,now,'5000','2026-10-23');
    await rejected(()=>review(f,now,intent(now,'70','2026-10-24')),'CORRECTION_BELOW_PAID');
    const valid=await review(f,now,intent(now,'80','2026-10-24'));
    assert.equal(valid.settlement.after_open_minor,'600');
    await assert.rejects(()=>commit(f,now,valid,async(tx:any)=>{
      const q=queryAdapter(tx);
      // This hook is before the canonical audit, so full history validation
      // correctly rejects first. Probe the DB-origin guard directly here.
      // Releasing a savepoint does not commit the enclosing transaction.
      await q.query('SAVEPOINT capacity_test');
      await q.query('RELEASE SAVEPOINT capacity_test');
      const journals=(await q.query('SELECT journal_id FROM accounting_document_amendments WHERE company_id=$1 AND document_id=$2',[f.company,doc.id])).rows;
      await q.query('SELECT public.conditional_capacity_origins($1,$2::uuid[])',[f.company,journals.map(r=>r.journal_id)]);
    }),(error:any)=>/transaction not committed locally/.test(error?.message??'') ||
      /transaction not committed locally/.test(error?.cause?.message??''));
    assert.equal((await capacity()).snapshot_hash,frozen.snapshot_hash);
    await commit(f,now,valid);
    const advanced=await transact(async q=>{await scope(q,f.company,actor,true,true);
      return prepareReplacementCapacity(q,f.company,doc.id,{...terms,agreement_date:'2026-10-24'});});
    assert.notEqual(advanced.snapshot_hash,frozen.snapshot_hash);
    assert.equal(advanced.snapshot.journal_origins.length,4);
    assert.equal((await report(f)).open_items.find((d:any)=>d.id===doc.id).open_minor,'600');
  });
  test(`corrected ${kind}: cumulative partial/full credits, native replay, exact history and cash preservation`,async()=>{
    const f=await fixture(),doc=await postNew(f,kind,source(kind==='sales_invoice'?f.customer:f.supplier,'excluding_vat',['STANDARD']));
    await pay(f,doc);
    await commit(f,doc,await review(f,doc));
    const frozen=(await admin.query('SELECT * FROM accounting_document_sources WHERE id=$1',[doc.id])).rows;
    const amendments=(await admin.query('SELECT * FROM accounting_document_amendments WHERE document_id=$1',[doc.id])).rows;
    const first=await correctedCredit(f,doc,'10');
    const posted=await request(f.company,`/accounting-documents/${first.id}/post`,'POST',{},first.revision);
    assert.equal(posted.status,200,JSON.stringify(posted));
    let open=(await report(f)).open_items.find((d:any)=>d.id===doc.id);
    assert.equal(open.gross_minor,'10800');assert.equal(open.credited_minor,'1200');
    assert.equal(open.paid_minor,'5000');assert.equal(open.open_minor,'4600');
    assert.equal((await report(f,'2026-10-21')).open_items.find((d:any)=>d.id===doc.id).gross_minor,'12000');
    assert.equal((await report(f,'2026-10-23')).open_items.find((d:any)=>d.id===doc.id).credited_minor,'0');
    const second=await correctedCredit(f,doc,'80',0,'2026-10-25'),command=await creditReview(f,second);
    assert.equal(command.releases.length,1);assert.equal(command.releases[0].amount_minor,'5000');
    const endpoint=`/accounting-documents/${second.id}/paid-credit`;
    const done=await request(f.company,endpoint,'POST',command,second.revision);
    assert.equal(done.status,200,JSON.stringify(done));
    const retry=await request(f.company,endpoint,'POST',command,second.revision);
    assert.equal(retry.status,200);assert.equal(retry.data.status,'duplicate');assert.equal(retry.data.journal_id,done.data.journal_id);
    assert.equal((await request(f.company,endpoint,'POST',{...command,reason:'Conflicting intent'},second.revision)).status,409);
    open=(await report(f)).open_items.find((d:any)=>d.id===doc.id);
    assert.equal(open.credited_minor,'10800');assert.equal(open.paid_minor,'0');assert.equal(open.open_minor,'0');
    const over=await correctedCredit(f,doc,'0.01',0,'2026-10-26');
    await rejected(()=>reviewPaidCredit(f.company,actor,over.id,over.revision,{request_id:randomUUID(),reason:'Over cap'}),'CREDIT_EXCEEDS_COMMERCIAL_CAPACITY');
    assert.deepEqual((await admin.query('SELECT * FROM accounting_document_sources WHERE id=$1',[doc.id])).rows,frozen);
    assert.deepEqual((await admin.query('SELECT * FROM accounting_document_amendments WHERE document_id=$1',[doc.id])).rows,amendments);
    const cash=(await admin.query("SELECT kind,amount_minor::text FROM accounting_payment_events WHERE company_id=$1 ORDER BY created_at",[f.company])).rows;
    assert.deepEqual(cash.map(e=>e.kind),['payment','unallocation']);assert.equal(cash[0].amount_minor,'5000');
    const data=await report(f);assert.equal(data.journal_movements.debit_minor,data.journal_movements.credit_minor);
    assert.equal(data.balance_sheet.balanced,true);
    for(const [date,prior,open,poolAmount,net,vat] of [
      ['2026-10-10','2026-10-09','12000','0','10000','2000'],
      ['2026-10-15','2026-10-14','7000','0','10000','2000'],
      ['2026-10-22','2026-10-21','5800','0','9000','1800'],
      ['2026-10-24','2026-10-23','4600','0','8000','1600'],
      ['2026-10-25','2026-10-24','0','5000','0','0'],
      ['2026-11-01','2026-10-31','0','5000','0','0'],
    ]) {
      const side=kind==='sales_invoice'?'customer':'supplier';
      const cash=date<'2026-10-15'?'0':side==='customer'?'5000':'-5000';
      reconcileLifecycleReport(await report(f,date),await report(f,date,date),await report(f,prior),
        doc.party_id,{open,pool:poolAmount,cash,net,vat,side});
    }
    // This fixture also retains a rejected excess-credit DRAFT; it still blocks
    // correction until resolved. Posted-only capacity is exercised above.
    await rejected(async()=>review(f,await current(f,doc)),'CORRECTION_CHILD_CREDITS');
  });
  test(`corrected ${kind}: line-local capacity, concurrent drafts, rollback and authority`,async()=>{
    const f=await fixture(),doc=await postNew(f,kind,source(kind==='sales_invoice'?f.customer:f.supplier,'excluding_vat',['STANDARD','REDUCED']));
    await commit(f,doc,await review(f,doc));
    const a=await correctedCredit(f,doc,'60'),b=await correctedCredit(f,doc,'60');
    const ca=await creditReview(f,a),cb=await creditReview(f,b);
    const outcomes=await Promise.all([a,b].map((c,i)=>request(f.company,`/accounting-documents/${c.id}/paid-credit`,'POST',i?cb:ca,c.revision)));
    assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);
    assert.equal(outcomes.find(r=>r.status===409).error.code,'CREDIT_EXCEEDS_COMMERCIAL_CAPACITY');
    const other=await correctedCredit(f,doc,'90',1),co=await creditReview(f,other),before=await counts(f);
    assert.equal((await request(f.company,`/accounting-documents/${other.id}/paid-credit`,'POST',co,other.revision,reader)).status,403);
    const foreign=await fixture();
    assert.equal((await request(foreign.company,`/accounting-documents/${other.id}/paid-credit`,'POST',co,other.revision)).status,404);
    await assert.rejects(()=>commitPaidCredit(f.company,actor,other.id,other.revision,co,async()=>{throw Error('injected capacity rollback');}),/injected capacity rollback/);
    assert.deepEqual(await counts(f),before);
    await admin.query("UPDATE accounting_document_periods SET status='CLOSED' WHERE company_id=$1",[f.company]);
    await rejected(()=>commitPaidCredit(f.company,actor,other.id,other.revision,co),'PERIOD_NOT_WRITABLE');
    assert.deepEqual(await counts(f),before);
  });
  test(`corrected ${kind}: later commercial discount and partial credit share frozen line capacity`,async()=>{
    const f=await fixture(),doc=await postNew(f,kind,source(kind==='sales_invoice'?f.customer:f.supplier,'excluding_vat',['STANDARD']));
    await commit(f,doc,await review(f,doc));
    const now=await current(f,doc);
    const saved=await request(f.company,'/accounting-documents','POST',{
      kind:kind==='sales_invoice'?'sales_credit_note':'supplier_credit_note',
      source:{...now.source,invoice_number:'DISC-'+randomUUID(),issue_date:'2026-10-24',due_date:'2026-10-24',
        discount_adjustment:{type:'percentage',value:'10',original_revision:now.revision}},
      original_id:doc.id,reason:'Agreed subsequent commercial discount',adjustment_method:'offset_outstanding',
      effective_adjustment_date:'2026-10-24',original_line_refs:[0]});
    assert.equal(saved.status,201,JSON.stringify(saved));assert.equal(saved.data.money.gross_pence,'1080');
    assert.equal((await request(f.company,`/accounting-documents/${saved.data.id}/post`,'POST',{},saved.data.revision)).status,200);
    const full=await correctedCredit(f,doc,'90',0,'2026-10-25');
    await rejected(()=>reviewPaidCredit(f.company,actor,full.id,full.revision,{request_id:randomUUID(),reason:'Cannot consume discount twice'}),'CREDIT_EXCEEDS_COMMERCIAL_CAPACITY');
    const remaining=await correctedCredit(f,doc,'81',0,'2026-10-25'),command=await creditReview(f,remaining);
    assert.equal((await request(f.company,`/accounting-documents/${remaining.id}/paid-credit`,'POST',command,remaining.revision)).status,200);
    assert.equal((await report(f)).open_items.find((d:any)=>d.id===doc.id).open_minor,'0');
  });
}

test('active claims block correction, cancelled claims persist, and new claims bind the corrected head',async()=>{
  const f=await fixture(),doc=await postNew(f,'purchase_bill',source(f.supplier,'including_vat',['STANDARD']));
  const body={request_id:randomUUID(),bill_id:doc.id,bill_revision:doc.revision,reason:'Returned part',return_reference:'RN-1',returned_on:'2026-10-11',expected_by:'2026-10-20',lines:[{original_line_ref:0,quantity:'0.5',part_reference:'PART',job_reference:'JOB'}]};
  const claim=await createClaims(f.company,actor,body);await rejected(()=>review(f,doc),'CORRECTION_ACTIVE_CLAIMS');
  const saved=(await admin.query('SELECT * FROM supplier_credit_claims WHERE id=$1',[claim.ids[0]])).rows[0];
  await cancelClaim(f.company,actor,saved.id,saved.revision,{request_id:randomUUID()});
  await commit(f,doc,await review(f,doc));
  await rejected(()=>createClaims(f.company,actor,{...body,request_id:randomUUID()}),'REVISION_CONFLICT');
  assert.equal((await admin.query('SELECT cancelled FROM supplier_credit_claims WHERE id=$1',[saved.id])).rows[0].cancelled,true);
  const historical=await listClaims(f.company,actor,doc.id);
  assert.equal(historical.claims[0].cancelled,true);assert.equal(historical.claims[0].status,'needs_review');
  assert.deepEqual(historical.claims[0].expected,saved.expected);assert.deepEqual(historical.claims[0].candidates,[]);
  const corrected=await current(f,doc);
  await rejected(()=>createClaims(f.company,actor,{...body,request_id:randomUUID(),bill_revision:corrected.revision}),'RETURN_PRECEDES_CORRECTION');
  const command={...body,request_id:randomUUID(),bill_revision:corrected.revision,returned_on:'2026-10-22',expected_by:'2026-10-25'};
  const fresh=await createClaims(f.company,actor,command);
  assert.deepEqual(await createClaims(f.company,actor,command),fresh);
  const listed=(await listClaims(f.company,actor,doc.id)).claims.find(c=>c.id===fresh.ids[0])!;
  assert.equal(listed.status,'awaiting');
  assert.equal(listed.bill_revision,corrected.revision);
  assert.equal(listed.expected.gross_pence,(BigInt(corrected.money.gross_pence)/2n).toString());
  const credit=await postNew(f,'supplier_credit_note',{...corrected.source,
    invoice_number:'CLAIM-'+randomUUID(),issue_date:'2026-10-23',due_date:'2026-10-23',
    line_items:[{...corrected.source.line_items[0],quantity:'0.5'}]},
    {original_id:doc.id,reason:'Returned part',adjustment_method:'offset_outstanding',
      effective_adjustment_date:'2026-10-23',original_line_refs:[0]});
  const receipt={request_id:randomUUID(),credit_id:credit.id,credit_revision:credit.revision,credit_line_ref:0};
  const received=await confirmReceipt(f.company,actor,listed.id,listed.revision,receipt);
  assert.deepEqual(await confirmReceipt(f.company,actor,listed.id,listed.revision,receipt),received);
  const final=(await listClaims(f.company,actor,doc.id)).claims.find(c=>c.id===listed.id)!;
  assert.equal(final.status,'received');
  assert.deepEqual(final.received,final.expected);
  assert.equal((await admin.query('SELECT revision FROM accounting_document_sources WHERE id=$1',[doc.id])).rows[0].revision,doc.revision);
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


test('settlement and historical reports agree on linked credit cutoffs for both parties',async()=>{
  for(const kind of ['sales_invoice','purchase_bill']) {
    const f=await fixture(),party=kind==='sales_invoice'?f.customer:f.supplier;
    const doc=await postNew(f,kind,source(party,'excluding_vat',['STANDARD']));
    const creditKind=kind==='sales_invoice'?'sales_credit_note':'supplier_credit_note';
    const creditSource={...doc.source,invoice_number:'C-'+randomUUID(),issue_date:'2026-10-20',due_date:'2026-10-20',
      line_items:[{...doc.source.line_items[0],quantity:'0.1'}]};
    await postNew(f,creditKind,creditSource,{original_id:doc.id,reason:'Return',adjustment_method:'offset_outstanding',effective_adjustment_date:'2026-10-20',original_line_refs:[0]});
    const open=await documentOpen(pool,f.company,doc.id);
    assert.equal(open.credited_minor,'1200');assert.equal(open.open_minor,'10800');
    assert.equal((await report(f,'2026-10-19')).open_items[0].credited_minor,'0');
    assert.equal((await report(f,'2026-10-20')).open_items[0].credited_minor,open.credited_minor);
  }
});

test('linked credit projection rejects missing journal, wrong party and kind even beyond cutoff',async()=>{
  const original={id:randomUUID(),kind:'sales_invoice',party_id:randomUUID(),source:{currency:'GBP'}};
  const credit={id:randomUUID(),kind:'sales_credit_note',party_id:original.party_id,source:{currency:'GBP'},status:'posted',
    verified_journal_id:randomUUID(),posting_date:'2026-10-20',money:{gross_pence:'1200'}};
  for(const patch of [{verified_journal_id:null},{party_id:randomUUID()},{kind:'supplier_credit_note'},{source:{currency:'EUR'}}]) {
    const q={query:async()=>({rows:[{...credit,...patch}]})} as any;
    await rejected(()=>linkedCreditDocuments(q,randomUUID(),original,'2026-10-01'),'CREDIT_HISTORY_INVALID');
  }
});


test('receipt confirmation and claim listing fail closed on corrupt bill history without changing receipt evidence',async()=>{
  const templateCompany=await fixture(),templateBill=await postNew(templateCompany,'purchase_bill',source(templateCompany.supplier,'excluding_vat',['STANDARD']));
  await commit(templateCompany,templateBill,await review(templateCompany,templateBill));
  const template=(await admin.query('SELECT id FROM accounting_document_amendments WHERE company_id=$1',[templateCompany.company])).rows[0];
  const f=await fixture(),bill=await postNew(f,'purchase_bill',source(f.supplier,'excluding_vat',['STANDARD']));
  const created=await createClaims(f.company,actor,{request_id:randomUUID(),bill_id:bill.id,bill_revision:bill.revision,
    reason:'Returned part',returned_on:'2026-10-11',lines:[{original_line_ref:0,quantity:'0.2'}]});
  const creditSource={...bill.source,invoice_number:'C-'+randomUUID(),issue_date:'2026-10-12',due_date:'2026-10-12',line_items:[{...bill.source.line_items[0],quantity:'0.1'}]};
  const credit=await postNew(f,'supplier_credit_note',creditSource,{original_id:bill.id,reason:'Return',adjustment_method:'offset_outstanding',effective_adjustment_date:'2026-10-12',original_line_refs:[0]});
  const claim=(await admin.query('SELECT * FROM supplier_credit_claims WHERE id=$1',[created.ids[0]])).rows[0];
  await confirmReceipt(f.company,actor,claim.id,claim.revision,{request_id:randomUUID(),credit_id:credit.id,credit_revision:credit.revision,credit_line_ref:0});
  const listed=await listClaims(f.company,actor,bill.id);assert.equal(listed.claims[0].status,'partial');assert.equal(listed.claims[0].receipts[0].active,true);
  const before=(await admin.query('SELECT * FROM supplier_credit_receipts WHERE company_id=$1',[f.company])).rows;
  const second=await postNew(f,'supplier_credit_note',{...creditSource,invoice_number:'C-'+randomUUID()},{original_id:bill.id,reason:'Return',adjustment_method:'offset_outstanding',effective_adjustment_date:'2026-10-12',original_line_refs:[0]});
  const unrelated=await postNew(f,'purchase_bill',source(f.supplier,'excluding_vat',['STANDARD']));
  const journals=(await admin.query('SELECT id,journal_id FROM accounting_document_sources WHERE company_id=$1',[f.company])).rows;
  // Insert an intentionally orphaned amendment only into this disposable fixture.
  await pool.query(`INSERT INTO accounting_document_amendments SELECT $1::uuid,$2::uuid,$3::uuid,1,$4::uuid,$5::uuid,$6::uuid,request_hash,review_token,actor_id,reason,effective_date,$7::uuid,$8::uuid,financial_context_hash,before_source,after_source,before_money,after_money,delta_money,after_tax_context,created_at FROM accounting_document_amendments WHERE id=$9`,[randomUUID(),f.company,bill.id,bill.revision,randomUUID(),randomUUID(),journals.find(j=>j.id===bill.id).journal_id,journals.find(j=>j.id===unrelated.id).journal_id,template.id]);
  await rejected(()=>listClaims(f.company,actor,bill.id),'CORRECTION_HISTORY_INVALID');
  await rejected(()=>confirmReceipt(f.company,actor,claim.id,listed.claims[0].revision,{request_id:randomUUID(),credit_id:second.id,credit_revision:second.revision,credit_line_ref:0}),'CORRECTION_HISTORY_INVALID');
  assert.deepEqual((await admin.query('SELECT * FROM supplier_credit_receipts WHERE company_id=$1',[f.company])).rows,before);
});


test('linked credit journal revision and currency mismatches fail closed before historical cutoff',async()=>{
  for (const kind of ['sales_invoice','purchase_bill']) {
    const f=await fixture(),original=await postNew(f,kind,source(kind==='sales_invoice'?f.customer:f.supplier,'excluding_vat',['STANDARD']));
    const creditKind=kind==='sales_invoice'?'sales_credit_note':'supplier_credit_note';
    const credit=await postNew(f,creditKind,{...original.source,invoice_number:'C-'+randomUUID(),
      issue_date:'2026-10-20',due_date:'2026-10-20',line_items:[{...original.source.line_items[0],quantity:'0.1'}]},
      {original_id:original.id,reason:'Return',adjustment_method:'offset_outstanding',effective_adjustment_date:'2026-10-20',original_line_refs:[0]});
    const before=await documentOpen(pool,f.company,original.id);
    assert.equal(before.credited_minor,'1200');assert.equal(before.open_minor,'10800');
    const journal=(await admin.query('SELECT journal_id FROM accounting_document_sources WHERE id=$1',[credit.id])).rows[0].journal_id;
    for (const [column,value] of [['source_revision',randomUUID()],['currency_code','EUR']]) {
      const client=await admin.connect();
      try {
        // Corrupt only a disposable fixture inside a transaction. Rollback restores
        // both the immutable guard and journal bytes, including on assertion failure.
        await client.query('BEGIN');
        await client.query('ALTER TABLE canonical_journal_entries DISABLE TRIGGER ledgerly_canonical_journal_entries_guard');
        await client.query(`UPDATE canonical_journal_entries SET ${column}=$2 WHERE id=$1`,[journal,value]);
        await rejected(()=>documentOpen(client,f.company,original.id),'CREDIT_HISTORY_INVALID');
        await rejected(()=>linkedCreditDocuments(client,f.company,original,'2026-10-19'),'CREDIT_HISTORY_INVALID');
      } finally { await client.query('ROLLBACK');client.release(); }
    }
    assert.deepEqual(await documentOpen(pool,f.company,original.id),before);
    assert.equal((await report(f,'2026-10-19')).open_items[0].credited_minor,'0');
    assert.equal((await report(f,'2026-10-20')).open_items[0].credited_minor,'1200');
    assert.equal((await admin.query("SELECT tgenabled FROM pg_trigger WHERE tgname='ledgerly_canonical_journal_entries_guard'")).rows[0].tgenabled,'A');
  }
});
