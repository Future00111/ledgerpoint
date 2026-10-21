import test,{before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import pg from "pg";
import express from "express";
import {pool} from "@workspace/db";
import {createAccountingRouter} from "../../routes/accountingDocuments";
import {InvoiceDraftService} from "../financialDrafts/invoiceService";
import {createProductionInvoiceDraftAuthority} from "../financialDrafts/productionAuthority";
import {invoiceDraftRouter} from "../financialDrafts/router";
import {isGenericEntityWriteBlocked} from "../../routes/entityWritePolicy";
import {queryAdapter} from "./core";
import {reports} from "./reports";
import {ensureWorkspaceTaxRules} from '../../../../../tools/accounting-flow/workspace-tax-rules.mjs';
import {applyReconciliationApproval,applyNonPaymentReconciliationMatch} from '../ai-accountant/approval';

const socket=process.env.ACCOUNTING_FLOW_TEST_SOCKET??"";
if(!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]+\/socket$/.test(socket)) throw Error("Disposable socket required");
const admin=new pg.Pool({host:socket,port:55441,user:"w03_bootstrap",database:"ledgerly_accounting_flow_test",password:"",ssl:false,options:""});
const actor="synthetic-accounting-owner",readOnly="synthetic-accounting-reader";
let server:ReturnType<ReturnType<typeof express>["listen"]>,base:string,failNext=false;
let pausePosting:(()=>Promise<void>)|undefined;
const auth:express.RequestHandler=(req,res,next)=>{
  const user=req.get("x-test-actor");if(!user){res.status(401).json({error:{code:"UNAUTHORIZED"}});return;}
  (req as any).userId=user;next();
};
before(async()=>{
  const identity=(await pool.query("SELECT current_database() db,current_user role,inet_server_addr() addr")).rows[0];
  assert.deepEqual(identity,{db:"ledgerly_accounting_flow_test",role:"ledgerly_api",addr:null});
  const app=express();app.use(express.json());
  app.use("/companies/:companyId",createAccountingRouter(auth,async tx=>{
    if(failNext){failNext=false;await queryAdapter(tx).query("SELECT 1/0");}
    await pausePosting?.();
  }));
  app.use("/legacy/:companyId",invoiceDraftRouter(new InvoiceDraftService(pool,createProductionInvoiceDraftAuthority()),auth));
  server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
  base=`http://127.0.0.1:${(server.address() as any).port}`;
});
after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();await admin.end();});
async function request(company:string,path:string,method="GET",body?:unknown,revision?:string,user:string|null=actor) {
  const response=await fetch(base+"/companies/"+company+path,{method,headers:{
    ...(user?{"x-test-actor":user}:{}),...(body===undefined?{}:{"Content-Type":"application/json"}),
    ...(revision?{"If-Match":`"${revision}"`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json() as any;return {status:response.status,...result};
}
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
