/** Real SQL/HTTP on a newly initialized private Unix-socket cluster; synthetic authority/auth only. */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import pg from "pg";
import express from "express";
import { InvoiceDraftService, type DraftAuthority } from "./invoiceService";
import { contextRevision, createProductionInvoiceDraftAuthority } from "./productionAuthority";
import { invoiceDraftRouter } from "./router";
import { verifyDraftBody, draftParserErrors } from "./jsonBoundary";
import { fail, draftSourceFingerprint } from "./contract";
import { genericEntityWriteBoundary } from "../../routes/entityWritePolicy";

let dir: string, admin: pg.Pool, runtime: pg.Pool, server: ReturnType<ReturnType<typeof express>["listen"]>;
let base: string, nativeBase: string, company: string, customer: string, noVatCompany: string, noVatCustomer: string;
let auditFailure = false;
let malformedTaxContext = false;
const source = () => ({contract:"w03.draft.v1",currency:"GBP",customer_id:customer,invoice_number:"DRAFT-"+randomUUID(),
  issue_date:"2026-10-20",due_date:"2026-11-20",payment_terms:30,
  line_items:[{description:"Synthetic",quantity:"1",unit_price:"10",tax_code:"SYNTHETIC_20"}]});
const authority: DraftAuthority = {
  async assertWritable(tx, c, id, proposed) {
    if(proposed.issue_date < "2026-01-01") fail(409,"PERIOD_NOT_WRITABLE"); // Synthetic rule, NOT an approved accounting period.
    if(!id) return;
    const link = await tx.query("SELECT invoice_id FROM synthetic_posted_sources WHERE company_id=$1 AND invoice_id=$2 FOR SHARE",[c,id]);
    if(link.rows.length) fail(409,"DOCUMENT_NOT_DRAFT");
  },
  async resolveTax(_tx,_c,input,net) {
    // TEST ONLY; not an approved VAT provider or tax eligibility decision.
    if(input.line_items.some(l=>l.tax_code!=="SYNTHETIC_20")) fail(422,"TAX_TREATMENT_UNSUPPORTED");
    if(auditFailure) await _tx.query("SELECT set_config('w03.fixture_audit_failure','on',true)");
    const context={company:{country:"GB",currency:"GBP",vat_registered:true,vat_scheme:"standard",
      vat_accounting_basis:"invoice"},issue_date:input.issue_date,rounding:"synthetic fixture",
      price_basis:input.price_basis,source_fingerprint:draftSourceFingerprint(input),
      lines:input.line_items.map((line,index)=>({rule_id:"SYNTHETIC_RULE",code:line.tax_code,label:"Synthetic rule",
        treatment:"standard",rate:"20.00",effective_from:"2026-01-01",effective_to:"",
        price_basis:input.price_basis,entered_unit_price:line.unit_price,unit_net_price:line.unit_price,
        net_pence:net[index]!.toString(),vat_pence:((net[index]!*20n)/100n).toString()}))};
    return {transactionBound:true,
      // Deliberately malformed runtime provider result in a negative-control fixture.
      contextRevision:(malformedTaxContext ? 42 : contextRevision(context)) as unknown as string,
      context, vatPence:net.map(n=>(n*20n/100n).toString()),
      netPence:net.map(String),unitNetPrices:input.line_items.map(line=>line.unit_price)};
  }
};
const env = () => ({PATH:process.env.PATH!,HOME:dir,LANG:"C",LC_ALL:"C"});
function pgctl(...args: string[]) { return execFileSync("pg_ctl",["-D",join(dir,"data"),...args],{env:env(),stdio:"pipe",timeout:20000}); }
before(async()=>{
  dir=mkdtempSync(join(tmpdir(),"ledgerly-w03-"));
  const socket=join(dir,"socket"); mkdirSync(socket,{mode:0o700});
  execFileSync("initdb",["-D",join(dir,"data"),"-U","w03_bootstrap","-A","trust","--no-locale"],{env:env(),stdio:"pipe",timeout:30000});
  pgctl("-l",join(dir,"postgres.log"),"-o",`-F -h '' -k ${socket} -p 55439`,"-w","start");
  admin=new pg.Pool({host:socket,port:55439,database:"postgres",user:"w03_bootstrap",application_name:"w03-synthetic-bootstrap"});
  await admin.query("CREATE ROLE ledgerly_api LOGIN");
  await admin.query("CREATE DATABASE w03_synthetic");
  await admin.end();
  admin=new pg.Pool({host:socket,port:55439,database:"w03_synthetic",user:"w03_bootstrap"});
  await admin.query(`
    CREATE TABLE companies(id uuid PRIMARY KEY,name text,country text,base_currency text,vat_registered boolean,
      vat_scheme text,vat_accounting_basis text,address_line_1 text,address_line_2 text,city text,
      county text,postcode text,email text,vat_number text);
    CREATE TABLE company_users(id uuid PRIMARY KEY,company_id uuid,user_id text,role text,is_active boolean);
    CREATE TABLE customers(id uuid PRIMARY KEY,company_id uuid,name text,status text,email text,
      address_line_1 text,address_line_2 text,city text,county text,postcode text);
    CREATE TABLE vat_tax_rules(id uuid PRIMARY KEY,company_id uuid,code text,label text,rate numeric(5,2),
      treatment text,effective_from date,effective_to date,is_active boolean);
    CREATE TABLE canonical_journal_entries(id uuid PRIMARY KEY,company_id uuid,source_id text,status text);
    CREATE TABLE bank_transactions(id uuid PRIMARY KEY,company_id uuid,linked_invoice_id uuid,
      matched_record_id text,matched_type text);
    CREATE TABLE sales_invoices(id uuid PRIMARY KEY,company_id uuid,customer_id uuid,customer_name text,invoice_number text,
      issue_date date,due_date date,payment_terms integer,reference text,line_items jsonb,subtotal numeric(12,2),
      vat_total numeric(12,2),total numeric(12,2),amount_paid numeric(12,2),balance_due numeric(12,2),status text,notes text,
      updated_at timestamptz DEFAULT now());
    CREATE TABLE synthetic_posted_sources(invoice_id uuid,company_id uuid);`);
  const root=process.env.W03_WORKSPACE!;
  assert.ok(root && existsSync(join(root,"lib/db/migrations/w03-invoice-drafts.review.sql")));
  await admin.query(readFileSync(join(root,"lib/db/migrations/w03-invoice-drafts.review.sql"),"utf8"));
  await admin.query(`GRANT SELECT,UPDATE ON companies,company_users,customers,vat_tax_rules,synthetic_posted_sources TO ledgerly_api;
    GRANT SELECT ON canonical_journal_entries,bank_transactions TO ledgerly_api;
    GRANT UPDATE(id) ON canonical_journal_entries,bank_transactions TO ledgerly_api;
    GRANT SELECT,INSERT,UPDATE ON sales_invoices,w03_invoice_drafts TO ledgerly_api;
    GRANT SELECT,INSERT ON w03_invoice_draft_audit TO ledgerly_api;
    CREATE FUNCTION synthetic_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF current_setting('w03.fixture_audit_failure',true)='on' THEN
      RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER synthetic_audit_fail BEFORE INSERT ON w03_invoice_draft_audit FOR EACH ROW EXECUTE FUNCTION synthetic_audit_failure();`);
  company=randomUUID(); customer=randomUUID();
  await admin.query(`INSERT INTO companies(id,name,country,base_currency,vat_registered,vat_scheme,vat_accounting_basis)
    VALUES($1,'Synthetic Company','GB','GBP',true,'standard','invoice')`,[company]);
  await admin.query("INSERT INTO company_users VALUES($1,$2,'synthetic-user','owner',true)",[randomUUID(),company]);
  await admin.query("INSERT INTO customers(id,company_id,name,status) VALUES($1,$2,'Synthetic Customer','active')",[customer,company]);
  await admin.query(`INSERT INTO vat_tax_rules
    (id,company_id,code,label,rate,treatment,effective_from,effective_to,is_active)
    VALUES($1,$2,'SYNTHETIC_20','Synthetic standard rule',20,'standard','2011-01-04',NULL,true)`,
  [randomUUID(),company]);
  await admin.query(`INSERT INTO vat_tax_rules
    (id,company_id,code,label,rate,treatment,effective_from,effective_to,is_active)
    VALUES($1,$2,'SYNTHETIC_5','Synthetic reduced rule',5,'reduced','1997-09-01',NULL,true)`,
  [randomUUID(),company]);
  noVatCompany=randomUUID(); noVatCustomer=randomUUID();
  for (const treatment of ["zero","exempt","outside_scope"]) {
    await admin.query(`INSERT INTO vat_tax_rules
      (id,company_id,code,label,rate,treatment,effective_from,effective_to,is_active)
      VALUES($1,$2,$3,$4,0,$5,'2026-01-01',NULL,true)`,
      [randomUUID(),company,"SYNTHETIC_"+treatment.toUpperCase(),"Synthetic "+treatment,treatment]);
  }
  await admin.query(`INSERT INTO companies(id,name,country,base_currency,vat_registered,vat_scheme,vat_accounting_basis)
    VALUES($1,'Synthetic Non-VAT Company','GB','GBP',false,'standard','invoice')`,[noVatCompany]);
  await admin.query("INSERT INTO company_users VALUES($1,$2,'synthetic-user','owner',true)",[randomUUID(),noVatCompany]);
  await admin.query("INSERT INTO customers(id,company_id,name,status) VALUES($1,$2,'Synthetic Non-VAT Customer','active')",
    [noVatCustomer,noVatCompany]);
  await admin.query(`INSERT INTO vat_tax_rules
    (id,company_id,code,label,rate,treatment,effective_from,effective_to,is_active)
    VALUES($1,$2,'NO_VAT','Not VAT registered',0,'no_vat','2026-01-01',NULL,true)`,
  [randomUUID(),noVatCompany]);
  runtime=new pg.Pool({host:socket,port:55439,database:"w03_synthetic",user:"ledgerly_api",application_name:"w03-synthetic-runtime"});
  const identity=await runtime.query("SELECT current_database() db,current_user usr,inet_server_addr() addr");
  assert.deepEqual(identity.rows[0],{db:"w03_synthetic",usr:"ledgerly_api",addr:null});
  const app=express();
  app.use(express.json({limit:"2mb",verify:verifyDraftBody})); app.use(draftParserErrors);
  const syntheticAuth=(req:express.Request,res:express.Response,next:express.NextFunction)=>{
    if(req.get("X-Synthetic-User")!=="fixture"){res.status(401).json({error:{code:"AUTHENTICATION_REQUIRED"}});return;}
    Object.assign(req,{userId:"synthetic-user"});next();
  };
  app.use("/api/companies/:companyId/financial-drafts/invoices",invoiceDraftRouter(new InvoiceDraftService(runtime,authority),syntheticAuth));
  app.use("/api/companies/:companyId/financial-drafts/native-invoices",
    invoiceDraftRouter(new InvoiceDraftService(runtime,createProductionInvoiceDraftAuthority()),syntheticAuth));
  app.use("/api/entities/:entity",genericEntityWriteBoundary);
  server=app.listen(0,"127.0.0.1"); await new Promise<void>(resolve=>server.once("listening",resolve));
  base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/companies/${company}/financial-drafts/invoices`;
  nativeBase=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/companies/${company}/financial-drafts/native-invoices`;
});
after(async()=>{
  if(server) await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  if(runtime) await runtime.end(); if(admin) await admin.end();
  let stopped=false;
  if(dir && existsSync(join(dir,"data/postmaster.pid"))) {pgctl("-m","fast","-w","stop");stopped=true;}
  if(dir) rmSync(dir,{recursive:true,force:true});
  if(process.env.W03_WORKSPACE) writeFileSync(join(process.env.W03_WORKSPACE,"generated-artifacts/w03-development-cleanup.json"),
    JSON.stringify({syntheticOnly:true,postgresStopped:stopped,directoryRemoved:!existsSync(dir),
      usedAmbientDatabaseCredentials:false,productionContact:false})+"\n");
});
const request=(method:string,body?:unknown,id="",revision?:string)=>fetch(base+id,{method,headers:{"Content-Type":"application/json",
  "X-Synthetic-User":"fixture",...(revision?{"If-Match":`"${revision}"`}:{})},...(body?{body:JSON.stringify(body)}:{})});
