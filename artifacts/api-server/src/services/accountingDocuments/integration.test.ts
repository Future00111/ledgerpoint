import test,{before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {execFileSync,fork, type ChildProcess} from "node:child_process";
import path from "node:path";
import pg from "pg";
import express from "express";
import {pool} from "@workspace/db";
import {createAccountingRouter} from "../../routes/accountingDocuments";
import {createDocumentIntakeRouter} from "../../routes/documentIntake";
import {verifyDraftBody,draftParserErrors} from '../financialDrafts/jsonBoundary';
import {InvoiceDraftService} from "../financialDrafts/invoiceService";
import {createProductionInvoiceDraftAuthority} from "../financialDrafts/productionAuthority";
import {invoiceDraftRouter} from "../financialDrafts/router";
import {isGenericEntityWriteBlocked} from "../../routes/entityWritePolicy";
import {queryAdapter} from "./core";
import {reports} from "./reports";
import {ensureWorkspaceTaxRules} from '../../../../../tools/accounting-flow/workspace-tax-rules.mjs';
import {applyReconciliationApproval,applyNonPaymentReconciliationMatch} from '../ai-accountant/approval';
import {reverseCanonicalJournal} from '../accounting/canonicalPosting';
import {createCompaniesRouter} from '../../routes/companies';
import {createEntitiesRouter} from '../../routes/entities';
import {createFunctionsRouter} from '../../routes/functions';
import {addVATTaxRule} from '../ai-accountant/vat';
import {registerEmptyCompanyJourney} from './onboardingJourney';

const socket=process.env.ACCOUNTING_FLOW_TEST_SOCKET??"";
if(!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]+\/socket$/.test(socket)) throw Error("Disposable socket required");
const admin=new pg.Pool({host:socket,port:55441,user:"w03_bootstrap",database:"ledgerly_accounting_flow_test",password:"",ssl:false,options:""});
const actor="synthetic-accounting-owner",readOnly="synthetic-accounting-reader";
let server:ReturnType<ReturnType<typeof express>["listen"]>,base:string,failNext=false,failNextCredit=false,failNextCapture=false;
let pausePosting:(()=>Promise<void>)|undefined;
const auth:express.RequestHandler=(req,res,next)=>{
  const user=req.get("x-test-actor");if(!user){res.status(401).json({error:{code:"UNAUTHORIZED"}});return;}
  (req as any).userId=user;next();
};
before(async()=>{
  const identity=(await pool.query("SELECT current_database() db,current_user role,inet_server_addr() addr")).rows[0];
  assert.deepEqual(identity,{db:"ledgerly_accounting_flow_test",role:"ledgerly_api",addr:null});
  const app=express();app.use(express.json({limit:'10mb',verify:verifyDraftBody}));app.use(draftParserErrors);
  app.use('/onboarding-companies',createCompaniesRouter(auth,{
    byId:async id=>({id}),byEmail:async()=>null,
  }));
  app.use('/onboarding-entities',createEntitiesRouter(auth));
  app.use('/bank-functions',createFunctionsRouter(auth));
  app.use('/companies/:companyId/document-intake',createDocumentIntakeRouter(auth,async q=>{
    if(failNextCapture){failNextCapture=false;await q.query('SELECT 1/0');}
  }));
  app.use("/companies/:companyId",createAccountingRouter(auth,async tx=>{
    if(failNext){failNext=false;await queryAdapter(tx).query("SELECT 1/0");}
    await pausePosting?.();
  },async q=>{
    if(failNextCredit){failNextCredit=false;await q.query('SELECT 1/0');}
  }));
  app.use("/legacy/:companyId",invoiceDraftRouter(new InvoiceDraftService(pool,createProductionInvoiceDraftAuthority()),auth));
  server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
  base=`http://127.0.0.1:${(server.address() as any).port}`;
});
after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();await admin.end();});
test('native bank import rejects late fractional-penny evidence before any persisted rows',async()=>{
  const f=await fixture();
  const count=async()=>Number((await admin.query('SELECT count(*) n FROM bank_transactions WHERE company_id=$1',[f.company])).rows[0].n);
  assert.equal(await count(),0);
  for(const money_in of ['0.005','1.001','10000000000.00',true]){
    const response=await fetch(base+'/bank-functions/recordBankTransactions',{method:'POST',
      headers:{'Content-Type':'application/json','x-test-actor':actor},
      body:JSON.stringify({company_id:f.company,transactions:[
        {money_in:'19.99',money_out:'0',description:'Synthetic valid first row'},
        {money_in,money_out:'0',description:'Synthetic invalid late row'}]})});
    assert.equal(response.status,400);
    assert.equal(await count(),0);
  }
});
test('protected bank import command persists evidence once, denies foreign and read-only actors, and rolls back invalid late rows',async()=>{
  const f=await fixture(),other=await fixture(),bank=randomUUID(),foreign=randomUUID();
  await admin.query("INSERT INTO bank_accounts(id,company_id,account_name,currency,status) VALUES($1,$2,'Synthetic GBP','GBP','active'),($3,$4,'Foreign synthetic','GBP','active')",[bank,f.company,foreign,other.company]);
  const body:any={request_id:randomUUID(),bank_account_id:bank,rows:[{date:'2026-11-09',description:'Synthetic statement',reference:'S1',money_in:'19.99',money_out:'0.00'}]};
  const counts=async()=>Number((await admin.query('SELECT count(*) n FROM bank_transactions WHERE company_id=$1',[f.company])).rows[0].n);
  assert.equal((await request(f.company,'/bank-imports','POST',body,undefined,null)).status,401);
  assert.equal((await request(f.company,'/bank-imports','POST',body,undefined,readOnly)).status,403);
  assert.notEqual((await request(f.company,'/bank-imports','POST',{...body,bank_account_id:foreign})).status,201);
  assert.equal(await counts(),0);
  const preview=await request(f.company,'/bank-statements/import-review','POST',body);
  assert.equal(preview.status,200,JSON.stringify(preview));body.review_token=preview.data.review_token;
  const first=await request(f.company,'/bank-imports','POST',body);
  assert.equal(first.status,201,JSON.stringify(first));
  assert.equal(first.data.rows[0].money_in,'19.99');
  assert.equal(first.data.rows[0].status,'review');
  assert.equal(first.data.rows[0].linked_invoice_id,null);
  const duplicate=await request(f.company,'/bank-imports','POST',body);
  assert.deepEqual(duplicate.data,first.data);assert.equal(await counts(),1);
  assert.deepEqual((await request(f.company,`/bank-imports/${body.request_id}`)).data,first.data);
  const parallel=await Promise.all([request(f.company,'/bank-imports','POST',body),request(f.company,'/bank-imports','POST',body)]);
  for(const p of parallel)assert.deepEqual(p.data,first.data);
  assert.equal(await counts(),1);
  const changed={...body,rows:[{...body.rows[0],description:'Changed intent'}]};
  assert.notEqual((await request(f.company,'/bank-imports','POST',changed)).status,201);
  const bad={...body,request_id:randomUUID(),rows:[body.rows[0],{...body.rows[0],date:'2026-02-30'}]};
  assert.notEqual((await request(f.company,'/bank-imports','POST',bad)).status,201);
  assert.equal(await counts(),1,'first valid row rolls back with invalid late date');
  assert.equal((await admin.query('SELECT count(*) n FROM accounting_bank_imports WHERE company_id=$1',[f.company])).rows[0].n,'1');
  assert.equal((await pool.query("SELECT has_table_privilege(current_user,'bank_transactions','INSERT') permitted")).rows[0].permitted,false);
  assert.equal((await pool.query("SELECT has_table_privilege(current_user,'accounting_bank_imports','INSERT') permitted")).rows[0].permitted,false);
  assert.equal((await admin.query('SELECT count(*) n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n,'0','statement import never posts a journal');
  await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2',[f.company,actor]);
  assert.equal((await request(f.company,'/bank-imports','POST',body)).status,404);
  assert.equal((await request(f.company,`/bank-imports/${body.request_id}`)).status,404);
});
async function request(company:string,path:string,method="GET",body?:unknown,revision?:string,user:string|null=actor) {
  const response=await fetch(base+"/companies/"+company+path,{method,headers:{
    ...(user?{"x-test-actor":user}:{}),...(body===undefined?{}:{"Content-Type":"application/json"}),
    ...(revision?{"If-Match":`"${revision}"`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json() as any;return {status:response.status,...result};
}
registerEmptyCompanyJourney({
  scoped:request,
  addRule:addVATTaxRule,
  root:async(path,method,body,user=actor)=>{
    const response=await fetch(base+path,{method,headers:{
      ...(user?{'x-test-actor':user}:{}),'Content-Type':'application/json',
    },body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  },
});
test('native VAT setup audit is readable but cannot be edited or removed by the runtime role',async()=>{
  const rows=await pool.query("SELECT event_type,user_id FROM vat_return_audits WHERE user_id=$1",[actor]);
  assert.equal(rows.rows.length,4);
  assert.ok(rows.rows.every(r=>r.event_type==='vat_tax_rule_created' && r.user_id===actor));
  for(const sql of ['UPDATE vat_return_audits SET description=description','DELETE FROM vat_return_audits','TRUNCATE vat_return_audits'])
    await assert.rejects(pool.query(sql),{code:'42501'});
});
async function fixture(vat=true) {
  const company=randomUUID(),customer=randomUUID(),supplier=randomUUID();
  await admin.query(`INSERT INTO companies(id,name,country,base_currency,vat_registered,vat_scheme,vat_accounting_basis,status)
    VALUES($1,'Synthetic accounting API fixture','GB','GBP',$2,'standard','invoice','active')`,[company,vat]);
  for(const [user,role] of [[actor,"owner"],[readOnly,"read_only"]])
    await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,$4,true)",[randomUUID(),company,user,role]);
  await admin.query("INSERT INTO customers(id,company_id,name,status) VALUES($1,$2,'Synthetic customer','active')",[customer,company]);
  await admin.query("INSERT INTO suppliers(id,company_id,name,status) VALUES($1,$2,'Synthetic supplier','active')",[supplier,company]);
  const mappings:Record<string,string>={};
  for(const [role,type] of [["receivables","asset"],["payables","liability"],["revenue","income"],["expense","expense"],["output_vat","liability"],["input_vat","asset"]]) {
    const id=randomUUID();mappings[role!]=id;
    await admin.query("INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,$3,$3,$4,true)",[id,company,role,type]);
  }
  assert.equal((await request(company,"/accounting-configuration","PUT",{revision:null,mappings,business_accounting_basis:"accrual"})).status,200);
  const period=await request(company,"/accounting-periods","POST",{start_date:"2026-01-01",end_date:"2026-12-31",financial_year_label:"Year ending 2026"});
  assert.equal(period.status,201);
  for(const [code,rate,treatment] of [["STANDARD_20","20","standard"],["NO_VAT","0","no_vat"]])
    await admin.query("INSERT INTO vat_tax_rules(id,company_id,code,label,rate,treatment,effective_from,is_active) VALUES($1,$2,$3,$3,$4,$5,'2011-01-04',true)",[randomUUID(),company,code,rate,treatment]);
  const ctx=await request(company,"/accounting-documents/context?kind=sales_invoice");
  assert.equal(ctx.status,200,JSON.stringify(ctx));
  assert.equal(ctx.data.periods[0].start_date,"2026-01-01");
  assert.equal(ctx.data.tax_rules.length,2);
  assert.equal((await request(company,"/accounting-configuration")).status,200);
  const paymentMappings:Record<string,string>={};
  for(const [role,type] of [['bank','asset'],['customer_credit','liability'],['supplier_prepayment','asset']]) {
    const id=randomUUID();paymentMappings[role!]=id;
    await admin.query('INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,$3,$3,$4,true)',[id,company,role,type]);
  }
  assert.equal((await request(company,'/accounting-payments/configuration','PUT',{revision:null,mappings:paymentMappings})).status,200);
  return {company,customer,supplier,mappings,paymentMappings,period:period.data.id};
}
async function openingFixture() {
  const f=await fixture(),bank=randomUUID(),equity=randomUUID();
  await admin.query("INSERT INTO bank_accounts(id,company_id,account_name,currency,status,opening_balance,current_balance) VALUES($1,$2,'Synthetic opening bank','GBP','active',999,999)",[bank,f.company]);
  await admin.query("INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,'3000','Reviewed opening equity','equity',true)",[equity,f.company]);
  return {...f,bank,equity,body:{request_id:randomUUID(),bank_account_id:bank,bank_ledger_account_id:f.paymentMappings.bank,
    balancing_account_id:equity,effective_date:'2026-01-15',amount_minor:'12345',direction:'debit'}};
}
async function matchedBankCase(party='customer') {
  const f=await openingFixture();
  const payment={id:randomUUID(),kind:'payment',party_type:party,party_id:party==='customer'?f.customer:f.supplier,
    payment_id:null,date:'2026-10-21',reference:'Correction lifecycle',amount_minor:'12000',allocations:[]};
  await recordPayment(f,payment);
  const batch={request_id:randomUUID(),bank_account_id:f.bank,rows:[{date:'2026-10-21',description:'Lifecycle cash',
    reference:'LIFE',money_in:party==='customer'?'120.00':'0.00',money_out:party==='customer'?'0.00':'120.00'}]};
  const ir=await request(f.company,'/bank-statements/import-review','POST',batch);
  const imported=await request(f.company,'/bank-statements/imports','POST',{...batch,review_token:ir.data.review_token});
  assert.equal(imported.status,200,JSON.stringify(imported));
  const add=async(amount:string)=>{
    const b={request_id:randomUUID(),bank_transaction_id:imported.data.rows[0].id,payment_id:payment.id,amount_minor:amount};
    const r=await request(f.company,'/bank-statements/match-review','POST',b);
    assert.equal(r.status,200,JSON.stringify(r));
    const posted=await request(f.company,'/bank-statements/matches','POST',{...b,review_token:r.data.review_token});
    assert.equal(posted.status,200,JSON.stringify(posted));return posted.data;
  };
  return {f,payment,statement:imported.data.rows[0].id,add};
}
async function correctBankMatch(f:any,m:any) {
  const b={request_id:randomUUID(),match_request_id:m.request_id,reason:'Wrong statement association'};
  const r=await request(f.company,'/bank-statements/correction-review','POST',b);
  assert.equal(r.status,200,JSON.stringify(r));
  const result=await request(f.company,'/bank-statements/corrections','POST',{...b,review_token:r.data.review_token});
  assert.equal(result.status,200,JSON.stringify(result));return result.data;
}
for(const side of ['customer','supplier']) test(`${side} correction does not bypass allocation guards; native unallocation and reversal restore document outstanding`,async()=>{
  const {f,payment,add}=await matchedBankCase(side);
  const doc=await create(f,side==='customer'?'sales_invoice':'purchase_bill',source(side==='customer'?f.customer:f.supplier,'120'));
  assert.equal(doc.money.gross_pence,'12000');
  await post(f,doc);
  const allocations=[{document_id:doc.id,amount_minor:'12000'}];
  await recordPayment(f,{...payment,id:randomUUID(),kind:'allocation',payment_id:payment.id,allocations});
  const m=await add('12000');await correctBankMatch(f,m);
  const reversal={...payment,id:randomUUID(),kind:'reversal',payment_id:payment.id,date:'2026-10-22',reference:'Restored outstanding'};
  assert.equal((await request(f.company,'/accounting-payments/review','POST',reversal)).status,409);
  assert.equal((await reports(f.company,actor,'2026-01-01','2026-12-31')).open_items.find((x:any)=>x.id===doc.id).open_minor,'0');
  await recordPayment(f,{...payment,id:randomUUID(),kind:'unallocation',payment_id:payment.id,allocations,date:'2026-10-22'});
  await recordPayment(f,reversal);
  const report=await reports(f.company,actor,'2026-01-01','2026-12-31');
  assert.equal(report.open_items.find((x:any)=>x.id===doc.id).open_minor,'12000');
  assert.equal(report.cash.balance_minor,'0');
  assert.equal((await request(f.company,'/bank-statements/context')).data.statements[0].remaining_minor,'12000');
});
for(const side of ['customer','supplier']) test(`${side} statement matching uses the posted refund event's own cash journal without new money`,async()=>{
  const {f,payment}=await matchedBankCase(side);
  const refund={...payment,id:randomUUID(),kind:'refund',payment_id:payment.id,amount_minor:'6000',reference:'Existing refund'};
  await recordPayment(f,refund);
  const rows=[{date:'2026-10-21',description:'Refund cash',reference:'REFUND',money_in:side==='supplier'?'60.00':'0.00',money_out:side==='customer'?'60.00':'0.00'}];
  const batch={request_id:randomUUID(),bank_account_id:f.bank,rows};
  const r=await request(f.company,'/bank-statements/import-review','POST',batch);
  const imported=await request(f.company,'/bank-statements/imports','POST',{...batch,review_token:r.data.review_token});
  assert.equal(imported.status,200,JSON.stringify(imported));
  const statement=imported.data.rows[0].id;
  const own=(await admin.query('SELECT journal_id FROM accounting_payment_events WHERE company_id=$1 AND id=$2',[f.company,refund.id])).rows[0].journal_id;
  const original=(await admin.query('SELECT journal_id FROM accounting_payment_events WHERE company_id=$1 AND id=$2',[f.company,payment.id])).rows[0].journal_id;
  assert.notEqual(own,original);
  const body={request_id:randomUUID(),bank_transaction_id:statement,payment_id:refund.id,amount_minor:'4000'};
  const preview=await request(f.company,'/bank-statements/match-review','POST',body);
  assert.equal(preview.status,200,JSON.stringify(preview));assert.equal(preview.data.payment.journal_id,own);
  const postBody={...body,review_token:preview.data.review_token};
  const posted=await request(f.company,'/bank-statements/matches','POST',postBody);
  assert.equal(posted.status,200);assert.equal(posted.data.journal_id,own);
  assert.deepEqual((await request(f.company,'/bank-statements/matches','POST',postBody)).data,posted.data);
  assert.deepEqual((await request(f.company,`/bank-statements/matches/${body.request_id}`)).data,posted.data);
  const tooMuch=await request(f.company,'/bank-statements/match-review','POST',{...body,request_id:randomUUID(),amount_minor:'3000'});
  assert.equal(tooMuch.status,409);
  assert.equal((await request(f.company,'/bank-statements/match-review','POST',{...body,request_id:randomUUID(),payment_id:payment.id})).status,422);
  const ctx=(await request(f.company,'/bank-statements/context')).data;
  assert.equal(ctx.payments.find((p:any)=>p.id===refund.id).remaining_minor,'2000');
  assert.equal(ctx.statements.find((s:any)=>s.id===statement).remaining_minor,'2000');
  assert.equal((await admin.query('SELECT count(*) n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n,'2');
  assert.equal((await reports(f.company,actor,'2026-01-01','2026-12-31')).cash.balance_minor,side==='customer'?'6000':'-6000');
});
for(const side of ['customer','supplier']) test(`${side} payment reversal requires every active match corrected and recovers one balanced reversal`,async()=>{
  const {f,payment,add}=await matchedBankCase(side),a=await add('7000'),b=await add('5000');
  const reversal={...payment,id:randomUUID(),kind:'reversal',payment_id:payment.id,date:'2026-10-22',reference:'Corrected match reversal'};
  assert.equal((await request(f.company,'/accounting-payments/review','POST',reversal)).status,409);
  await correctBankMatch(f,a);
  assert.equal((await request(f.company,'/accounting-payments/review','POST',reversal)).status,409);
  await correctBankMatch(f,b);
  const review=await request(f.company,'/accounting-payments/review','POST',reversal);
  assert.equal(review.status,200,JSON.stringify(review));
  const confirmed=await request(f.company,'/accounting-payments','POST',{...reversal,review_token:review.data.review_token});
  assert.equal(confirmed.status,200,JSON.stringify(confirmed));
  const recovered=await request(f.company,`/accounting-payments/operations/${reversal.id}`);
  assert.equal(recovered.status,200);
  assert.equal((await request(f.company,'/accounting-payments','POST',{...reversal,review_token:review.data.review_token})).status,200);
  const ctx=(await request(f.company,'/bank-statements/context')).data;
  assert.equal(ctx.statements[0].remaining_minor,'12000');assert.equal(ctx.statements[0].status,'unmatched');
  const now=await reports(f.company,actor,'2026-01-01','2026-10-22');
  const before=await reports(f.company,actor,'2026-01-01','2026-10-21');
  assert.equal(now.cash.balance_minor,'0');assert.equal(before.cash.balance_minor,side==='customer'?'12000':'-12000');
  assert.equal((await admin.query('SELECT count(*) n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n,'2');
  assert.equal((await admin.query(`SELECT count(*) n FROM
    (SELECT journal_entry_id FROM canonical_journal_lines WHERE company_id=$1 GROUP BY journal_entry_id HAVING sum(debit_minor)<>sum(credit_minor)) x`,[f.company])).rows[0].n,'0');
});
for(const side of ['customer','supplier']) test(`${side} append-only bank correction releases one partial receipt, serializes replay and preserves cash`,async()=>{
  const {f,payment,statement,add}=await matchedBankCase(side),a=await add('7000'),b=await add('5000');
  const make=(m:any)=>({request_id:randomUUID(),match_request_id:m.request_id,reason:'Wrong evidence selected'});
  const ca=make(a),cb=make(b);
  const ar=await request(f.company,'/bank-statements/correction-review','POST',ca);
  const br=await request(f.company,'/bank-statements/correction-review','POST',cb);
  assert.equal(ar.status,200);assert.equal(ar.data.statement_remaining_minor,'7000');
  assert.equal((await request(f.company,'/bank-statements/correction-review','POST',ca,undefined,readOnly)).status,403);
  const foreign=await fixture();
  assert.equal((await request(foreign.company,'/bank-statements/correction-review','POST',ca)).status,404);
  const body={...ca,review_token:ar.data.review_token};
  failNextCredit=true;
  assert.equal((await request(f.company,'/bank-statements/corrections','POST',body)).status,500);
  assert.equal((await request(f.company,`/bank-statements/corrections/${ca.request_id}`)).data.status,'unknown');
  const results=await Promise.all([request(f.company,'/bank-statements/corrections','POST',body),request(f.company,'/bank-statements/corrections','POST',body)]);
  assert.equal(results[0].status,200,JSON.stringify(results));assert.deepEqual(results[1].data,results[0].data);
  assert.equal(results[0].data.released_minor,'7000');assert.ok(results[0].data.effective_at);
  assert.deepEqual((await request(f.company,`/bank-statements/corrections/${ca.request_id}`)).data,results[0].data);
  assert.equal((await request(f.company,'/bank-statements/corrections','POST',{...body,reason:'Changed'})).status,409);
  assert.equal((await request(f.company,'/bank-statements/corrections','POST',{...body,request_id:randomUUID()})).status,409);
  const stale=await request(f.company,'/bank-statements/corrections','POST',{...cb,review_token:br.data.review_token});
  assert.equal(stale.status,409);assert.equal(stale.error.code,'BANK_CORRECTION_REVIEW_STALE');
  const ctx=(await request(f.company,'/bank-statements/context')).data;
  assert.equal(ctx.statements.find((s:any)=>s.id===statement).remaining_minor,'7000');
  assert.equal(ctx.matches.find((m:any)=>m.request_id===a.request_id).active,false);
  assert.equal(ctx.matches.find((m:any)=>m.request_id===b.request_id).active,true);
  assert.equal(ctx.payments.find((p:any)=>p.id===payment.id).remaining_minor,'7000');
  assert.equal((await admin.query('SELECT count(*) n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n,'1');
  assert.equal((await reports(f.company,actor,'2026-01-01','2026-12-31')).cash.balance_minor,side==='customer'?'12000':'-12000');
  await assert.rejects(pool.query('DELETE FROM accounting_bank_match_corrections WHERE company_id=$1',[f.company]));
  await assert.rejects(pool.query('UPDATE accounting_bank_match_corrections SET reason=$2 WHERE company_id=$1',[f.company,'Changed']));
  await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2',[f.company,actor]);
  assert.equal((await request(f.company,'/bank-statements/corrections','POST',body)).status,404);
});
test('adversarial imports cannot bypass reviewed duplicate authority through alias or runtime SQL',async()=>{
  const f=await openingFixture();
  const make=()=>({request_id:randomUUID(),bank_account_id:f.bank,rows:[
    {date:'2026-10-21',description:'Identical synthetic evidence',reference:'REVIEW-25',money_in:'10.00',money_out:'0.00'}]});
  const a=make(),b=make();
  assert.equal((await request(f.company,'/bank-imports','POST',a)).status,428);
  assert.equal((await pool.query("SELECT has_function_privilege(current_user,'ledgerly_record_bank_import(uuid,text,uuid,uuid,jsonb)','EXECUTE') allowed")).rows[0].allowed,false);
  await assert.rejects(pool.query('SELECT ledgerly_record_bank_import($1,$2,$3,$4,$5::jsonb)',[f.company,actor,f.bank,a.request_id,JSON.stringify(a.rows)]),/permission denied/);
  const ar=await request(f.company,'/bank-statements/import-review','POST',a);
  const br=await request(f.company,'/bank-statements/import-review','POST',b);
  assert.equal(ar.status,200);assert.equal(br.status,200);
  const posted=await request(f.company,'/bank-imports','POST',{...a,review_token:ar.data.review_token});
  assert.equal(posted.status,201,JSON.stringify(posted));
  assert.equal((await request(f.company,'/bank-imports','POST',{...b,review_token:br.data.review_token})).status,409);
  await assert.rejects(pool.query('SELECT ledgerly_record_reviewed_bank_import($1,$2,$3,$4,$5::jsonb,$6)',
    [f.company,actor,f.bank,b.request_id,JSON.stringify(br.data.intent.rows),br.data.review_token]),/BANK_IMPORT_DUPLICATE/);
  assert.equal((await admin.query('SELECT count(*) n FROM bank_transactions WHERE company_id=$1',[f.company])).rows[0].n,'1');
  assert.deepEqual((await request(f.company,'/bank-imports','POST',{...a,review_token:ar.data.review_token})).data,posted.data);
  const unreviewed=make();
  await assert.rejects(pool.query('SELECT ledgerly_record_reviewed_bank_import($1,$2,$3,$4,$5::jsonb,$6)',
    [f.company,actor,f.bank,unreviewed.request_id,JSON.stringify(a.rows),'sha256:'+'0'.repeat(64)]),/BANK_IMPORT_REVIEW_REQUIRED/);
  const legacyRace={...make(),rows:[{...a.rows[0],description:'Legacy zero side',reference:''}]};
  const lr=await request(f.company,'/bank-statements/import-review','POST',legacyRace);
  assert.equal(lr.status,200);
  await admin.query(`INSERT INTO bank_transactions(id,company_id,bank_account_id,date,description,reference,money_in,money_out)
    VALUES($1,$2,$3,'2026-10-21','Legacy zero side',NULL,10,NULL)`,[randomUUID(),f.company,f.bank]);
  await assert.rejects(pool.query('SELECT ledgerly_record_reviewed_bank_import($1,$2,$3,$4,$5::jsonb,$6)',
    [f.company,actor,f.bank,legacyRace.request_id,JSON.stringify(lr.data.intent.rows),lr.data.review_token]),/BANK_IMPORT_DUPLICATE/);
});
test('adversarial bank setup cannot reclassify historical prepayment pools as cash',async()=>{
  const f=await fixture();
  const b={id:randomUUID(),kind:'payment',party_type:'supplier',party_id:f.supplier,payment_id:null,
    date:'2026-01-20',reference:'Historical supplier prepayment',amount_minor:'6000',allocations:[]};
  await recordPayment(f,b);
  const before=await reports(f.company,actor,'2026-01-01','2026-01-31');
  assert.equal(before.cash.balance_minor,'-6000');
  const config=(await request(f.company,'/accounting-payments/context')).data.configuration;
  const newPool=randomUUID();
  await admin.query("INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,'NEWPOOL','New pool','asset',true)",[newPool,f.company]);
  const malicious={revision:config.revision,mappings:{...config.mappings,bank:config.mappings.supplier_prepayment,supplier_prepayment:newPool}};
  const rejected=await request(f.company,'/accounting-payments/configuration','PUT',malicious);
  assert.equal(rejected.status,422,JSON.stringify(rejected));assert.equal(rejected.error.code,'PAYMENT_HISTORICAL_ACCOUNT_CONFLICT');
  assert.equal((await reports(f.company,actor,'2026-01-01','2026-01-31')).cash.balance_minor,'-6000');
  assert.deepEqual((await request(f.company,'/accounting-payments/context')).data.configuration,config);
});
test('canonical import whitespace and malformed legacy history fail closed through HTTP and SQL',async()=>{
  const f=await openingFixture();
  const whitespace=[9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279];
  for(const n of whitespace) {
    const value=String.fromCharCode(n)+'Payment'+String.fromCharCode(n);
    assert.equal((await pool.query('SELECT ledgerly_import_trim($1) v',[value])).rows[0].v,value.trim());
  }
  const body={request_id:randomUUID(),bank_account_id:f.bank,rows:[
    {date:'2026-10-21',description:'Payment',reference:'WS',money_in:'10.00',money_out:'0.00'}]};
  const preview=await request(f.company,'/bank-statements/import-review','POST',body);
  assert.equal(preview.status,200);
  const legacy=randomUUID();
  await admin.query(`INSERT INTO bank_transactions(id,company_id,bank_account_id,date,description,reference,money_in,money_out)
    VALUES($1,$2,$3,'2026-10-21',$4,'WS',10,0)`,[legacy,f.company,f.bank,'\u00a0Payment\u00a0']);
  const call=()=>pool.query('SELECT ledgerly_record_reviewed_bank_import($1,$2,$3,$4,$5::jsonb,$6)',
    [f.company,actor,f.bank,body.request_id,JSON.stringify(preview.data.intent.rows),preview.data.review_token]);
  await assert.rejects(call(),/BANK_IMPORT_DUPLICATE/);
  assert.equal((await request(f.company,'/bank-statements/imports','POST',{...body,review_token:preview.data.review_token})).status,409);
  for(const fields of [{description:null,money_in:'10',money_out:'0'},{description:'Legacy',money_in:null,money_out:null},
    {description:'Legacy',money_in:'NaN',money_out:'0'}]) {
    await admin.query('UPDATE bank_transactions SET description=$2,money_in=$3,money_out=$4 WHERE id=$1',
      [legacy,fields.description,fields.money_in,fields.money_out]);
    const held=await request(f.company,'/bank-statements/import-review','POST',{...body,request_id:randomUUID()});
    assert.equal(held.status,409,JSON.stringify(held));assert.equal(held.error.code,'BANK_IMPORT_LEGACY_HISTORY_UNKEYABLE');
    await assert.rejects(call(),/BANK_IMPORT_LEGACY_HISTORY_UNKEYABLE/);
  }
  assert.equal((await admin.query('SELECT count(*) n FROM bank_transactions WHERE company_id=$1',[f.company])).rows[0].n,'1');
  assert.equal((await pool.query("SELECT has_function_privilege(current_user,'ledgerly_record_reviewed_bank_import_private(uuid,text,uuid,uuid,jsonb,text)','EXECUTE') allowed")).rows[0].allowed,false);
});
test('adversarial reversal cannot strand already matched statement evidence even after a prior valid review',async()=>{
  const f=await openingFixture();
  const b={id:randomUUID(),kind:'payment',party_type:'customer',party_id:f.customer,payment_id:null,
    date:'2026-10-21',reference:'Matched cash',amount_minor:'10000',allocations:[]};
  await recordPayment(f,b);
  const reverse={...b,id:randomUUID(),kind:'reversal',payment_id:b.id,reference:'Would strand match'};
  const before=await request(f.company,'/accounting-payments/review','POST',reverse);
  assert.equal(before.status,200);
  const batch={request_id:randomUUID(),bank_account_id:f.bank,rows:[
    {date:'2026-10-21',description:'Cash received',reference:'MATCH-25',money_in:'100.00',money_out:'0.00'}]};
  const review=await request(f.company,'/bank-statements/import-review','POST',batch);
  const imported=await request(f.company,'/bank-statements/imports','POST',{...batch,review_token:review.data.review_token});
  const match={request_id:randomUUID(),bank_transaction_id:imported.data.rows[0].id,payment_id:b.id,amount_minor:'10000'};
  const mr=await request(f.company,'/bank-statements/match-review','POST',match);
  assert.equal((await request(f.company,'/bank-statements/matches','POST',{...match,review_token:mr.data.review_token})).status,200);
  for(const path of ['/accounting-payments/review','/accounting-payments']) {
    const rejected=await request(f.company,path,'POST',{...reverse,review_token:before.data.review_token});
    assert.equal(rejected.status,409,JSON.stringify(rejected));assert.equal(rejected.error.code,'PAYMENT_BANK_MATCHED_REVERSAL_UNSUPPORTED');
  }
  const ctx=(await request(f.company,'/bank-statements/context')).data;
  assert.equal(ctx.statements[0].status,'matched');assert.equal(ctx.payments.length,1);
  assert.equal((await admin.query('SELECT count(*) n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n,'1');
  assert.equal((await reports(f.company,actor,'2026-01-01','2026-12-31')).cash.balance_minor,'10000');
});
test('native statement import preview, duplicates and partial matching preserve existing payment journals and recover exactly once',async()=>{
  const f=await openingFixture();
  const invoice=await create(f,'sales_invoice',source(f.customer));
  await post(f,invoice);
  const b=paymentIntent(f,invoice,'12000','12000');
  const recorded=await recordPayment(f,b);
  const snapshot=async()=>({
    journals:(await admin.query('SELECT * FROM canonical_journal_entries WHERE company_id=$1 ORDER BY id',[f.company])).rows,
    lines:(await admin.query('SELECT * FROM canonical_journal_lines WHERE company_id=$1 ORDER BY id',[f.company])).rows,
    payments:(await admin.query('SELECT * FROM accounting_payment_events WHERE company_id=$1 ORDER BY id',[f.company])).rows,
  });
  const before=await snapshot();
  const row={date:'2026-10-21',description:'Synthetic settlement',reference:'BANK-1',money_in:'120.00',money_out:'0.00'};
  const batch={request_id:randomUUID(),bank_account_id:f.bank,rows:[row]};
  assert.equal((await request(f.company,'/bank-statements/import-review','POST',batch,undefined,null)).status,401);
  assert.equal((await request(f.company,'/bank-statements/import-review','POST',batch,undefined,readOnly)).status,403);
  const invalid=await request(f.company,'/bank-statements/import-review','POST',{...batch,rows:[row,{...row,money_in:'0.001'}]});
  assert.equal(invalid.status,422);
  const preview=await request(f.company,'/bank-statements/import-review','POST',batch);
  assert.equal(preview.status,200,JSON.stringify(preview));assert.equal(preview.data.can_import,true);
  assert.equal((await admin.query('SELECT count(*) n FROM bank_transactions WHERE company_id=$1',[f.company])).rows[0].n,'0');
  const command={...batch,review_token:preview.data.review_token};
  const imported=await request(f.company,'/bank-statements/imports','POST',command);
  assert.equal(imported.status,200,JSON.stringify(imported));const statement=imported.data.rows[0].id;
  assert.deepEqual((await request(f.company,'/bank-statements/imports','POST',command)).data,imported.data);
  assert.deepEqual((await request(f.company,`/bank-statements/imports/${batch.request_id}`)).data,imported.data);
  const duplicate=await request(f.company,'/bank-statements/import-review','POST',{...batch,request_id:randomUUID()});
  assert.equal(duplicate.data.can_import,false);assert.equal(duplicate.data.duplicates.length,1);
  assert.equal((await request(f.company,'/bank-statements/imports','POST',{...batch,request_id:randomUUID(),review_token:duplicate.data.review_token})).status,409);
  const match={request_id:randomUUID(),bank_transaction_id:statement,payment_id:b.id,amount_minor:'7000'};
  const review=await request(f.company,'/bank-statements/match-review','POST',match);
  assert.equal(review.status,200,JSON.stringify(review));
  assert.equal(review.data.statement_remaining_minor,'5000');
  assert.equal((await request(f.company,`/bank-statements/matches/${match.request_id}`)).data.status,'unknown');
  const matchCommand={...match,review_token:review.data.review_token};
  const outcomes=await Promise.all([request(f.company,'/bank-statements/matches','POST',matchCommand),request(f.company,'/bank-statements/matches','POST',matchCommand)]);
  for(const outcome of outcomes)assert.equal(outcome.status,200,JSON.stringify(outcome));
  assert.deepEqual(outcomes[0].data,outcomes[1].data);
  assert.deepEqual((await request(f.company,`/bank-statements/matches/${match.request_id}`)).data,outcomes[0].data);
  let ctx=(await request(f.company,'/bank-statements/context')).data;
  assert.equal(ctx.statements[0].status,'partial');assert.equal(ctx.statements[0].remaining_minor,'5000');
  assert.equal(ctx.payments[0].remaining_minor,'5000');
  assert.equal((await request(f.company,'/bank-statements/matches','POST',{...matchCommand,amount_minor:'6000'})).status,409);
  const remainder={...match,request_id:randomUUID(),amount_minor:'5000'};
  const finalReview=await request(f.company,'/bank-statements/match-review','POST',remainder);
  assert.equal((await request(f.company,'/bank-statements/matches','POST',{...remainder,review_token:finalReview.data.review_token})).status,200);
  ctx=(await request(f.company,'/bank-statements/context')).data;
  assert.equal(ctx.statements[0].status,'matched');assert.equal(ctx.payments[0].remaining_minor,'0');
  assert.equal(ctx.matches.length,2);
  assert.deepEqual(await snapshot(),before,'Matching must not alter or create any financial effect');
  await assert.rejects(admin.query("UPDATE bank_transactions SET description='changed' WHERE id=$1",[statement]),/immutable/);
  await assert.rejects(admin.query('DELETE FROM bank_transactions WHERE id=$1',[statement]),/immutable/);
  await assert.rejects(admin.query("UPDATE accounting_bank_matches SET amount_minor=1 WHERE company_id=$1",[f.company]),/immutable/);
  const r=await reports(f.company,actor,'2026-01-01','2026-12-31');
  assert.equal(r.cash.balance_minor,'12000');
  assert.equal(r.open_items.find((d:any)=>d.id===invoice.id).open_minor,'0');
  assert.equal(recorded.journal_id,ctx.matches[0].journal_id);
});
test('native statement matching rejects cross-company, stale capacity, wrong direction and rolls back receipt failures',async()=>{
  const f=await openingFixture(),other=await openingFixture();
  const b={id:randomUUID(),kind:'payment',party_type:'supplier',party_id:f.supplier,payment_id:null,
    date:'2026-10-21',reference:'Synthetic supplier cash',amount_minor:'6000',allocations:[]};
  const p=await request(f.company,'/accounting-payments/review','POST',b);
  assert.equal((await request(f.company,'/accounting-payments','POST',{...b,review_token:p.data.review_token})).status,200);
  const batch={request_id:randomUUID(),bank_account_id:f.bank,rows:[
    {date:'2026-10-21',description:'Supplier part1',reference:'B1',money_in:'0',money_out:'40'},
    {date:'2026-10-21',description:'Supplier part2',reference:'B2',money_in:'0',money_out:'20'},
    {date:'2026-10-21',description:'Wrong direction',reference:'B3',money_in:'60',money_out:'0'}]};
  const review=await request(f.company,'/bank-statements/import-review','POST',batch);
  const imported=await request(f.company,'/bank-statements/imports','POST',{...batch,review_token:review.data.review_token});
  assert.equal(imported.status,200,JSON.stringify(imported));
  const rows=imported.data.rows;
  const first={request_id:randomUUID(),bank_transaction_id:rows[0].id,payment_id:b.id,amount_minor:'4000'};
  assert.equal((await request(other.company,'/bank-statements/match-review','POST',first)).status,404);
  assert.equal((await request(f.company,'/bank-statements/match-review','POST',first,undefined,readOnly)).status,403);
  assert.equal((await request(f.company,'/bank-statements/match-review','POST',{...first,bank_transaction_id:rows[2].id})).status,422);
  const second={...first,request_id:randomUUID(),bank_transaction_id:rows[1].id,amount_minor:'2000'};
  const r1=await request(f.company,'/bank-statements/match-review','POST',first),r2=await request(f.company,'/bank-statements/match-review','POST',second);
  failNextCredit=true;
  assert.equal((await request(f.company,'/bank-statements/matches','POST',{...first,review_token:r1.data.review_token})).status,500);
  assert.equal((await request(f.company,`/bank-statements/matches/${first.request_id}`)).data.status,'unknown');
  assert.equal((await request(f.company,'/bank-statements/matches','POST',{...first,review_token:r1.data.review_token})).status,200);
  assert.equal((await request(f.company,'/bank-statements/matches','POST',{...second,review_token:r2.data.review_token})).status,409);
  const fresh=await request(f.company,'/bank-statements/match-review','POST',second);
  assert.equal((await request(f.company,'/bank-statements/matches','POST',{...second,review_token:fresh.data.review_token})).status,200);
  await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2',[f.company,actor]);
  assert.equal((await request(f.company,`/bank-statements/matches/${first.request_id}`)).status,404);
  assert.equal((await request(f.company,'/bank-statements/matches','POST',{...first,review_token:r1.data.review_token})).status,404);
});
test('bank opening native review-confirm, concurrent replay, recovery and historical reports use a single balanced journal',async()=>{
  const f=await openingFixture();
  assert.equal((await request(f.company,'/opening-balances/review','POST',f.body,undefined,null)).status,401);
  assert.equal((await request(f.company,'/opening-balances/review','POST',f.body,undefined,readOnly)).status,403);
  const review=await request(f.company,'/opening-balances/review','POST',f.body);
  assert.equal(review.status,200,JSON.stringify(review));
  assert.deepEqual(review.data.lines.map((l:any)=>[l.debitMinor,l.creditMinor]),[['12345','0'],['0','12345']]);
  assert.equal((await request(f.company,`/opening-balances/${f.bank}`)).data.status,'unknown');
  const body={...f.body,review_token:review.data.review_token};
  const results=await Promise.all([request(f.company,'/opening-balances','POST',body),request(f.company,'/opening-balances','POST',body)]);
  for(const result of results) assert.equal(result.status,200,JSON.stringify(result));
  assert.equal(results[0].data.journal_id,results[1].data.journal_id);
  const recovered=await request(f.company,`/opening-balances/${f.bank}`,undefined,undefined,undefined,readOnly);
  assert.equal(recovered.data.journal_id,results[0].data.journal_id);
  assert.equal(recovered.data.balance_minor,'12345');
  assert.equal((await request(f.company,'/opening-balances','POST',{...body,request_id:randomUUID()})).status,409);
  assert.equal((await request(f.company,'/opening-balances','POST',{...body,amount_minor:'100'})).status,409);
  const counts=(await admin.query(`SELECT (SELECT count(*) FROM canonical_journal_entries WHERE company_id=$1) journals,
    (SELECT count(*) FROM canonical_journal_lines WHERE company_id=$1) lines,
    (SELECT count(*) FROM accounting_audit_events WHERE company_id=$1 AND outcome='posted') audits`,[f.company])).rows[0];
  assert.deepEqual(counts,{journals:'1',lines:'2',audits:'1'});
  const before=await reports(f.company,actor,'2026-01-01','2026-01-14');
  const at=await reports(f.company,actor,'2026-01-15','2026-01-15');
  const after=await reports(f.company,actor,'2026-01-16','2026-01-31');
  assert.equal(before.cash.balance_minor,'0');assert.equal(at.cash.balance_minor,'12345');assert.equal(after.cash.balance_minor,'12345');
  assert.deepEqual(at.journal_movements,{debit_minor:'12345',credit_minor:'12345'});
  assert.deepEqual(after.journal_movements,{debit_minor:'0',credit_minor:'0'});
  assert.equal(at.balance_sheet.assets_minor,'12345');assert.equal(at.balance_sheet.equity_minor,'12345');
  assert.equal(at.pnl.profit_minor,'0');
  assert.equal(at.trial_balance.reduce((n:bigint,l:any)=>n+BigInt(l.balance_minor),0n),0n);
  assert.equal(at.vat.box1_pence,'0');assert.equal(at.vat.box4_pence,'0');
  const payment={id:randomUUID(),kind:'payment',party_type:'customer',party_id:f.customer,payment_id:null,
    date:'2026-01-20',reference:'Synthetic cash after opening',amount_minor:'1000',allocations:[]};
  const paymentReview=await request(f.company,'/accounting-payments/review','POST',payment);
  assert.equal(paymentReview.status,200,JSON.stringify(paymentReview));
  assert.equal((await request(f.company,'/accounting-payments','POST',{...payment,review_token:paymentReview.data.review_token})).status,200);
  assert.equal((await request(f.company,`/opening-balances/${f.bank}`)).data.balance_minor,'13345');
  assert.equal((await reports(f.company,actor,'2026-01-01','2026-01-19')).cash.balance_minor,'12345');
  assert.equal((await reports(f.company,actor,'2026-01-01','2026-01-20')).cash.balance_minor,'13345');
  // Changing the current bank mapping must not erase historical bank identity
  // or permit its reuse as a subledger control.
  const newBank=randomUUID();
  await admin.query("INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,'1201','New bank','asset',true)",[newBank,f.company]);
  const config=(await request(f.company,'/accounting-payments/context')).data.configuration;
  assert.equal((await request(f.company,'/accounting-payments/configuration','PUT',{revision:config.revision,
    mappings:{...f.paymentMappings,bank:newBank,supplier_prepayment:f.paymentMappings.bank}})).status,422);
  assert.equal((await request(f.company,'/accounting-payments/configuration','PUT',{revision:config.revision,
    mappings:{...f.paymentMappings,bank:newBank}})).status,200);
  assert.equal((await reports(f.company,actor,'2026-01-01','2026-01-20')).cash.balance_minor,'13345');
  assert.equal((await admin.query('SELECT current_balance FROM bank_accounts WHERE id=$1',[f.bank])).rows[0].current_balance,'999.00');
  await assert.rejects(pool.query('UPDATE accounting_bank_openings SET actor_id=$1 WHERE company_id=$2',['changed',f.company]));
  await assert.rejects(pool.query('DELETE FROM accounting_bank_openings WHERE company_id=$1',[f.company]));
  await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2',[f.company,actor]);
  assert.equal((await request(f.company,'/opening-balances','POST',body)).status,404);
});
test('bank opening rejects closed/stale/foreign/subledger states, rolls back atomically, supports overdraft without VAT or profit',async()=>{
  const f=await openingFixture(),other=await openingFixture();
  for(const change of [{bank_account_id:other.bank},{balancing_account_id:other.equity},
    {bank_ledger_account_id:f.mappings.receivables},{balancing_account_id:f.mappings.revenue},
    {effective_date:'2026-02-30'},{effective_date:'2025-12-31'},{amount_minor:'0'},{amount_minor:'1.5'}]) {
    assert.notEqual((await request(f.company,'/opening-balances/review','POST',{...f.body,...change})).status,200,JSON.stringify(change));
  }
  const body={...f.body,direction:'credit'};
  const first=await request(f.company,'/opening-balances/review','POST',body);assert.equal(first.status,200,JSON.stringify(first));
  await admin.query("UPDATE chart_of_accounts SET name='Changed equity' WHERE id=$1",[f.equity]);
  assert.equal((await request(f.company,'/opening-balances','POST',{...body,review_token:first.data.review_token})).status,409);
  const review=await request(f.company,'/opening-balances/review','POST',body);
  await admin.query("UPDATE accounting_document_periods SET status='CLOSED' WHERE id=$1",[f.period]);
  assert.equal((await request(f.company,'/opening-balances','POST',{...body,review_token:review.data.review_token})).status,409);
  await admin.query("UPDATE accounting_document_periods SET status='OPEN' WHERE id=$1",[f.period]);
  const fresh=await request(f.company,'/opening-balances/review','POST',body);
  const command={...body,review_token:fresh.data.review_token};
  failNext=true;assert.equal((await request(f.company,'/opening-balances','POST',command)).status,500);
  assert.equal((await admin.query('SELECT count(*) n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n,'0');
  assert.equal((await request(f.company,`/opening-balances/${f.bank}`)).data.status,'unknown');
  const posted=await request(f.company,'/opening-balances','POST',command);assert.equal(posted.status,200,JSON.stringify(posted));
  assert.equal(posted.data.balance_minor,'-12345');
  const report=await reports(f.company,actor,'2026-01-01','2026-12-31');
  assert.equal(report.cash.balance_minor,'-12345');assert.equal(report.pnl.profit_minor,'0');
  const secondBank=randomUUID();
  await admin.query("INSERT INTO bank_accounts(id,company_id,account_name,currency,status) VALUES($1,$2,'Second synthetic','GBP','active')",[secondBank,f.company]);
  assert.equal((await request(f.company,'/opening-balances/review','POST',{...body,request_id:randomUUID(),bank_account_id:secondBank})).status,409);
});
function source(party:string,price="120",quantity="1",date="2026-10-21",code="STANDARD_20") {
  return {contract:"w03.draft.v1",currency:"GBP",price_basis:"including_vat",customer_id:party,invoice_number:"SYNTH-"+randomUUID(),
    issue_date:date,due_date:date,payment_terms:0,reference:"",notes:"TEST DATA",line_items:[{description:"Synthetic ordinary supply",quantity,unit_price:price,tax_code:code}]};
}
async function create(f:any,kind:string,src:any,extra:any={}) {
  const r=await request(f.company,"/accounting-documents","POST",{kind,source:src,purchase_vat_eligible:kind==="purchase_bill",...extra});
  assert.equal(r.status,201,JSON.stringify(r));return r.data;
}
async function post(f:any,doc:any,expected=200) {
  const r=await request(f.company,`/accounting-documents/${doc.id}/post`,"POST",{},doc.revision);
  assert.equal(r.status,expected,JSON.stringify(r));return r;
}
async function creditDoc(f:any,original:any,quantity="0.2",date="2026-10-21",refs=[0]) {
  return create(f,original.kind==="sales_invoice"?"sales_credit_note":"supplier_credit_note",
    {...original.source,invoice_number:"CREDIT-"+randomUUID(),issue_date:date,due_date:date,
      line_items:refs.map(i=>({...original.source.line_items[i],quantity}))},
    {original_id:original.id,reason:"Agreed price reduction offset against outstanding liability, no cash refund.",
      adjustment_method:"offset_outstanding",effective_adjustment_date:date,original_line_refs:refs});
}

async function discountCredit(f:any,original:any,type='percentage',value='10',date='2026-10-21') {
  return create(f,original.kind==='sales_invoice'?'sales_credit_note':'supplier_credit_note',
    {...original.source,discount:null,discount_adjustment:{type,value,original_revision:original.revision},
      invoice_number:'DISCOUNT-'+randomUUID(),issue_date:date,due_date:date},
    {original_id:original.id,reason:'Agreed commercial discount after invoice creation',
      adjustment_method:'offset_outstanding',effective_adjustment_date:date,
      original_line_refs:original.source.line_items.map((_:any,i:number)=>i)});
}

test('document capabilities match actual draft and protected posting permissions',async()=>{
  const f=await fixture();
  for(const [role,editDrafts,postDocuments] of [['owner',true,true],['accountant',true,true],['admin',true,false],['read_only',false,false]] as const) {
    const user='discount-role-'+randomUUID();
    await admin.query('INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,$4,true)',[randomUUID(),f.company,user,role]);
    const ctx=await request(f.company,'/accounting-documents/context?kind=purchase_bill','GET',undefined,undefined,user);
    assert.deepEqual(ctx.data.capabilities,{edit_drafts:editDrafts,post_documents:postDocuments});
    const paymentContext=await request(f.company,'/accounting-payments/context','GET',undefined,undefined,user);
    assert.deepEqual(paymentContext.data.capabilities,{configure_payments:editDrafts,review_payments:editDrafts,post_payments:postDocuments});
    const doc=await create(f,'sales_invoice',source(f.customer));
    const changed=await request(f.company,`/accounting-documents/${doc.id}`,'PATCH',
      {source:{contract:'w03.draft.v1',discount:{type:'percentage',value:'10'}}},doc.revision,user);
    assert.equal(changed.status,editDrafts?200:403,JSON.stringify(changed));
    const current=changed.data??doc;
    const posted=await request(f.company,`/accounting-documents/${doc.id}/post`,'POST',{},current.revision,user);
    assert.equal(posted.status,postDocuments?200:403,JSON.stringify(posted));
    await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2',[f.company,user]);
    assert.equal((await request(f.company,'/accounting-documents/context','GET',undefined,undefined,user)).status,404);
    assert.equal((await request(f.company,'/accounting-payments/context','GET',undefined,undefined,user)).status,404);
  }
});

test('all four document drafts edit and reopen with revised totals, stale-write protection and source audit',async()=>{
  const f=await fixture();
  const sale=await create(f,'sales_invoice',source(f.customer)),bill=await create(f,'purchase_bill',source(f.supplier));
  await post(f,sale);await post(f,bill);
  const drafts=[await create(f,'sales_invoice',source(f.customer)),await create(f,'purchase_bill',source(f.supplier)),
    await creditDoc(f,sale),await creditDoc(f,bill)];
  for(const doc of drafts) {
    const input={source:{contract:'w03.draft.v1',reference:'Edited saved draft',line_items:doc.source.line_items.map((l:any)=>({...l,unit_price:'60'}))}};
    const edited=await request(f.company,`/accounting-documents/${doc.id}`,'PATCH',input,doc.revision);
    assert.equal(edited.status,200,JSON.stringify(edited));assert.notEqual(edited.data.revision,doc.revision);
    assert.equal(edited.data.money.gross_pence,doc.kind.includes('credit')?'1200':'6000');
    const reopened=await request(f.company,`/accounting-documents/${doc.id}`);
    assert.deepEqual(reopened.data.source,edited.data.source);assert.deepEqual(reopened.data.money,edited.data.money);
    assert.equal((await request(f.company,`/accounting-documents/${doc.id}`,'PATCH',input,doc.revision)).error.code,'REVISION_CONFLICT');
    const audit=(await admin.query("SELECT before_source,after_source FROM accounting_document_audit WHERE document_id=$1 AND action='edit'",[doc.id])).rows;
    assert.equal(audit.length,1);assert.deepEqual(audit[0].before_source,doc.source);assert.deepEqual(audit[0].after_source,edited.data.source);
    await post(f,edited.data);
    assert.equal((await request(f.company,`/accounting-documents/${doc.id}`,'PATCH',input,edited.data.revision)).error.code,'DOCUMENT_NOT_DRAFT');
  }
});

test('draft discounts allocate mixed VAT in both bases, clear on edit, post balanced, and allow exact full returns',async()=>{
  for(const kind of ['sales_invoice','purchase_bill']) for(const basis of ['excluding_vat','including_vat']) for(const type of ['percentage','amount']) {
    const f=await fixture();await ensureWorkspaceTaxRules(admin,f.company);
    const inclusive=basis==='including_vat';
    const src={...source(kind==='sales_invoice'?f.customer:f.supplier),price_basis:basis,
      discount:{type,value:type==='percentage'?'10':inclusive?'32.50':'30.00'},
      line_items:[['STANDARD_20',inclusive?'120':'100'],['REDUCED_5',inclusive?'105':'100'],['ZERO_0','100']].map(([tax_code,unit_price])=>({description:'Mixed VAT discount '+tax_code,quantity:'1',unit_price,tax_code}))};
    let doc=await create(f,kind,src);
    assert.deepEqual([doc.money.net_pence,doc.money.vat_pence,doc.money.gross_pence],['27000','2250','29250']);
    assert.equal(doc.money.discount.amount_pence,inclusive?'3250':'3000');
    assert.deepEqual((await request(f.company,`/accounting-documents/${doc.id}`)).data.source.discount,src.discount);
    const clear=await request(f.company,`/accounting-documents/${doc.id}`,'PATCH',{source:{contract:'w03.draft.v1',discount:null}},doc.revision);
    assert.equal(clear.status,200,JSON.stringify(clear));assert.equal(clear.data.source.discount,undefined);assert.equal(clear.data.money.gross_pence,'32500');
    const restored=await request(f.company,`/accounting-documents/${doc.id}`,'PATCH',{source:{contract:'w03.draft.v1',discount:src.discount}},clear.data.revision);
    assert.equal(restored.status,200,JSON.stringify(restored));doc=restored.data;await post(f,doc);
    const cr=await create(f,kind==='sales_invoice'?'sales_credit_note':'supplier_credit_note',
      {...doc.source,discount:null,invoice_number:'FULL-DISCOUNTED-RETURN-'+randomUUID()},
      {original_id:doc.id,reason:'Return of entire discounted order',adjustment_method:'offset_outstanding',effective_adjustment_date:'2026-10-21',original_line_refs:[0,1,2]});
    assert.deepEqual([cr.money.net_pence,cr.money.vat_pence,cr.money.gross_pence],['27000','2250','29250']);await post(f,cr);
    const report=(await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-12-31')).data;
    assert.equal(report.open_items.find((d:any)=>d.id===doc.id).open_minor,'0');assert.equal(report.balance_sheet.balanced,true);
    assert.equal(report.pnl.profit_minor,'0');assert.equal(report.vat.box1_pence,'0');assert.equal(report.vat.box4_pence,'0');
    const balance=await admin.query('SELECT total_debit_minor,total_credit_minor FROM canonical_journal_entries WHERE company_id=$1',[f.company]);
    assert.equal(balance.rows.length,2);assert.ok(balance.rows.every(j=>j.total_debit_minor===j.total_credit_minor));
  }
});

test('later percentage and fixed discounts preserve partial payments and original source for invoices and bills',async()=>{
  for(const kind of ['sales_invoice','purchase_bill']) for(const type of ['percentage','amount']) {
    const f=await fixture(),original=await create(f,kind,source(kind==='sales_invoice'?f.customer:f.supplier));await post(f,original);
    const payment=paymentIntent(f,original,'5000','5000');await recordPayment(f,payment);
    const before=(await request(f.company,`/accounting-documents/${original.id}`)).data;
    const paymentBefore=(await admin.query('SELECT * FROM accounting_payment_events WHERE id=$1',[payment.id])).rows;
    const cr=await discountCredit(f,original,type,'10');
    const expected=type==='percentage'?'1200':'1000';
    assert.equal(cr.money.gross_pence,expected);assert.equal(cr.money.discount_adjustment.amount_pence,expected);
    await post(f,cr);assert.equal((await post(f,cr)).data.status,'duplicate');
    assert.deepEqual((await request(f.company,`/accounting-documents/${original.id}`)).data,before);
    assert.deepEqual((await admin.query('SELECT * FROM accounting_payment_events WHERE id=$1',[payment.id])).rows,paymentBefore);
    const report=(await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-12-31')).data;
    const item=report.open_items.find((d:any)=>d.id===original.id);
    assert.deepEqual([item.gross_minor,item.paid_minor,item.credited_minor,item.open_minor],['12000','5000',expected,type==='percentage'?'5800':'6000']);
    assert.equal(report.balance_sheet.balanced,true);assert.equal(item.history.length,2);
    const j=(await request(f.company,`/accounting-journals/${(await request(f.company,`/accounting-documents/${cr.id}`)).data.journal_id}`)).data;
    assert.equal(j.entry.total_debit_minor,j.entry.total_credit_minor);
    assert.equal((await admin.query("SELECT count(*)::int n FROM accounting_document_audit WHERE document_id=$1 AND action='post'",[cr.id])).rows[0].n,1);
  }
});

test('discount credits use original VAT evidence and adjustment date after tax rules change',async()=>{
  const f=await fixture();await ensureWorkspaceTaxRules(admin,f.company);
  const bill=await create(f,'purchase_bill',{...source(f.supplier,'105','1','2026-09-21','REDUCED_5'),
    line_items:[...source(f.supplier,'105','1','2026-09-21','REDUCED_5').line_items,{description:'Zero rated',quantity:'1',unit_price:'100',tax_code:'ZERO_0'}]});await post(f,bill);
  await admin.query("UPDATE vat_tax_rules SET effective_to='2026-09-30' WHERE company_id=$1",[f.company]);
  const cr=await discountCredit(f,bill,'amount','20.50');await post(f,cr);
  assert.deepEqual([cr.money.net_pence,cr.money.vat_pence,cr.money.gross_pence],['2000','50','2050']);
  assert.deepEqual(cr.tax_context.lines.map((l:any)=>l.rate),['5.00','0.00']);
  const old=(await request(f.company,'/accounting-reports?from=2026-09-01&to=2026-09-30')).data;
  assert.equal(old.pnl.expense_minor,'20000');assert.equal(old.vat.box4_pence,'500');
  const now=(await request(f.company,'/accounting-reports?from=2026-10-01&to=2026-10-31')).data;
  assert.equal(now.pnl.expense_minor,'-2000');assert.equal(now.vat.box4_pence,'-50');assert.equal(now.open_items.find((d:any)=>d.id===bill.id).open_minor,'18450');
});

test('competing discounts cannot exceed the balance after a partial payment',async()=>{
  const f=await fixture(),sale=await create(f,'sales_invoice',source(f.customer));await post(f,sale);
  await recordPayment(f,paymentIntent(f,sale,'5000','5000'));
  const first=await discountCredit(f,sale,'amount','50'),second=await discountCredit(f,sale,'amount','50');
  const results=await Promise.all([first,second].map(d=>request(f.company,`/accounting-documents/${d.id}/post`,'POST',{},d.revision)));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(results.find(r=>r.status===409)?.error.code,'DISCOUNT_EXCEEDS_OUTSTANDING');
  const item=(await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-12-31')).data.open_items.find((d:any)=>d.id===sale.id);
  assert.deepEqual([item.paid_minor,item.credited_minor,item.open_minor],['5000','5000','2000']);
});

test('discount failures preserve journal, payments, audit and source; permissions, revisions and periods stay enforced',async()=>{
  const f=await fixture(),other=await fixture(),sale=await create(f,'sales_invoice',source(f.customer));await post(f,sale);
  await recordPayment(f,paymentIntent(f,sale,'5000','5000'));
  const cr=await discountCredit(f,sale);
  const reportBefore=(await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-12-31')).data;
  const path=`/accounting-documents/${cr.id}/post`;
  assert.equal((await request(other.company,path,'POST',{},cr.revision)).status,404);
  assert.equal((await request(f.company,path,'POST',{},cr.revision,readOnly)).status,403);
  assert.equal((await request(f.company,path,'POST',{},randomUUID())).error.code,'REVISION_CONFLICT');
  failNext=true;await post(f,cr,500);
  assert.deepEqual((await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-12-31')).data,reportBefore);
  assert.equal((await request(f.company,`/accounting-documents/${cr.id}`)).data.status,'draft');
  assert.equal((await admin.query("SELECT count(*)::int n FROM accounting_document_audit WHERE document_id=$1 AND action='post'",[cr.id])).rows[0].n,0);
  await admin.query("UPDATE accounting_document_periods SET status='CLOSED' WHERE id=$1",[f.period]);
  assert.equal((await post(f,cr,409)).error.code,'PERIOD_NOT_WRITABLE');
  await admin.query("UPDATE accounting_document_periods SET status='OPEN' WHERE id=$1",[f.period]);
  const stale=await request(f.company,`/accounting-documents/${cr.id}`,'PATCH',
    {source:{contract:'w03.draft.v1',discount_adjustment:{type:'percentage',value:'10',original_revision:randomUUID()}}},cr.revision);
  assert.equal(stale.status,409,JSON.stringify(stale));
  await post(f,cr);
});

test('discounted returned-item claims use the paid-for value and commercial discounts never satisfy those claims',async()=>{
  const f=await fixture();
  const bill=await create(f,'purchase_bill',{...source(f.supplier),discount:{type:'percentage',value:'10'}});await post(f,bill);
  const [claim]=await track(f,bill,claimIntent(bill,[{original_line_ref:0,quantity:'0.5',part_reference:'PART-001',job_reference:'JOB-001'}]));assert.equal(claim.expected.gross_pence,'5400');
  const commercial=await discountCredit(f,bill);await post(f,commercial);
  const fresh=(await claimsFor(f,bill))[0];assert.equal(fresh.status,'awaiting');assert.equal(fresh.candidates.length,0);
  const confirm=await request(f.company,`/credit-claims/${claim.id}/receipts`,'POST',receiptIntent(commercial),claim.revision);
  assert.equal(confirm.status,409,JSON.stringify(confirm));assert.equal(confirm.error.code,'CREDIT_MATCH_INVALID');
  const returned=await create(f,'supplier_credit_note',{...bill.source,discount:null,invoice_number:'DISCOUNTED-RETURN-'+randomUUID(),line_items:[{...bill.source.line_items[0],quantity:'0.5'}]},
    {original_id:bill.id,reason:'Part returned',adjustment_method:'offset_outstanding',effective_adjustment_date:'2026-10-21',original_line_refs:[0]});
  assert.equal(returned.money.gross_pence,'5400');await post(f,returned);
  assert.equal((await request(f.company,`/credit-claims/${claim.id}/receipts`,'POST',receiptIntent(returned),claim.revision)).status,200);
  assert.equal((await claimsFor(f,bill))[0].status,'received');
});

test('legacy draft discount is calculated, saved and reopened rather than silently ignored',async()=>{
  const f=await fixture(),body={...source(f.customer),discount:{type:'percentage',value:'10'}};
  const result=await fetch(base+'/legacy/'+f.company,{method:'POST',headers:{'x-test-actor':actor,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal(result.status,201,await result.clone().text());const saved=(await result.json() as any).data;
  assert.equal(saved.money.gross_pence,'10800');assert.equal(saved.source.discount.value,'10');
  const read=await fetch(base+'/legacy/'+f.company+'/'+saved.id,{headers:{'x-test-actor':actor}});
  assert.equal(read.status,200);const reopened=(await read.json() as any).data;
  assert.deepEqual(reopened.money,saved.money);assert.deepEqual(reopened.source,saved.source);
  assert.equal((await admin.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n,0);
});

test('an audit insert failure atomically rolls back a discount edit and its compatibility projection',async()=>{
  const f=await fixture(),doc=await create(f,'sales_invoice',source(f.customer));
  const before=(await request(f.company,`/accounting-documents/${doc.id}`)).data;
  const projection=(await admin.query('SELECT * FROM sales_invoices WHERE id=$1',[doc.id])).rows;
  const audit=(await admin.query('SELECT * FROM accounting_document_audit WHERE document_id=$1 ORDER BY created_at,id',[doc.id])).rows;
  // Test-only DDL belongs to this disposable database and this one fixture UUID.
  const name='test_discount_audit_'+randomUUID().replaceAll('-','');
  await admin.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic audit failure'; END $$`);
  try {
    await admin.query(`CREATE TRIGGER ${name} BEFORE INSERT ON accounting_document_audit FOR EACH ROW
      WHEN (NEW.document_id='${doc.id}'::uuid AND NEW.action='edit') EXECUTE FUNCTION ${name}()`);
    const edit=await request(f.company,`/accounting-documents/${doc.id}`,'PATCH',
      {source:{contract:'w03.draft.v1',notes:'Must roll back',discount:{type:'amount',value:'12.00'}}},doc.revision);
    assert.equal(edit.status,500,JSON.stringify(edit));
    assert.deepEqual((await request(f.company,`/accounting-documents/${doc.id}`)).data,before);
    assert.deepEqual((await admin.query('SELECT * FROM sales_invoices WHERE id=$1',[doc.id])).rows,projection);
    assert.deepEqual((await admin.query('SELECT * FROM accounting_document_audit WHERE document_id=$1 ORDER BY created_at,id',[doc.id])).rows,audit);
  } finally {
    await admin.query(`DROP TRIGGER IF EXISTS ${name} ON accounting_document_audit`);
    await admin.query(`DROP FUNCTION ${name}()`);
  }
});
test("isolated legacy journal history remains readable but cannot become a financial write bypass",async()=>{
  const f=await fixture();
  const id=randomUUID();
  await admin.query(`INSERT INTO journal_entries(id,company_id,date,description,total_debit,total_credit,status)
    VALUES($1,$2,'2026-10-30','Synthetic archived journal',10,10,'posted')`,[id,f.company]);
  const history=await pool.query('SELECT description,total_debit,total_credit FROM journal_entries WHERE company_id=$1',[f.company]);
  assert.deepEqual(history.rows,[{description:'Synthetic archived journal',total_debit:'10.00',total_credit:'10.00'}]);
  for(const [sql,params] of [
    ['INSERT INTO journal_entries(id,company_id) VALUES($1,$2)',[randomUUID(),f.company]],
    ['UPDATE journal_entries SET total_debit=20 WHERE id=$1',[id]],
    ['DELETE FROM journal_entries WHERE id=$1',[id]],
    ['TRUNCATE journal_entries',[]],
  ] as [string,string[]][]) await assert.rejects(pool.query(sql,params),{code:'42501'});
  assert.equal((await pool.query('SELECT total_debit FROM journal_entries WHERE id=$1',[id])).rows[0].total_debit,'10.00');
  assert.equal((await pool.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n,0);
});

test("four native create/edit/reopen/review/post journeys reconcile ledger, parties, P&L, BS and VAT with idempotent retries",async()=>{
  const f=await fixture();
  let sale=await create(f,"sales_invoice",source(f.customer));
  const edit=await request(f.company,`/accounting-documents/${sale.id}`,"PATCH",{source:{contract:"w03.draft.v1",reference:"Reviewed ordinary completed sale"}},sale.revision);
  assert.equal(edit.status,200,JSON.stringify(edit));sale=edit.data;
  const reopen=await request(f.company,`/accounting-documents/${sale.id}`);
  assert.equal(reopen.data.source.reference,"Reviewed ordinary completed sale");
  const simultaneous=await Promise.all([post(f,sale),post(f,sale)]);
  assert.deepEqual(simultaneous.map(r=>r.data.status).sort(),["duplicate","posted"]);
  const sc=await creditDoc(f,sale);await post(f,sc);
  const bill=await create(f,"purchase_bill",source(f.supplier,"60"));await post(f,bill);
  const pc=await creditDoc(f,bill);await post(f,pc);
  for(const doc of [sale,sc,bill,pc]) {
    const again=await post(f,doc);assert.equal(again.data.status,"duplicate");
    const read=await request(f.company,`/accounting-documents/${doc.id}`);
    assert.equal(read.data.status,"posted");assert.equal(read.data.source.price_basis,"including_vat");
    const j=await request(f.company,`/accounting-journals/${read.data.journal_id}`);
    assert.equal(j.status,200);assert.equal(j.data.entry.source_id,doc.id);
    assert.equal(j.data.entry.total_debit_minor,j.data.entry.total_credit_minor);
    assert.ok(j.data.lines.length>=2);
    const editPosted=await request(f.company,`/accounting-documents/${doc.id}`,"PATCH",{source:{contract:"w03.draft.v1",notes:"Cannot edit"}},doc.revision);
    assert.equal(editPosted.status,409);
  }
  const r=await request(f.company,"/accounting-reports?from=2026-01-01&to=2026-12-31");
  assert.equal(r.status,200,JSON.stringify(r));const d=r.data;
  assert.deepEqual({revenue_minor:d.pnl.revenue_minor,expense_minor:d.pnl.expense_minor,profit_minor:d.pnl.profit_minor},
    {revenue_minor:"8000",expense_minor:"4000",profit_minor:"4000"});
  assert.deepEqual(d.pnl.sections.map((s:any)=>s.total_minor),["8000","0","4000"]);
  assert.equal(d.pnl.gross_profit_minor,"8000");
  assert.deepEqual(d.balance_sheet.sections.map((s:any)=>s.total_minor),["10400","6400","0"]);
  assert.deepEqual([d.vat.box1_pence,d.vat.box4_pence,d.vat.box5_pence,d.vat.box6_pence,d.vat.box7_pence],["1600","800","800","8000","4000"]);
  for(const box of ['1','4']) assert.equal(d.posted_documents.filter((s:any)=>s.vat_box===box)
    .reduce((n:bigint,s:any)=>n+BigInt(s.vat_minor),0n).toString(),d.vat[`box${box}_pence`]);
  assert.equal(d.posted_documents.find((s:any)=>s.id===sc.id).vat_minor,'-400');
  assert.equal(d.posted_documents.find((s:any)=>s.id===pc.id).vat_minor,'-200');
  assert.deepEqual(d.journal_movements,{debit_minor:"21600",credit_minor:"21600"});
  assert.equal(d.trial_balance.reduce((n:any,a:any)=>n+BigInt(a.debit_minor),0n),14400n);
  assert.equal(d.trial_balance.reduce((n:any,a:any)=>n+BigInt(a.credit_minor),0n),14400n);
  assert.equal(d.party_balances.find((p:any)=>p.party_type==="customer").balance_minor,"9600");
  assert.equal(d.party_balances.find((p:any)=>p.party_type==="supplier").balance_minor,"4800");
  assert.equal(d.balance_sheet.balanced,true);assert.equal(d.balance_sheet.net_assets_minor,"9600");
  assert.equal(d.balance_sheet.net_liabilities_minor,"5600");assert.equal(d.balance_sheet.current_earnings_minor,"4000");
  assert.equal(d.balance_sheet.net_vat_payable_minor,"800");
  assert.equal(Number((await admin.query("SELECT count(*) n FROM canonical_journal_entries WHERE company_id=$1",[f.company])).rows[0].n),4);
  assert.equal(Number((await admin.query("SELECT count(*) n FROM accounting_document_sources WHERE company_id=$1 AND status='posted'",[f.company])).rows[0].n),4);
  assert.equal((await admin.query("SELECT coalesce(sum(amount_paid),0)::text paid FROM sales_invoices WHERE company_id=$1",[f.company])).rows[0].paid,"0.00");
  await assert.rejects(()=>pool.query("UPDATE canonical_journal_lines SET debit_minor=0 WHERE company_id=$1",[f.company]),(e:any)=>e.code==="42501");
  await assert.rejects(()=>pool.query("DELETE FROM canonical_journal_entries WHERE company_id=$1",[f.company]),(e:any)=>e.code==="42501");
});
test('demo 5% and zero-rated rules survive repeat setup and reconcile invoices, bills and credits in both price bases', async () => {
  for (const code of ['REDUCED_5', 'ZERO_0']) for (const basis of ['including_vat', 'excluding_vat']) {
    const f = await fixture();
    assert.deepEqual(await ensureWorkspaceTaxRules(admin, f.company), ['REDUCED_5', 'ZERO_0']);
    assert.deepEqual(await ensureWorkspaceTaxRules(admin, f.company), []);
    const reduced = code === 'REDUCED_5';
    const ctx = await request(f.company, '/accounting-documents/context?kind=sales_invoice');
    assert.ok(ctx.data.tax_rules.some((r:any) => r.code === code && Number(r.rate) === (reduced ? 5 : 0)));
    const sale = await create(f, 'sales_invoice', {...source(f.customer, basis === 'including_vat' && reduced ? '105' : '100', '1', '2026-10-21', code), price_basis: basis});
    const bill = await create(f, 'purchase_bill', {...source(f.supplier, basis === 'including_vat' && reduced ? '52.50' : '50', '1', '2026-10-21', code), price_basis: basis});
    assert.equal(sale.money.net_pence, '10000');
    assert.equal(sale.money.vat_pence, reduced ? '500' : '0');
    const draftReports = await request(f.company, '/accounting-reports?from=2026-01-01&to=2026-12-31');
    assert.equal(draftReports.data.pnl.revenue_minor, '0');
    await post(f, sale); await post(f, bill);
    const salesCredit = await creditDoc(f, sale); const supplierCredit = await creditDoc(f, bill);
    await post(f, salesCredit); await post(f, supplierCredit);
    const result = await request(f.company, '/accounting-reports?from=2026-01-01&to=2026-12-31');
    assert.equal(result.status, 200, JSON.stringify(result));
    const r = result.data;
    assert.deepEqual([r.pnl.revenue_minor, r.pnl.expense_minor, r.pnl.profit_minor], ['8000', '4000', '4000']);
    assert.deepEqual([r.vat.box1_pence, r.vat.box4_pence, r.vat.box6_pence, r.vat.box7_pence], [reduced ? '400' : '0', reduced ? '200' : '0', '8000', '4000']);
    assert.equal(r.open_items.find((d:any) => d.id === sale.id).open_minor, reduced ? '8400' : '8000');
    assert.equal(r.open_items.find((d:any) => d.id === bill.id).open_minor, reduced ? '4200' : '4000');
    assert.equal(r.balance_sheet.balanced, true);
    assert.equal(r.general_ledger.length, reduced ? 12 : 8);
  }
});
test("credit retains original tax point, selected original lines and own effective period; movements differ from closing balances",async()=>{
  const f=await fixture();
  const si=await create(f,"sales_invoice",{...source(f.customer,"120","1","2026-09-21"),
    line_items:[...source(f.customer).line_items,{description:"Second original line",quantity:"1",unit_price:"60",tax_code:"STANDARD_20"}]});
  await post(f,si);
  await admin.query("UPDATE vat_tax_rules SET effective_to='2026-09-30' WHERE company_id=$1 AND code='STANDARD_20'",[f.company]);
  const sc=await creditDoc(f,si,"0.2","2026-10-21",[1]);await post(f,sc);
  assert.equal(sc.tax_context.lines[0].rate,"20.00");
  const oct=await request(f.company,"/accounting-reports?from=2026-10-01&to=2026-10-31");
  assert.equal(oct.status,200,JSON.stringify(oct));
  assert.equal(oct.data.pnl.revenue_minor,"-1000");assert.equal(oct.data.vat.box1_pence,"-200");
  assert.equal(oct.data.vat.box6_pence,"-1000");
  assert.equal(oct.data.party_balances[0].balance_minor,"16800");
  assert.equal(oct.data.balance_sheet.net_assets_minor,"16800");
  const sep=await request(f.company,"/accounting-reports?from=2026-09-01&to=2026-09-30");
  assert.equal(sep.data.pnl.revenue_minor,"15000");assert.equal(sep.data.vat.box1_pence,"3000");
  assert.equal(sep.data.party_balances[0].balance_minor,"18000");
});
test("concurrent excessive credits serialize; unallocated/refund/date-substitution credits fail closed",async()=>{
  const f=await fixture(),si=await create(f,"sales_invoice",source(f.customer));await post(f,si);
  const a=await creditDoc(f,si,"0.6"),b=await creditDoc(f,si,"0.6");
  const results=await Promise.all([a,b].map(doc=>request(f.company,`/accounting-documents/${doc.id}/post`,"POST",{},doc.revision)));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(results.find(r=>r.status===409)?.error.code,"CREDIT_EXCEEDS_OUTSTANDING");
  for(const extra of [
    {original_id:null,adjustment_method:"offset_outstanding",effective_adjustment_date:"2026-10-21"},
    {original_id:si.id,adjustment_method:"refund",effective_adjustment_date:"2026-10-21"},
    {original_id:si.id,adjustment_method:"offset_outstanding",effective_adjustment_date:"2026-10-22"},
  ]) {
    const r=await request(f.company,"/accounting-documents","POST",{kind:"sales_credit_note",source:source(f.customer,"120","0.1"),
      reason:"Actual decrease",purchase_vat_eligible:false,...extra});
    assert.equal(r.status,422,JSON.stringify(r));
  }
});
test("failed posting rolls back journal, effect, status and audit; stale source/context and closed periods deny",async()=>{
  const f=await fixture();let si=await create(f,"sales_invoice",source(f.customer));
  failNext=true;await post(f,si,500);
  const counts=await admin.query("SELECT (SELECT count(*) FROM canonical_journal_entries WHERE company_id=$1) journals,(SELECT count(*) FROM accounting_posting_effects WHERE company_id=$1) effects",[f.company]);
  assert.equal(counts.rows[0].journals,"0");assert.equal(counts.rows[0].effects,"0");
  assert.equal((await admin.query("SELECT count(*) n FROM accounting_document_audit WHERE company_id=$1 AND action='post'",[f.company])).rows[0].n,"0");
  assert.equal((await request(f.company,`/accounting-documents/${si.id}`)).data.status,"draft");
  assert.equal((await request(f.company,`/accounting-documents/${si.id}/post`,"POST",{},randomUUID())).error.code,"REVISION_CONFLICT");
  await admin.query("UPDATE accounting_document_periods SET status='CLOSED' WHERE id=$1",[f.period]);
  assert.equal((await post(f,si,409)).error.code,"PERIOD_NOT_WRITABLE");
  await admin.query("UPDATE accounting_document_periods SET status='OPEN' WHERE id=$1",[f.period]);
  await admin.query("UPDATE vat_tax_rules SET label='Changed after review' WHERE company_id=$1 AND code='STANDARD_20'",[f.company]);
  assert.equal((await post(f,si,409)).error.code,"SOURCE_CONTEXT_CHANGED");
  await admin.query("UPDATE vat_tax_rules SET label='STANDARD_20' WHERE company_id=$1 AND code='STANDARD_20'",[f.company]);
  await admin.query("UPDATE accounting_company_configuration SET revision=$2 WHERE company_id=$1",[f.company,randomUUID()]);
  assert.equal((await post(f,si,409)).error.code,"CONFIGURATION_CHANGED");
  const refresh=await request(f.company,`/accounting-documents/${si.id}`,"PATCH",{source:{contract:"w03.draft.v1",reference:"Re-reviewed current configuration"}},si.revision);
  assert.equal(refresh.status,200);si=refresh.data;
  await post(f,si);
});
test("authorization, cross-company IDs, forged journal inputs and generic financial bypasses reject",async()=>{
  const f=await fixture(),foreign=await fixture(),si=await create(f,"sales_invoice",source(f.customer));
  assert.equal((await request(f.company,`/accounting-documents/${si.id}/post`,"POST",{},si.revision,null)).status,401);
  assert.equal((await request(f.company,`/accounting-documents/${si.id}/post`,"POST",{},si.revision,readOnly)).status,403);
  assert.equal((await request(foreign.company,`/accounting-documents/${si.id}`)).status,404);
  assert.equal((await request(foreign.company,`/accounting-documents/${si.id}/post`,"POST",{},si.revision)).status,404);
  assert.equal((await request(f.company,`/accounting-documents/${si.id}/post`,"POST",{lines:[{debit:120}]},si.revision)).status,422);
  for(const entity of ["SalesInvoice","PurchaseBill","SalesCreditNote","SupplierCreditNote","JournalEntry","JournalLine"]) assert.equal(isGenericEntityWriteBlocked(entity),true);
  await admin.query("UPDATE companies SET vat_accounting_basis='cash' WHERE id=$1",[f.company]);
  assert.equal((await post(f,si,422)).error.code,"VAT_SETUP_UNSUPPORTED");
});
test("non-VAT and explicitly nonrecoverable purchase VAT never fabricate input VAT recovery",async()=>{
  const f=await fixture(false);
  const bill=await create(f,"purchase_bill",source(f.supplier,"19.99","2.5","2026-10-21","NO_VAT"),{purchase_vat_eligible:false});
  await post(f,bill);const cr=await creditDoc(f,bill,"0.5");await post(f,cr);
  assert.equal(bill.money.gross_pence,"4998");
  assert.equal((await request(f.company,"/accounting-reports?from=2026-01-01&to=2026-12-31")).data.vat.box4_pence,"0");
  const v=await fixture(),unclaimed=await create(v,"purchase_bill",source(v.supplier,"60"),{purchase_vat_eligible:false});
  await post(v,unclaimed);
  const r=await request(v.company,"/accounting-reports?from=2026-01-01&to=2026-12-31");
  assert.equal(r.data.vat.box4_pence,"0");assert.equal(r.data.pnl.expense_minor,"6000");
});
test("full-schema legacy draft reopen defaults excluding without rewrite and still has no posting",async()=>{
  const f=await fixture();
  const body=source(f.customer,"1.01");delete (body as any).price_basis;
  const r=await fetch(base+"/legacy/"+f.company,{method:"POST",headers:{"x-test-actor":actor,"Content-Type":"application/json"},body:JSON.stringify(body)});
  assert.equal(r.status,201,await r.clone().text());const saved=(await r.json() as any).data;
  await admin.query("UPDATE w03_invoice_drafts SET source=source-'price_basis' WHERE invoice_id=$1",[saved.id]);
  const read=await fetch(base+"/legacy/"+f.company+"/"+saved.id,{headers:{"x-test-actor":actor}});
  const reopened=(await read.json() as any).data;
  assert.equal(read.status,200);assert.equal(reopened.source.price_basis,"excluding_vat");
  assert.equal(reopened.money.gross_pence,"121");
  assert.equal((await request(f.company,`/accounting-documents/${saved.id}`)).error.code,"LEGACY_DRAFT");
  assert.equal((await admin.query("SELECT source ? 'price_basis' present FROM w03_invoice_drafts WHERE invoice_id=$1",[saved.id])).rows[0].present,false);
});
test("reports hold a repeatable-read snapshot while a real native posting commits between ledger and source reads",async()=>{
  const f=await fixture(),si=await create(f,"sales_invoice",source(f.customer));
  const consistent=await reports(f.company,actor,"2026-01-01","2026-12-31",async()=>{await post(f,si);});
  assert.equal(consistent.general_ledger.length,0);
  assert.equal(consistent.party_transactions.length,0);
  assert.equal(consistent.pnl.revenue_minor,"0");
  const after=await request(f.company,"/accounting-reports?from=2026-01-01&to=2026-12-31");
  assert.equal(after.data.pnl.revenue_minor,"10000");
  assert.equal(after.data.party_balances[0].balance_minor,"12000");
  assert.equal((await request(f.company,"/accounting-reports?from=2026-02-31&to=2026-12-31")).status,422);
});
test("explicit eligible UUIDv5 sales/purchase accounts save/reopen; defaults clear overrides; invalid choices have safe field errors",async()=>{
  const f=await fixture(),foreign=await fixture();
  const revenue="96481554-479b-53bc-a074-5eaf00f4f2e0",expense="6f62dfa8-8fd5-5b43-aea0-7ca16cf0f060";
  for(const [id,code,type] of [[revenue,"00-SALES","income"],[expense,"A-COST","expense"]])
    await admin.query("INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,$3,'Synthetic custom account',$4,true)",[id,f.company,code,type]);
  const accounts=await request(f.company,"/accounting-accounts");
  assert.equal(accounts.status,200);
  assert.ok(accounts.data.find((a:any)=>a.id===revenue).eligible_roles.includes("revenue"));
  for(const [kind,party,id,role] of [["sales_invoice",f.customer,revenue,"revenue"],["purchase_bill",f.supplier,expense,"expense"]]) {
    const created=await request(f.company,"/accounting-documents","POST",{kind,source:source(party!),posting_account_id:id});
    assert.equal(created.status,201,JSON.stringify(created));const doc=created.data;
    const reopened=await request(f.company,`/accounting-documents/${doc.id}`);
    assert.equal(reopened.data.posting_accounts[role!],id);
    const cleared=await request(f.company,`/accounting-documents/${doc.id}`,"PATCH",{posting_account_id:null},doc.revision);
    assert.equal(cleared.status,200);
    assert.equal(cleared.data.posting_accounts[role!],f.mappings[role!]);
    for(const bad of [f.mappings.receivables,foreign.mappings.revenue,"not-a-uuid"]) {
      const denied=await request(f.company,"/accounting-documents","POST",{kind,source:source(party!),posting_account_id:bad});
      assert.equal(denied.status,422);assert.equal(denied.error.issues[0].path,"/posting_account_id");
      assert.match(denied.error.message,/account/i);assert.ok(!denied.error.message.includes(bad!));
    }
    await admin.query("UPDATE chart_of_accounts SET is_active=false WHERE id=$1",[id]);
    const inactive=await request(f.company,"/accounting-documents","POST",{kind,source:source(party!),posting_account_id:id});
    assert.equal(inactive.status,422);assert.match(inactive.error.issues[0].message,/inactive/i);
    await admin.query("UPDATE chart_of_accounts SET is_active=true WHERE id=$1",[id]);
  }
});
test("native chart CRUD preserves UUID/history, serializes revisions/code uniqueness, locks classification and groups reports",async()=>{
  const f=await fixture(),other=await fixture();
  const make=(code:string,type="income",group="Custom sales")=>request(f.company,"/accounting-accounts","POST",
    {code,name:"Synthetic custom account",account_type:type,report_group:group,display_order:4});
  let a=(await make("00-a")).data;
  assert.ok(a?.id);assert.equal(a.code,"00-a");
  const duplicate=await make("00-A");assert.equal(duplicate.status,422);assert.equal(duplicate.error.issues[0].path,"/code");
  const concurrent=await Promise.all([make("X-RACE"),make("x-race")]);
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,422]);
  const edits=await Promise.all(["Synthetic renamed one","Synthetic renamed two"].map(name=>request(f.company,
    `/accounting-accounts/${a.id}`,"PATCH",{name},a.revision)));
  assert.deepEqual(edits.map(r=>r.status).sort(),[200,409]);a=edits.find(r=>r.status===200)!.data;
  const retype=await request(f.company,`/accounting-accounts/${a.id}`,"PATCH",{account_type:"expense"},a.revision);
  assert.equal(retype.status,200);assert.equal(retype.data.id,a.id);
  a=(await request(f.company,`/accounting-accounts/${a.id}`,"PATCH",{account_type:"income"},retype.data.revision)).data;
  assert.equal((await request(other.company,`/accounting-accounts/${a.id}`,"PATCH",{name:"Forbidden"},a.revision)).status,404);
  assert.equal((await request(f.company,"/accounting-accounts","POST",{code:"RO",name:"Read only",account_type:"income"},undefined,readOnly)).status,403);
  assert.equal(isGenericEntityWriteBlocked("ChartOfAccount"),true);
  let doc=(await request(f.company,"/accounting-documents","POST",
    {kind:"sales_invoice",source:source(f.customer),posting_account_id:a.id})).data;
  let entered!:()=>void,release!:()=>void;
  const inside=new Promise<void>(r=>entered=r),held=new Promise<void>(r=>release=r);
  pausePosting=async()=>{entered();await held;};
  const posting=post(f,doc);await inside;
  const racedEdit=request(f.company,`/accounting-accounts/${a.id}`,"PATCH",{account_type:"expense"},a.revision);
  try {
    let waiting=false;
    for(let i=0;i<100;i++) {
      waiting=(await admin.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='ledgerly_api' AND wait_event_type='Lock') yes")).rows[0].yes;
      if(waiting) break;await new Promise(r=>setTimeout(r,10));
    }
    assert.equal(waiting,true,"Account edit must actually block behind the canonical company lock");
  } finally {release();pausePosting=undefined;}
  await posting;
  const blocked=await racedEdit;assert.equal(blocked.status,422);assert.equal(blocked.error.issues[0].path,"/account_type");
  const current=(await request(f.company,"/accounting-accounts")).data.find((x:any)=>x.id===a.id);
  const renamed=await request(f.company,`/accounting-accounts/${a.id}`,"PATCH",
    {code:"001-NEW",name:"Synthetic custom sales",report_group:"Owner heading"},current.revision);
  assert.equal(renamed.status,200);
  const direct=(await make("00-DIRECT","cost_of_sales","Direct costs")).data;
  const bill=(await request(f.company,"/accounting-documents","POST",
    {kind:"purchase_bill",source:source(f.supplier,"60"),posting_account_id:direct.id,purchase_vat_eligible:true})).data;
  await post(f,bill);
  const ar=(await request(f.company,"/accounting-accounts")).data.find((x:any)=>x.id===f.mappings.receivables);
  assert.equal((await request(f.company,`/accounting-accounts/${ar.id}`,"PATCH",
    {report_group:"Customer balances"},ar.revision)).status,200);
  const before=await request(f.company,"/accounting-reports?from=2026-01-01&to=2026-12-31");
  assert.equal(before.data.pnl.revenue_minor,"10000");
  assert.equal(before.data.pnl.cost_of_sales_minor,"5000");
  assert.equal(before.data.pnl.gross_profit_minor,"5000");
  assert.equal(before.data.pnl.profit_minor,"5000");
  assert.equal(before.data.general_ledger.find((l:any)=>l.source_id===doc.id).source_number,doc.source.invoice_number);
  assert.equal(before.data.balance_sheet.sections[0].groups.find((g:any)=>g.name==="Customer balances").subtotal_minor,"12000");
  const group=before.data.pnl.sections[0].groups.find((g:any)=>g.name==="Owner heading");
  assert.equal(group.subtotal_minor,"10000");assert.equal(group.accounts[0].code,"001-NEW");
  assert.equal(group.accounts[0].account_id,a.id);
  const archived=await request(f.company,`/accounting-accounts/${a.id}`,"PATCH",{is_active:false},renamed.data.revision);
  assert.equal(archived.status,200);assert.equal(archived.data.eligible_roles.length,0);
  const after=await request(f.company,"/accounting-reports?from=2026-01-01&to=2026-12-31");
  assert.deepEqual(after.data.pnl,before.data.pnl);assert.deepEqual(after.data.balance_sheet,before.data.balance_sheet);
  const mapped=(await request(f.company,"/accounting-accounts")).data.find((x:any)=>x.id===f.mappings.receivables);
  const denied=await request(f.company,`/accounting-accounts/${mapped.id}`,"PATCH",{is_active:false},mapped.revision);
  assert.equal(denied.status,422);assert.equal(denied.error.issues[0].path,"/is_active");
  assert.ok(Number((await admin.query("SELECT count(*) n FROM accounting_chart_audit WHERE company_id=$1",[f.company])).rows[0].n)>0);
  await assert.rejects(()=>pool.query("DELETE FROM accounting_chart_audit WHERE company_id=$1",[f.company]),(e:any)=>e.code==="42501");
});

function paymentIntent(f:any,doc:any,amount='15000',allocate='12000',extra:any={}) {
  return {id:randomUUID(),kind:'payment',party_type:doc.kind==='sales_invoice'?'customer':'supplier',party_id:doc.party_id,
    payment_id:null,date:'2026-10-21',reference:'Synthetic manual payment',amount_minor:amount,
    allocations:BigInt(allocate)>0n?[{document_id:doc.id,amount_minor:allocate}]:[],...extra};
}
async function reviewPayment(f:any,b:any) {
  const r=await request(f.company,'/accounting-payments/review','POST',b);
  assert.equal(r.status,200,JSON.stringify(r));return {...b,review_token:r.data.review_token};
}
async function recordPayment(f:any,b:any) {
  const reviewed=await reviewPayment(f,b);
  const r=await request(f.company,'/accounting-payments','POST',reviewed);
  assert.equal(r.status,200,JSON.stringify(r));return {...r.data,reviewed};
}
test('partial value credits preserve originals and agree across journals, reports, history and legacy balance readers',async()=>{
  const f=await fixture();
  for(const kind of ['sales_invoice','purchase_bill']) {
    const original=await create(f,kind,source(kind==='sales_invoice'?f.customer:f.supplier,'60'));await post(f,original);
    const credit=await create(f,kind==='sales_invoice'?'sales_credit_note':'supplier_credit_note',
      {...original.source,invoice_number:'TEN-POUND-CREDIT-'+randomUUID(),line_items:[{...original.source.line_items[0],unit_price:'10'}]},
      {original_id:original.id,reason:'Agreed £10 price reduction',adjustment_method:'offset_outstanding',effective_adjustment_date:'2026-10-21',original_line_refs:[0]});
    assert.equal(credit.money.gross_pence,'1000');await post(f,credit);
    const table=kind==='sales_invoice'?'sales_invoices':'purchase_bills';
    const projection=async()=> (await admin.query(`SELECT total::text,amount_paid::text,balance_due::text,status FROM ${table} WHERE id=$1`,[original.id])).rows[0];
    assert.deepEqual(await projection(),{total:'60.00',amount_paid:'0.00',balance_due:'50.00',status:'part_paid'});
    let report=(await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-10-21')).data;
    let item=report.open_items.find((d:any)=>d.id===original.id);
    assert.equal(item.settlement,'part_paid');assert.equal(item.open_minor,'5000');assert.equal(item.paid_minor,'0');
    assert.equal(item.history[0].id,credit.id);assert.equal(item.history[0].amount_minor,'1000');
    const payment=paymentIntent(f,original,'2000','2000');await recordPayment(f,payment);
    assert.deepEqual(await projection(),{total:'60.00',amount_paid:'20.00',balance_due:'30.00',status:'part_paid'});
    // A further credit must remain possible after a canonical cash payment.
    const next=await creditDoc(f,original,'0.1');await post(f,next);
    report=(await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-10-21')).data;
    item=report.open_items.find((d:any)=>d.id===original.id);
    assert.equal(item.open_minor,'2400');assert.equal(item.credited_minor,'1600');assert.equal(item.paid_minor,'2000');
    assert.equal(item.history.length,3);assert.equal(item.history.find((e:any)=>e.id===payment.id).amount_minor,'2000');
    assert.equal((await request(f.company,`/accounting-documents/${original.id}`)).data.status,'posted');
    assert.deepEqual(await projection(),{total:'60.00',amount_paid:'20.00',balance_due:'24.00',status:'part_paid'});
    await recordPayment(f,paymentIntent(f,original,'1000','1000',{kind:'unallocation',payment_id:payment.id}));
    assert.deepEqual(await projection(),{total:'60.00',amount_paid:'10.00',balance_due:'34.00',status:'part_paid'});
    const full=await create(f,credit.kind,{...credit.source,invoice_number:'FINAL-CREDIT-'+randomUUID(),line_items:[{...credit.source.line_items[0],unit_price:'34'}]},
      {original_id:original.id,reason:'Remaining agreed reduction',adjustment_method:'offset_outstanding',effective_adjustment_date:'2026-10-21',original_line_refs:[0]});
    await post(f,full);
    assert.deepEqual(await projection(),{total:'60.00',amount_paid:'10.00',balance_due:'0.00',status:'paid'});
    const bank=randomUUID();
    await admin.query(`INSERT INTO bank_transactions(id,company_id,date,description,money_in,money_out,status)
      VALUES($1,$2,'2026-10-21','Synthetic old matching guard',$3,$4,'unmatched')`,[bank,f.company,kind==='sales_invoice'?'1':'0',kind==='purchase_bill'?'1':'0']);
    await assert.rejects(()=>applyReconciliationApproval(bank,[{record_type:kind as any,record_id:original.id}],actor),/Use Payments/);
    await assert.rejects(()=>applyNonPaymentReconciliationMatch(bank,{record_type:credit.kind,record_id:credit.id},actor),/Use Payments/);
    assert.equal((await admin.query('SELECT status FROM bank_transactions WHERE id=$1',[bank])).rows[0].status,'unmatched');
    assert.deepEqual(await projection(),{total:'60.00',amount_paid:'10.00',balance_due:'0.00',status:'paid'});
  }
  const final=(await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-10-21')).data;
  assert.equal(final.balance_sheet.balanced,true);assert.equal(final.pnl.profit_minor,'0');
  assert.equal(final.vat.box1_pence,final.vat.box4_pence);
});
test('bank status and matching metadata cannot settle documents or duplicate recovered payment commands',async()=>{
  for(const kind of ['sales_invoice','purchase_bill']) {
    const f=await fixture();
    const original=await create(f,kind,source(kind==='sales_invoice'?f.customer:f.supplier));await post(f,original);
    const credit=await create(f,kind==='sales_invoice'?'sales_credit_note':'supplier_credit_note',
      {...original.source,invoice_number:'BANK-CREDIT-'+randomUUID(),line_items:[{...original.source.line_items[0],unit_price:'10'}]},
      {original_id:original.id,reason:'Agreed £10 reduction',adjustment_method:'offset_outstanding',effective_adjustment_date:'2026-10-21',original_line_refs:[0]});
    await post(f,credit);
    const reviewed=await reviewPayment(f,paymentIntent(f,original,'2000','2000'));
    // Discard the first outcome, as a caller with a lost response would do.
    assert.equal((await request(f.company,'/accounting-payments','POST',reviewed)).status,200);
    const report=async()=> (await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-10-21')).data;
    const before=await report(),item=before.open_items.find((d:any)=>d.id===original.id);
    assert.equal(item.open_minor,'9000');assert.equal(item.credited_minor,'1000');assert.equal(item.paid_minor,'2000');
    const snapshot=async()=> (await admin.query(`SELECT
      (SELECT count(*)::int FROM accounting_payment_events WHERE company_id=$1) payments,
      (SELECT count(*)::int FROM canonical_journal_entries WHERE company_id=$1) journals,
      (SELECT to_jsonb(t) FROM ${kind==='sales_invoice'?'sales_invoices':'purchase_bills'} t WHERE id=$2) document`,[f.company,original.id])).rows[0];
    const financialBefore=await snapshot(),bank=randomUUID();
    await admin.query(`INSERT INTO bank_transactions(id,company_id,date,money_in,money_out,status)
      VALUES($1,$2,'2026-10-21',$3,$4,'unmatched')`,[bank,f.company,kind==='sales_invoice'?'90':'0',kind==='purchase_bill'?'90':'0']);
    // Deliberately corrupt only synthetic bank labels through fixture administration.
    // The application must never grant this write a financial effect.
    for(const status of ['matched','reconciled','unmatched']) {
      await admin.query('UPDATE bank_transactions SET status=$1,matched_type=$2,matched_record_id=$3 WHERE id=$4',
        [status,kind,original.id,bank]);
      assert.deepEqual(await report(),before);
      assert.deepEqual(await snapshot(),financialBefore);
    }
    const recovered=await request(f.company,'/accounting-payments','POST',reviewed);
    assert.equal(recovered.status,200);assert.equal(recovered.data.status,'duplicate');assert.equal(recovered.data.id,reviewed.id);
    const conflict=await request(f.company,'/accounting-payments','POST',{...reviewed,reference:'Changed retry intent'});
    assert.equal(conflict.status,409);assert.equal(conflict.error.code,'IDEMPOTENCY_CONFLICT');
    assert.deepEqual(await snapshot(),financialBefore);assert.deepEqual(await report(),before);
  }
});
test('W06 customer excess, refunds, later allocations and undo reconcile cash, statements and historical VAT',async()=>{
  const f=await fixture(),sale=await create(f,'sales_invoice',source(f.customer));await post(f,sale);
  const b=paymentIntent(f,sale);const reviewed=await reviewPayment(f,b);
  const retry=await Promise.all([request(f.company,'/accounting-payments','POST',reviewed),request(f.company,'/accounting-payments','POST',reviewed)]);
  assert.deepEqual(retry.map(r=>r.status),[200,200]);assert.deepEqual(retry.map(r=>r.data.status).sort(),['duplicate','posted']);
  let r=(await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-10-21')).data;
  assert.equal(r.cash.balance_minor,'15000');assert.equal(r.party_balances[0].balance_minor,'0');assert.equal(r.party_balances[0].unapplied_minor,'3000');
  assert.equal(r.open_items[0].settlement,'settled');assert.equal(r.pnl.profit_minor,'10000');assert.equal(r.vat.box1_pence,'2000');
  const refund=paymentIntent(f,sale,'1000','0',{kind:'refund',payment_id:b.id,date:'2026-10-22'});await recordPayment(f,refund);
  const second=await create(f,'sales_invoice',source(f.customer,'24','1','2026-10-22'));await post(f,second);
  const allocation=paymentIntent(f,second,'2000','2000',{kind:'allocation',payment_id:b.id,date:'2026-10-22'});await recordPayment(f,allocation);
  r=(await request(f.company,'/accounting-reports?from=2026-10-22&to=2026-10-22')).data;
  assert.equal(r.cash.balance_minor,'14000');assert.equal(r.party_balances[0].balance_minor,'400');assert.equal(r.party_balances[0].unapplied_minor,'0');
  assert.equal(r.pnl.profit_minor,'2000');assert.equal(r.vat.box1_pence,'400');assert.equal(r.balance_sheet.balanced,true);
  const undo=paymentIntent(f,second,'1000','1000',{kind:'unallocation',payment_id:b.id,date:'2026-10-23'});await recordPayment(f,undo);
  r=(await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-10-23')).data;
  assert.equal(r.party_balances[0].balance_minor,'1400');assert.equal(r.party_balances[0].unapplied_minor,'1000');
  assert.equal(r.cash.balance_minor,'14000');assert.equal(r.pnl.revenue_minor,'12000');assert.equal(r.vat.box1_pence,'2400');
  const old=(await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-10-21')).data;
  assert.equal(old.cash.balance_minor,'15000');assert.equal(old.party_balances[0].unapplied_minor,'3000');
  const tooMuch=await request(f.company,'/accounting-payments/review','POST',paymentIntent(f,second,'1500','1500',{kind:'allocation',payment_id:b.id,date:'2026-10-23'}));
  assert.equal(tooMuch.status,409);
  const lateCredit=await creditDoc(f,second,'0.75','2026-10-23');assert.equal((await post(f,lateCredit,409)).error.code,'CREDIT_EXCEEDS_OUTSTANDING');
  await assert.rejects(()=>pool.query('UPDATE accounting_payment_events SET reference=$1 WHERE id=$2',['tampered',b.id]),(e:any)=>e.code==='42501');
  const replay=await request(f.company,'/accounting-payments','POST',reviewed);assert.equal(replay.data.status,'duplicate');
  const conflict=await request(f.company,'/accounting-payments','POST',{...reviewed,reference:'Changed intent'});assert.equal(conflict.status,409);
  // Changing configuration must not turn historical receivables into bank cash.
  const newAr=randomUUID();
  await admin.query("INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,'new-ar','New receivables','asset',true)",[newAr,f.company]);
  const config=(await request(f.company,'/accounting-configuration')).data;
  assert.equal((await request(f.company,'/accounting-configuration','PUT',{revision:config.revision,mappings:{...f.mappings,receivables:newAr},business_accounting_basis:'accrual'})).status,200);
  const pc=(await request(f.company,'/accounting-payments/context')).data.configuration;
  const reuse=await request(f.company,'/accounting-payments/configuration','PUT',{revision:pc.revision,mappings:{...f.paymentMappings,bank:f.mappings.receivables}});
  assert.equal(reuse.error.code,'PAYMENT_CONTROL_ACCOUNT_CONFLICT');
});
test('W06 supplier prepayment and refund, full unallocation and reversal preserve profit and tax',async()=>{
  const f=await fixture(),bill=await create(f,'purchase_bill',source(f.supplier,'60'));await post(f,bill);
  const b=paymentIntent(f,bill,'8000','6000');await recordPayment(f,b);
  await recordPayment(f,paymentIntent(f,bill,'500','0',{kind:'refund',payment_id:b.id,date:'2026-10-22'}));
  let r=(await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-10-22')).data;
  assert.equal(r.cash.balance_minor,'-7500');assert.equal(r.party_balances[0].unapplied_minor,'1500');
  assert.equal(r.party_balances[0].balance_minor,'0');assert.equal(r.pnl.expense_minor,'5000');assert.equal(r.vat.box4_pence,'1000');
  const reversal=await request(f.company,'/accounting-payments/review','POST',paymentIntent(f,bill,'8000','0',{kind:'reversal',payment_id:b.id,date:'2026-10-22'}));
  assert.equal(reversal.status,409);
  const sale=await create(f,'sales_invoice',source(f.customer));await post(f,sale);
  const receipt=paymentIntent(f,sale,'12000','12000');await recordPayment(f,receipt);
  await recordPayment(f,paymentIntent(f,sale,'12000','12000',{kind:'unallocation',payment_id:receipt.id,date:'2026-10-22'}));
  await recordPayment(f,paymentIntent(f,sale,'12000','0',{kind:'reversal',payment_id:receipt.id,date:'2026-10-22'}));
  r=(await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-10-22')).data;
  assert.equal(r.cash.balance_minor,'-7500');assert.equal(r.party_balances.find((p:any)=>p.party_type==='customer').balance_minor,'12000');
  assert.equal(r.party_balances.find((p:any)=>p.party_type==='customer').unapplied_minor,'0');assert.equal(r.balance_sheet.balanced,true);
  const list=(await request(f.company,'/accounting-payments')).data;
  assert.equal(list.find((p:any)=>p.id===receipt.id).reversed,true);
});
test('W06 rejects stale concurrent allocations, cross-party, read-only, closed-period and rollback failures',async()=>{
  const f=await fixture(),sale=await create(f,'sales_invoice',source(f.customer));await post(f,sale);
  const first=await reviewPayment(f,paymentIntent(f,sale,'12000','12000'));
  const second=await reviewPayment(f,paymentIntent(f,sale,'12000','12000'));
  assert.equal((await request(f.company,'/accounting-payments','POST',first,undefined,readOnly)).status,403);
  assert.equal((await request(f.company,'/accounting-payments','POST',first,undefined,null)).status,401);
  const other=await fixture();assert.equal((await request(other.company,'/accounting-payments/review','POST',paymentIntent(f,sale))).status,404);
  failNext=true;assert.equal((await request(f.company,'/accounting-payments','POST',first)).status,500);
  assert.equal((await admin.query('SELECT count(*) n FROM accounting_payment_events WHERE company_id=$1',[f.company])).rows[0].n,'0');
  const concurrent=await Promise.all([first,second].map(b=>request(f.company,'/accounting-payments','POST',b)));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
  assert.equal((await admin.query('SELECT count(*) n FROM accounting_payment_events WHERE company_id=$1',[f.company])).rows[0].n,'1');
  const credit=await creditDoc(f,sale,'0.1');assert.equal((await post(f,credit,409)).error.code,'CREDIT_EXCEEDS_OUTSTANDING');
  await admin.query("UPDATE accounting_document_periods SET status='CLOSED' WHERE id=$1",[f.period]);
  const closed=await request(f.company,'/accounting-payments/review','POST',paymentIntent(f,sale,'100','0'));
  assert.equal(closed.error.code,'PERIOD_NOT_WRITABLE');
});

function claimIntent(bill:any,lines=[{original_line_ref:0,quantity:'1',part_reference:'PART-001',job_reference:'JOB-001'}]) {
  return {request_id:randomUUID(),bill_id:bill.id,bill_revision:bill.revision,reason:'Synthetic warranty return',
    return_reference:'RN-TEST-001',returned_on:'2026-10-21',expected_by:'2026-11-04',lines};
}
function receiptIntent(credit:any,line=0) {
  return {request_id:randomUUID(),credit_id:credit.id,credit_revision:credit.revision,credit_line_ref:line};
}
async function claimsFor(f:any,bill:any) {
  const result=await request(f.company,`/credit-claims?bill_id=${bill.id}`);
  assert.equal(result.status,200,JSON.stringify(result));return result.data.claims as any[];
}
async function track(f:any,bill:any,body=claimIntent(bill)) {
  const result=await request(f.company,'/credit-claims','POST',body);
  assert.equal(result.status,201,JSON.stringify(result));return claimsFor(f,bill);
}
async function accountingSnapshot(f:any,bill:any) {
  const doc=await request(f.company,`/accounting-documents/${bill.id}`);
  const report=await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-12-31');
  assert.equal(doc.status,200);assert.equal(report.status,200,JSON.stringify(report));
  const projection=(await admin.query('SELECT total,amount_paid,balance_due,status FROM purchase_bills WHERE company_id=$1 AND id=$2',[f.company,bill.id])).rows[0];
  const audit=(await admin.query('SELECT count(*)::int n FROM accounting_audit_events WHERE company_id=$1',[f.company])).rows[0].n;
  return {document:doc.data,report:report.data,projection,audit};
}

test('credit tracking enforces authentication, membership, roles and company boundaries on every operation',async()=>{
  const f=await fixture(),other=await fixture(),bill=await create(f,'purchase_bill',source(f.supplier));await post(f,bill);
  const intent=claimIntent(bill),inactive='synthetic-inactive-tracker';
  await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'owner',false)",[randomUUID(),f.company,inactive]);
  for(const [user,status] of [[null,401],[readOnly,403],['synthetic-outsider',404],[inactive,404]] as const) {
    assert.equal((await request(f.company,'/credit-claims','POST',intent,undefined,user)).status,status);
  }
  assert.equal((await request(other.company,'/credit-claims','POST',intent)).status,404);
  const [claim]=await track(f,bill,intent),credit=await creditDoc(f,bill,'0.2');await post(f,credit);
  for(const [user,status] of [[null,401],[readOnly,403],['synthetic-outsider',404],[inactive,404]] as const) {
    assert.equal((await request(f.company,`/credit-claims/${claim.id}/receipts`,'POST',receiptIntent(credit),claim.revision,user)).status,status);
    assert.equal((await request(f.company,`/credit-claims/${claim.id}/cancel`,'POST',{request_id:randomUUID()},claim.revision,user)).status,status);
  }
  for(const suffix of ['receipts','cancel']) {
    const body=suffix==='receipts'?receiptIntent(credit):{request_id:randomUUID()};
    assert.equal((await request(other.company,`/credit-claims/${claim.id}/${suffix}`,'POST',body,claim.revision)).status,404);
  }
  assert.equal((await request(f.company,'/credit-claims','GET',undefined,undefined,null)).status,401);
  assert.equal((await request(f.company,'/credit-claims','GET',undefined,undefined,'synthetic-outsider')).status,404);
  const reader=await request(f.company,'/credit-claims','GET',undefined,undefined,readOnly);
  assert.equal(reader.status,200);assert.equal(reader.data.can_manage,false);
  assert.equal(reader.data.claims[0].candidates[0].can_confirm,false);
  assert.deepEqual((await request(other.company,`/credit-claims?bill_id=${bill.id}`)).data.claims,[]);
  const foreignBill=await create(other,'purchase_bill',source(other.supplier));await post(other,foreignBill);
  const foreignCredit=await creditDoc(other,foreignBill);await post(other,foreignCredit);
  assert.equal((await request(f.company,`/credit-claims/${claim.id}/receipts`,'POST',receiptIntent(foreignCredit),claim.revision)).status,404);
  assert.equal((await claimsFor(f,bill))[0].receipts.length,0);
  assert.equal((await admin.query('SELECT count(*)::int n FROM supplier_credit_claim_commands WHERE company_id=$1',[f.company])).rows[0].n,1);
});

test('credit tracking allows existing draft-management roles without granting posting capability',async()=>{
  const f=await fixture(),bill=await create(f,'purchase_bill',{...source(f.supplier),line_items:[
    ...source(f.supplier).line_items,{description:'Separate surcharge',quantity:'1',unit_price:'24',tax_code:'STANDARD_20'}]});await post(f,bill);
  for(const [index,role] of ['admin','accountant'].entries()) {
    const user=`synthetic-tracker-${role}`;
    await admin.query('INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,$4,true)',[randomUUID(),f.company,user,role]);
    const intent=claimIntent(bill,[{original_line_ref:index,quantity:'1',part_reference:'',job_reference:''}]);
    assert.equal((await request(f.company,'/credit-claims','POST',intent,undefined,user)).status,201);
  }
  assert.equal((await claimsFor(f,bill)).length,2);
  assert.equal((await admin.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n,1);
});

test('credit tracking retries are idempotent and bind body, actor and current permissions',async()=>{
  const f=await fixture(),bill=await create(f,'purchase_bill',source(f.supplier));await post(f,bill);
  const intent=claimIntent(bill);
  const concurrent=await Promise.all([request(f.company,'/credit-claims','POST',intent),request(f.company,'/credit-claims','POST',intent)]);
  assert.deepEqual(concurrent.map(r=>r.status),[201,201]);assert.deepEqual(concurrent[0].data,concurrent[1].data);
  const changed=await request(f.company,'/credit-claims','POST',{...intent,reason:'Changed return'});
  assert.equal(changed.status,409);assert.equal(changed.error.code,'REQUEST_ID_CONFLICT');
  const secondOwner='synthetic-second-owner';
  await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'owner',true)",[randomUUID(),f.company,secondOwner]);
  assert.equal((await request(f.company,'/credit-claims','POST',intent,undefined,secondOwner)).error.code,'REQUEST_ID_CONFLICT');
  await admin.query("UPDATE company_users SET role='read_only' WHERE company_id=$1 AND user_id=$2",[f.company,actor]);
  try {assert.equal((await request(f.company,'/credit-claims','POST',intent)).status,403);}
  finally {await admin.query("UPDATE company_users SET role='owner' WHERE company_id=$1 AND user_id=$2",[f.company,actor]);}
  assert.equal((await claimsFor(f,bill)).length,1);
  assert.deepEqual((await admin.query('SELECT actor_id,action,claim_ids FROM supplier_credit_claim_commands WHERE company_id=$1',[f.company])).rows,
    [{actor_id:actor,action:'create',claim_ids:concurrent[0].data.ids}]);
});

test('credit tracking races serialize and stale claim or credit revisions fail without duplicate receipts',async()=>{
  const f=await fixture(),bill=await create(f,'purchase_bill',source(f.supplier));await post(f,bill);
  const competing=await Promise.all([request(f.company,'/credit-claims','POST',claimIntent(bill)),request(f.company,'/credit-claims','POST',claimIntent(bill))]);
  assert.deepEqual(competing.map(r=>r.status).sort(),[201,409]);
  const [claim]=await claimsFor(f,bill),credit=await creditDoc(f,bill,'0.2');await post(f,credit);
  const path=`/credit-claims/${claim.id}/receipts`,intent=receiptIntent(credit);
  assert.equal((await request(f.company,path,'POST',intent)).status,428);
  assert.equal((await request(f.company,path,'POST',intent,randomUUID())).error.code,'REVISION_CONFLICT');
  assert.equal((await request(f.company,path,'POST',{...intent,credit_revision:randomUUID()},claim.revision)).error.code,'CREDIT_REVISION_CONFLICT');
  const pair=await Promise.all([request(f.company,path,'POST',intent,claim.revision),request(f.company,path,'POST',{...intent,request_id:randomUUID()},claim.revision)]);
  assert.deepEqual(pair.map(r=>r.status).sort(),[200,409]);
  const [fresh]=await claimsFor(f,bill);assert.equal(fresh.receipts.length,1);assert.notEqual(fresh.revision,claim.revision);
  assert.equal((await request(f.company,path,'POST',receiptIntent(credit),fresh.revision)).error.code,'CREDIT_ALREADY_RECEIVED');
  assert.equal((await request(f.company,`/credit-claims/${claim.id}/cancel`,'POST',{request_id:randomUUID()},claim.revision)).error.code,'REVISION_CONFLICT');
  assert.equal((await admin.query('SELECT count(*)::int n FROM supplier_credit_claim_commands WHERE company_id=$1',[f.company])).rows[0].n,2);
  const winner=pair.find(r=>r.status===200)!;
  // Replay the command that actually won, including its original revision.
  const commands=(await admin.query("SELECT request_id FROM supplier_credit_claim_commands WHERE company_id=$1 AND action='receive'",[f.company])).rows;
  const replay=await request(f.company,path,'POST',{...intent,request_id:commands[0].request_id},claim.revision);
  assert.equal(replay.status,200);assert.deepEqual(replay.data,winner.data);
});

test('credit tracking rolls back claims, receipts, revisions and audit atomically without touching accounting',async()=>{
  const f=await fixture(),bill=await create(f,'purchase_bill',{...source(f.supplier),line_items:[
    ...source(f.supplier).line_items,{description:'Core surcharge',quantity:'1',unit_price:'24',tax_code:'STANDARD_20'}]});await post(f,bill);
  const intent=claimIntent(bill,[0,1].map(original_line_ref=>({original_line_ref,quantity:'1',part_reference:'',job_reference:''})));
  const before=await accountingSnapshot(f,bill);
  const invalid=await request(f.company,'/credit-claims','POST',{...intent,lines:[intent.lines[0],{...intent.lines[1],original_line_ref:99}]});
  assert.equal(invalid.status,422);assert.equal((await claimsFor(f,bill)).length,0);
  failNextCredit=true;assert.equal((await request(f.company,'/credit-claims','POST',intent)).status,500);
  assert.equal((await claimsFor(f,bill)).length,0);
  assert.equal((await admin.query('SELECT count(*)::int n FROM supplier_credit_claim_commands WHERE company_id=$1',[f.company])).rows[0].n,0);
  assert.deepEqual(await accountingSnapshot(f,bill),before);
  const claims=await track(f,bill,intent),claim=claims.find(c=>c.original_line_ref===0),unused=claims.find(c=>c.original_line_ref===1);
  assert.deepEqual(await accountingSnapshot(f,bill),before);
  const credit=await creditDoc(f,bill,'0.2');await post(f,credit);
  const afterPosting=await accountingSnapshot(f,bill),receipt=receiptIntent(credit),path=`/credit-claims/${claim.id}/receipts`;
  failNextCredit=true;assert.equal((await request(f.company,path,'POST',receipt,claim.revision)).status,500);
  let current=(await claimsFor(f,bill)).find(c=>c.id===claim.id);
  assert.equal(current.revision,claim.revision);assert.equal(current.receipts.length,0);
  assert.equal((await admin.query('SELECT count(*)::int n FROM supplier_credit_claim_commands WHERE company_id=$1',[f.company])).rows[0].n,1);
  assert.deepEqual(await accountingSnapshot(f,bill),afterPosting);
  assert.equal((await request(f.company,path,'POST',receipt,claim.revision)).status,200);
  const cancel={request_id:randomUUID()},cancelPath=`/credit-claims/${unused.id}/cancel`;
  failNextCredit=true;assert.equal((await request(f.company,cancelPath,'POST',cancel,unused.revision)).status,500);
  current=(await claimsFor(f,bill)).find(c=>c.id===unused.id);
  assert.equal(current.cancelled,false);assert.equal(current.revision,unused.revision);
  assert.equal((await admin.query('SELECT count(*)::int n FROM supplier_credit_claim_commands WHERE company_id=$1',[f.company])).rows[0].n,2);
  const cancelled=await request(f.company,cancelPath,'POST',cancel,unused.revision);assert.equal(cancelled.status,200);
  assert.deepEqual((await request(f.company,cancelPath,'POST',cancel,unused.revision)).data,cancelled.data);
  assert.equal((await claimsFor(f,bill)).find(c=>c.id===unused.id).cancelled,true);
  assert.equal((await admin.query('SELECT count(*)::int n FROM supplier_credit_claim_commands WHERE company_id=$1',[f.company])).rows[0].n,3);
  assert.deepEqual(await accountingSnapshot(f,bill),afterPosting);
});

test('a reduced-price credit leaves value outstanding and never satisfies a separate surcharge',async()=>{
  const f=await fixture(),bill=await create(f,'purchase_bill',{...source(f.supplier),line_items:[
    {...source(f.supplier).line_items[0],description:'Brake caliper'},
    {description:'Brake caliper surcharge',quantity:'1',unit_price:'24',tax_code:'STANDARD_20'}]});await post(f,bill);
  const [part,surcharge]=(await track(f,bill,claimIntent(bill,[0,1].map(original_line_ref=>({original_line_ref,quantity:'1',part_reference:'',job_reference:''}))))).sort((a,b)=>a.original_line_ref-b.original_line_ref);
  const credit=await create(f,'supplier_credit_note',{...bill.source,invoice_number:'PARTIAL-'+randomUUID(),line_items:[{...bill.source.line_items[0],unit_price:'90'}]},
    {original_id:bill.id,reason:'Partial value credited',adjustment_method:'offset_outstanding',effective_adjustment_date:'2026-10-21',original_line_refs:[0]});await post(f,credit);
  const before=await accountingSnapshot(f,bill);
  assert.equal((await request(f.company,`/credit-claims/${part.id}/receipts`,'POST',receiptIntent(credit),part.revision)).status,200);
  const claims=await claimsFor(f,bill),result=claims.find(c=>c.id===part.id),unmatched=claims.find(c=>c.id===surcharge.id);
  assert.equal(result.status,'partial');assert.equal(result.received_quantity,'1');
  assert.deepEqual(result.remaining,{net_pence:'2500',vat_pence:'500',gross_pence:'3000'});
  assert.equal(unmatched.status,'awaiting');assert.equal(unmatched.remaining.gross_pence,'2400');
  assert.equal(unmatched.receipts.length,0);assert.equal(unmatched.candidates.length,0);
  assert.deepEqual(await accountingSnapshot(f,bill),before);
});

test('historical posted credits are excluded, drafts require posting, and multiple confirmed partial credits complete a claim',async()=>{
  const f=await fixture(),bill=await create(f,'purchase_bill',source(f.supplier));await post(f,bill);
  const historical=await creditDoc(f,bill,'0.1');await post(f,historical);
  const pending=await creditDoc(f,bill,'0.2');
  let [claim]=await track(f,bill,claimIntent(bill,[{original_line_ref:0,quantity:'0.5',part_reference:'',job_reference:''}]));
  assert.deepEqual(claim.baseline_credit_ids,[historical.id]);
  assert.equal(claim.candidates.length,1);assert.equal(claim.candidates[0].credit_id,pending.id);assert.equal(claim.candidates[0].can_confirm,false);
  assert.equal(claim.received.gross_pence,'0');
  const path=`/credit-claims/${claim.id}/receipts`;
  assert.equal((await request(f.company,path,'POST',receiptIntent(historical),claim.revision)).error.code,'CREDIT_PREDATES_CLAIM');
  assert.equal((await request(f.company,path,'POST',receiptIntent(pending),claim.revision)).error.code,'CREDIT_MATCH_INVALID');
  await post(f,pending);
  assert.equal((await request(f.company,path,'POST',receiptIntent(pending),claim.revision)).status,200);
  [claim]=await claimsFor(f,bill);assert.equal(claim.status,'partial');assert.equal(claim.remaining.gross_pence,'3600');
  const finalCredit=await creditDoc(f,bill,'0.3');await post(f,finalCredit);
  assert.equal((await request(f.company,path,'POST',receiptIntent(finalCredit),claim.revision)).status,200);
  [claim]=await claimsFor(f,bill);assert.equal(claim.status,'received');assert.equal(claim.received_quantity,'0.5');
  assert.deepEqual(claim.received,claim.expected);assert.deepEqual(claim.remaining,{net_pence:'0',vat_pence:'0',gross_pence:'0'});
  assert.equal(claim.receipts.length,2);
  assert.equal((await request(f.company,`/credit-claims/${claim.id}/cancel`,'POST',{request_id:randomUUID()},claim.revision)).error.code,'CLAIM_CANNOT_CANCEL');
});

test('fully paid bills can be tracked without changing their accounting or settled status',async()=>{
  const f=await fixture(),bill=await create(f,'purchase_bill',source(f.supplier,'60'));await post(f,bill);
  await recordPayment(f,paymentIntent(f,bill,'6000','6000'));
  const before=await accountingSnapshot(f,bill);assert.equal(before.projection.balance_due,'0.00');assert.equal(before.projection.status,'paid');
  const [claim]=await track(f,bill,claimIntent(bill,[{original_line_ref:0,quantity:'0.5',part_reference:'',job_reference:''}]));
  assert.equal(claim.status,'awaiting');assert.equal(claim.expected.gross_pence,'3000');
  assert.deepEqual(await accountingSnapshot(f,bill),before);
});

test('tracking receipt and command history are immutable and claim financial snapshots cannot be edited by runtime role',async()=>{
  const f=await fixture(),bill=await create(f,'purchase_bill',source(f.supplier));await post(f,bill);
  const [claim]=await track(f,bill),credit=await creditDoc(f,bill,'0.2');await post(f,credit);
  assert.equal((await request(f.company,`/credit-claims/${claim.id}/receipts`,'POST',receiptIntent(credit),claim.revision)).status,200);
  for(const query of [
    "UPDATE supplier_credit_claims SET quantity='999' WHERE company_id=$1",
    "UPDATE supplier_credit_claims SET expected='{}'::jsonb WHERE company_id=$1",
    'DELETE FROM supplier_credit_claims WHERE company_id=$1',
    "UPDATE supplier_credit_receipts SET quantity='999' WHERE company_id=$1",
    'DELETE FROM supplier_credit_receipts WHERE company_id=$1',
    "UPDATE supplier_credit_claim_commands SET action='cancel' WHERE company_id=$1",
    'DELETE FROM supplier_credit_claim_commands WHERE company_id=$1',
  ]) await assert.rejects(()=>pool.query(query,[f.company]),(error:any)=>error.code==='42501');
  await assert.rejects(()=>admin.query("UPDATE supplier_credit_receipts SET quantity='999' WHERE company_id=$1",[f.company]),/immutable/);
  await assert.rejects(()=>admin.query('DELETE FROM supplier_credit_claim_commands WHERE company_id=$1',[f.company]),/immutable/);
  const [after]=await claimsFor(f,bill);assert.equal(after.quantity,'1');assert.equal(after.receipts.length,1);
  assert.equal(after.receipts[0].quantity,'0.2');
});

async function reverseTrackingFixture(f:any,doc:any) {
  const current=(await request(f.company,`/accounting-documents/${doc.id}`)).data;
  return reverseCanonicalJournal({principal:{kind:'user',userId:actor,requestedCompanyId:f.company},requestedCompanyId:f.company,
    originalJournalId:current.journal_id,reason:'Synthetic tracking lifecycle test',postingDate:'2026-10-22',
    economicEffectId:'tracking-reversal-'+randomUUID(),idempotencyKey:'tracking-reversal-'+randomUUID(),configurationVersionId:current.mapping_revision},
  {contextProvider:{async lockForPosting(input,tx){
    const q=queryAdapter(tx);
    const period=(await q.query("SELECT * FROM accounting_document_periods WHERE company_id=$1 AND id=$2 AND status='OPEN' FOR UPDATE",[f.company,f.period])).rows[0];
    const config=(await q.query('SELECT revision FROM accounting_company_configuration WHERE company_id=$1 FOR UPDATE',[f.company])).rows[0];
    const accounts=(await q.query('SELECT id,company_id,is_active FROM chart_of_accounts WHERE company_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',[f.company,input.accountIds])).rows;
    assert.ok(period);assert.ok(config);
    return {authority:{companyId:f.company,financialYearId:period.financial_year_id,accountingPeriodId:period.id,periodStatus:'OPEN' as const,
      configurationVersionId:config.revision,currencyCode:'GBP',accounts:Object.fromEntries(accounts.map(a=>[a.id,{id:a.id,companyId:a.company_id,isActive:a.is_active,isEligible:true,currencyCode:'GBP'}]))},
      recordKeys:[`accounting_document_periods:${period.id}`,`accounting_company_configuration:${f.company}`],capturedToken:{revision:config.revision},
      transactionBound:true as const,lockMode:'FOR UPDATE' as const,validateCurrent:()=>({ok:true as const})};
  }}});
}
test('real canonical reversals invalidate confirmed tracking receipts and prevent reversed bill claims',async()=>{
  const f=await fixture(),bill=await create(f,'purchase_bill',source(f.supplier));await post(f,bill);
  const [claim]=await track(f,bill),credit=await creditDoc(f,bill,'0.2');await post(f,credit);
  assert.equal((await request(f.company,`/credit-claims/${claim.id}/receipts`,'POST',receiptIntent(credit),claim.revision)).status,200);
  assert.equal((await claimsFor(f,bill))[0].status,'partial');
  await reverseTrackingFixture(f,credit);
  const [after]=await claimsFor(f,bill);assert.equal(after.status,'needs_review');assert.equal(after.receipts[0].active,false);
  assert.equal(after.received.gross_pence,'0');assert.equal(after.remaining.gross_pence,'12000');
  const secondBill=await create(f,'purchase_bill',source(f.supplier));await post(f,secondBill);
  await reverseTrackingFixture(f,secondBill);
  const refused=await request(f.company,'/credit-claims','POST',claimIntent(secondBill));
  assert.equal(refused.status,409);assert.equal(refused.error.code,'POSTED_BILL_REQUIRED');
});

function captureUpload() {
  const bytes=Buffer.from('%PDF-1.4\nSYNTHETIC CAPTURE '+randomUUID()+'\n%%EOF');
  return {filename:'Synthetic supplier invoice.pdf',media_type:'application/pdf',content_base64:bytes.toString('base64')};
}
const captureEnvelope=(f:any)=>({kind:'purchase_bill',purchase_vat_eligible:true,source:source(f.supplier)});
async function captured(f:any,upload=captureUpload(),user=actor) {
  const r=await request(f.company,'/document-intake/upload','POST',upload,undefined,user);
  assert.equal(r.status,201,JSON.stringify(r));return r.data.source;
}
async function captureReview(f:any,s:any,envelope=captureEnvelope(f),user=actor) {
  const r=await request(f.company,`/document-intake/${s.id}/review`,'POST',{envelope},undefined,user);
  assert.equal(r.status,200,JSON.stringify(r));
  return {envelope:r.data.envelope,review_fingerprint:r.data.review_fingerprint,
    source_reviewed:true,supplier_confirmed:true,tax_treatment_confirmed:true};
}
test('capture retains exact authenticated evidence and deduplicates concurrent uploads within a company',async()=>{
  const f=await fixture(),other=await fixture(),upload=captureUpload();
  const results=await Promise.all([request(f.company,'/document-intake/upload','POST',upload),request(f.company,'/document-intake/upload','POST',upload)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);
  assert.equal(results[0].data.source.id,results[1].data.source.id);const s=results[0].data.source;
  assert.equal((await admin.query('SELECT count(*)::int n FROM document_intake_audit WHERE source_id=$1',[s.id])).rows[0].n,1);
  const otherSource=await captured(other,upload);assert.notEqual(otherSource.id,s.id);
  assert.equal((await request(other.company,`/document-intake/${s.id}`)).status,404);
  assert.equal((await request(f.company,'/document-intake','GET',undefined,undefined,null)).status,401);
  const read=await request(f.company,'/document-intake');assert.equal(read.data.can_manage,true);
  assert.deepEqual(read.data.provider_status,{ocr:'not_connected',email:'not_connected'});
  assert.equal('content' in read.data.sources[0],false);
  const file=await fetch(base+`/companies/${f.company}/document-intake/${s.id}/content`,{headers:{'x-test-actor':readOnly}});
  assert.equal(file.status,200);assert.match(file.headers.get('content-disposition')??'',/^attachment;/);
  assert.equal(file.headers.get('x-content-type-options'),'nosniff');assert.match(file.headers.get('content-security-policy')??'',/sandbox/);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()),Buffer.from(upload.content_base64,'base64'));
  assert.equal((await fetch(base+`/companies/${f.company}/document-intake/${s.id}/content`)).status,401);
  assert.equal((await request(other.company,`/document-intake/${s.id}/content`)).status,404);
  assert.equal((await request(f.company,'/document-intake/upload','POST',{...upload,media_type:'image/png'})).status,422);
  assert.equal((await request(f.company,'/document-intake/upload','POST',{...upload,content_base64:upload.content_base64+'\n'})).status,422);
  const duplicateJson=await fetch(base+`/companies/${f.company}/document-intake/upload`,{method:'POST',headers:{'x-test-actor':actor,'Content-Type':'application/json'},
    body:'{"filename":"one.pdf","filename":"two.pdf"}'});
  assert.equal(duplicateJson.status,400);assert.equal((await duplicateJson.json() as any).error.code,'DUPLICATE_KEY');
});
test('capture creates exactly one reviewed draft under concurrent retries and never posts',async()=>{
  const f=await fixture(),s=await captured(f),intent=await captureReview(f,s);
  const path=`/document-intake/${s.id}/draft`;
  const pair=await Promise.all([request(f.company,path,'POST',intent,s.revision),request(f.company,path,'POST',intent,s.revision)]);
  assert.deepEqual(pair.map(r=>r.status).sort(),[200,201]);
  assert.equal(pair[0].data.document.id,pair[1].data.document.id);const doc=pair[0].data.document;
  assert.equal(doc.status,'draft');assert.equal(doc.money.gross_pence,'12000');assert.equal(doc.money.vat_pence,'2000');
  assert.equal((await admin.query('SELECT count(*)::int n FROM accounting_document_sources WHERE company_id=$1',[f.company])).rows[0].n,1);
  assert.equal((await admin.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n,0);
  assert.equal((await admin.query("SELECT count(*)::int n FROM document_intake_audit WHERE source_id=$1 AND action='draft_created'",[s.id])).rows[0].n,1);
  assert.equal((await request(f.company,`/document-intake?document_id=${doc.id}`)).data.sources[0].id,s.id);
  const changed=await request(f.company,`/accounting-documents/${doc.id}`,'PATCH',{source:{contract:'w03.draft.v1',notes:'Edited after capture'}},doc.revision);
  assert.equal(changed.status,200);await post(f,changed.data);
  const retry=await request(f.company,path,'POST',intent,s.revision);
  assert.equal(retry.status,200);assert.equal(retry.data.duplicate,true);assert.equal(retry.data.document.status,'posted');
  const altered={...intent,envelope:{...intent.envelope,source:{...intent.envelope.source,reference:'Different intent'}}};
  assert.equal((await request(f.company,path,'POST',altered,s.revision)).error.code,'SOURCE_ALREADY_LINKED');
});
test('capture review rejects missing acknowledgements, stale intent, stale tax and foreign supplier',async()=>{
  const f=await fixture(),other=await fixture(),s=await captured(f),intent=await captureReview(f,s),path=`/document-intake/${s.id}/draft`;
  assert.equal((await request(f.company,path,'POST',intent)).status,428);
  assert.equal((await request(f.company,path,'POST',intent,randomUUID())).error.code,'REVISION_CONFLICT');
  for(const field of ['source_reviewed','supplier_confirmed','tax_treatment_confirmed']) {
    assert.equal((await request(f.company,path,'POST',{...intent,[field]:false},s.revision)).error.code,'REVIEW_REQUIRED');
  }
  assert.equal((await request(f.company,path,'POST',{...intent,envelope:{...intent.envelope,source:{...intent.envelope.source,reference:'changed'}}},s.revision)).error.code,'REVIEW_STALE');
  assert.equal((await request(f.company,`/document-intake/${s.id}/review`,'POST',{envelope:captureEnvelope(other)})).status,422);
  await admin.query("UPDATE vat_tax_rules SET label='Reviewed standard VAT label' WHERE company_id=$1 AND code='STANDARD_20'",[f.company]);
  assert.equal((await request(f.company,path,'POST',intent,s.revision)).error.code,'REVIEW_STALE');
  assert.equal((await admin.query('SELECT count(*)::int n FROM accounting_document_sources WHERE company_id=$1',[f.company])).rows[0].n,0);
});
test('capture draft, compatibility projection, source link and audits roll back together',async()=>{
  const f=await fixture(),s=await captured(f),intent=await captureReview(f,s);
  failNextCapture=true;
  const failed=await request(f.company,`/document-intake/${s.id}/draft`,'POST',intent,s.revision);
  assert.equal(failed.status,500,JSON.stringify(failed));
  for(const table of ['accounting_document_sources','purchase_bills','accounting_document_audit','canonical_journal_entries'])
    assert.equal((await admin.query(`SELECT count(*)::int n FROM ${table} WHERE company_id=$1`,[f.company])).rows[0].n,0,table);
  const row=(await admin.query('SELECT revision,document_id,review_fingerprint FROM document_intake_sources WHERE id=$1',[s.id])).rows[0];
  assert.deepEqual(row,{revision:s.revision,document_id:null,review_fingerprint:null});
  assert.equal((await admin.query('SELECT count(*)::int n FROM document_intake_audit WHERE source_id=$1',[s.id])).rows[0].n,1);
  const retry=await request(f.company,`/document-intake/${s.id}/draft`,'POST',intent,s.revision);assert.equal(retry.status,201,JSON.stringify(retry));
});
test('capture permissions are checked on upload, review and every idempotent retry',async()=>{
  const f=await fixture(),s=await captured(f),intent=await captureReview(f,s),path=`/document-intake/${s.id}/draft`;
  assert.equal((await request(f.company,`/document-intake/${s.id}/review`,'POST',{envelope:intent.envelope},undefined,readOnly)).status,403);
  assert.equal((await request(f.company,path,'POST',intent,s.revision)).status,201);
  for(const [role,allowed] of [['owner',true],['accountant',true],['admin',true],['read_only',false]] as const) {
    const user='capture-role-'+randomUUID();
    await admin.query('INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,$4,true)',[randomUUID(),f.company,user,role]);
    assert.equal((await request(f.company,'/document-intake','GET',undefined,undefined,user)).data.can_manage,allowed);
    assert.equal((await request(f.company,'/document-intake/upload','POST',captureUpload(),undefined,user)).status,allowed?201:403);
    assert.equal((await request(f.company,path,'POST',intent,s.revision,user)).status,allowed?200:403);
    await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2',[f.company,user]);
    assert.equal((await request(f.company,path,'POST',intent,s.revision,user)).status,404);
    assert.equal((await request(f.company,`/document-intake/${s.id}`,'GET',undefined,undefined,user)).status,404);
  }
});
test('capture evidence and audit are immutable and document links enforce tenant identity',async()=>{
  const f=await fixture(),other=await fixture(),s=await captured(f),foreign=await create(other,'purchase_bill',source(other.supplier));
  const token='v1:'+ 'a'.repeat(64)+':'+ 'b'.repeat(64);
  await assert.rejects(pool.query('UPDATE document_intake_sources SET content=$2 WHERE id=$1',[s.id,Buffer.from('tamper')]));
  await assert.rejects(admin.query("UPDATE document_intake_sources SET filename='changed.pdf' WHERE id=$1",[s.id]));
  await assert.rejects(pool.query('UPDATE document_intake_sources SET document_id=$2,review_fingerprint=$3,revision=$4 WHERE id=$1',[s.id,foreign.id,token,randomUUID()]));
  await assert.rejects(admin.query('DELETE FROM document_intake_sources WHERE id=$1',[s.id]));
  await assert.rejects(pool.query('DELETE FROM document_intake_audit WHERE source_id=$1',[s.id]));
  await assert.rejects(admin.query("UPDATE document_intake_audit SET actor_id='tamper' WHERE source_id=$1",[s.id]));
  await assert.rejects(pool.query('TRUNCATE document_intake_audit'));
  await assert.rejects(admin.query('TRUNCATE document_intake_audit'));
  const intent=await captureReview(f,s),created=await request(f.company,`/document-intake/${s.id}/draft`,'POST',intent,s.revision);
  assert.equal(created.status,201,JSON.stringify(created));
  await assert.rejects(admin.query('UPDATE document_intake_sources SET document_id=NULL,review_fingerprint=NULL,revision=$2 WHERE id=$1',[s.id,randomUUID()]));
});
test('captured supplier credits retain original source rates and native settlement controls',async()=>{
  const f=await fixture(),bill=await create(f,'purchase_bill',source(f.supplier));await post(f,bill);
  const s=await captured(f),envelope={kind:'supplier_credit_note',purchase_vat_eligible:true,
    source:{...bill.source,invoice_number:'CAPTURE-CREDIT-'+randomUUID(),line_items:bill.source.line_items.map((l:any)=>({...l,quantity:'0.5'}))},
    original_id:bill.id,original_line_refs:[0],reason:'Returned half of the original supply',
    adjustment_method:'offset_outstanding',effective_adjustment_date:bill.source.issue_date};
  const intent=await captureReview(f,s,envelope);const created=await request(f.company,`/document-intake/${s.id}/draft`,'POST',intent,s.revision);
  assert.equal(created.status,201,JSON.stringify(created));assert.equal(created.data.document.money.gross_pence,'6000');
  assert.equal(created.data.document.money.vat_pence,'1000');await post(f,created.data.document);
  const report=(await request(f.company,'/accounting-reports?from=2026-01-01&to=2026-12-31')).data;
  assert.equal(report.open_items[0].open_minor,'6000');assert.equal(report.vat.box4_pence,'1000');assert.equal(report.balance_sheet.balanced,true);
});

test('paid supplier and customer credits atomically release allocations, preserve cash, replay and rollback',async()=>{
  const {reviewPaidCredit,commitPaidCredit}=await import('./paidCredit');
  for(const kind of ['purchase_bill','sales_invoice']) {
    const f=await fixture(),original=await create(f,kind,source(kind==='sales_invoice'?f.customer:f.supplier));await post(f,original);
    const payment=await recordPayment(f,paymentIntent(f,original,'12000','12000'));
    const credit=await creditDoc(f,original,'0.1','2026-10-22');
    const intent={request_id:randomUUID(),reason:'Return after full payment'};
    const reviewed=await reviewPaidCredit(f.company,actor,credit.id,credit.revision,intent);
    assert.equal(reviewed.credit_minor,'1200');assert.equal(reviewed.released_minor,'1200');assert.equal(reviewed.offset_minor,'0');
    const body={...intent,review_token:reviewed.review_token,releases:reviewed.releases};
    const before=(await admin.query('SELECT * FROM accounting_payment_events WHERE company_id=$1 ORDER BY id',[f.company])).rows;
    const journalCount=async()=>Number((await admin.query('SELECT count(*) n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n);
    const n=await journalCount();
    await assert.rejects(()=>commitPaidCredit(f.company,actor,credit.id,credit.revision,body,async(tx)=>{await queryAdapter(tx).query('SELECT 1/0');}));
    assert.equal(await journalCount(),n);assert.deepEqual((await admin.query('SELECT * FROM accounting_payment_events WHERE company_id=$1 ORDER BY id',[f.company])).rows,before);
    await assert.rejects(()=>commitPaidCredit(f.company,readOnly,credit.id,credit.revision,body));
    await assert.rejects(()=>commitPaidCredit(f.company,actor,credit.id,credit.revision,{...body,releases:[]}), (e:any)=>e.code==='PAID_CREDIT_REVIEW_STALE');
    const simultaneous=await Promise.all([commitPaidCredit(f.company,actor,credit.id,credit.revision,body),commitPaidCredit(f.company,actor,credit.id,credit.revision,body)]);
    assert.deepEqual(simultaneous.map(r=>r.status).sort(),['duplicate','posted']);
    assert.equal((await commitPaidCredit(f.company,actor,credit.id,credit.revision,body)).status,'duplicate');
    await assert.rejects(()=>commitPaidCredit(f.company,actor,credit.id,credit.revision,{...body,reason:'Changed'}),(e:any)=>e.code==='IDEMPOTENCY_CONFLICT');
    assert.equal(await journalCount(),n+2);
    const beforeRelease=await reports(f.company,actor,'2026-10-01','2026-10-21'),afterRelease=await reports(f.company,actor,'2026-10-01','2026-10-22');
    assert.equal(beforeRelease.open_items[0].paid_minor,'12000');assert.equal(beforeRelease.open_items[0].credited_minor,'0');
    assert.equal(afterRelease.open_items[0].paid_minor,'10800');assert.equal(afterRelease.open_items[0].credited_minor,'1200');assert.equal(afterRelease.balance_sheet.balanced,true);
    const foreign=await fixture();await assert.rejects(()=>commitPaidCredit(foreign.company,actor,credit.id,credit.revision,body));
    const payments=(await request(f.company,'/accounting-payments')).data;
    assert.equal(payments[0].amount_minor,'12000');assert.equal(payments[0].unapplied_minor,'1200');assert.equal(payments[0].allocated_minor,'10800');
    assert.deepEqual((await admin.query('SELECT * FROM accounting_payment_events WHERE company_id=$1 AND id=$2',[f.company,payment.id])).rows[0],before[0]);
    await assert.rejects(()=>pool.query('DELETE FROM accounting_paid_credit_operations WHERE company_id=$1',[f.company]));
    await assert.rejects(()=>admin.query('UPDATE accounting_paid_credit_operations SET actor_id=$2 WHERE company_id=$1',[f.company,'changed']));
  }
});


test('competing paid credits and multiple payment releases retain cumulative capacity and stable order',async()=>{
 const {reviewPaidCredit,commitPaidCredit}=await import('./paidCredit');
 const f=await fixture(),original=await create(f,'purchase_bill',source(f.supplier));await post(f,original);
 const first=await recordPayment(f,paymentIntent(f,original,'5000','5000'));
 const second=await recordPayment(f,paymentIntent(f,original,'7000','7000'));
 const credits=await Promise.all([creditDoc(f,original,'0.6','2026-10-22'),creditDoc(f,original,'0.6','2026-10-22')]);
 const reviews:Awaited<ReturnType<typeof reviewPaidCredit>>[]=[];
 for(const c of credits)reviews.push(await reviewPaidCredit(f.company,actor,c.id,c.revision,{request_id:randomUUID(),reason:'Returned items'}));
 assert.deepEqual(reviews[0].releases.map(r=>[r.payment_id,r.amount_minor]),[[first.id,'5000'],[second.id,'2200']]);
 const results=await Promise.allSettled(credits.map((c,i)=>commitPaidCredit(f.company,actor,c.id,c.revision,{...reviews[i].intent,review_token:reviews[i].review_token,releases:reviews[i].releases})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const data=await reports(f.company,actor,'2026-10-01','2026-10-22');assert.equal(data.open_items[0].credited_minor,'7200');assert.equal(data.open_items[0].paid_minor,'4800');assert.equal(data.balance_sheet.balanced,true);
});

test('part-paid excess review includes prior unapplied/refunded money and denies revoked-member replay',async()=>{
 const {reviewPaidCredit,commitPaidCredit}=await import('./paidCredit');
 const f=await fixture(),original=await create(f,'sales_invoice',source(f.customer));await post(f,original);
 const payment=await recordPayment(f,paymentIntent(f,original,'12000','10000'));
 await recordPayment(f,paymentIntent(f,original,'500','0',{kind:'refund',payment_id:payment.id,date:'2026-10-21'}));
 const credit=await creditDoc(f,original,'0.25','2026-10-22');
 const r=await reviewPaidCredit(f.company,actor,credit.id,credit.revision,{request_id:randomUUID(),reason:'Part return'});
 assert.equal(r.credit_minor,'3000');assert.equal(r.offset_minor,'2000');assert.equal(r.released_minor,'1000');assert.equal(r.remaining_minor,'0');
 assert.equal(r.releases[0].before_unapplied_minor,'1500');assert.equal(r.releases[0].after_unapplied_minor,'2500');
 assert.equal(r.releases[0].payment_journal_id,payment.journal_id);assert.equal(r.original_id,original.id);
 const body={...r.intent,review_token:r.review_token,releases:r.releases};await commitPaidCredit(f.company,actor,credit.id,credit.revision,body);
 const payments=(await request(f.company,'/accounting-payments')).data;assert.equal(payments[0].unapplied_minor,'2500');assert.equal(payments[0].refunded_minor,'500');
 await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2',[f.company,actor]);
 try {await assert.rejects(()=>commitPaidCredit(f.company,actor,credit.id,credit.revision,body),(e:any)=>e.code==='RESOURCE_NOT_FOUND');}
 finally {await admin.query('UPDATE company_users SET is_active=true WHERE company_id=$1 AND user_id=$2',[f.company,actor]);}
});

test('paid-credit stale setup, closed period and absent/partial schema commit no effects',async()=>{
 const {reviewPaidCredit,commitPaidCredit}=await import('./paidCredit');
 const f=await fixture(),original=await create(f,'purchase_bill',source(f.supplier));await post(f,original);
 await recordPayment(f,paymentIntent(f,original,'12000','12000'));
 const credit=await creditDoc(f,original,'0.1','2026-10-22');
 const r=await reviewPaidCredit(f.company,actor,credit.id,credit.revision,{request_id:randomUUID(),reason:'Return'});
 const body={...r.intent,review_token:r.review_token,releases:r.releases};
 const snapshot=async()=>({journals:(await admin.query('SELECT id FROM canonical_journal_entries WHERE company_id=$1 ORDER BY id',[f.company])).rows,
   payments:(await admin.query('SELECT * FROM accounting_payment_events WHERE company_id=$1 ORDER BY id',[f.company])).rows,
   credit:(await admin.query('SELECT * FROM accounting_document_sources WHERE company_id=$1 AND id=$2',[f.company,credit.id])).rows});
 const before=await snapshot();
 await admin.query("UPDATE accounting_document_periods SET status='CLOSED' WHERE company_id=$1",[f.company]);
 try {await assert.rejects(()=>commitPaidCredit(f.company,actor,credit.id,credit.revision,body),(e:any)=>e.code==='PERIOD_NOT_WRITABLE');}
 finally {await admin.query("UPDATE accounting_document_periods SET status='OPEN' WHERE company_id=$1",[f.company]);}
 const config=(await request(f.company,'/accounting-payments/context')).data.configuration;
 assert.equal((await request(f.company,'/accounting-payments/configuration','PUT',{revision:config.revision,mappings:config.mappings})).status,200);
 await assert.rejects(()=>commitPaidCredit(f.company,actor,credit.id,credit.revision,body),(e:any)=>e.code==='PAID_CREDIT_REVIEW_STALE');
 await admin.query('ALTER TABLE accounting_paid_credit_operations RENAME TO absent_paid_credit_fixture');
 try {await assert.rejects(()=>commitPaidCredit(f.company,actor,credit.id,credit.revision,body),(e:any)=>e.code==='PAID_CREDIT_SCHEMA_UNAVAILABLE');}
 finally {await admin.query('ALTER TABLE absent_paid_credit_fixture RENAME TO accounting_paid_credit_operations');}
 await admin.query('ALTER TABLE accounting_paid_credit_operations DISABLE TRIGGER accounting_paid_credit_immutable');
 try {await assert.rejects(()=>commitPaidCredit(f.company,actor,credit.id,credit.revision,body),(e:any)=>e.code==='PAID_CREDIT_SCHEMA_INCOMPLETE');}
 finally {await admin.query('ALTER TABLE accounting_paid_credit_operations ENABLE ALWAYS TRIGGER accounting_paid_credit_immutable');}
 assert.deepEqual(await snapshot(),before);
 assert.equal((await admin.query('SELECT count(*)::int n FROM accounting_paid_credit_operations WHERE company_id=$1',[f.company])).rows[0].n,0);
});

test('paid credit and separately reviewed payment unallocation fence competing allocation vectors',async()=>{
 const {reviewPaidCredit,commitPaidCredit}=await import('./paidCredit');
 const {postPayment}=await import('./payments');
 const f=await fixture(),original=await create(f,'purchase_bill',source(f.supplier));await post(f,original);
 const payment=await recordPayment(f,paymentIntent(f,original,'12000','12000'));
 const cashBefore=(await admin.query('SELECT * FROM accounting_payment_events WHERE company_id=$1 AND id=$2',[f.company,payment.id])).rows[0];
 const credit=await creditDoc(f,original,'0.1','2026-10-22');
 const r=await reviewPaidCredit(f.company,actor,credit.id,credit.revision,{request_id:randomUUID(),reason:'Returned part'});
 const independent=await reviewPayment(f,paymentIntent(f,original,'500','500',{kind:'unallocation',payment_id:payment.id,date:'2026-10-22'}));
 const results=await Promise.allSettled([
   commitPaidCredit(f.company,actor,credit.id,credit.revision,{...r.intent,review_token:r.review_token,releases:r.releases}),
   postPayment(f.company,actor,independent),
 ]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 const loser=results.find(x=>x.status==='rejected') as PromiseRejectedResult;
 assert.ok(['PAYMENT_REVIEW_STALE','PAID_CREDIT_REVIEW_STALE'].includes(loser.reason.code),loser.reason.code);
 const creditWon=results[0].status==='fulfilled';
 const data=await reports(f.company,actor,'2026-10-01','2026-10-22'),open=data.open_items[0];
 assert.equal(open.credited_minor,creditWon?'1200':'0');assert.equal(open.paid_minor,creditWon?'10800':'11500');assert.equal(open.open_minor,creditWon?'0':'500');
 const events=(await request(f.company,'/accounting-payments')).data;
 assert.equal(events[0].unapplied_minor,creditWon?'1200':'500');assert.equal(data.balance_sheet.balanced,true);
 assert.deepEqual((await admin.query('SELECT * FROM accounting_payment_events WHERE company_id=$1 AND id=$2',[f.company,payment.id])).rows[0],cashBefore);
 assert.equal((await admin.query('SELECT count(*)::int n FROM accounting_paid_credit_operations WHERE company_id=$1',[f.company])).rows[0].n,creditWon?1:0);
 assert.equal((await admin.query('SELECT count(*)::int n FROM accounting_payment_events WHERE company_id=$1 AND kind=$2',[f.company,'unallocation'])).rows[0].n,1);
 assert.equal((await admin.query('SELECT status FROM accounting_document_sources WHERE company_id=$1 AND id=$2',[f.company,credit.id])).rows[0].status,creditWon?'posted':'draft');
});

test('paid-credit released pools support later allocation, refund and undo without double use or rewriting history',async()=>{
 const {reviewPaidCredit,commitPaidCredit}=await import('./paidCredit');
 for(const kind of ['purchase_bill','sales_invoice']) {
  const f=await fixture(),original=await create(f,kind,source(kind==='sales_invoice'?f.customer:f.supplier));await post(f,original);
  const payment=await recordPayment(f,paymentIntent(f,original,'12000','12000'));
  const credit=await creditDoc(f,original,'0.1','2026-10-22');
  const r=await reviewPaidCredit(f.company,actor,credit.id,credit.revision,{request_id:randomUUID(),reason:'Linked credit on fully paid document; refund reviewed separately'});
  await commitPaidCredit(f.company,actor,credit.id,credit.revision,{...r.intent,review_token:r.review_token,releases:r.releases});
  const frozen=(await admin.query('SELECT * FROM accounting_payment_events WHERE company_id=$1 ORDER BY id',[f.company])).rows;
  const second=await create(f,kind,source(kind==='sales_invoice'?f.customer:f.supplier));await post(f,second);
  const allocation=await recordPayment(f,paymentIntent(f,second,'700','700',{kind:'allocation',payment_id:payment.id,date:'2026-10-23'}));
  const refund=await recordPayment(f,paymentIntent(f,original,'500','0',{kind:'refund',payment_id:payment.id,date:'2026-10-23'}));
  for(const event of [allocation,refund]) {
   const replay=await request(f.company,'/accounting-payments','POST',event.reviewed);
   assert.equal(replay.status,200);assert.equal(replay.data.status,'duplicate');
  }
  const exhausted=await request(f.company,'/accounting-payments/review','POST',paymentIntent(f,original,'1','0',{kind:'refund',payment_id:payment.id,date:'2026-10-23'}));
  assert.equal(exhausted.status,409);assert.equal(exhausted.error.code,'AMOUNT_EXCEEDS_UNAPPLIED');
  const prior=await reports(f.company,actor,'2026-10-01','2026-10-22');
  assert.equal(prior.cash.balance_minor,kind==='sales_invoice'?'12000':'-12000');
  assert.equal(prior.party_balances[0].unapplied_minor,'1200');
  await recordPayment(f,paymentIntent(f,second,'700','700',{kind:'unallocation',payment_id:payment.id,date:'2026-10-24'}));
  const payments=(await request(f.company,'/accounting-payments')).data;
  assert.equal(payments[0].amount_minor,'12000');assert.equal(payments[0].allocated_minor,'10800');
  assert.equal(payments[0].unapplied_minor,'700');assert.equal(payments[0].refunded_minor,'500');
  const reversal=await request(f.company,'/accounting-payments/review','POST',paymentIntent(f,original,'12000','0',{kind:'reversal',payment_id:payment.id,date:'2026-10-24'}));
  assert.equal(reversal.status,409);
  const after=await reports(f.company,actor,'2026-10-01','2026-10-24');
  assert.equal(after.cash.balance_minor,kind==='sales_invoice'?'11500':'-11500');assert.equal(after.balance_sheet.balanced,true);
  const item=after.open_items.find((d:any)=>d.id===original.id);
  assert.equal(item.open_minor,'0');assert.equal(item.credited_minor,'1200');assert.equal(item.paid_minor,'10800');
  assert.deepEqual((await admin.query('SELECT * FROM accounting_payment_events WHERE company_id=$1 AND id=ANY($2::uuid[]) ORDER BY id',[f.company,frozen.map((e:any)=>e.id)])).rows,frozen);
 }
});

test('payment recovery survives actual subprocess restart after a committed response is lost',async()=>{
  const file=path.join(process.cwd(),'generated-artifacts/payment-restart-harness.cjs');
  execFileSync('pnpm',['--filter','@workspace/api-server','exec','esbuild',
    'src/services/accountingDocuments/paymentRestartHarness.ts','--bundle','--platform=node',
    '--format=cjs','--external:pg','--external:@clerk/express','--outfile='+file],{stdio:'pipe'});
  const env={PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C',LC_ALL:'C',
    NODE_ENV:'test',NODE_PATH:path.join(process.cwd(),'artifacts/api-server/node_modules'),
    ACCOUNTING_FLOW_TEST_SOCKET:socket,
    DATABASE_URL:`postgresql://ledgerly_api@localhost/ledgerly_accounting_flow_test?host=${encodeURIComponent(socket)}&port=55441`};
  const children:ChildProcess[]=[];
  async function startChild(){
    const child=fork(file,[],{env,stdio:['ignore','ignore','inherit','ipc']});children.push(child);
    const ready=await new Promise<{port:number,pid:number}>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Restart harness startup timeout')),15000);
      child.once('message',(m:any)=>{clearTimeout(timer);resolve(m);});
      child.once('error',e=>{clearTimeout(timer);reject(e);});
      child.once('exit',()=>{clearTimeout(timer);reject(Error('Restart harness exited before ready'));});
    });
    return {child,...ready};
  }
  async function stop(child:ChildProcess){
    if(child.exitCode!==null||child.signalCode!==null)return;
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>{child.kill('SIGKILL');},5000);
      child.once('exit',()=>{clearTimeout(timer);resolve();});
      child.once('error',e=>{clearTimeout(timer);reject(e);});child.kill('SIGTERM');
    });
  }
  try{
    for(const kind of ['sales_invoice','purchase_bill']){
      const f=await fixture(),foreign=await fixture();
      const doc=await create(f,kind,source(kind==='sales_invoice'?f.customer:f.supplier));await post(f,doc);
      const command=await reviewPayment(f,paymentIntent(f,doc)),first=await startChild();
      await assert.rejects(()=>fetch(`http://127.0.0.1:${first.port}/companies/${f.company}/accounting-payments`,{
        method:'POST',headers:{'Content-Type':'application/json','x-test-actor':actor,'x-test-drop-reply':'yes'},body:JSON.stringify(command)}));
      const events=(await admin.query('SELECT id,journal_id FROM accounting_payment_events WHERE id=$1',[command.id])).rows;
      assert.equal(events.length,1);
      const snapshot=async()=>(await admin.query(`SELECT (SELECT count(*) FROM accounting_payment_events WHERE company_id=$1) events,
        (SELECT count(*) FROM canonical_journal_entries WHERE company_id=$1) journals`,[f.company])).rows;
      const before=await snapshot();await stop(first.child);
      const second=await startChild();assert.notEqual(first.pid,second.pid);
      const lookup=async(company:string,user:string|null=readOnly,id=command.id)=>{
        const r=await fetch(`http://127.0.0.1:${second.port}/companies/${company}/accounting-payments/operations/${id}`,{headers:user?{'x-test-actor':user}:{}});
        return {status:r.status,body:await r.json() as {data:{status:string,id:string,journal_id?:string}}};
      };
      const known=await lookup(f.company);
      assert.equal(known.status,200);assert.deepEqual(known.body.data,{status:'recorded',id:command.id,journal_id:events[0].journal_id});
      assert.equal((await lookup(f.company,null)).status,401);
      assert.equal((await lookup(f.company,'synthetic-no-membership')).status,404);
      assert.equal((await lookup(foreign.company)).body.data.status,'unknown');
      assert.equal((await lookup(f.company,readOnly,randomUUID())).body.data.status,'unknown');
      assert.deepEqual(await snapshot(),before);await stop(second.child);
    }
  }finally{for(const child of children)await stop(child);}
});

test('original payment request recovery survives new sessions without reposting and denies revoked or foreign membership',async()=>{
  const f=await fixture(),other=await fixture();
  for(const kind of ['sales_invoice','purchase_bill']) {
    const original=await create(f,kind,source(kind==='sales_invoice'?f.customer:f.supplier));await post(f,original);
    const reviewed=await reviewPayment(f,paymentIntent(f,original));
    const path=`/accounting-payments/operations/${reviewed.id}`;
    const missing=await request(f.company,path);
    assert.deepEqual(missing.data,{status:'unknown',id:reviewed.id});
    const posted=await request(f.company,'/accounting-payments','POST',reviewed);assert.equal(posted.status,200);
    const before=(await admin.query(`SELECT (SELECT count(*) FROM accounting_payment_events WHERE company_id=$1) events,
      (SELECT count(*) FROM canonical_journal_entries WHERE company_id=$1) journals`,[f.company])).rows;
    // A new authenticated reader/session needs only the original identity, not the reviewed payload.
    const recovered=await request(f.company,path,'GET',undefined,undefined,readOnly);
    assert.equal(recovered.status,200);assert.deepEqual(recovered.data,{status:'recorded',id:reviewed.id,journal_id:posted.data.journal_id});
    assert.equal((await request(f.company,path,'GET',undefined,undefined,null)).status,401);
    assert.deepEqual((await request(other.company,path)).data,{status:'unknown',id:reviewed.id});
    assert.equal((await request(f.company,path,'GET',undefined,undefined,'foreign-user')).status,404);
    await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2',[f.company,readOnly]);
    assert.equal((await request(f.company,path,'GET',undefined,undefined,readOnly)).status,404);
    await admin.query('UPDATE company_users SET is_active=true WHERE company_id=$1 AND user_id=$2',[f.company,readOnly]);
    assert.deepEqual((await admin.query(`SELECT (SELECT count(*) FROM accounting_payment_events WHERE company_id=$1) events,
      (SELECT count(*) FROM canonical_journal_entries WHERE company_id=$1) journals`,[f.company])).rows,before);
    const replay=await request(f.company,'/accounting-payments','POST',reviewed);assert.equal(replay.data.journal_id,posted.data.journal_id);
    const conflict=await request(f.company,'/accounting-payments','POST',{...reviewed,reference:'Different intent'});assert.equal(conflict.status,409);
    assert.deepEqual((await request(f.company,path)).data,recovered.data);
  }
  assert.equal((await request(f.company,'/accounting-payments/operations/not-a-uuid')).status,400);
});

test('rolled-back payment command remains unknown and a same-identity retry recovers its one committed result',async()=>{
  const f=await fixture(),original=await create(f,'sales_invoice',source(f.customer));await post(f,original);
  const reviewed=await reviewPayment(f,paymentIntent(f,original));
  failNext=true;
  assert.equal((await request(f.company,'/accounting-payments','POST',reviewed)).status,500);
  const path=`/accounting-payments/operations/${reviewed.id}`;
  assert.deepEqual((await request(f.company,path)).data,{status:'unknown',id:reviewed.id});
  assert.equal((await admin.query('SELECT id FROM accounting_payment_events WHERE id=$1',[reviewed.id])).rowCount,0);
  const posted=await request(f.company,'/accounting-payments','POST',reviewed);assert.equal(posted.status,200);
  assert.deepEqual((await request(f.company,path)).data,{status:'recorded',id:reviewed.id,journal_id:posted.data.journal_id});
  assert.equal((await admin.query('SELECT id FROM accounting_payment_events WHERE id=$1',[reviewed.id])).rowCount,1);
});

for(const side of ['sales_invoice','purchase_bill']) test(`new discount policy: ${side} rejects fully paid and excess discounts without blocking ordinary credits`,async()=>{
 const {reviewPaidCredit,commitPaidCredit}=await import('./paidCredit');
 const f=await fixture(),original=await create(f,side,source(side==='sales_invoice'?f.customer:f.supplier));await post(f,original);
 const draft=await discountCredit(f,original,'amount','12');
 const review=await reviewPaidCredit(f.company,actor,draft.id,draft.revision,{request_id:randomUUID(),reason:'Discount while unpaid'});
 await recordPayment(f,paymentIntent(f,original,'12000','12000'));
 const before=await reports(f.company,actor,'2026-01-01','2026-12-31');
 const journals=(await admin.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n;
 const fresh=await request(f.company,'/accounting-documents','POST',{kind:side==='sales_invoice'?'sales_credit_note':'supplier_credit_note',
  original_id:original.id,reason:'New discount after full payment',adjustment_method:'offset_outstanding',effective_adjustment_date:'2026-10-21',
  source:{...original.source,invoice_number:'REJECT-'+randomUUID(),discount_adjustment:{type:'amount',value:'12',original_revision:original.revision}}});
 assert.equal(fresh.status,409,JSON.stringify(fresh));assert.equal(fresh.error.code,'DISCOUNT_REQUIRES_UNPAID_BALANCE');
 const direct=await request(f.company,`/accounting-documents/${draft.id}/post`,'POST',{},draft.revision);
 assert.equal(direct.status,409);assert.equal(direct.error.code,'DISCOUNT_REQUIRES_UNPAID_BALANCE');
 await assert.rejects(reviewPaidCredit(f.company,actor,draft.id,draft.revision,{request_id:randomUUID(),reason:'Stale draft'}),{code:'DISCOUNT_REQUIRES_UNPAID_BALANCE'});
 await assert.rejects(commitPaidCredit(f.company,actor,draft.id,draft.revision,{...review.intent,review_token:review.review_token,releases:review.releases}),{code:'DISCOUNT_REQUIRES_UNPAID_BALANCE'});
 assert.deepEqual(await reports(f.company,actor,'2026-01-01','2026-12-31'),before);
 assert.equal((await admin.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n,journals);
 const ordinary=await creditDoc(f,original,'0.1');
 const r=await reviewPaidCredit(f.company,actor,ordinary.id,ordinary.revision,{request_id:randomUUID(),reason:'Linked refund credit'});
 assert.equal(r.released_minor,'1200');
 await commitPaidCredit(f.company,actor,ordinary.id,ordinary.revision,{...r.intent,review_token:r.review_token,releases:r.releases});
 const after=await reports(f.company,actor,'2026-01-01','2026-12-31');
 assert.equal(after.cash.balance_minor,before.cash.balance_minor); // credit is not a cash refund
 assert.equal(after.party_balances[0].unapplied_minor,'1200');
});

for(const side of ['sales_invoice','purchase_bill']) test(`new discount policy: ${side} caps a partial-payment discount at outstanding and preserves replay`,async()=>{
 const {reviewPaidCredit,commitPaidCredit}=await import('./paidCredit');
 const f=await fixture(),original=await create(f,side,source(side==='sales_invoice'?f.customer:f.supplier));await post(f,original);
 const excess=await discountCredit(f,original,'amount','80');
 await recordPayment(f,paymentIntent(f,original,'5000','5000'));
 await assert.rejects(reviewPaidCredit(f.company,actor,excess.id,excess.revision,{request_id:randomUUID(),reason:'Too large'}),{code:'DISCOUNT_EXCEEDS_OUTSTANDING'});
 const exact=await discountCredit(f,original,'amount','70');
 const r=await reviewPaidCredit(f.company,actor,exact.id,exact.revision,{request_id:randomUUID(),reason:'Discount remaining debt'});
 assert.equal(r.released_minor,'0');assert.deepEqual(r.releases,[]);
 const body={...r.intent,review_token:r.review_token,releases:r.releases};
 await commitPaidCredit(f.company,actor,exact.id,exact.revision,body);
 assert.equal((await commitPaidCredit(f.company,actor,exact.id,exact.revision,body)).status,'duplicate');
 const report=await reports(f.company,actor,'2026-01-01','2026-12-31');
 const item=report.open_items.find((d:any)=>d.id===original.id);
 assert.deepEqual([item.paid_minor,item.credited_minor,item.open_minor],['5000','7000','0']);
});
