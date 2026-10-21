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

const socket=process.env.ACCOUNTING_FLOW_TEST_SOCKET??"";
if(!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]+\/socket$/.test(socket)) throw Error("Disposable socket required");
const admin=new pg.Pool({host:socket,port:55441,user:"w03_bootstrap",database:"ledgerly_accounting_flow_test",password:"",ssl:false,options:""});
const actor="synthetic-accounting-owner",readOnly="synthetic-accounting-reader";
let server:ReturnType<ReturnType<typeof express>["listen"]>,base:string,failNext=false;
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
  return {company,customer,supplier,mappings,period:period.data.id};
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
  assert.deepEqual(d.pnl,{revenue_minor:"8000",expense_minor:"4000",profit_minor:"4000"});
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