const nativeRequest=(companyId:string,method:string,body?:unknown,id="",revision?:string)=>fetch(
  `${nativeBase.replace(company,companyId)}${id}`,{method,headers:{"Content-Type":"application/json",
    "X-Synthetic-User":"fixture",...(revision?{"If-Match":`"${revision}"`}:{})},...(body?{body:JSON.stringify(body)}:{})});
type TestPayload = { data: { id:string; revision:string;
  money:{gross_pence:string; net_pence?:string; vat_pence?:string;
    lines?:Array<{net_pence:string;vat_pence:string;gross_pence:string}>};
  source:{notes:string;due_date?:string}; request_id:string; tax_context?:unknown;
}; error:{code:string} };
const payload = async (response: Response) => await response.json() as TestPayload;

test("real SQL + HTTP create/edit/read, role scope and append-only audit",async()=>{
  const response=await request("POST",source()); assert.equal(response.status,201);
  const created=(await payload(response)).data; assert.equal(created.money.gross_pence,"1200");
  const edit=await request("PATCH",{contract:"w03.draft.v1",notes:"edited"},"/"+created.id,created.revision);
  assert.equal(edit.status,200); const updated=(await payload(edit)).data;
  assert.notEqual(updated.revision,created.revision);
  const read=await request("GET",undefined,"/"+created.id); assert.equal(read.status,200);
  assert.equal((await payload(read)).data.source.notes,"edited");
  const audit=await runtime.query("SELECT actor_role,operation,after_revision,request_id FROM w03_invoice_draft_audit WHERE invoice_id=$1 ORDER BY created_at",[created.id]);
  assert.deepEqual(audit.rows.map(r=>r.operation),["create","update"]);
  assert.equal(audit.rows[1].request_id,updated.request_id);
  assert.equal((await payload(await request("GET",undefined,"/"+created.id))).data.money.gross_pence,"1200");
  await assert.rejects(runtime.query("DELETE FROM w03_invoice_draft_audit"),/permission denied/);
  await assert.rejects(admin.query("UPDATE w03_invoice_draft_audit SET actor_role='admin'"),/append-only/);
});
test("read-only invoice context returns only the active member's company customers and tax rules",async()=>{
  const response=await request("GET",undefined,"/context");
  assert.equal(response.status,200);
  const result=await payload(response) as TestPayload & {data:{company:{id:string;vat_registered:boolean};customers:Array<{id:string}>;tax_rules:Array<{code:string}>;can_write_draft:boolean}};
  assert.equal(result.data.company.id,company);
  assert.equal(result.data.company.vat_registered,true);
  assert.deepEqual(result.data.customers.map(row=>row.id),[customer]);
  assert.deepEqual(result.data.tax_rules.map(row=>row.code),["SYNTHETIC_20","SYNTHETIC_5","SYNTHETIC_EXEMPT","SYNTHETIC_OUTSIDE_SCOPE","SYNTHETIC_ZERO"]);
  assert.equal(result.data.can_write_draft,true);
  await admin.query("UPDATE company_users SET role='read_only' WHERE company_id=$1",[company]);
  const readOnly=await payload(await request("GET",undefined,"/context")) as typeof result;
  assert.equal(readOnly.data.can_write_draft,false);
  await admin.query("UPDATE company_users SET role='owner',is_active=false WHERE company_id=$1",[company]);
  assert.equal((await request("GET",undefined,"/context")).status,403);
  await admin.query("UPDATE company_users SET is_active=true WHERE company_id=$1",[company]);
  assert.equal((await request("POST",{contract:"w03.draft.v1"},"/context")).status,405);
});
test("production authority saves and reopens exact-penny standard VAT and non-VAT drafts",async()=>{
  const standard=source();
  standard.invoice_number="EXACT-VAT-"+randomUUID();
  standard.line_items[0]!.unit_price="100";
  const savedResponse=await nativeRequest(company,"POST",standard);
  assert.equal(savedResponse.status,201,await savedResponse.clone().text());
  const saved=await payload(savedResponse);
  assert.equal(saved.data.money.net_pence,"10000");
  assert.equal(saved.data.money.vat_pence,"2000");
  assert.equal(saved.data.money.gross_pence,"12000");
  const standardReadResponse=await nativeRequest(company,"GET",undefined,"/"+saved.data.id);
  assert.equal(standardReadResponse.status,200,await standardReadResponse.clone().text());
  const standardRead=await payload(standardReadResponse);
  assert.deepEqual(standardRead.data.money.lines,[{net_pence:"10000",vat_pence:"2000",gross_pence:"12000"}]);
  assert.equal((standardRead.data.tax_context as {lines:Array<{code:string;rate:string}>}).lines[0]!.code,"SYNTHETIC_20");
  assert.equal((standardRead.data.tax_context as {rounding:{contract:string;method:string}}).rounding.contract,"w03.money.dev.v3");
  assert.equal((standardRead.data.tax_context as {rounding:{contract:string;method:string}}).rounding.method,"nearest-penny-half-up");
  const storedAudit=await admin.query("SELECT tax_context FROM w03_invoice_draft_audit WHERE invoice_id=$1",[saved.data.id]);
  assert.equal(storedAudit.rows[0]!.tax_context.lines[0].label,"Synthetic standard rule");
  await admin.query("INSERT INTO bank_transactions(id,company_id,linked_invoice_id) VALUES($1,$2,$3)",
    [randomUUID(),company,saved.data.id]);
  const linkedEdit=await nativeRequest(company,"PATCH",{contract:"w03.draft.v1",notes:"must remain locked"},
    "/"+saved.data.id,saved.data.revision);
  assert.equal(linkedEdit.status,409);
  assert.equal((await payload(linkedEdit)).error.code,"DOCUMENT_HAS_FINANCIAL_LINK");

  const nonVat={...source(),customer_id:noVatCustomer,invoice_number:"EXACT-NOVAT-"+randomUUID(),
    line_items:[{description:"Exact no VAT",quantity:"1",unit_price:"19.99",tax_code:"NO_VAT"}]};
  const noVatResponse=await nativeRequest(noVatCompany,"POST",nonVat);
  assert.equal(noVatResponse.status,201,await noVatResponse.clone().text());
  const noVatSaved=await payload(noVatResponse);
  assert.equal(noVatSaved.data.money.net_pence,"1999");
  assert.equal(noVatSaved.data.money.vat_pence,"0");
  assert.equal(noVatSaved.data.money.gross_pence,"1999");
  const reopenedResponse=await nativeRequest(noVatCompany,"GET",undefined,"/"+noVatSaved.data.id);
  assert.equal(reopenedResponse.status,200,await reopenedResponse.clone().text());
  const reopened=await payload(reopenedResponse);
  assert.deepEqual(reopened.data.money.lines,[{net_pence:"1999",vat_pence:"0",gross_pence:"1999"}]);
  assert.equal((reopened.data.tax_context as {lines:Array<{treatment:string;label:string}>}).lines[0]!.treatment,"no_vat");
  await admin.query("INSERT INTO canonical_journal_entries(id,company_id,source_id,status) VALUES($1,$2,$3,'reversed')",
    [randomUUID(),noVatCompany,noVatSaved.data.id]);
  const postedEdit=await nativeRequest(noVatCompany,"PATCH",{contract:"w03.draft.v1",notes:"must stay locked"},
    "/"+noVatSaved.data.id,noVatSaved.data.revision);
  assert.equal(postedEdit.status,409);
  assert.equal((await payload(postedEdit)).error.code,"DOCUMENT_NOT_DRAFT");
});
test("production authority rounds each line half-up, sums saved lines, and reopens identical results",async()=>{
  const rounded=source();
  rounded.invoice_number="HALF-UP-"+randomUUID();
  rounded.line_items=[
    {description:"Standard 1.01",quantity:"1",unit_price:"1.01",tax_code:"SYNTHETIC_20"},
    {description:"Standard 1.03",quantity:"1",unit_price:"1.03",tax_code:"SYNTHETIC_20"},
    {description:"Reduced 0.10",quantity:"1",unit_price:"0.10",tax_code:"SYNTHETIC_5"},
  ];
  const response=await nativeRequest(company,"POST",rounded);
  assert.equal(response.status,201,await response.clone().text());
  const saved=await payload(response);
  assert.deepEqual(saved.data.money.lines,[
    {net_pence:"101",vat_pence:"20",gross_pence:"121"},
    {net_pence:"103",vat_pence:"21",gross_pence:"124"},
    {net_pence:"10",vat_pence:"1",gross_pence:"11"},
  ]);
  assert.deepEqual(
    [saved.data.money.net_pence,saved.data.money.vat_pence,saved.data.money.gross_pence],
    ["214","42","256"],
  );
  const reopened=await nativeRequest(company,"GET",undefined,"/"+saved.data.id);
  assert.equal(reopened.status,200,await reopened.clone().text());
  const reopenedData=(await payload(reopened)).data;
  assert.deepEqual(reopenedData.money,saved.data.money);
  assert.deepEqual((reopenedData.tax_context as {rounding:unknown}).rounding,(saved.data.tax_context as {rounding:unknown}).rounding);

  const quantity=source();
  quantity.invoice_number="QUANTITY-HALF-UP-"+randomUUID();
  quantity.line_items[0]!.quantity="1.2345";
  quantity.line_items[0]!.unit_price="2.3456";
  const quantityResponse=await nativeRequest(company,"POST",quantity);
  assert.equal(quantityResponse.status,201,await quantityResponse.clone().text());
  assert.deepEqual((await payload(quantityResponse)).data.money.lines,[
    {net_pence:"290",vat_pence:"58",gross_pence:"348"},
  ]);
});
test("native inclusive prices extract VAT by each effective rate and preserve entered/net read fields",async()=>{
  const cases = [
    ["120","1","SYNTHETIC_20","10000","2000","12000"],
    ["105","1","SYNTHETIC_5","10000","500","10500"],
    ["0.03","1","SYNTHETIC_20","2","1","3"],
    ["19.99","2.5","SYNTHETIC_20","4165","833","4998"],
    ["100","1","SYNTHETIC_ZERO","10000","0","10000"],
    ["100","1","SYNTHETIC_EXEMPT","10000","0","10000"],
    ["100","1","SYNTHETIC_OUTSIDE_SCOPE","10000","0","10000"],
  ];
  for (const [price,quantity,code,net,vat,gross] of cases) {
    const input={...source(),price_basis:"including_vat",
      line_items:[{description:"Inclusive fixture",quantity:quantity!,unit_price:price!,tax_code:code!}]};
    const response=await nativeRequest(company,"POST",input);
    assert.equal(response.status,201,await response.clone().text());
    const saved=(await payload(response)).data;
    assert.deepEqual([saved.money.net_pence,saved.money.vat_pence,saved.money.gross_pence],[net,vat,gross]);
    const reopenedResponse=await nativeRequest(company,"GET",undefined,"/"+saved.id);
    assert.equal(reopenedResponse.status,200);
    const reopened=(await payload(reopenedResponse)).data;
    assert.deepEqual(reopened.money,saved.money);
    const stored=(await admin.query("SELECT line_items FROM sales_invoices WHERE id=$1",[saved.id])).rows[0]!.line_items[0];
    assert.equal(stored.entered_unit_price,price);
    assert.equal(stored.price_basis,"including_vat");
    if(price==="120") assert.equal(stored.unit_price,"100.0000"); // net, never relabelled gross
  }
  const mixed={...source(),price_basis:"including_vat",line_items:[
    {description:"20%",quantity:"1",unit_price:"120",tax_code:"SYNTHETIC_20"},
    {description:"5%",quantity:"1",unit_price:"105",tax_code:"SYNTHETIC_5"},
    {description:"Zero",quantity:"1",unit_price:"100",tax_code:"SYNTHETIC_ZERO"},
    {description:"Exempt",quantity:"1",unit_price:"100",tax_code:"SYNTHETIC_EXEMPT"}]};
  const mixedResponse=await nativeRequest(company,"POST",mixed);
  assert.equal(mixedResponse.status,201,await mixedResponse.clone().text());
  const m=(await payload(mixedResponse)).data.money;
  assert.deepEqual([m.net_pence,m.vat_pence,m.gross_pence],["40000","2500","42500"]);
});
test("basis changes bind source/context fingerprints, retain revisions and never replay duplicate creates",async()=>{
  const input={...source(),customer_id:noVatCustomer,price_basis:"excluding_vat",
    line_items:[{description:"No VAT fixture",quantity:"2.5",unit_price:"19.99",tax_code:"NO_VAT"}]};
  const createdResponse=await nativeRequest(noVatCompany,"POST",input);
  assert.equal(createdResponse.status,201);
  const created=(await payload(createdResponse)).data;
  const changedResponse=await nativeRequest(noVatCompany,"PATCH",{contract:"w03.draft.v1",price_basis:"including_vat"},
    "/"+created.id,created.revision);
  assert.equal(changedResponse.status,200,await changedResponse.clone().text());
  const changed=(await payload(changedResponse)).data;
  assert.deepEqual(changed.money,created.money);
  assert.deepEqual([changed.money.net_pence,changed.money.vat_pence,changed.money.gross_pence],["4998","0","4998"]);
  const before=created.tax_context as {source_fingerprint:string};
  const after=changed.tax_context as {source_fingerprint:string};
  assert.notEqual(before.source_fingerprint,after.source_fingerprint);
  const reopenedResponse=await nativeRequest(noVatCompany,"GET",undefined,"/"+created.id);
  assert.equal(reopenedResponse.status,200);
  const reopened=(await payload(reopenedResponse)).data;
  assert.equal((reopened.source as unknown as {price_basis:string}).price_basis,"including_vat");
  assert.deepEqual(reopened.money,changed.money);
  assert.equal((await nativeRequest(noVatCompany,"PATCH",{contract:"w03.draft.v1",price_basis:"excluding_vat"},
    "/"+created.id,created.revision)).status,409);
  const duplicate=await nativeRequest(noVatCompany,"POST",{...input,price_basis:"including_vat"});
  assert.equal(duplicate.status,409);
  assert.equal((await payload(duplicate)).error.code,"NUMBER_CONFLICT");
  const audit=(await admin.query("SELECT before_source,after_source FROM w03_invoice_draft_audit WHERE invoice_id=$1 AND operation='update'",[created.id])).rows;
  assert.equal(audit.length,1);
  assert.equal(audit[0]!.before_source.price_basis,"excluding_vat");
  assert.equal(audit[0]!.after_source.price_basis,"including_vat");
  const invalid=await nativeRequest(noVatCompany,"POST",{...input,invoice_number:"INVALID-"+randomUUID(),price_basis:"gross"});
  assert.equal(invalid.status,422);
});
test("old drafts hydrate excluding without rewriting source, amounts, revision or audit",async()=>{
  const response=await nativeRequest(company,"POST",source());
  assert.equal(response.status,201);
  const saved=(await payload(response)).data;
  await admin.query(`UPDATE w03_invoice_drafts SET source=source-'price_basis',
    tax_context=tax_context-'price_basis'-'source_fingerprint' WHERE invoice_id=$1`,[saved.id]);
  const count=Number((await admin.query("SELECT count(*) n FROM w03_invoice_draft_audit WHERE invoice_id=$1",[saved.id])).rows[0]!.n);
  const readResponse=await nativeRequest(company,"GET",undefined,"/"+saved.id);
  assert.equal(readResponse.status,200);
  const read=(await payload(readResponse)).data;
  assert.equal((read.source as unknown as {price_basis:string}).price_basis,"excluding_vat");
  assert.equal(read.revision,saved.revision);
  assert.deepEqual(read.money,saved.money);
  assert.equal((await admin.query("SELECT source ? 'price_basis' present FROM w03_invoice_drafts WHERE invoice_id=$1",[saved.id])).rows[0]!.present,false);
  assert.equal(Number((await admin.query("SELECT count(*) n FROM w03_invoice_draft_audit WHERE invoice_id=$1",[saved.id])).rows[0]!.n),count);
});
test("native reopen fails closed without source-lock privilege, then edits and reopens the same draft with minimal grants",async()=>{
  const input=source();
  input.invoice_number="SOURCE-LOCK-"+randomUUID();
  input.line_items[0]!.unit_price="1.03";
  const createdResponse=await nativeRequest(company,"POST",input);
  assert.equal(createdResponse.status,201,await createdResponse.clone().text());
  const created=(await payload(createdResponse)).data;
  await admin.query("REVOKE UPDATE(id) ON canonical_journal_entries,bank_transactions FROM ledgerly_api");
  try {
    const blocked=await nativeRequest(company,"GET",undefined,"/"+created.id);
    assert.equal(blocked.status,503);
    assert.equal((await payload(blocked)).error.code,"STORAGE_UNAVAILABLE");
  } finally {
    await admin.query("GRANT UPDATE(id) ON canonical_journal_entries,bank_transactions TO ledgerly_api");
  }
  const reopenedResponse=await nativeRequest(company,"GET",undefined,"/"+created.id);
  assert.equal(reopenedResponse.status,200,await reopenedResponse.clone().text());
  const reopened=(await payload(reopenedResponse)).data;
  assert.deepEqual(reopened.money,created.money);
  const editedResponse=await nativeRequest(company,"PATCH",{contract:"w03.draft.v1",notes:"same draft edit"},
    "/"+created.id,reopened.revision);
  assert.equal(editedResponse.status,200,await editedResponse.clone().text());
  const edited=(await payload(editedResponse)).data;
  const finalResponse=await nativeRequest(company,"GET",undefined,"/"+created.id);
  assert.equal(finalResponse.status,200,await finalResponse.clone().text());
  const final=(await payload(finalResponse)).data;
  assert.equal(final.id,created.id);
  assert.equal(final.source.notes,"same draft edit");
  assert.equal(final.source.due_date,input.due_date);
  assert.equal(final.revision,edited.revision);
  assert.deepEqual(final.money,created.money);
  assert.equal(Number((await admin.query("SELECT count(*) n FROM sales_invoices WHERE invoice_number=$1",[input.invoice_number])).rows[0]!.n),1);
});
test("synthetic VAT rules reject dates before their stated effective boundaries",async()=>{
  const standardBefore=source();
  standardBefore.invoice_number="BEFORE-20-"+randomUUID();
  standardBefore.issue_date="2011-01-03";
  standardBefore.due_date="2011-02-03";
  const rejectedStandard=await nativeRequest(company,"POST",standardBefore);
  assert.equal(rejectedStandard.status,422);
  assert.equal((await payload(rejectedStandard)).error.code,"TAX_RULE_NOT_FOUND");

  const standardAt=source();
  standardAt.invoice_number="AT-20-"+randomUUID();
  standardAt.issue_date="2011-01-04";
  standardAt.due_date="2011-02-04";
  const acceptedStandard=await nativeRequest(company,"POST",standardAt);
  assert.equal(acceptedStandard.status,201,await acceptedStandard.clone().text());

  const reducedBefore=source();
  reducedBefore.invoice_number="BEFORE-5-"+randomUUID();
  reducedBefore.issue_date="1997-08-31";
  reducedBefore.due_date="1997-09-30";
  reducedBefore.line_items[0]!.tax_code="SYNTHETIC_5";
  const rejectedReduced=await nativeRequest(company,"POST",reducedBefore);
  assert.equal(rejectedReduced.status,422);
  assert.equal((await payload(rejectedReduced)).error.code,"TAX_RULE_NOT_FOUND");

  const reducedAt=source();
  reducedAt.invoice_number="AT-5-"+randomUUID();
  reducedAt.issue_date="1997-09-01";
  reducedAt.due_date="1997-10-01";
  reducedAt.line_items[0]!.tax_code="SYNTHETIC_5";
  const acceptedReduced=await nativeRequest(company,"POST",reducedAt);
  assert.equal(acceptedReduced.status,201,await acceptedReduced.clone().text());
  assert.equal(Number((await admin.query(
    "SELECT count(*) n FROM sales_invoices WHERE invoice_number LIKE 'BEFORE-%'",
  )).rows[0]!.n),0);
});
test("real route rejects malformed/duplicate/unknown fields, body limits, missing auth and unsupported bulk",async()=>{
  for(const key of ["status","company_id","total","actor_id","amount_paid"]) {
    const result=await request("POST",{...source(),[key]:"forged"});assert.equal(result.status,422);
  }
  const duplicate=await fetch(base,{method:"POST",headers:{"Content-Type":"application/json","X-Synthetic-User":"fixture"},body:'{"a":1,"a":2}'});
  assert.equal(duplicate.status,400);assert.equal((await payload(duplicate)).error.code,"DUPLICATE_KEY");
  const large=await request("POST",{...source(),notes:"x".repeat(1024*1024)});assert.equal(large.status,413);
  assert.equal((await fetch(base,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(source())})).status,401);
  assert.equal((await request("POST",source(),"/bulk")).status,405);
  const origin = base.split("/api/companies/")[0];
  for (const [method,path] of [["POST","SalesInvoice"],["POST","SalesInvoice/bulk"],
    ["PATCH","SalesInvoice/bulk-update"],["PUT","SalesInvoice/id"],["DELETE","SalesInvoice/id"],
    ["POST","VATTaxRule"],["PUT","VATTaxRule/id"],["DELETE","VATTaxRule/id"]]) {
    assert.equal((await fetch(`${origin}/api/entities/${path}`,{method})).status,403);
  }
});
test("real SQL rejects disallowed roles, inactive/duplicate scope, foreign/inactive customer and unsupported tax",async()=>{
  for(const role of ["manager","read_only","member","staff","unmapped"]) {
    await admin.query("UPDATE company_users SET role=$1",[role]);
    assert.equal((await request("POST",source())).status,403);
  }
  for(const role of ["admin","accountant"]) {
    await admin.query("UPDATE company_users SET role=$1",[role]);assert.equal((await request("POST",source())).status,201);
  }
  await admin.query("UPDATE company_users SET role='owner',is_active=false");
  assert.equal((await request("POST",source())).status,403);
  await admin.query("UPDATE company_users SET is_active=true");
  assert.equal((await request("POST",{...source(),customer_id:randomUUID()})).status,422);
  await admin.query("UPDATE customers SET status='inactive'");assert.equal((await request("POST",source())).status,422);
  await admin.query("UPDATE customers SET status='active'");
  const bad=source(); bad.line_items[0]!.tax_code="no_vat";assert.equal((await request("POST",bad)).status,422);
  assert.equal((await request("POST",{...source(),issue_date:"2025-12-01",due_date:"2025-12-31"})).status,409);
  malformedTaxContext=true;
  try{assert.equal((await request("POST",source())).status,503);}finally{malformedTaxContext=false;}
});
test("real SQL protects posted targets, stale revisions, duplicate numbers and rollback on audit failure",async()=>{
  const input=source(); const created=(await payload(await request("POST",input))).data;
  assert.equal((await request("POST",input)).status,409);
  assert.equal((await request("PATCH",{contract:"w03.draft.v1",notes:"stale"},"/"+created.id,randomUUID())).status,409);
  assert.equal((await request("PATCH",{contract:"w03.draft.v1",notes:"missing"},"/"+created.id)).status,428);
  assert.equal((await request("PATCH",{contract:"w03.draft.v1",issue_date:"2025-12-01",due_date:"2025-12-31"},"/"+created.id,created.revision)).status,409);
  await admin.query("INSERT INTO synthetic_posted_sources VALUES($1,$2)",[created.id,company]);
  assert.equal((await request("PATCH",{contract:"w03.draft.v1",notes:"posted"},"/"+created.id,created.revision)).status,409);
  const before=await admin.query("SELECT (SELECT count(*) FROM sales_invoices) invoices,(SELECT count(*) FROM w03_invoice_draft_audit) audits");
  auditFailure=true;try {assert.equal((await request("POST",source())).status,500);}finally{auditFailure=false;}
  assert.deepEqual((await admin.query("SELECT (SELECT count(*) FROM sales_invoices) invoices,(SELECT count(*) FROM w03_invoice_draft_audit) audits")).rows,before.rows);
});
test("legacy drafts hold for reviewed adoption, posted status rejects, private foreign ID stays 404", async()=>{
  const legacy = randomUUID();
  await admin.query("INSERT INTO sales_invoices(id,company_id,status,amount_paid) VALUES($1,$2,'draft',0)",[legacy,company]);
  const result = await request("GET",undefined,"/"+legacy);
  assert.equal(result.status,409); assert.equal((await payload(result)).error.code,"LEGACY_DRAFT_REVIEW_REQUIRED");
  await admin.query("UPDATE sales_invoices SET status='posted' WHERE id=$1",[legacy]);
  assert.equal((await request("GET",undefined,"/"+legacy)).status,409);
  assert.equal((await request("GET",undefined,"/"+randomUUID())).status,404);
});
test("real foreign-company records cannot supply membership, customer or invoice scope", async()=>{
  const otherCompany=randomUUID(), otherCustomer=randomUUID(), otherInvoice=randomUUID();
  await admin.query(`INSERT INTO companies(id,name,country,base_currency,vat_registered,vat_scheme,vat_accounting_basis)
    VALUES($1,'Other Synthetic Company','GB','GBP',true,'standard','invoice')`,[otherCompany]);
  await admin.query("INSERT INTO customers(id,company_id,name,status) VALUES($1,$2,'Other Synthetic Customer','active')",[otherCustomer,otherCompany]);
  await admin.query("INSERT INTO sales_invoices(id,company_id,status,amount_paid) VALUES($1,$2,'draft',0)",[otherInvoice,otherCompany]);
  assert.equal((await request("POST",{...source(),customer_id:otherCustomer})).status,422);
  assert.equal((await request("GET",undefined,"/"+otherInvoice)).status,404);
  const denied=await fetch(base.replace(company,otherCompany),{method:"POST",
    headers:{"Content-Type":"application/json","X-Synthetic-User":"fixture"},body:JSON.stringify({...source(),customer_id:otherCustomer})});
  assert.equal(denied.status,404);
  assert.equal(Number((await admin.query("SELECT count(*) n FROM sales_invoices WHERE company_id=$1",[otherCompany])).rows[0].n),1);
});
test("real overlapping connections: revocation wins the company lock and subsequent save denies",async()=>{
  const blocker=await admin.connect();
  try{
    await blocker.query("BEGIN");await blocker.query("SELECT id FROM companies WHERE id=$1 FOR UPDATE",[company]);
    const pending=request("POST",source());
    let overlapped=false;
    for(let n=0;n<100;n++){
      const locks=await admin.query("SELECT count(*) n FROM pg_stat_activity WHERE application_name='w03-synthetic-runtime' AND cardinality(pg_blocking_pids(pid))>0");
      if(Number(locks.rows[0].n)>0){overlapped=true;break;}
      await new Promise(r=>setTimeout(r,10));
    }
    assert.equal(overlapped,true);
    await blocker.query("UPDATE company_users SET is_active=false");await blocker.query("COMMIT");
    assert.equal((await pending).status,403);
  }finally{await blocker.query("ROLLBACK");blocker.release();await admin.query("UPDATE company_users SET is_active=true");}
});
test("real concurrent edits with one revision serialize: exactly one commits",async()=>{
  const created=(await payload(await request("POST",source()))).data;
  const edits=await Promise.all(["A","B"].map(notes=>request("PATCH",{contract:"w03.draft.v1",notes},"/"+created.id,created.revision)));
  assert.deepEqual(edits.map(r=>r.status).sort(),[200,409]);
  assert.equal(Number((await admin.query("SELECT count(*) n FROM w03_invoice_draft_audit WHERE invoice_id=$1",[created.id])).rows[0].n),2);
});
