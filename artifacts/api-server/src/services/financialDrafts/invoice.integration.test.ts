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
import { invoiceDraftRouter } from "./router";
import { verifyDraftBody, draftParserErrors } from "./jsonBoundary";
import { fail } from "./contract";
import { genericEntityWriteBoundary } from "../../routes/entityWritePolicy";

let dir: string, admin: pg.Pool, runtime: pg.Pool, server: ReturnType<ReturnType<typeof express>["listen"]>;
let base: string, company: string, customer: string;
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
    return {transactionBound:true,
      // Deliberately malformed runtime provider result in a negative-control fixture.
      contextRevision:(malformedTaxContext ? 42 : "SYNTHETIC_NOT_APPROVED") as unknown as string,
      vatPence:net.map(n=>((n*20n+50n)/100n).toString())};
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
    CREATE TABLE companies(id uuid PRIMARY KEY);
    CREATE TABLE company_users(id uuid PRIMARY KEY,company_id uuid,user_id text,role text,is_active boolean);
    CREATE TABLE customers(id uuid PRIMARY KEY,company_id uuid,name text,status text);
    CREATE TABLE sales_invoices(id uuid PRIMARY KEY,company_id uuid,customer_id uuid,customer_name text,invoice_number text,
      issue_date date,due_date date,payment_terms integer,reference text,line_items jsonb,subtotal numeric(12,2),
      vat_total numeric(12,2),total numeric(12,2),amount_paid numeric(12,2),balance_due numeric(12,2),status text,notes text,
      updated_at timestamptz DEFAULT now());
    CREATE TABLE synthetic_posted_sources(invoice_id uuid,company_id uuid);`);
  const root=process.env.W03_WORKSPACE!;
  assert.ok(root && existsSync(join(root,"lib/db/migrations/w03-invoice-drafts.review.sql")));
  await admin.query(readFileSync(join(root,"lib/db/migrations/w03-invoice-drafts.review.sql"),"utf8"));
  await admin.query(`GRANT SELECT,UPDATE ON companies,company_users,customers,synthetic_posted_sources TO ledgerly_api;
    GRANT SELECT,INSERT,UPDATE ON sales_invoices,w03_invoice_drafts TO ledgerly_api;
    GRANT SELECT,INSERT ON w03_invoice_draft_audit TO ledgerly_api;
    CREATE FUNCTION synthetic_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF current_setting('w03.fixture_audit_failure',true)='on' THEN
      RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER synthetic_audit_fail BEFORE INSERT ON w03_invoice_draft_audit FOR EACH ROW EXECUTE FUNCTION synthetic_audit_failure();`);
  company=randomUUID(); customer=randomUUID();
  await admin.query("INSERT INTO companies VALUES($1)",[company]);
  await admin.query("INSERT INTO company_users VALUES($1,$2,'synthetic-user','owner',true)",[randomUUID(),company]);
  await admin.query("INSERT INTO customers VALUES($1,$2,'Synthetic Customer','active')",[customer,company]);
  runtime=new pg.Pool({host:socket,port:55439,database:"w03_synthetic",user:"ledgerly_api",application_name:"w03-synthetic-runtime"});
  const identity=await runtime.query("SELECT current_database() db,current_user usr,inet_server_addr() addr");
  assert.deepEqual(identity.rows[0],{db:"w03_synthetic",usr:"ledgerly_api",addr:null});
  const app=express();
  app.use(express.json({limit:"2mb",verify:verifyDraftBody})); app.use(draftParserErrors);
  app.use("/api/companies/:companyId/financial-drafts/invoices",invoiceDraftRouter(new InvoiceDraftService(runtime,authority),
    (req,res,next)=>{if(req.get("X-Synthetic-User")!=="fixture"){res.status(401).json({error:{code:"AUTHENTICATION_REQUIRED"}});return;}
      Object.assign(req,{userId:"synthetic-user"});next();}));
  app.use("/api/entities/:entity",genericEntityWriteBoundary);
  server=app.listen(0,"127.0.0.1"); await new Promise<void>(resolve=>server.once("listening",resolve));
  base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/companies/${company}/financial-drafts/invoices`;
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
type TestPayload = { data: { id:string; revision:string; money:{gross_pence:string}; source:{notes:string}; request_id:string }; error:{code:string} };
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
  await assert.rejects(runtime.query("DELETE FROM w03_invoice_draft_audit"),/permission denied/);
  await assert.rejects(admin.query("UPDATE w03_invoice_draft_audit SET actor_role='admin'"),/append-only/);
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
    ["PATCH","SalesInvoice/bulk-update"],["PUT","SalesInvoice/id"],["DELETE","SalesInvoice/id"]]) {
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
  await admin.query("INSERT INTO companies VALUES($1)",[otherCompany]);
  await admin.query("INSERT INTO customers VALUES($1,$2,'Other Synthetic Customer','active')",[otherCustomer,otherCompany]);
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
