import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createAccountingRouter } from "./accountingDocuments";
import { presentReplacementHistory } from "../services/accountingDocuments/replacementPresentation";

const company="11111111-1111-4111-8111-111111111111", doc="22222222-2222-4222-8222-222222222222";
function app(authenticated=true) {
  const a=express(); a.use(express.json());
  a.use("/companies/:companyId",createAccountingRouter((req,res,next)=>{
    if(!authenticated){res.status(401).json({error:{code:"UNAUTHENTICATED"}});return;}
    (req as any).userId="user_test";next();
  }));
  return a;
}
async function call(a:express.Express,method:string,path:string,body?:unknown) {
  const server=a.listen(0);
  try {
    const port=(server.address() as any).port;
    const res=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:body===undefined?{}:{"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:res.status,json:(await res.json().catch(()=>null)) as any};
  } finally {server.close();}
}
const base=`/companies/${company}/accounting-documents/${doc}/conditional-replacements`;
const terms={version:1,party_type:"customer",party_id:"33333333-3333-4333-8333-333333333333",currency:"GBP",
  agreement_id:"44444444-4444-4444-8444-444444444444",agreement_date:"2026-11-01",payment_deadline:"2026-11-30",discount_gross_pence:"750"};
const valid={request_id:"55555555-5555-4555-8555-555555555555",predecessor_id:null,terms,evidence_text:"Email",attested:true};

test("replacement routes require authentication", async()=>{
  for(const [m,p,b] of [["GET",base],["POST",base,valid],["POST",`${base}/${doc}/observe`,{}]] as const)
    assert.equal((await call(app(false),m,p,b)).status,401);
});
test("append rejects bypass flags, missing attestation and invalid terms before any database access", async()=>{
  for(const body of [{...valid,force:true},{...valid,posting_available:true},{...valid,authority_token:"x"},{...valid,attested:false},
    {...valid,terms:{...terms,discount_gross_pence:"0"}},{...valid,terms:{...terms,scale:true}}]) {
    const r=await call(app(),"POST",base,body);
    assert.ok([400,422].includes(r.status),JSON.stringify(body)+r.status);
    assert.ok(r.json?.error?.code);
  }
  assert.equal((await call(app(),"POST",base,{...valid,attested:false})).json.error.code,"CONDITIONAL_ATTESTATION_REQUIRED");
});
test("observe accepts no caller fields and company header context is rejected", async()=>{
  assert.equal((await call(app(),"POST",`${base}/${doc}/observe`,{bypass:true})).status,422);
  const a=app(); const server=a.listen(0); const port=(server.address() as any).port;
  try {
    const r=await fetch(`http://127.0.0.1:${port}${base}`,{headers:{"x-company-id":company}});
    assert.equal(r.status,400);
  } finally {server.close();}
});
test("no commit, redemption, compensation-commit or conditional-posting route is exposed", ()=>{
  const router:any=createAccountingRouter((_q,_s,n)=>n());
  const paths:string[]=router.stack.filter((l:any)=>l.route).flatMap((l:any)=>Object.keys(l.route.methods).map(m=>`${m} ${l.route.path}`));
  assert.ok(paths.includes("get /accounting-documents/:id/conditional-replacements"));
  assert.ok(paths.includes("post /accounting-documents/:id/conditional-replacements"));
  assert.ok(paths.includes("post /accounting-documents/:id/conditional-replacements/:replacementId/observe"));
  for(const p of paths) assert.doesNotMatch(p,/redeem|redemption|conditional-credit(?!\/review)|conditional-compensations(?!\/(context|review|operations))|authority|commit/i,p);
  assert.ok(!paths.some(p=>/^post .*conditional-replacements.*\/(post|redeem|commit)/.test(p)));
});
test("history projection distinguishes current/superseded/observed/consumed and leaks no internals", ()=>{
  const rows=[{id:"r1",predecessor_id:null,request_id:"q1",recorded_at:"t1",actor_id:"u",original_binding_hash:"h",source_xid:"9",evidence_id:"e",
      evidence:{id:"e",terms,evidence_text:"a",evidence_hash:"x",terms_hash:"y",recorded_at:"t",company_id:company}},
    {id:"r2",predecessor_id:"r1",request_id:"q2",recorded_at:"t2",actor_id:"u",original_binding_hash:"h",evidence:null}];
  const v=presentReplacementHistory("h",rows,[{state:"observed",observed_at:"o",binding_hash:"b"},{state:"unobserved"}],true);
  assert.equal(v.current_replacement_id,"r2");assert.equal(v.consumed,true);assert.equal(v.replaceable,false);assert.equal(v.posting_available,false);
  assert.deepEqual(v.replacements.map(r=>[r.position,r.current,r.observation.state]),[[1,false,"observed"],[2,true,"unobserved"]]);
  const text=JSON.stringify(v);assert.doesNotMatch(text,/source_xid|company_id|canonical|capacity/);
  assert.throws(()=>presentReplacementHistory("h",[rows[1]],[{state:"unobserved"}],false));
  assert.throws(()=>presentReplacementHistory("h",rows,[{state:"unobserved"}],false));
  assert.equal(presentReplacementHistory("h",[],[],false).current_replacement_id,null);
});
