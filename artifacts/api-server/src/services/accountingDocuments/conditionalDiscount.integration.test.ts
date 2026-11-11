// Real PostgreSQL cases, only in the fresh disposable accounting-flow runner.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {realpathSync,mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import path from 'node:path';
import pg from 'pg';
import express from 'express';
import {createAccountingRouter} from '../../routes/accountingDocuments';
import {pool} from '@workspace/db';
import {withCanonicalPostingTransaction} from '../accounting/canonicalPosting';
import {queryAdapter,transact} from './core';
import {documentOpen} from './settlement';
import {saveConfiguration,addPeriod} from './configuration';
import {savePaymentConfiguration,previewPayment,postPayment} from './payments';
import {captureCommittedPaymentWitness,conditionalCreditAdmission} from './conditionalDiscount';
import {appendConditionalReplacement,getConditionalReplacementHistory} from './conditionalReplacements';
import {observeConditionalReplacement} from './replacementBindings';
const socket=process.env.ACCOUNTING_FLOW_TEST_SOCKET??'';
if(!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]{6}\/socket$/.test(socket)||realpathSync(socket)!==socket) throw Error('Fresh disposable socket required');
const admin=new pg.Pool({host:socket,port:55441,user:'w03_bootstrap',database:'ledgerly_accounting_flow_test',password:'',ssl:false});
const actor='synthetic-witness-owner';
let server:ReturnType<ReturnType<typeof express>['listen']>,base:string;
let browserHtml='';
before(async()=>{
 assert.deepEqual((await admin.query(`SELECT current_database() db,current_user actor,inet_server_addr() addr,current_setting('data_directory') dir`)).rows[0],
  {db:'ledgerly_accounting_flow_test',actor:'w03_bootstrap',addr:null,dir:path.join(path.dirname(socket),'data')});
 assert.equal((await pool.query('SELECT current_user actor')).rows[0].actor,'ledgerly_api');
 const app=express();app.use(express.json());
 // Loopback-only, fresh synthetic test harness; production router keeps Clerk.
 app.get('/synthetic-compensation-browser',(_req,res)=>res.type('html').send(browserHtml));
 app.use('/companies/:companyId',createAccountingRouter((req,res,next)=>{
  const user=req.get('x-test-actor');if(!user){res.sendStatus(401);return;}
  (req as any).userId=user;next();
 }));
 server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 base=`http://127.0.0.1:${(server.address() as any).port}`;
});
after(async()=>{if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();await admin.end();});
async function conditionalHttp(company:string,id:string,body:unknown,revision?:string,user:string|null=actor,suffix='conditional-credit/review') {
 const response=await fetch(`${base}/companies/${company}/accounting-documents/${id}/${suffix}`,{method:'POST',headers:{
  'Content-Type':'application/json',...(user?{'x-test-actor':user}:{}),...(revision?{'If-Match':`"${revision}"`}:{})},body:JSON.stringify(body)});
 const raw=await response.text();return {status:response.status,...(raw.startsWith('{')?JSON.parse(raw):{})};
}
async function financialSnapshot(company:string) {
 const snapshot:Record<string,unknown>={};
 for(const table of ['accounting_document_sources','canonical_journal_entries','canonical_journal_lines','accounting_posting_effects','sales_invoices','purchase_bills','accounting_payment_events','accounting_paid_credit_operations']) {
  snapshot[table]=(await pool.query(`SELECT to_jsonb(t) row FROM ${table} t WHERE company_id=$1 ORDER BY to_jsonb(t)::text`,[company])).rows;
 }
 return snapshot;
}
async function fixture(){
 const company=randomUUID(),customer=randomUUID();
 await admin.query(`INSERT INTO companies(id,name,country,base_currency,vat_registered,vat_scheme,vat_accounting_basis,status)
 VALUES($1,'Synthetic witness','GB','GBP',false,'standard','invoice','active')`,[company]);
 await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'owner',true)",[randomUUID(),company,actor]);
 await admin.query("INSERT INTO customers(id,company_id,name,status) VALUES($1,$2,'Synthetic witness customer','active')",[customer,company]);
 const mappings:Record<string,string>={},payment:Record<string,string>={};
 for(const [role,type] of [['receivables','asset'],['payables','liability'],['revenue','income'],['expense','expense'],['output_vat','liability'],['input_vat','asset'],['bank','asset'],['customer_credit','liability'],['supplier_prepayment','asset']]){
  const id=randomUUID();(role==='bank'||role==='customer_credit'||role==='supplier_prepayment'?payment:mappings)[role!]=id;
  await admin.query('INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,$3,$3,$4,true)',[id,company,role,type]);
 }
 await saveConfiguration(company,actor,{revision:null,mappings,business_accounting_basis:'accrual'});
 await addPeriod(company,actor,{start_date:'2026-01-01',end_date:'2026-12-31',financial_year_label:'Synthetic 2026'});
 await savePaymentConfiguration(company,actor,{revision:null,mappings:payment});
 const body={id:randomUUID(),kind:'payment',party_type:'customer',party_id:customer,payment_id:null,date:'2026-11-03',reference:'Synthetic witness cash',amount_minor:'100',allocations:[]};
 const review=await previewPayment(company,actor,body);
 return {company,body:{...body,review_token:review.review_token}};
}
async function insertWitness(q:any,f:any,overrides:{hash?:string,actor?:string,journal?:string}={}){
 return q.query(`INSERT INTO public.conditional_discount_commit_witnesses(company_id,event_id,journal_id,event_source_hash,actor_id)
 SELECT e.company_id,e.id,COALESCE($5::uuid,e.journal_id),COALESCE($4::text,j.source_revision),$3 FROM public.accounting_payment_events e
 JOIN public.canonical_journal_entries j ON j.id=e.journal_id WHERE e.company_id=$1 AND e.id=$2`,[f.company,f.body.id,overrides.actor??actor,overrides.hash??null,overrides.journal??null]);
}
for(const mode of ['parent','unreleased savepoint','released savepoint']) test(`real PostgreSQL: ${mode} cannot witness before top commit`,async()=>{
 const f=await fixture();
 await withCanonicalPostingTransaction(async tx=>{
  const q=queryAdapter(tx);
  if(mode!=='parent') await q.query('SAVEPOINT payment_child');
  await postPayment(f.company,actor,f.body,undefined,tx);
  if(mode==='released savepoint') await q.query('RELEASE SAVEPOINT payment_child');
  const row=(await q.query(`SELECT source_xid=pg_current_xact_id() same,pg_xact_status(source_xid) status FROM public.conditional_discount_payment_transactions WHERE event_id=$1`,[f.body.id])).rows[0];
  assert.deepEqual(row,{same:true,status:'in progress'});
  await q.query('SAVEPOINT rejected_witness');
  await assert.rejects(()=>insertWitness(q,f),(e:any)=>/separately committed/.test(e.cause?.message??e.message));
  await q.query('ROLLBACK TO SAVEPOINT rejected_witness');
  // Another connection cannot observe this uncommitted event/receipt.
  assert.equal((await pool.query('SELECT count(*)::int n FROM public.conditional_discount_payment_transactions WHERE event_id=$1',[f.body.id])).rows[0].n,0);
 });
 const first=await captureCommittedPaymentWitness(f.company,actor,f.body.id);
 assert.equal(first.status,'recorded');
 assert.deepEqual(await captureCommittedPaymentWitness(f.company,actor,f.body.id),first);
});
test('real PostgreSQL: rollback removes both source and transaction receipt',async()=>{
 const f=await fixture();
 await assert.rejects(()=>withCanonicalPostingTransaction(async tx=>{await postPayment(f.company,actor,f.body,undefined,tx);throw Error('synthetic rollback');}),/synthetic rollback/);
 for(const table of ['accounting_payment_events','conditional_discount_payment_transactions'])
  assert.equal((await pool.query(`SELECT count(*)::int n FROM public.${table} WHERE ${table==='accounting_payment_events'?'id':'event_id'}=$1`,[f.body.id])).rows[0].n,0);
});
test('real PostgreSQL: runtime cannot forge, update, delete or truncate transaction receipts',async()=>{
 const f=await fixture();await postPayment(f.company,actor,f.body);
 for(const sql of [
  `INSERT INTO public.conditional_discount_payment_transactions(company_id,event_id,source_xid,cluster_id) VALUES('${f.company}','${f.body.id}',pg_current_xact_id(),'forged')`,
  'UPDATE public.conditional_discount_payment_transactions SET cluster_id=cluster_id',
  'DELETE FROM public.conditional_discount_payment_transactions',
  'TRUNCATE public.conditional_discount_payment_transactions',
  'UPDATE public.conditional_discount_commit_witnesses SET observed_at=clock_timestamp()',
  'DELETE FROM public.conditional_discount_commit_witnesses',
  'TRUNCATE public.conditional_discount_commit_witnesses',
 ]) await assert.rejects(()=>pool.query(sql),(e:any)=>e.code==='42501');
 const c=await admin.connect();try{await c.query('BEGIN');
  await assert.rejects(()=>c.query('UPDATE public.conditional_discount_payment_transactions SET cluster_id=cluster_id'),/immutable/);
 }finally{await c.query('ROLLBACK');c.release();}
});
test('real PostgreSQL: missing trigger rejects schema; foreign origin cannot certify an unwitnessed event',async()=>{
 const f=await fixture();await withCanonicalPostingTransaction(tx=>postPayment(f.company,actor,f.body,undefined,tx));
 const c=await admin.connect();try{
  await c.query('BEGIN');await c.query('ALTER TABLE public.conditional_discount_payment_transactions DISABLE TRIGGER conditional_discount_transaction_immutable');
  await c.query("UPDATE public.conditional_discount_payment_transactions SET cluster_id='foreign-cluster' WHERE event_id=$1",[f.body.id]);
  await c.query('ALTER TABLE public.conditional_discount_payment_transactions ENABLE ALWAYS TRIGGER conditional_discount_transaction_immutable');
  await c.query('SET LOCAL ROLE ledgerly_api');
  await assert.rejects(()=>insertWitness(c,f),/separately committed/);
 }finally{await c.query('ROLLBACK');c.release();}
 // Committed metadata damage is confined to this disposable database and restored.
 await admin.query('ALTER TABLE public.conditional_discount_commit_witnesses DISABLE TRIGGER conditional_discount_witness_observe');
 try{await assert.rejects(()=>captureCommittedPaymentWitness(f.company,actor,f.body.id),/CONDITIONAL_WITNESS_SCHEMA_INCOMPLETE/);}
 finally{await admin.query('ALTER TABLE public.conditional_discount_commit_witnesses ENABLE ALWAYS TRIGGER conditional_discount_witness_observe');}
 assert.equal((await captureCommittedPaymentWitness(f.company,actor,f.body.id)).status,'recorded');
});
test('real PostgreSQL: fabricated clocks are replaced and the first observation survives retries',async()=>{
 const f=await fixture();await withCanonicalPostingTransaction(tx=>postPayment(f.company,actor,f.body,undefined,tx));
 const floor=(await pool.query('SELECT clock_timestamp()::text floor')).rows[0].floor;
 await pool.query(`INSERT INTO public.conditional_discount_commit_witnesses(company_id,event_id,journal_id,event_source_hash,actor_id,event_created_at,observed_at)
 SELECT e.company_id,e.id,e.journal_id,j.source_revision,$3,'1900-01-01','1901-01-01' FROM public.accounting_payment_events e
 JOIN public.canonical_journal_entries j ON j.id=e.journal_id WHERE e.company_id=$1 AND e.id=$2`,[f.company,f.body.id,actor]);
 assert.deepEqual((await pool.query(`SELECT w.event_created_at=e.created_at source_clock,w.observed_at >= $2::timestamptz fresh_clock
 FROM public.conditional_discount_commit_witnesses w JOIN public.accounting_payment_events e ON e.id=w.event_id WHERE w.event_id=$1`,[f.body.id,floor])).rows[0],{source_clock:true,fresh_clock:true});
 const first=await captureCommittedPaymentWitness(f.company,actor,f.body.id);
 assert.deepEqual(await captureCommittedPaymentWitness(f.company,actor,f.body.id),first);
});
test('real PostgreSQL: existing valid witness remains readable after origin mismatch without recertification',async()=>{
 const f=await fixture();await postPayment(f.company,actor,f.body);
 const first=await captureCommittedPaymentWitness(f.company,actor,f.body.id);
 assert.equal(first.status,'recorded');
 const original=(await admin.query('SELECT cluster_id FROM public.conditional_discount_payment_transactions WHERE event_id=$1',[f.body.id])).rows[0].cluster_id;
 const change=async(cluster:string)=>{const c=await admin.connect();try{
  await c.query('BEGIN');await c.query('ALTER TABLE public.conditional_discount_payment_transactions DISABLE TRIGGER conditional_discount_transaction_immutable');
  await c.query('UPDATE public.conditional_discount_payment_transactions SET cluster_id=$2 WHERE event_id=$1',[f.body.id,cluster]);
  await c.query('ALTER TABLE public.conditional_discount_payment_transactions ENABLE ALWAYS TRIGGER conditional_discount_transaction_immutable');await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}};
 try{await change('synthetic-restored-origin');assert.deepEqual(await captureCommittedPaymentWitness(f.company,actor,f.body.id),first);}
 finally{await change(original);}
});

test('real PostgreSQL: restricted runtime cannot poison the first receipt hash, journal or observer',async()=>{
 const f=await fixture();
 // Commit the source without automatic observation, leaving the first receipt available.
 await withCanonicalPostingTransaction(tx=>postPayment(f.company,actor,f.body,undefined,tx));
 const foreign=await fixture();
 await withCanonicalPostingTransaction(tx=>postPayment(foreign.company,actor,foreign.body,undefined,tx));
 const foreignJournal=(await pool.query('SELECT journal_id FROM public.accounting_payment_events WHERE id=$1',[foreign.body.id])).rows[0].journal_id;
 const inactive=`inactive-${randomUUID()}`,readonly=`readonly-${randomUUID()}`,foreignActor=`foreign-${randomUUID()}`,observer=`observer-${randomUUID()}`;
 for(const [company,user,role,active] of [[f.company,inactive,'owner',false],[f.company,readonly,'read_only',true],
   [foreign.company,foreignActor,'owner',true],[f.company,observer,'admin',true]])
  await admin.query('INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,$4,$5)',[randomUUID(),company,user,role,active]);
 const cases=[
  {overrides:{hash:'sha256:'+'0'.repeat(64)},message:/Matching canonical payment identity/},
  {overrides:{journal:foreignJournal},message:/separately committed/},
  ...[inactive,readonly,foreignActor,`missing-${randomUUID()}`].map(actor=>({overrides:{actor},message:/Active writable company observer/})),
 ];
 for(const candidate of cases){
  await assert.rejects(()=>insertWitness(pool,f,candidate.overrides),candidate.message);
  assert.equal((await pool.query('SELECT count(*)::int n FROM public.conditional_discount_commit_witnesses WHERE company_id=$1 AND event_id=$2',[f.company,f.body.id])).rows[0].n,0);
 }
 // The observer may be another authorized member, rather than the payment creator.
 const first=await captureCommittedPaymentWitness(f.company,observer,f.body.id);
 assert.equal(first.status,'recorded');
 assert.equal((await pool.query('SELECT actor_id FROM public.conditional_discount_commit_witnesses WHERE company_id=$1 AND event_id=$2',[f.company,f.body.id])).rows[0].actor_id,observer);
 assert.deepEqual(await captureCommittedPaymentWitness(f.company,actor,f.body.id),first);
});
test('real PostgreSQL: inconsistent canonical posting effect cannot certify a receipt',async()=>{
 const f=await fixture();
 await withCanonicalPostingTransaction(tx=>postPayment(f.company,actor,f.body,undefined,tx));
 const c=await admin.connect();
 try{
  await c.query('BEGIN');
  // Simulate damaged immutable history only inside this rolled-back disposable transaction.
  await c.query('ALTER TABLE public.accounting_posting_effects DISABLE TRIGGER ledgerly_accounting_posting_effects_guard');
  await c.query("UPDATE public.accounting_posting_effects SET source_revision=$2 WHERE company_id=$1 AND source_id=$3",[f.company,'sha256:'+'0'.repeat(64),f.body.id]);
  await c.query('ALTER TABLE public.accounting_posting_effects ENABLE ALWAYS TRIGGER ledgerly_accounting_posting_effects_guard');
  await c.query('SET LOCAL ROLE ledgerly_api');
  await assert.rejects(()=>insertWitness(c,f),/Matching canonical payment identity/);
 }finally{await c.query('ROLLBACK');c.release();}
 assert.equal((await pool.query('SELECT count(*)::int n FROM public.conditional_discount_commit_witnesses WHERE company_id=$1 AND event_id=$2',[f.company,f.body.id])).rows[0].n,0);
 const first=await captureCommittedPaymentWitness(f.company,actor,f.body.id);
 assert.equal(first.status,'recorded');
 assert.deepEqual(await captureCommittedPaymentWitness(f.company,actor,f.body.id),first);
});

import {captureConditionalEvidence,getConditionalEvidence} from './conditionalDiscount';
import {conditionalTermsHash} from '../financialDrafts/contract';
import {saveDocument,getDocument} from './documents';
import {postDocument} from './posting';
async function ordinaryOriginalFixture(partyType:'customer'|'supplier'='customer') {
 const f=await fixture();
 if(partyType==='supplier') {
  const supplier=randomUUID();
  await admin.query("INSERT INTO suppliers(id,company_id,name,status) VALUES($1,$2,'Synthetic binding supplier','active')",[supplier,f.company]);
  f.body={...f.body,party_type:partyType,party_id:supplier};
 }
 await admin.query(`INSERT INTO vat_tax_rules(id,company_id,code,label,rate,treatment,effective_from,is_active)
 VALUES($1,$2,'NONE','Synthetic no VAT',0,'no_vat','2000-01-01',true)`,[randomUUID(),f.company]);
 const draft=await saveDocument(f.company,actor,{kind:partyType==='customer'?'sales_invoice':'purchase_bill',source:{
  contract:'w03.draft.v1',currency:'GBP',customer_id:f.body.party_id,invoice_number:'ORIGIN-'+randomUUID(),
  issue_date:'2026-11-01',due_date:'2026-11-30',payment_terms:29,reference:'',notes:'',
  line_items:[{description:'Synthetic original',quantity:'1',unit_price:'120',tax_code:'NONE'}]}});
 return {...f,draft};
}
for(const savepoint of ['none','released','unreleased']) test(`real PostgreSQL: original journal top-xid origin / ${savepoint}`,async()=>{
 const f=await ordinaryOriginalFixture();
 await withCanonicalPostingTransaction(async tx=>{
  const q=queryAdapter(tx);
  if(savepoint!=='none') await q.query('SAVEPOINT original_post');
  const result=await postDocument(f.company,actor,f.draft.id,f.draft.revision,undefined,tx);
  if(savepoint==='released') await q.query('RELEASE SAVEPOINT original_post');
  const receipt=(await q.query(`SELECT source_xid=pg_current_xact_id() same,pg_xact_status(source_xid) status
    FROM conditional_discount_journal_origins WHERE company_id=$1 AND journal_id=$2`,
    [f.company,result.journal_id])).rows[0];
  assert.deepEqual(receipt,{same:true,status:'in progress'});
  assert.equal((await pool.query(`SELECT count(*)::int n FROM conditional_discount_journal_origins
    WHERE company_id=$1 AND journal_id=$2`,[f.company,result.journal_id])).rows[0].n,0);
 });
 const receipt=(await pool.query(`SELECT pg_xact_status(source_xid) status FROM conditional_discount_journal_origins
   WHERE company_id=$1 AND journal_id=(SELECT journal_id FROM accounting_document_sources WHERE id=$2)`,
   [f.company,f.draft.id])).rows[0];
 assert.equal(receipt.status,'committed');
});
test('real PostgreSQL: original origin rolls back with journal and cannot be retroactively attached or forged',async()=>{
 const f=await ordinaryOriginalFixture();
 let journal:string|undefined;
 await assert.rejects(()=>withCanonicalPostingTransaction(async tx=>{
  const posted=await postDocument(f.company,actor,f.draft.id,f.draft.revision,undefined,tx);
  journal=posted.journal_id;throw Error('synthetic original rollback');
 }),/synthetic original rollback/);
 assert.equal((await pool.query('SELECT count(*)::int n FROM conditional_discount_journal_origins WHERE journal_id=$1',[journal])).rows[0].n,0);
 const posted=await postDocument(f.company,actor,f.draft.id,f.draft.revision);
 await assert.rejects(()=>pool.query(`SELECT bind_conditional_discount_original($1,$2,$3,'{}'::jsonb,$4,$5,'{}')`,
  [f.company,f.draft.id,posted.journal_id,'sha256:'+'0'.repeat(64),actor]),/same original posting transaction/);
 await assert.rejects(()=>pool.query(`SELECT bind_conditional_discount_original($1,$2,$3,'{}'::jsonb,$4,$5,'{}')`,
  [randomUUID(),f.draft.id,posted.journal_id,'sha256:'+'0'.repeat(64),actor]),/same original posting transaction/);
 for(const table of ['conditional_discount_journal_origins','conditional_discount_original_bindings','conditional_discount_original_observations']) {
  for(const operation of ['INSERT','UPDATE','DELETE','TRUNCATE']) {
   const result=(await pool.query('SELECT has_table_privilege(current_user,$1,$2) allowed',[table,operation])).rows[0];
   assert.equal(result.allowed,false,`${table} ${operation} must not be directly writable`);
  }
 }
});
for(const partyType of ['customer','supplier'] as const) test(`real PostgreSQL: ${partyType} evidence capture/replay/read/draft/clear and disabled posting`,async()=>{
 const f=await fixture(),party=('abcdefab'+randomUUID().slice(8)).toUpperCase();
 await admin.query(`INSERT INTO ${partyType==='customer'?'customers':'suppliers'}(id,company_id,name,status) VALUES($1,$2,'Synthetic conditional party','active')`,[party.toLowerCase(),f.company]);
 await admin.query(`INSERT INTO vat_tax_rules(id,company_id,code,label,rate,treatment,effective_from,is_active)
 VALUES($1,$2,'NONE','No VAT',0,'no_vat','2026-01-01',true)`,[randomUUID(),f.company]);
 const terms={version:1 as const,party_type:partyType,party_id:party,currency:'GBP' as const,agreement_id:('abcdefab'+randomUUID().slice(8)).toUpperCase(),agreement_date:'2026-11-01',payment_deadline:'2026-11-30',discount_gross_pence:'1200'};
 const body={request_id:randomUUID(),terms,evidence_text:'Agreed £12; café 😀\n"quoted" / \\ bytes',attested:true};
 const [receipt,replayed]=await Promise.all([captureConditionalEvidence(f.company,actor,body),captureConditionalEvidence(f.company,actor,body)]);
 assert.equal(receipt.id,replayed.id);
 assert.equal((await admin.query('SELECT count(*)::int n FROM conditional_discount_evidence WHERE company_id=$1 AND request_id=$2',[f.company,body.request_id])).rows[0].n,1);
 assert.equal(receipt.terms_hash,conditionalTermsHash(terms));
 assert.equal(receipt.evidence_hash,'sha256:'+createHash('sha256').update(body.evidence_text,'utf8').digest('hex'));
 assert.equal((await captureConditionalEvidence(f.company,actor,body)).id,receipt.id);
 assert.equal((await getConditionalEvidence(f.company,actor,receipt.id)).evidence_text,body.evidence_text);
 await assert.rejects(()=>captureConditionalEvidence(f.company,actor,{...body,evidence_text:'changed'}),/CONDITIONAL_EVIDENCE_REQUEST_CONFLICT/);
 const source={contract:'w03.draft.v1',currency:'GBP',customer_id:party,invoice_number:'COND-'+randomUUID(),issue_date:'2026-11-01',due_date:'2026-11-30',payment_terms:29,reference:'',notes:'',line_items:[{description:'Synthetic',quantity:'1',unit_price:'120',tax_code:'NONE'}],conditional_discount:{...terms,evidence_receipt_id:receipt.id}};
 const draft=await saveDocument(f.company,actor,{kind:partyType==='customer'?'sales_invoice':'purchase_bill',source});
 await assert.rejects(()=>postDocument(f.company,actor,draft.id,draft.revision),/CONDITIONAL_POSTING_NOT_AVAILABLE/);
 assert.equal((await getDocument(f.company,actor,draft.id)).status,'draft');
 assert.equal((await admin.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1 AND source_id=$2',[f.company,draft.id])).rows[0].n,0);
 await assert.rejects(()=>saveDocument(f.company,actor,{source:{contract:'w03.draft.v1',conditional_discount:{...source.conditional_discount,discount_gross_pence:'1199'}}},draft.id,draft.revision),/CONDITIONAL_EVIDENCE_TERMS_MISMATCH/);
 const cleared=await saveDocument(f.company,actor,{source:{contract:'w03.draft.v1',conditional_discount:null}},draft.id,draft.revision);
 assert.equal(cleared.source.conditional_discount,undefined);
 for(const statement of ['INSERT INTO conditional_discount_evidence SELECT * FROM conditional_discount_evidence','UPDATE conditional_discount_evidence SET evidence_text=evidence_text','DELETE FROM conditional_discount_evidence','TRUNCATE conditional_discount_evidence']) await assert.rejects(()=>pool.query(statement));
 const foreign=await fixture();
 await assert.rejects(()=>getConditionalEvidence(foreign.company,actor,receipt.id),/RESOURCE_NOT_FOUND/);
 await assert.rejects(()=>captureConditionalEvidence(f.company,actor,{...body,request_id:randomUUID(),terms:{...terms,party_id:foreign.body.party_id}}));
 const direct=await pool.query('SELECT capture_conditional_discount_evidence($1,$2,$3,$4,$5,true) id',[f.company,actor,body.request_id,JSON.stringify(terms),body.evidence_text]);
 assert.equal(direct.rows[0].id,receipt.id);
 await assert.rejects(()=>pool.query('SELECT capture_conditional_discount_evidence($1,$2,$3,$4,$5,false)',[f.company,actor,randomUUID(),JSON.stringify(terms),body.evidence_text]),/Invalid agreement evidence/);
 for(const patch of [{version:null},{currency:null},{party_type:null},{discount_gross_pence:null}]) await assert.rejects(()=>pool.query('SELECT capture_conditional_discount_evidence($1,$2,$3,$4,$5,true)',[f.company,actor,randomUUID(),JSON.stringify({...terms,...patch}),body.evidence_text]),/Invalid agreement evidence/);
 await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2',[f.company,actor]);
 await assert.rejects(()=>getConditionalEvidence(f.company,actor,receipt.id),/RESOURCE_NOT_FOUND/);
 await assert.rejects(()=>pool.query('SELECT capture_conditional_discount_evidence($1,$2,$3,$4,$5,true)',[f.company,actor,randomUUID(),JSON.stringify(terms),body.evidence_text]),/Evidence capability unavailable/);
});

import {postCanonicalJournalInTransaction,type DatabaseTransaction,type LockedAuthority} from '../accounting/canonicalPosting';
import {calculateDocument} from './documents';
import {journalLines} from './documentJournal';
import {hash,scope,document} from './core';
import {bindConditionalOriginal,observeConditionalOriginal,prepareConditionalOriginal,canonicalConditionalPayload} from './conditionalDiscount';
async function conditionalOriginalFixture(partyType:'customer'|'supplier'='customer',deadline='2026-11-30') {
 const f=await ordinaryOriginalFixture(partyType);
 const terms={version:1,party_type:partyType,party_id:f.body.party_id,currency:'GBP',agreement_id:randomUUID(),agreement_date:'2026-11-01',payment_deadline:deadline,discount_gross_pence:'1200'};
 const evidence=await captureConditionalEvidence(f.company,actor,{request_id:randomUUID(),terms,evidence_text:'Synthetic original binding agreement',attested:true});
 const draft=await saveDocument(f.company,actor,{kind:partyType==='customer'?'sales_invoice':'purchase_bill',source:{...f.draft.source,conditional_discount:{...terms,evidence_receipt_id:evidence.id}}},f.draft.id,f.draft.revision);
 await assert.rejects(()=>postDocument(f.company,actor,draft.id,draft.revision),/CONDITIONAL_POSTING_NOT_AVAILABLE/);
 return {...f,draft};
}
// Internal test harness for the prerequisite: the existing canonical engine and
// native calculation/line builder supply financial authority. Public admission
// remains disabled; no production bypass flag or alternate writer is added.
async function bindInOriginalTransaction(f:any,tx:DatabaseTransaction,beforeBind?:(q:any,prepared:any,journalId:string)=>Promise<void>) {
 const q=queryAdapter(tx);await scope(q,f.company,actor,true,true);
 const row=await document(q,f.company,f.draft.id,true);
 const fresh=await calculateDocument(q,f.company,row.kind,{},row);
 for(const field of ['source','money','tax_context','posting_accounts']) assert.equal(hash(fresh[field as keyof typeof fresh]),hash(row[field]));
 const prepared=await prepareConditionalOriginal(q,f.company,row);
 const financialHash=prepared.bindingHash; // Exact native payload commitment exists before journal INSERT.
 const locked=<T>(authority:T,key:string):LockedAuthority<T>=>({authority,recordKeys:[key],capturedToken:{revision:row.revision},lockMode:'FOR UPDATE',transactionBound:true,
  validateCurrent:({command})=>command.sourceRevision===row.revision&&command.sourceEvidenceHash===financialHash?{ok:true}:{ok:false,code:'transaction_contract_invalid',message:'Synthetic source changed'}});
 const result=await postCanonicalJournalInTransaction(tx,{
  principal:{kind:'user',userId:actor,requestedCompanyId:f.company},requestedCompanyId:f.company,
  sourceType:row.kind,sourceId:row.id,sourceRevision:row.revision,sourceStatus:'draft',sourceEvidenceHash:financialHash,
  postingKind:'ordinary_document',economicEffectId:`document:${row.id}`,idempotencyKey:`document:${row.id}`,
  accountIds:Object.values(row.posting_accounts) as string[],postingDate:row.source.issue_date,configurationVersionId:row.mapping_revision,
  currencyCode:'GBP',description:row.source.invoice_number,reference:row.source.reference,
 },{
  sourceProvider:{async lockForPosting(){return locked({companyId:f.company,sourceType:row.kind,sourceId:row.id,status:'draft',isPostable:true,sourceRevision:row.revision,evidenceHash:financialHash},`accounting_document_sources:${row.id}`);}},
  contextProvider:{async lockForPosting(input){
   const p=(await q.query(`SELECT * FROM accounting_document_periods WHERE company_id=$1 AND start_date<=$2 AND end_date>=$2 FOR UPDATE`,[f.company,row.source.issue_date])).rows[0];
   assert.equal(p.status,'OPEN');
   const accounts=(await q.query('SELECT * FROM chart_of_accounts WHERE company_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',[f.company,input.accountIds])).rows;
   return locked({companyId:f.company,financialYearId:p.financial_year_id,accountingPeriodId:p.id,periodStatus:'OPEN' as const,configurationVersionId:row.mapping_revision,currencyCode:'GBP',
    accounts:Object.fromEntries(accounts.map(a=>[a.id,{id:a.id,companyId:f.company,isActive:a.is_active,isEligible:true,currencyCode:'GBP'}]))},`accounting_document_periods:${p.id}`);
  }},lineBuilder:{async build(){return journalLines(row);}},
 });
 await q.query("UPDATE accounting_document_sources SET status='posted',journal_id=$3 WHERE company_id=$1 AND id=$2",[f.company,row.id,result.journalId]);
 await q.query(`UPDATE ${row.kind==='sales_invoice'?'sales_invoices':'purchase_bills'} SET status='posted' WHERE company_id=$1 AND id=$2`,[f.company,row.id]);
 if(beforeBind) await beforeBind(q,prepared,result.journalId);
 const binding=await bindConditionalOriginal(q,f.company,actor,row.id);
 return {binding,journalId:result.journalId};
}
for(const savepoint of ['parent','unreleased','released']) test(`real PostgreSQL: successful conditional binding and committed observation / ${savepoint}`,async()=>{
 const f=await conditionalOriginalFixture();
 await withCanonicalPostingTransaction(async tx=>{
  const q=queryAdapter(tx);
  if(savepoint!=='parent') await q.query('SAVEPOINT conditional_original');
  const {binding,journalId}=await bindInOriginalTransaction(f,tx);
  if(savepoint==='released') await q.query('RELEASE SAVEPOINT conditional_original');
  assert.equal(Object.hasOwn(binding,'journal_id'),false);assert.ok(journalId);assert.equal(binding.vector[0].gross_pence,'1200');
  assert.deepEqual(await bindConditionalOriginal(q,f.company,actor,f.draft.id),binding);
  await q.query('SAVEPOINT cannot_observe');
  await assert.rejects(()=>q.query('SELECT observe_conditional_discount_original($1,$2,$3)',[f.company,f.draft.id,actor]),(error:any)=>/not committed/.test(error.cause?.message??error.message));
  await q.query('ROLLBACK TO SAVEPOINT cannot_observe');
  assert.equal((await pool.query('SELECT count(*)::int n FROM conditional_discount_original_bindings WHERE document_id=$1',[f.draft.id])).rows[0].n,0);
 });
 const floor=(await pool.query('SELECT clock_timestamp()::text floor')).rows[0].floor;
 const first=await observeConditionalOriginal(f.company,actor,f.draft.id);
 assert.ok(first?.observed_at);
 assert.equal((await pool.query('SELECT $1::timestamptz >= $2::timestamptz fresh',[first.observed_at,floor])).rows[0].fresh,true);
 assert.deepEqual(await observeConditionalOriginal(f.company,actor,f.draft.id),first);
 assert.equal((await pool.query('SELECT count(*)::int n FROM conditional_discount_original_observations WHERE document_id=$1',[f.draft.id])).rows[0].n,1);
 await assert.rejects(()=>observeConditionalOriginal(randomUUID(),actor,f.draft.id),/RESOURCE_NOT_FOUND/);
});
test('real PostgreSQL: binding rolls back with its native journal and source',async()=>{
 const f=await conditionalOriginalFixture();
 await assert.rejects(()=>withCanonicalPostingTransaction(async tx=>{await bindInOriginalTransaction(f,tx);throw Error('synthetic binding rollback');}),/synthetic binding rollback/);
 for(const table of ['conditional_discount_original_bindings','conditional_discount_original_observations']) assert.equal((await pool.query(`SELECT count(*)::int n FROM ${table} WHERE document_id=$1`,[f.draft.id])).rows[0].n,0);
 assert.equal((await pool.query('SELECT status FROM accounting_document_sources WHERE id=$1',[f.draft.id])).rows[0].status,'draft');
 assert.equal((await pool.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE source_id=$1',[f.draft.id])).rows[0].n,0);
});
test('real PostgreSQL: original observer rejects a disabled immutable guard before reading evidence',async()=>{
 const f=await conditionalOriginalFixture();await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));
 await admin.query('ALTER TABLE conditional_discount_original_bindings DISABLE TRIGGER conditional_original_immutable');
 try{await assert.rejects(()=>observeConditionalOriginal(f.company,actor,f.draft.id),/CONDITIONAL_BINDING_SCHEMA_INCOMPLETE/);}
 finally{await admin.query('ALTER TABLE conditional_discount_original_bindings ENABLE ALWAYS TRIGGER conditional_original_immutable');}
 assert.equal((await pool.query('SELECT count(*)::int n FROM conditional_discount_original_observations WHERE document_id=$1',[f.draft.id])).rows[0].n,0);
 assert.ok((await observeConditionalOriginal(f.company,actor,f.draft.id)).observed_at);
});

for(const existing of [false,true]) test(`real PostgreSQL: poisoned SQL binding payload rejects service ${existing?'replay':'first observation'}`,async()=>{
 const f=await conditionalOriginalFixture();await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));
 const first=existing?await observeConditionalOriginal(f.company,actor,f.draft.id):undefined;
 const original=(await admin.query('SELECT binding,binding_hash,canonical_payload FROM conditional_discount_original_bindings WHERE document_id=$1',[f.draft.id])).rows[0];
 const replace=async(binding:any,bindingHash:string,payload=canonicalConditionalPayload(binding))=>{
  const q=await admin.connect();try{
   await q.query('BEGIN');await q.query('ALTER TABLE conditional_discount_original_bindings DISABLE TRIGGER conditional_original_immutable');
   await q.query('UPDATE conditional_discount_original_bindings SET binding=$2,binding_hash=$3,canonical_payload=$4 WHERE document_id=$1',[f.draft.id,JSON.stringify(binding),bindingHash,payload]);
   await q.query('ALTER TABLE conditional_discount_original_bindings ENABLE ALWAYS TRIGGER conditional_original_immutable');await q.query('COMMIT');
  }catch(e){await q.query('ROLLBACK');throw e;}finally{q.release();}
 };
 try{
  // Administrator-only corruption is confined to this disposable fixture and
  // restored after every case. A self-consistent payload hash is insufficient.
  for(const patch of [{journal_id:randomUUID()},{evidence_id:randomUUID()},{terms_hash:hash('forged')},{source_hash:hash('forged')},{vector:[]},{deadline:'2026-12-01'}]){
   const poisoned={...original.binding,...patch};await replace(poisoned,hash(poisoned));
   await assert.rejects(()=>observeConditionalOriginal(f.company,actor,f.draft.id),/CONDITIONAL_BINDING_INVALID/);
   await assert.rejects(()=>pool.query('SELECT observe_conditional_discount_original($1,$2,$3)',[f.company,f.draft.id,actor]),/payload commitment invalid/);
   assert.deepEqual((await pool.query('SELECT observed_at::text FROM conditional_discount_original_observations WHERE document_id=$1',[f.draft.id])).rows[0],first);
   await replace(original.binding,original.binding_hash);
  }
 }finally{await replace(original.binding,original.binding_hash);}
 const restored=await observeConditionalOriginal(f.company,actor,f.draft.id);
 if(existing) assert.deepEqual(restored,first);else assert.ok(restored.observed_at);
});

test('real PostgreSQL: restricted SQL cannot replace the pre-journal native payload commitment',async()=>{
 const f=await conditionalOriginalFixture();
 await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx,async(q,prepared,journalId)=>{
  const b=prepared.binding;
  const variants=[
   {binding:{...b,vector:[]}}, {binding:{...b,source_hash:hash('forged')}},
   {binding:{...b,financial_hash:hash('forged')}}, {binding:{...b,evidence_id:randomUUID()}},
   {binding:{...b,terms_hash:hash('forged')}}, {binding:{...b,company_id:randomUUID()}},
   {binding:{...b,document_id:randomUUID()}}, {binding:{...b,journal_id:journalId}},
   {binding:b,payload:'{'}, {binding:b,payload:JSON.stringify({...b,vector:[]})},
   {binding:b,payload:prepared.canonicalPayload+' '}, {binding:b,hash:hash('forged')},
  ];
  await q.query('SAVEPOINT duplicate_binding_member');
  await q.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'owner',false)",[randomUUID(),f.company,actor]);
  await assert.rejects(()=>q.query('SELECT bind_conditional_discount_original($1,$2,$3,$4,$5,$6,$7)',
   [f.company,f.draft.id,journalId,JSON.stringify(b),prepared.bindingHash,actor,prepared.canonicalPayload]),
   (error:any)=>/source or posting identity invalid/.test(error.cause?.message??error.message));
  await q.query('ROLLBACK TO SAVEPOINT duplicate_binding_member');
  for(const [index,v] of variants.entries()){
   const variant=v as any,payload=variant.payload??canonicalConditionalPayload(variant.binding);
   const digest=variant.hash??'sha256:'+createHash('sha256').update(payload,'utf8').digest('hex');
   await q.query('SAVEPOINT poison_binding');
   await assert.rejects(()=>q.query('SELECT bind_conditional_discount_original($1,$2,$3,$4,$5,$6,$7)',
    [f.company,f.draft.id,journalId,JSON.stringify(variant.binding),digest,actor,payload]),
    (error:any)=>/Conditional original (payload commitment|source or posting identity) invalid|invalid input syntax for type json/.test(error.cause?.message??error.message),`poison ${index}`);
   await q.query('ROLLBACK TO SAVEPOINT poison_binding');
   assert.equal((await q.query('SELECT count(*)::int n FROM conditional_discount_original_bindings WHERE document_id=$1',[f.draft.id])).rows[0].n,0);
  }
 }));
 const persisted=(await pool.query('SELECT * FROM conditional_discount_original_bindings WHERE document_id=$1',[f.draft.id])).rows[0];
 assert.equal(persisted.binding_hash,'sha256:'+createHash('sha256').update(persisted.canonical_payload,'utf8').digest('hex'));
 await assert.rejects(()=>pool.query('SELECT bind_conditional_discount_original($1,$2,$3,$4,$5,$6,$7)',
  [f.company,f.draft.id,persisted.journal_id,JSON.stringify(persisted.binding),persisted.binding_hash,actor,persisted.canonical_payload]),/same original posting transaction/);
 const first=await observeConditionalOriginal(f.company,actor,f.draft.id);
 await pool.query('SELECT observe_conditional_discount_original($1,$2,$3)',[f.company,f.draft.id,actor]);
 assert.deepEqual(await observeConditionalOriginal(f.company,actor,f.draft.id),first);
});

test('real PostgreSQL: direct observer rejects duplicate identity and rechecks a locked concurrent revocation',async()=>{
 const f=await conditionalOriginalFixture();await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));
 const duplicate=randomUUID();
 await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'owner',false)",[duplicate,f.company,actor]);
 try{await assert.rejects(()=>pool.query('SELECT observe_conditional_discount_original($1,$2,$3)',[f.company,f.draft.id,actor]),/Active writable company membership required/);}
 finally{await admin.query('DELETE FROM company_users WHERE id=$1',[duplicate]);}
 const revoker=await admin.connect(),observer=await pool.connect();let pending:Promise<any>|undefined;
 try{
  const revokerPid=(await revoker.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const observerPid=(await observer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  await revoker.query('BEGIN');
  await revoker.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2',[f.company,actor]);
  pending=observer.query('SELECT observe_conditional_discount_original($1,$2,$3)',[f.company,f.draft.id,actor]).then(()=>({succeeded:true}),error=>({error}));
  let blocked=false;
  for(let i=0;i<150&&!blocked;i++){
   blocked=(await revoker.query('SELECT $1::int=ANY(pg_blocking_pids($2::int)) blocked',[revokerPid,observerPid])).rows[0].blocked;
   if(!blocked) await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.equal(blocked,true,'observer must wait on the real membership row lock');
  await revoker.query('COMMIT');
  const result=await pending;assert.match(result.error?.message??'',/Active writable company membership required/);
  assert.equal((await pool.query('SELECT count(*)::int n FROM conditional_discount_original_observations WHERE document_id=$1',[f.draft.id])).rows[0].n,0);
 }finally{
  await revoker.query('ROLLBACK');if(pending) await pending;
  revoker.release();observer.release();
  await admin.query('UPDATE company_users SET is_active=true WHERE company_id=$1 AND user_id=$2',[f.company,actor]);
 }
 assert.ok((await observeConditionalOriginal(f.company,actor,f.draft.id)).observed_at);
});

import {conditionalPaymentSnapshot} from './conditionalDiscount';
for(const partyType of ['customer','supplier'] as const) test(`real PostgreSQL: ${partyType} native cash freezes bindings before allocation and never backfills old pools`,async()=>{
 const f=await conditionalOriginalFixture(partyType);
 const oldBody={...f.body,id:randomUUID(),amount_minor:'100'};
 const oldPreview=await previewPayment(f.company,actor,oldBody);
 assert.deepEqual(oldPreview.source.conditional_binding_snapshot,{version:1,bindings:[]});
 const old=await postPayment(f.company,actor,{...oldBody,review_token:oldPreview.review_token});
 await withCanonicalPostingTransaction(async tx=>{
  await bindInOriginalTransaction(f,tx);
  assert.deepEqual(await conditionalPaymentSnapshot(queryAdapter(tx),f.company,partyType,f.body.party_id,'payment',null,[]),{version:1,bindings:[]});
 });
 const body={...f.body,id:randomUUID(),amount_minor:'10800'};
 const unobserved=await previewPayment(f.company,actor,body);
 assert.deepEqual(unobserved.source.conditional_binding_snapshot,{version:1,bindings:[]});
 const receipt=await observeConditionalOriginal(f.company,actor,f.draft.id);
 await assert.rejects(()=>postPayment(f.company,actor,{...body,review_token:unobserved.review_token}),/PAYMENT_REVIEW_STALE/);
 const fresh=await previewPayment(f.company,actor,body),snapshot=fresh.source.conditional_binding_snapshot!;
 assert.equal(snapshot.bindings.length,1);assert.equal(snapshot.bindings[0]!.document_id,f.draft.id);
 assert.equal(Date.parse(snapshot.bindings[0]!.observed_at),Date.parse(receipt.observed_at));
 assert.match(snapshot.bindings[0]!.observed_at,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
 await withCanonicalPostingTransaction(async tx=>{
  const q=queryAdapter(tx);await q.query("SET LOCAL TIME ZONE 'Pacific/Auckland'");
  assert.deepEqual(await conditionalPaymentSnapshot(q,f.company,partyType,f.body.party_id,'payment',null,[]),snapshot);
 });
 const payment=await postPayment(f.company,actor,{...body,review_token:fresh.review_token});
 const saved=(await pool.query('SELECT source FROM accounting_payment_events WHERE id=$1',[body.id])).rows[0].source;
 assert.deepEqual(saved.conditional_binding_snapshot,snapshot);
 assert.equal((await postPayment(f.company,actor,{...body,review_token:fresh.review_token})).journal_id,payment.journal_id);
 for(const [parent,value,expected] of [[old.id,'100',0],[payment.id,'10800',1]] as const) {
  const allocation={...body,id:randomUUID(),kind:'allocation',payment_id:parent,amount_minor:value,allocations:[{document_id:f.draft.id,amount_minor:value}]};
  const review=await previewPayment(f.company,actor,allocation);
  assert.equal(review.source.conditional_binding_snapshot!.bindings.length,expected);
  await postPayment(f.company,actor,{...allocation,review_token:review.review_token});
 }
 const direct={...body,id:randomUUID(),amount_minor:'100',allocations:[{document_id:f.draft.id,amount_minor:'100'}]};
 const directReview=await previewPayment(f.company,actor,direct);
 assert.deepEqual(directReview.source.conditional_binding_snapshot,snapshot);
 await assert.rejects(()=>postPayment(f.company,actor,{...direct,review_token:directReview.review_token},async()=>{throw Error('snapshot rollback');}),/snapshot rollback/);
 assert.equal((await pool.query('SELECT count(*)::int n FROM accounting_payment_events WHERE id=$1',[direct.id])).rows[0].n,0);
 await postPayment(f.company,actor,{...direct,review_token:directReview.review_token});
 assert.equal((await pool.query('SELECT source FROM accounting_payment_events WHERE id=$1',[old.id])).rows[0].source.conditional_binding_snapshot.bindings.length,0);
});

test('real PostgreSQL: new payment planning rejects a partial binding schema before any financial write',async()=>{
 const f=await fixture();
 await admin.query('ALTER TABLE conditional_discount_original_observations DISABLE TRIGGER conditional_original_immutable');
 try {
  await assert.rejects(()=>previewPayment(f.company,actor,f.body),/CONDITIONAL_BINDING_SCHEMA_INCOMPLETE/);
  await assert.rejects(()=>postPayment(f.company,actor,f.body),/CONDITIONAL_BINDING_SCHEMA_INCOMPLETE/);
  assert.equal((await pool.query('SELECT count(*)::int n FROM accounting_payment_events WHERE company_id=$1',[f.company])).rows[0].n,0);
  assert.equal((await pool.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n,0);
 } finally {await admin.query('ALTER TABLE conditional_discount_original_observations ENABLE ALWAYS TRIGGER conditional_original_immutable');}
});
test('real PostgreSQL: retained original observation survives foreign historical transaction origin without recertification',async()=>{
 const f=await conditionalOriginalFixture();
 await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));
 await observeConditionalOriginal(f.company,actor,f.draft.id);
 const before=await previewPayment(f.company,actor,f.body);
 const c=await admin.connect();try {
  await c.query('BEGIN');
  await c.query('ALTER TABLE conditional_discount_original_bindings DISABLE TRIGGER conditional_original_immutable');
  await c.query("UPDATE conditional_discount_original_bindings SET cluster_id='synthetic-restored-origin' WHERE company_id=$1 AND document_id=$2",[f.company,f.draft.id]);
  await c.query('ALTER TABLE conditional_discount_original_bindings ENABLE ALWAYS TRIGGER conditional_original_immutable');
  await c.query('SET LOCAL ROLE ledgerly_api');
  assert.deepEqual(await conditionalPaymentSnapshot(c,f.company,'customer',f.body.party_id,'payment',null,[]),before.source.conditional_binding_snapshot);
 } finally {await c.query('ROLLBACK');c.release();}
});

import {reviewConditionalCredit,reviewPaidCredit,commitPaidCredit,reviewCommercialCredit,commitCommercialCredit} from './paidCredit';
for(const side of ['customer','supplier'] as const) test(`real PostgreSQL: ${side} replacement agreement immutable history, replay, races and permissions`,async()=>{
 const f=await conditionalOriginalFixture(side);
 await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));
 await observeConditionalOriginal(f.company,actor,f.draft.id);
 const original=(await admin.query('SELECT * FROM conditional_discount_original_bindings WHERE company_id=$1',[f.company])).rows;
 const make=(predecessor:string|null=null)=>({request_id:randomUUID(),predecessor_id:predecessor,
   terms:{version:1,party_type:side,party_id:f.body.party_id,currency:'GBP',agreement_id:randomUUID(),
     agreement_date:'2026-11-06',payment_deadline:'2026-12-01',discount_gross_pence:'1000'},
   evidence_text:'Synthetic explicit replacement agreement, not an automatic price adjustment',attested:true});
 const input=make();
 const first=await appendConditionalReplacement(f.company,actor,f.draft.id,input);
 assert.equal(first.evidence.terms.discount_gross_pence,'1000');
 await assert.rejects(()=>transact(q=>conditionalCreditAdmission(q,f.company,{...f.draft,status:'posted'},{})),/CONDITIONAL_REPLACEMENT_REDEMPTION_UNAVAILABLE/);
 assert.deepEqual(await appendConditionalReplacement(f.company,actor,f.draft.id,input),first);
 await assert.rejects(()=>appendConditionalReplacement(f.company,actor,f.draft.id,{...input,evidence_text:'changed'}),/CONDITIONAL_REPLACEMENT_REQUEST_CONFLICT/);
 const staleCount=(await admin.query('SELECT count(*) n FROM conditional_discount_evidence WHERE company_id=$1',[f.company])).rows;
 await assert.rejects(()=>appendConditionalReplacement(f.company,actor,f.draft.id,make()),/CONDITIONAL_REPLACEMENT_STALE/);
 assert.deepEqual((await admin.query('SELECT count(*) n FROM conditional_discount_evidence WHERE company_id=$1',[f.company])).rows,staleCount);
 const races=await Promise.allSettled([make(first.id),make(first.id)].map(x=>appendConditionalReplacement(f.company,actor,f.draft.id,x)));
 assert.equal(races.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(races.filter(x=>x.status==='rejected').length,1);
 const history=await getConditionalReplacementHistory(f.company,actor,f.draft.id);
 assert.equal(history.replacements.length,2);
 assert.equal(history.replacements[1].predecessor_id,first.id);
 const next=make(history.replacements[1].id);
 await assert.rejects(()=>appendConditionalReplacement(f.company,actor,f.draft.id,{...next,
   terms:{...next.terms,agreement_id:input.terms.agreement_id}}),/CONDITIONAL_NEW_AGREEMENT_REQUIRED/);
 await assert.rejects(()=>appendConditionalReplacement(f.company,actor,f.draft.id,{...next,
   terms:{...next.terms,party_id:randomUUID()}}),/RESOURCE_NOT_FOUND/);
 const connection=await pool.connect();
 try {
   await connection.query('BEGIN');
   await connection.query(`SELECT public.append_conditional_discount_replacement($1,$2,$3,$4,$5,$6,$7,true)`,
     [f.company,actor,f.draft.id,next.request_id,next.predecessor_id,JSON.stringify(next.terms),next.evidence_text]);
   assert.equal((await getConditionalReplacementHistory(f.company,actor,f.draft.id)).replacements.length,2);
   await connection.query('ROLLBACK');
 } finally {connection.release();}
 assert.equal((await getConditionalReplacementHistory(f.company,actor,f.draft.id)).replacements.length,2);
 assert.equal((await admin.query('SELECT count(*)::int n FROM conditional_discount_evidence WHERE company_id=$1 AND request_id=$2',[f.company,next.request_id])).rows[0].n,0);
 await assert.rejects(()=>appendConditionalReplacement(f.company,actor,f.draft.id,make(first.id)),/CONDITIONAL_REPLACEMENT_STALE/);
 await assert.rejects(()=>getConditionalReplacementHistory(f.company,'foreign-actor',f.draft.id),/RESOURCE_NOT_FOUND/);
 await admin.query("UPDATE company_users SET role='viewer' WHERE company_id=$1 AND user_id=$2",[f.company,actor]);
 await assert.rejects(()=>appendConditionalReplacement(f.company,actor,f.draft.id,make(history.replacements[1].id)),/CAPABILITY_DENIED/);
 await assert.rejects(()=>pool.query(`SELECT public.append_conditional_discount_replacement($1,$2,$3,$4,$5,$6,$7,true)`,
   [f.company,actor,f.draft.id,randomUUID(),history.replacements[1].id,JSON.stringify(make().terms),'Synthetic forbidden']),/capability unavailable/);
 await admin.query("UPDATE company_users SET role='owner' WHERE company_id=$1 AND user_id=$2",[f.company,actor]);
 for(const sql of [
   'UPDATE conditional_discount_replacements SET actor_id=actor_id WHERE company_id=$1',
   'DELETE FROM conditional_discount_replacements WHERE company_id=$1',
 ]) {
   await assert.rejects(()=>pool.query(sql,[f.company]),/permission denied/);
   await assert.rejects(()=>admin.query(sql,[f.company]),/immutable/i);
 }
 await assert.rejects(()=>pool.query('TRUNCATE conditional_discount_replacements'),/permission denied/);
 await assert.rejects(()=>admin.query('TRUNCATE conditional_discount_replacements CASCADE'),/immutable/i);
 assert.deepEqual((await admin.query('SELECT * FROM conditional_discount_original_bindings WHERE company_id=$1',[f.company])).rows,original);
 try {
   await admin.query('ALTER TABLE conditional_discount_replacements DISABLE TRIGGER conditional_replacement_immutable');
   await assert.rejects(()=>getConditionalReplacementHistory(f.company,actor,f.draft.id),/SCHEMA_INCOMPLETE/);
 } finally {await admin.query('ALTER TABLE conditional_discount_replacements ENABLE ALWAYS TRIGGER conditional_replacement_immutable');}
});

async function admissionFixture(partyType:'customer'|'supplier') {
 const f=await conditionalOriginalFixture(partyType,'2199-11-30');
 await addPeriod(f.company,actor,{start_date:'2199-01-01',end_date:'2199-12-31',financial_year_label:'Synthetic future deadline'});
 return f;
}
async function conditionalCreditDraft(f:any,partyType:'customer'|'supplier',unitPrice='12') {
 const {conditional_discount,...source}=f.draft.source;
 return saveDocument(f.company,actor,{kind:partyType==='customer'?'sales_credit_note':'supplier_credit_note',
  original_id:f.draft.id,reason:'Explicit conditional admission scenario',adjustment_method:'offset_outstanding',effective_adjustment_date:'2199-12-02',
  source:{...source,invoice_number:'CONDITIONAL-CREDIT-'+randomUUID(),issue_date:'2199-12-02',due_date:'2199-12-02',payment_terms:0,
   line_items:source.line_items.map((line:any)=>({...line,unit_price:unitPrice}))}});
}
async function replacementFixture(side:'customer'|'supplier',vat=false) {
 const f=await admissionFixture(side);
 if(vat) {
  await admin.query("UPDATE companies SET vat_registered=true,vat_scheme='standard',vat_accounting_basis='invoice' WHERE id=$1",[f.company]);
  await admin.query(`INSERT INTO vat_tax_rules(id,company_id,code,label,rate,treatment,effective_from,is_active)
    VALUES($1,$2,'STD','Synthetic standard VAT',20,'standard','2011-01-04',true)`,[randomUUID(),f.company]);
  f.draft=await saveDocument(f.company,actor,{kind:f.draft.kind,source:{...f.draft.source,
    line_items:f.draft.source.line_items.map((line:any)=>({...line,unit_price:'100',tax_code:'STD'}))}},f.draft.id,f.draft.revision);
 }
 await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));
 await observeConditionalOriginal(f.company,actor,f.draft.id);
 const input={request_id:randomUUID(),predecessor_id:null,
   terms:{version:1,party_type:side,party_id:f.body.party_id,currency:'GBP',agreement_id:randomUUID(),
     agreement_date:'2026-11-06',payment_deadline:'2199-11-30',discount_gross_pence:'2400'},
   evidence_text:'Synthetic explicit £24 replacement; no retrospective payment qualification',attested:true};
 return {...f,input};
}
for(const side of ['customer','supplier'] as const) {
 for(const corrected of [false,true]) test(`Job11 ${side}: ordinary prior credit, corrected=${corrected}, residual replacement and compensation`,async()=>{
  const f=await replacementFixture(side,true);
  const root=(await pool.query('SELECT * FROM accounting_document_sources WHERE id=$1',[f.draft.id])).rows[0];
  const {conditional_discount,...source}=f.draft.source;
  const prior=await saveDocument(f.company,actor,{kind:side==='customer'?'sales_credit_note':'supplier_credit_note',
   original_id:f.draft.id,reason:'Agreed commercial price reduction, not discount redemption',adjustment_method:'offset_outstanding',
   effective_adjustment_date:'2026-11-07',source:{...source,invoice_number:'COMMERCIAL-'+randomUUID(),issue_date:'2026-11-07',due_date:'2026-11-07',payment_terms:0,
    line_items:source.line_items.map((l:any)=>({...l,unit_price:'20'}))}});
  const cb={request_id:randomUUID(),reason:'Ordinary reduction £24'};
  await assert.rejects(()=>reviewPaidCredit(f.company,actor,prior.id,prior.revision,cb),/CONDITIONAL/);
  const cr=await reviewCommercialCredit(f.company,actor,prior.id,prior.revision,cb);
  const cmd={...cb,review_token:cr.review_token,releases:cr.releases};
  const before=await financialSnapshot(f.company);
  await assert.rejects(()=>commitCommercialCredit(f.company,actor,prior.id,prior.revision,cmd,async()=>{throw Error('commercial rollback');}),/commercial rollback/);
  assert.deepEqual(await financialSnapshot(f.company),before);
  await assert.rejects(()=>commitCommercialCredit(f.company,actor,prior.id,prior.revision,cmd,async tx=>{
    const q=queryAdapter(tx),op=(await q.query('SELECT * FROM accounting_paid_credit_operations WHERE company_id=$1 AND credit_id=$2',[f.company,prior.id])).rows[0];
    const forged=structuredClone(op.intent),payload=JSON.parse(forged.commercial_admission.credit_payload),request=randomUUID();
    payload.money.gross_pence='1';forged.commercial_admission.credit_payload=canonicalConditionalPayload(payload);
    await q.query(`INSERT INTO accounting_paid_credit_operations(company_id,request_id,credit_id,actor_id,request_hash,intent,result)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[f.company,request,prior.id,actor,op.request_hash,forged,{...op.result,request_id:request}]);
  }),(error:any)=>error.cause?.message==='Commercial credit source or transaction invalid');
  assert.deepEqual(await financialSnapshot(f.company),before);
  const concurrent=await Promise.all([commitCommercialCredit(f.company,actor,prior.id,prior.revision,cmd),
    commitCommercialCredit(f.company,actor,prior.id,prior.revision,cmd)]);
  assert.deepEqual(concurrent.map(r=>r.status).sort(),['duplicate','posted']);
  assert.equal((await commitCommercialCredit(f.company,actor,prior.id,prior.revision,cmd)).status,'duplicate');
  assert.equal((await pool.query("SELECT count(*)::int n FROM accounting_paid_credit_operations WHERE company_id=$1 AND intent ? 'conditional_admission'",[f.company])).rows[0].n,0);
  const savedPrior=(await pool.query('SELECT * FROM accounting_document_sources WHERE id=$1',[prior.id])).rows[0];
  const op=(await pool.query('SELECT * FROM accounting_paid_credit_operations WHERE company_id=$1 AND credit_id=$2',[f.company,prior.id])).rows[0];
  const forgedRequest=randomUUID();
  await assert.rejects(()=>pool.query(`INSERT INTO accounting_paid_credit_operations(company_id,request_id,credit_id,actor_id,request_hash,intent,result)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,[f.company,forgedRequest,prior.id,actor,op.request_hash,op.intent,{...op.result,request_id:forgedRequest}]),/Commercial credit source or transaction invalid/);
  await assert.rejects(()=>nativeCash(f,'8400','8400','2026-11-10'),/CONDITIONAL_REPLACEMENT_REQUIRED/);
  if(corrected) {
   const body={request_id:randomUUID(),reason:'Corrected price after commercial credit',effective_date:'2026-11-08',
    line_items:f.draft.source.line_items.map((l:any)=>({quantity:l.quantity,unit_price:'80'}))};
   const r=await reviewCorrection(f.company,actor,f.draft.id,f.draft.revision,body);
   await commitCorrection(f.company,actor,f.draft.id,f.draft.revision,{...body,review_token:r.review_token});
  }
  const replacement=await appendConditionalReplacement(f.company,actor,f.draft.id,{...f.input,
    terms:{...f.input.terms,agreement_date:'2026-11-09',discount_gross_pence:'1200'}});
  const obs=await observeConditionalReplacement(f.company,actor,replacement.id);
  assert.equal(obs.frozen.gross_pence,corrected?'7200':'9600');
  assert.equal(obs.frozen.capacity.credits[0].id,prior.id);
  assert.equal((await pool.query("SELECT has_function_privilege(current_user,'public.observe_conditional_discount_replacement_v1(uuid,text,uuid,text,text)','EXECUTE') allowed")).rows[0].allowed,false);
  assert.equal((await pool.query("SELECT has_function_privilege(current_user,'public.assert_commercial_credit(public.accounting_paid_credit_operations)','EXECUTE') allowed")).rows[0].allowed,false);
  const cashAmount=corrected?'6000':'8400',cash=await nativeCash(f,cashAmount,cashAmount,'2026-11-10');
  const credit=await conditionalCreditDraft(f,side,'10'),body={request_id:randomUUID(),reason:'Replacement discount after ordinary credit'};
  const review=await reviewConditionalCredit(f.company,actor,credit.id,credit.revision,body);
  assert.equal(review.conditional_admission?.threshold_minor,cashAmount);
  const command={...body,review_token:review.review_token,releases:review.releases};
  await commitConditionalCredit(f.company,actor,credit.id,credit.revision,command);
  assert.equal((await transact(q=>documentOpen(q,f.company,f.draft.id))).open_minor,'0');
  assert.equal((await commitConditionalCredit(f.company,actor,credit.id,credit.revision,command)).status,'duplicate');
  const comp={request_id:randomUUID(),original_id:f.draft.id,credit_id:credit.id,payment_id:cash.id,date:'2199-12-03',amount_minor:'1000',reason:'Reverse discount only'};
  const reviewed=await reviewConditionalCompensation(f.company,actor,comp);
  assert.equal(reviewed.after_open_minor,'2200');
  const beforeClosed=await financialSnapshot(f.company);
  await admin.query("UPDATE accounting_document_periods SET status='CLOSED' WHERE company_id=$1 AND start_date='2199-01-01'",[f.company]);
  try {
    await assert.rejects(()=>commitConditionalCompensation(f.company,actor,{...comp,review_token:reviewed.review_token}),/PERIOD_NOT_WRITABLE/);
  } finally {
    await admin.query("UPDATE accounting_document_periods SET status='OPEN' WHERE company_id=$1 AND start_date='2199-01-01'",[f.company]);
  }
  assert.deepEqual(await financialSnapshot(f.company),beforeClosed);
  await commitConditionalCompensation(f.company,actor,{...comp,review_token:reviewed.review_token});
  assert.equal((await transact(q=>documentOpen(q,f.company,f.draft.id))).open_minor,'2200');
  assert.equal((await pool.query("SELECT sum(amount_minor)::text total FROM accounting_payment_events WHERE company_id=$1 AND kind='payment'",[f.company])).rows[0].total,cashAmount);
  assert.deepEqual(await observeConditionalReplacement(f.company,actor,replacement.id),obs);
  assert.deepEqual((await pool.query('SELECT * FROM accounting_document_sources WHERE id=$1',[prior.id])).rows[0],savedPrior);
  assert.deepEqual((await pool.query('SELECT * FROM accounting_document_sources WHERE id=$1',[f.draft.id])).rows[0],root);
  // Job13: read every historical cutoff AFTER the complete lifecycle, proving
  // that later correction, redemption and compensation do not rewrite history.
  const net=corrected?6000:8000,vat=corrected?1200:1600;
  const checkpoints=[
    ['2026-11-06','12000','0','0',10000,2000],
    ['2026-11-07','9600','0','0',8000,1600],
    ['2026-11-08',corrected?'7200':'9600','0','0',net,vat],
    ['2026-11-10','1200','0',cashAmount,net,vat],
    ['2199-12-02','0','0',cashAmount,net-1000,vat-200],
    ['2199-12-03','2200','1000',cashAmount,net,vat],
  ] as const;
  for(const [date,open,poolAmount,cash,expectedNet,expectedVat] of checkpoints) {
    const previousDate=new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
    const full=await compensationReports(f.company,actor,'2026-01-01',date);
    const period=await compensationReports(f.company,actor,date,date);
    const previous=await compensationReports(f.company,actor,'2026-01-01',previousDate);
    reconcileLifecycleReport(full,period,previous,root.party_id,{open,pool:poolAmount,
      cash:(side==='customer'?BigInt(cash):-BigInt(cash)).toString(),
      // These purchase fixtures deliberately do not claim input VAT: it is
      // expensed, while the purchases VAT-working net remains the net amount.
      net:String(side==='supplier'?expectedNet+expectedVat:expectedNet),
      vatNet:String(expectedNet),vat:side==='supplier'?'0':String(expectedVat),side});
  }
 });
 test(`Job11 ${side}: corrected conditional original binds fresh replacement and redeems atomically`,async()=>{
  const f=await replacementFixture(side,true);
  const first=await appendConditionalReplacement(f.company,actor,f.draft.id,f.input);
  await observeConditionalReplacement(f.company,actor,first.id);
  const original=(await admin.query('SELECT * FROM accounting_document_sources WHERE company_id=$1 AND id=$2',[f.company,f.draft.id])).rows[0];
  const intent={request_id:randomUUID(),reason:'Agreed corrected price',effective_date:'2026-11-07',
    line_items:f.draft.source.line_items.map((line:any)=>({quantity:line.quantity,unit_price:'80'}))};
  const correction=await reviewCorrection(f.company,actor,f.draft.id,f.draft.revision,intent);
  await commitCorrection(f.company,actor,f.draft.id,f.draft.revision,{...intent,review_token:correction.review_token});
  await assert.rejects(()=>nativeCash(f,'8400','8400','2026-11-10'),/CONDITIONAL_REPLACEMENT_REQUIRED/);
  const replacement=await appendConditionalReplacement(f.company,actor,f.draft.id,{...f.input,request_id:randomUUID(),predecessor_id:first.id,
    terms:{...f.input.terms,agreement_id:randomUUID(),agreement_date:'2026-11-08',discount_gross_pence:'1200'}});
  const obs=await observeConditionalReplacement(f.company,actor,replacement.id);
  assert.equal(obs.frozen.gross_pence,'9600');
  assert.equal(obs.frozen.vector[0].net_pence,'1000');assert.equal(obs.frozen.vector[0].vat_pence,'200');
  assert.notEqual(obs.frozen.revision,original.revision);
  assert.equal(obs.frozen.capacity.journal_origins.length,2);
  const cash=await nativeCash(f,'8400','8400','2026-11-10');
  const credit=await conditionalCreditDraft(f,side,'10');
  const body={request_id:randomUUID(),reason:'Corrected replacement redemption'};
  const review=await reviewConditionalCredit(f.company,actor,credit.id,credit.revision,body);
  assert.equal(review.conditional_admission?.threshold_minor,'8400');
  const command={...body,review_token:review.review_token,releases:review.releases};
  const baseline=await financialSnapshot(f.company);
  await assert.rejects(()=>commitConditionalCredit(f.company,actor,credit.id,credit.revision,command,async()=>{throw Error('corrected rollback');}),/corrected rollback/);
  assert.deepEqual(await financialSnapshot(f.company),baseline);
  await commitConditionalCredit(f.company,actor,credit.id,credit.revision,command);
  assert.equal((await commitConditionalCredit(f.company,actor,credit.id,credit.revision,command)).status,'duplicate');
  assert.deepEqual(await observeConditionalReplacement(f.company,actor,replacement.id),obs);
  assert.deepEqual((await admin.query('SELECT * FROM accounting_document_sources WHERE company_id=$1 AND id=$2',[f.company,f.draft.id])).rows[0],original);
  assert.equal((await pool.query('SELECT source FROM accounting_payment_events WHERE id=$1',[cash.id])).rows[0].source.conditional_binding_snapshot.bindings[0].replacement_id,replacement.id);
  const compensation={request_id:randomUUID(),original_id:f.draft.id,credit_id:credit.id,payment_id:cash.id,
    date:'2199-12-03',amount_minor:'1000',reason:'Unallocate £10 and reverse corrected discount'};
  const compensationReview=await reviewConditionalCompensation(f.company,actor,compensation);
  assert.equal(compensationReview.after_open_minor,'2200');
  const compensate={...compensation,review_token:compensationReview.review_token};
  await commitConditionalCompensation(f.company,actor,compensate);
  assert.equal((await commitConditionalCompensation(f.company,actor,compensate)).status,'duplicate');
  assert.deepEqual(await observeConditionalReplacement(f.company,actor,replacement.id),obs);
  await assert.rejects(()=>appendConditionalReplacement(f.company,actor,f.draft.id,{...f.input,request_id:randomUUID(),predecessor_id:replacement.id,
    terms:{...f.input.terms,agreement_id:randomUUID()}}),/CONDITIONAL_AGREEMENT_CONSUMED/);
 });
 for(const vat of [false,true]) test(`Job10 PostgreSQL: ${side} VAT=${vat} exact replacement payment snapshot, atomic redemption, replay and permanent consumption`,async()=>{
  const f=await replacementFixture(side,vat);
  const oldCash=await nativeCash(f,'10800','0');
  const replacement=await appendConditionalReplacement(f.company,actor,f.draft.id,f.input);
  const before=(await admin.query('SELECT * FROM conditional_discount_original_bindings WHERE company_id=$1',[f.company])).rows;
  const obs=await observeConditionalReplacement(f.company,actor,replacement.id);
  assert.equal(obs.frozen.discount_gross_pence,'2400');
  assert.equal(obs.frozen.vector[0].net_pence,vat?'2000':'2400');assert.equal(obs.frozen.vector[0].vat_pence,vat?'400':'0');
  assert.deepEqual(await observeConditionalReplacement(f.company,actor,replacement.id),obs);
  assert.ok(obs.observation.observed_at);
  const cash=await nativeCash(f,'9600','9600','2026-11-10');
  const snapshot=(await pool.query('SELECT source FROM accounting_payment_events WHERE id=$1',[cash.id])).rows[0].source.conditional_binding_snapshot;
  assert.equal(snapshot.bindings[0].replacement_id,replacement.id);
  assert.equal(snapshot.bindings[0].replacement_hash,obs.observation.binding_hash);
  const old=(await pool.query('SELECT source FROM accounting_payment_events WHERE id=$1',[oldCash.id])).rows[0].source;
  assert.equal(old.conditional_binding_snapshot.bindings[0].replacement_id,undefined);
  const credit=await conditionalCreditDraft(f,side,vat?'20':'24'),body={request_id:randomUUID(),reason:'Explicit replacement redemption'};
  const review=await reviewConditionalCredit(f.company,actor,credit.id,credit.revision,body);
  assert.equal(review.conditional_admission?.threshold_minor,'9600');
  assert.equal(review.conditional_admission?.qualifying_minor,'9600');
  const request={...body,review_token:review.review_token,releases:review.releases};
  const baseline=await financialSnapshot(f.company);
  await assert.rejects(()=>commitConditionalCredit(f.company,actor,credit.id,credit.revision,request,async()=>{throw Error('replacement rollback');}),/replacement rollback/);
  assert.deepEqual(await financialSnapshot(f.company),baseline);
  const results=await Promise.all([commitConditionalCredit(f.company,actor,credit.id,credit.revision,request),commitConditionalCredit(f.company,actor,credit.id,credit.revision,request)]);
  assert.equal(results.filter(r=>r.status==='duplicate').length,1);
  await assert.rejects(()=>commitConditionalCredit(f.company,actor,credit.id,credit.revision,{...request,reason:'conflicting'}),/IDEMPOTENCY_CONFLICT/);
  await assert.rejects(()=>appendConditionalReplacement(f.company,actor,f.draft.id,{...f.input,request_id:randomUUID(),predecessor_id:replacement.id,
    terms:{...f.input.terms,agreement_id:randomUUID()}}),/CONDITIONAL_AGREEMENT_CONSUMED/);
  assert.deepEqual((await admin.query('SELECT * FROM conditional_discount_original_bindings WHERE company_id=$1',[f.company])).rows,before);
  assert.equal((await pool.query('SELECT count(*)::int n FROM accounting_paid_credit_operations WHERE company_id=$1',[f.company])).rows[0].n,1);
  const consumedView=await replacementHttp('GET',f.company,f.draft.id);
  assert.equal(consumedView.status,200);assert.equal(consumedView.data.consumed,true);assert.equal(consumedView.data.replaceable,false);
  assert.equal(consumedView.data.posting_available,false);assert.equal(consumedView.data.replacements[0].observation.state,'observed');
  const consumedAppend=await replacementHttp('POST',f.company,f.draft.id,'',{...f.input,request_id:randomUUID(),predecessor_id:replacement.id,terms:{...f.input.terms,agreement_id:randomUUID()}});
  assert.equal(consumedAppend.status,409);assert.equal(consumedAppend.error.code,'CONDITIONAL_AGREEMENT_CONSUMED');
  const compensation={request_id:randomUUID(),original_id:f.draft.id,credit_id:credit.id,payment_id:cash.id,
    date:'2199-12-03',amount_minor:'1000',reason:'Replacement payment reduced; reverse full replacement credit'};
  const cr=await reviewConditionalCompensation(f.company,actor,compensation);
  await commitConditionalCompensation(f.company,actor,{...compensation,review_token:cr.review_token});
  await assert.rejects(()=>appendConditionalReplacement(f.company,actor,f.draft.id,{...f.input,request_id:randomUUID(),predecessor_id:replacement.id,
    terms:{...f.input.terms,agreement_id:randomUUID()}}),/CONDITIONAL_AGREEMENT_CONSUMED/);
 });
 test(`Job10 PostgreSQL: ${side} stale versions, pre-observation/old cash and backdated payments never qualify`,async()=>{
  const f=await replacementFixture(side);
  await nativeCash(f,'9600','0');
  const first=await appendConditionalReplacement(f.company,actor,f.draft.id,f.input);
  const early=await nativeCash(f,'9600','0','2026-11-10');
  const earlySnapshot=(await pool.query('SELECT source FROM accounting_payment_events WHERE id=$1',[early.id])).rows[0].source.conditional_binding_snapshot;
  assert.equal(earlySnapshot.bindings.length,0);
  await observeConditionalReplacement(f.company,actor,first.id);
  const credit=await conditionalCreditDraft(f,side,'24'),body={request_id:randomUUID(),reason:'Synthetic version qualification'};
  await assert.rejects(()=>reviewConditionalCredit(f.company,actor,credit.id,credit.revision,body),/CONDITIONAL_PAYMENT_THRESHOLD_NOT_MET/);
  const cash=await nativeCash(f,'9600','9600','2026-11-10');
  const review=await reviewConditionalCredit(f.company,actor,credit.id,credit.revision,body);
  const second=await appendConditionalReplacement(f.company,actor,f.draft.id,{...f.input,request_id:randomUUID(),predecessor_id:first.id,
    terms:{...f.input.terms,agreement_id:randomUUID()}});
  await observeConditionalReplacement(f.company,actor,second.id);
  await assert.rejects(()=>commitConditionalCredit(f.company,actor,credit.id,credit.revision,{...body,review_token:review.review_token,releases:review.releases}),/CONDITIONAL_PAYMENT_THRESHOLD_NOT_MET/);
  assert.equal((await pool.query('SELECT source FROM accounting_payment_events WHERE id=$1',[cash.id])).rows[0].source.conditional_binding_snapshot.bindings[0].replacement_id,first.id);
  await assert.rejects(()=>observeConditionalReplacement(f.company,'foreign-actor',second.id),/RESOURCE_NOT_FOUND/);
  await admin.query("UPDATE company_users SET role='viewer' WHERE company_id=$1 AND user_id=$2",[f.company,actor]);
  await assert.rejects(()=>observeConditionalReplacement(f.company,actor,second.id),/CAPABILITY_DENIED/);
  await admin.query("UPDATE company_users SET role='owner' WHERE company_id=$1 AND user_id=$2",[f.company,actor]);
  const dated=await replacementFixture(side);
  const terms=await appendConditionalReplacement(dated.company,actor,dated.draft.id,dated.input);
  await observeConditionalReplacement(dated.company,actor,terms.id);
  await nativeCash(dated,'9600','9600','2026-11-03');
  const dc=await conditionalCreditDraft(dated,side,'24');
  await assert.rejects(()=>reviewConditionalCredit(dated.company,actor,dc.id,dc.revision,{request_id:randomUUID(),reason:'Backdated cash does not qualify'}),
    /CONDITIONAL_PAYMENT_THRESHOLD_NOT_MET/);
 });
 test(`Job10 PostgreSQL: ${side} supersession and redemption serialize under one company lock`,async()=>{
  const f=await replacementFixture(side),r=await appendConditionalReplacement(f.company,actor,f.draft.id,f.input);
  await observeConditionalReplacement(f.company,actor,r.id);
  await nativeCash(f,'9600','9600','2026-11-10');
  const c=await conditionalCreditDraft(f,side,'24'),body={request_id:randomUUID(),reason:'Concurrent replacement review'};
  const review=await reviewConditionalCredit(f.company,actor,c.id,c.revision,body);
  const supersede=()=>appendConditionalReplacement(f.company,actor,f.draft.id,{...f.input,request_id:randomUUID(),predecessor_id:r.id,
    terms:{...f.input.terms,agreement_id:randomUUID()}});
  const consume=()=>commitConditionalCredit(f.company,actor,c.id,c.revision,{...body,review_token:review.review_token,releases:review.releases});
  const results=await Promise.allSettled((side==='customer'?[supersede,consume]:[consume,supersede]).map(fn=>fn()));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  const count=(await pool.query('SELECT count(*)::int n FROM accounting_paid_credit_operations WHERE company_id=$1',[f.company])).rows[0].n;
  assert.equal((await getConditionalReplacementHistory(f.company,actor,f.draft.id)).replacements.length,count===1?1:2);
 });
}
test('Job10 PostgreSQL: replacement observation requires committed same-cluster history, preserves first clock and immutable payload',async()=>{
 const f=await replacementFixture('customer'),connection=await pool.connect();
 try {
  await connection.query('BEGIN');
  const {rows:[r]}=await connection.query(`SELECT public.append_conditional_discount_replacement($1,$2,$3,$4,null,$5,$6,true) id`,
    [f.company,actor,f.draft.id,f.input.request_id,JSON.stringify(f.input.terms),f.input.evidence_text]);
  await connection.query('SAVEPOINT observation');
  await assert.rejects(()=>connection.query('SELECT public.observe_conditional_discount_replacement($1,$2,$3,$4,$5)',
    [f.company,actor,r.id,'{}','sha256:'+'0'.repeat(64)]),/transaction not committed/);
  await connection.query('ROLLBACK TO SAVEPOINT observation');
  await connection.query('ROLLBACK');
 } finally {connection.release();}
 assert.equal((await getConditionalReplacementHistory(f.company,actor,f.draft.id)).replacements.length,0);
 const replacement=await appendConditionalReplacement(f.company,actor,f.draft.id,f.input);
 const observed=await observeConditionalReplacement(f.company,actor,replacement.id);
 for(const statement of ['UPDATE conditional_discount_replacement_observations SET actor_id=actor_id WHERE company_id=$1',
   'DELETE FROM conditional_discount_replacement_observations WHERE company_id=$1']) {
  await assert.rejects(()=>pool.query(statement,[f.company]),/permission denied/);
  await assert.rejects(()=>admin.query(statement,[f.company]),/immutable/i);
 }
 await assert.rejects(()=>admin.query('TRUNCATE conditional_discount_replacement_observations'),/immutable/i);
 assert.deepEqual(await observeConditionalReplacement(f.company,actor,replacement.id),observed);
 try {
  await admin.query('ALTER TABLE conditional_discount_replacements DISABLE TRIGGER conditional_replacement_origin');
  await assert.rejects(()=>observeConditionalReplacement(f.company,actor,replacement.id),/CONDITIONAL_REPLACEMENT_OBSERVER_INVALID/);
 } finally {await admin.query('ALTER TABLE conditional_discount_replacements ENABLE ALWAYS TRIGGER conditional_replacement_origin');}
});
async function nativeCash(f:any,amount:string,allocated:string,date='2026-11-03',witness=true) {
 const body={...f.body,id:randomUUID(),amount_minor:amount,date,allocations:allocated==='0'?[]:[{document_id:f.draft.id,amount_minor:allocated}]};
 const review=await previewPayment(f.company,actor,body);
 return witness?postPayment(f.company,actor,{...body,review_token:review.review_token}):
  withCanonicalPostingTransaction(tx=>postPayment(f.company,actor,{...body,review_token:review.review_token},undefined,tx));
}
for(const partyType of ['customer','supplier'] as const) {
 for(const amount of ['10800','10799','12000']) test(`real PostgreSQL: ${partyType} internal admission threshold ${amount} with closed public credit routes`,async()=>{
  const f=await admissionFixture(partyType);
  await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));
  await observeConditionalOriginal(f.company,actor,f.draft.id);
  await nativeCash(f,amount,amount);
  const credit=await conditionalCreditDraft(f,partyType),body={request_id:randomUUID(),reason:'Explicit internal conditional review'};
  const before=(await pool.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n;
  if(amount==='10799') await assert.rejects(()=>reviewConditionalCredit(f.company,actor,credit.id,credit.revision,body),/CONDITIONAL_PAYMENT_THRESHOLD_NOT_MET/);
  else {
   const review=await reviewConditionalCredit(f.company,actor,credit.id,credit.revision,body);
   assert.equal(review.conditional_admission?.threshold_minor,'10800');
   assert.equal(review.conditional_admission?.qualifying_minor,'10800');
   assert.equal(review.conditional_admission?.posting_available,false);
   assert.equal(review.released_minor,amount==='12000'?'1200':'0');
   assert.deepEqual(await reviewConditionalCredit(f.company,actor,credit.id,credit.revision,body),review);
   await assert.rejects(()=>commitPaidCredit(f.company,actor,credit.id,credit.revision,{...body,review_token:review.review_token,releases:review.releases}),/CONDITIONAL_POSTING_NOT_AVAILABLE/);
  }
  await assert.rejects(()=>reviewPaidCredit(f.company,actor,credit.id,credit.revision,body),/CONDITIONAL_POSTING_NOT_AVAILABLE/);
  await assert.rejects(()=>postDocument(f.company,actor,credit.id,credit.revision),/CONDITIONAL_POSTING_NOT_AVAILABLE/);
  assert.equal((await pool.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n,before);
  assert.equal((await pool.query('SELECT count(*)::int n FROM accounting_paid_credit_operations WHERE company_id=$1',[f.company])).rows[0].n,0);
 });
 for(const mode of ['old-pool','later-allocation','unwitnessed-allocation','unwitnessed','late-effective','unallocation','late-replenishment','surplus-refund','deadline-clock','cutoff-clock'] as const)
 test(`real PostgreSQL: ${partyType} conditional admission ${mode}`,async()=>{
  const f=await admissionFixture(partyType);
  let cash:any;
  if(mode==='old-pool') cash=await nativeCash(f,'10800','0');
  await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));
  await observeConditionalOriginal(f.company,actor,f.draft.id);
  if(mode==='old-pool' || mode==='later-allocation' || mode==='unwitnessed-allocation') {
   if(mode!=='old-pool') cash=await nativeCash(f,'10800','0');
   const body={...f.body,id:randomUUID(),kind:'allocation',payment_id:cash.id,amount_minor:'10800',allocations:[{document_id:f.draft.id,amount_minor:'10800'}]};
   const review=await previewPayment(f.company,actor,body);
   if(mode==='unwitnessed-allocation') await withCanonicalPostingTransaction(tx=>postPayment(f.company,actor,{...body,review_token:review.review_token},undefined,tx));
   else await postPayment(f.company,actor,{...body,review_token:review.review_token});
  } else cash=await nativeCash(f,mode==='surplus-refund'?'12000':'10800','10800',mode==='late-effective'?'2199-12-01':'2026-11-03',mode!=='unwitnessed');
  if(mode==='unallocation' || mode==='surplus-refund') {
   const body={...f.body,id:randomUUID(),kind:mode==='unallocation'?'unallocation':'refund',payment_id:cash.id,amount_minor:'1200',
    allocations:mode==='unallocation'?[{document_id:f.draft.id,amount_minor:'1200'}]:[]};
   const review=await previewPayment(f.company,actor,body);await postPayment(f.company,actor,{...body,review_token:review.review_token});
  }
  if(mode==='late-replenishment') await nativeCash(f,'1200','1200','2199-12-01');
  if(mode==='deadline-clock' || mode==='cutoff-clock') {
   // Administrator-only clock fixture in the disposable database; service never accepts caller clocks.
   const q=await admin.connect();try {
    await q.query('BEGIN');await q.query('ALTER TABLE conditional_discount_commit_witnesses DISABLE TRIGGER conditional_discount_witness_immutable');
    await q.query('UPDATE conditional_discount_commit_witnesses SET observed_at=$2 WHERE event_id=$1',[cash.id,mode==='deadline-clock'?'2199-11-30T23:59:59.999999Z':'2199-12-01T00:00:00.000000Z']);
    await q.query('ALTER TABLE conditional_discount_commit_witnesses ENABLE ALWAYS TRIGGER conditional_discount_witness_immutable');await q.query('COMMIT');
   }catch(e){await q.query('ROLLBACK');throw e;}finally{q.release();}
  }
  const credit=await conditionalCreditDraft(f,partyType),body={request_id:randomUUID(),reason:'Explicit internal conditional review'};
  if(['surplus-refund','later-allocation','deadline-clock'].includes(mode)) assert.equal((await reviewConditionalCredit(f.company,actor,credit.id,credit.revision,body)).conditional_admission?.qualifying_minor,'10800');
  else await assert.rejects(()=>reviewConditionalCredit(f.company,actor,credit.id,credit.revision,body),
   mode==='unallocation'?/CONDITIONAL_RELEASE_HISTORY_UNSUPPORTED/:/CONDITIONAL_PAYMENT_THRESHOLD_NOT_MET/);
 });
}

import {commitConditionalCredit} from './paidCredit';
import {reviewConditionalCompensation,commitConditionalCompensation,recoverConditionalCompensation} from './conditionalCompensation';
import {reports as compensationReports} from './reports';
import {reconcileLifecycleReport} from './reportAcceptance.testSupport';
import {reviewCorrection,commitCorrection} from './corrections';

async function compensationFixture(partyType:'customer'|'supplier',cashAmount='10800') {
 const f=await admissionFixture(partyType);
 await admin.query("UPDATE companies SET vat_registered=true,vat_scheme='standard',vat_accounting_basis='invoice' WHERE id=$1",[f.company]);
 await admin.query(`INSERT INTO vat_tax_rules(id,company_id,code,label,rate,treatment,effective_from,is_active)
 VALUES($1,$2,'STD20','Synthetic standard VAT',20,'standard','2011-01-04',true)`,[randomUUID(),f.company]);
 f.draft=await saveDocument(f.company,actor,{kind:f.draft.kind,purchase_vat_eligible:partyType==='supplier',
  source:{...f.draft.source,line_items:[{description:'Frozen original',quantity:'1',unit_price:'100',tax_code:'STD20'}]}},f.draft.id,f.draft.revision);
 await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));
 await observeConditionalOriginal(f.company,actor,f.draft.id);
 const cash=await nativeCash(f,cashAmount,cashAmount);
 const {conditional_discount,...source}=f.draft.source;
 const credit=await saveDocument(f.company,actor,{kind:partyType==='customer'?'sales_credit_note':'supplier_credit_note',
  original_id:f.draft.id,reason:'Synthetic conditional price decrease',adjustment_method:'offset_outstanding',
  effective_adjustment_date:'2199-12-02',source:{...source,invoice_number:'COMP-CREDIT-'+randomUUID(),issue_date:'2199-12-02',
   due_date:'2199-12-02',payment_terms:0,line_items:source.line_items.map((l:any)=>({...l,unit_price:'10'}))}});
 const redemption={request_id:randomUUID(),reason:'Synthetic original discount redemption'};
 const reviewed=await reviewConditionalCredit(f.company,actor,credit.id,credit.revision,redemption);
 await commitConditionalCredit(f.company,actor,credit.id,credit.revision,{...redemption,review_token:reviewed.review_token,releases:reviewed.releases});
 const body={request_id:randomUUID(),original_id:f.draft.id,credit_id:credit.id,payment_id:cash.id,
  date:'2199-12-03',amount_minor:'1000',reason:'Qualifying allocation reduced; compensate full frozen discount'};
 const r=await reviewConditionalCompensation(f.company,actor,body);
 return {...f,cash,credit,body:{...body,review_token:r.review_token},review:r};
}
async function compensationSnapshot(company:string) {
 return {...await financialSnapshot(company),
  compensation:(await pool.query('SELECT * FROM conditional_discount_compensations WHERE company_id=$1 ORDER BY request_id',[company])).rows,
  audits:(await pool.query('SELECT * FROM accounting_audit_events WHERE company_id=$1 ORDER BY id',[company])).rows};
}
for(const side of ['customer','supplier'] as const) test(`real PostgreSQL: ${side} consumed agreement cannot be reset by replacement before or after compensation`,async()=>{
 const f=await compensationFixture(side);
 const input={request_id:randomUUID(),predecessor_id:null,
   terms:{version:1,party_type:side,party_id:f.credit.party_id,currency:'GBP',agreement_id:randomUUID(),
     agreement_date:'2199-12-03',payment_deadline:'2199-12-31',discount_gross_pence:'1000'},
   evidence_text:'Synthetic attempted reset of consumed agreement',attested:true};
 const before=await compensationSnapshot(f.company);
 await assert.rejects(()=>appendConditionalReplacement(f.company,actor,f.draft.id,input),/CONDITIONAL_AGREEMENT_CONSUMED/);
 assert.deepEqual(await compensationSnapshot(f.company),before);
 await commitConditionalCompensation(f.company,actor,f.body);
 const after=await compensationSnapshot(f.company);
 await assert.rejects(()=>appendConditionalReplacement(f.company,actor,f.draft.id,input),/CONDITIONAL_AGREEMENT_CONSUMED/);
 assert.deepEqual(await compensationSnapshot(f.company),after);
});
async function surplusRefund(f:any,side:'customer'|'supplier',amount='100') {
 const payment={id:randomUUID(),kind:'refund',party_type:side,party_id:f.credit.party_id,payment_id:f.cash.id,
  date:'2199-12-02',reference:'Preserve completed surplus refund',amount_minor:amount,allocations:[]};
 const review=await previewPayment(f.company,actor,payment);
 return postPayment(f.company,actor,{...payment,review_token:review.review_token});
}
async function fullReversalReview(f:any) {
 const body={...f.body,amount_minor:'10800',payment_action:'reverse_payment'};
 const r=await reviewConditionalCompensation(f.company,actor,body);
 return {...body,review_token:r.review_token};
}
for(const side of ['customer','supplier'] as const) {
 for(const cash of ['10800','12000']) test(`Job2 real PostgreSQL: ${side} full ${cash} payment reversal atomically restores original debt and cash with exact replay`,async()=>{
  const f=await compensationFixture(side,cash),body=await fullReversalReview(f),before=await compensationSnapshot(f.company);
  const review=await reviewConditionalCompensation(f.company,actor,body);
  assert.equal(review.after_open_minor,'12000');assert.equal(review.after_allocated_minor,'0');
  assert.equal(review.after_unapplied_minor,'0');assert.equal(review.cash_change_minor,(side==='customer'?'-':'')+cash);
  const [a,b]=await Promise.all([commitConditionalCompensation(f.company,actor,body),commitConditionalCompensation(f.company,actor,body)]);
  assert.deepEqual([a.status,b.status].sort(),['duplicate','posted']);assert.equal(a.cash_reversal_id,b.cash_reversal_id);
  const after=await compensationSnapshot(f.company);
  assert.equal((after as any).canonical_journal_entries.length,(before as any).canonical_journal_entries.length+3);
  for(const table of ['accounting_payment_events','canonical_journal_entries','canonical_journal_lines','accounting_document_sources','accounting_paid_credit_operations'])
   for(const row of (before as any)[table]) assert.ok((after as any)[table].some((r:any)=>JSON.stringify(r)===JSON.stringify(row)),table);
  const journals=await pool.query(`SELECT l.journal_entry_id,sum(l.debit_minor)::text debit,sum(l.credit_minor)::text credit
    FROM canonical_journal_lines l WHERE company_id=$1 AND journal_entry_id=ANY($2::uuid[]) GROUP BY l.journal_entry_id`,
    [f.company,[a.reversal_journal_id,a.unallocation_journal_id,a.cash_reversal_journal_id]]);
  assert.equal(journals.rows.length,3);for(const row of journals.rows)assert.equal(row.debit,row.credit);
  const bank=await pool.query(`SELECT sum(l.debit_minor-l.credit_minor)::text delta FROM canonical_journal_lines l
    JOIN accounting_payment_configuration c ON c.company_id=l.company_id WHERE l.company_id=$1
    AND l.journal_entry_id=$2 AND l.account_id=(c.mappings->>'bank')::uuid`,[f.company,a.cash_reversal_journal_id]);
  assert.equal(bank.rows[0].delta,(side==='customer'?'-':'')+cash);
  const current=await compensationReports(f.company,actor,'2026-01-01','2199-12-03');
  const past=await compensationReports(f.company,actor,'2026-01-01','2199-12-02');
  reconcileLifecycleReport(current,await compensationReports(f.company,actor,'2199-12-03','2199-12-03'),
    past,f.credit.party_id,{open:'12000',pool:'0',cash:'0',net:'10000',vat:'2000',side});
  assert.equal(past.open_items.find((d:any)=>d.id===f.draft.id).open_minor,'0');
  const item=current.open_items.find((d:any)=>d.id===f.draft.id);
  assert.equal(item.open_minor,'12000');assert.equal(item.paid_minor,'0');assert.equal(item.credited_minor,'0');
  assert.equal(current.party_balances.find((p:any)=>p.party_id===f.credit.party_id).unapplied_minor,'0');
  assert.equal((await recoverConditionalCompensation(f.company,actor,body.request_id)).cash_reversal_id,a.cash_reversal_id);
  await assert.rejects(()=>commitConditionalCompensation(f.company,actor,{...body,reason:'Conflicting request'}),/IDEMPOTENCY_CONFLICT/);
  await assert.rejects(()=>pool.query(`INSERT INTO conditional_discount_compensations SELECT * FROM conditional_discount_compensations
    WHERE company_id=$1`,[f.company]),(e:any)=>e.code==='P0001'&&/child identity invalid/.test(e.message));
  assert.deepEqual(await compensationSnapshot(f.company),after);
 });
 test(`Job2 real PostgreSQL: ${side} all three effects roll back at every stage; no public bypass or refund reclamation`,async()=>{
  const f=await compensationFixture(side,'12000'),body=await fullReversalReview(f),before=await compensationSnapshot(f.company);
  for(const stage of ['reversal','unallocation','cash_reversal','evidence','projection']) {
   await assert.rejects(()=>commitConditionalCompensation(f.company,actor,body,async s=>{if(s===stage)throw Error('job2 rollback');}),/job2 rollback/);
   assert.deepEqual(await compensationSnapshot(f.company),before);
  }
  await assert.rejects(()=>reviewConditionalCompensation(f.company,actor,{...body,amount_minor:'1000'}),/COMPENSATION_FULL_UNALLOCATION_REQUIRED/);
  await assert.rejects(()=>previewPayment(f.company,actor,{id:randomUUID(),kind:'reversal',party_type:side,party_id:f.credit.party_id,
   payment_id:f.cash.id,date:body.date,reference:'No bypass',amount_minor:'12000',allocations:[]}),/CONDITIONAL_CONSUMED_PAYMENT_PROTECTED/);
  await surplusRefund(f,side);
  const refunded=await compensationSnapshot(f.company);
  await assert.rejects(()=>reviewConditionalCompensation(f.company,actor,body),/COMPENSATION_REFUNDED_PAYMENT_CANNOT_REVERSE/);
  await assert.rejects(()=>commitConditionalCompensation(f.company,actor,body),/COMPENSATION_REFUNDED_PAYMENT_CANNOT_REVERSE/);
  assert.deepEqual(await compensationSnapshot(f.company),refunded);
 });
 test(`Job2 real PostgreSQL: ${side} cash reversal respects current permissions periods schema and competing command`,async()=>{
  const f=await compensationFixture(side),body=await fullReversalReview(f),before=await compensationSnapshot(f.company);
  await admin.query("UPDATE company_users SET role='bookkeeper' WHERE company_id=$1 AND user_id=$2",[f.company,actor]);
  await assert.rejects(()=>commitConditionalCompensation(f.company,actor,body),(e:any)=>e.status===403);
  await admin.query("UPDATE company_users SET role='owner' WHERE company_id=$1 AND user_id=$2",[f.company,actor]);
  await admin.query("UPDATE accounting_document_periods SET status='CLOSED' WHERE company_id=$1 AND start_date='2199-01-01'",[f.company]);
  await assert.rejects(()=>commitConditionalCompensation(f.company,actor,body),/PERIOD_NOT_WRITABLE/);
  await admin.query("UPDATE accounting_document_periods SET status='OPEN' WHERE company_id=$1 AND start_date='2199-01-01'",[f.company]);
  await assert.rejects(()=>reviewConditionalCompensation(f.company,actor,{...body,date:'2199-12-01'}),/DATE_PRECEDES_SETTLEMENT_ACTIVITY/);
  const foreign=await fixture();await assert.rejects(()=>commitConditionalCompensation(foreign.company,actor,body),/RESOURCE_NOT_FOUND/);
  await admin.query('ALTER TABLE conditional_discount_compensations DISABLE TRIGGER conditional_discount_cash_reversal_guard');
  try {await assert.rejects(()=>commitConditionalCompensation(f.company,actor,body),/COMPENSATION_CASH_REVERSAL_SCHEMA_UNAVAILABLE/);}
  finally {await admin.query('ALTER TABLE conditional_discount_compensations ENABLE ALWAYS TRIGGER conditional_discount_cash_reversal_guard');}
  assert.deepEqual(await compensationSnapshot(f.company),before);
  const otherBody={...f.body,request_id:randomUUID()};
  const other=await reviewConditionalCompensation(f.company,actor,otherBody);
  const outcomes=await Promise.allSettled([commitConditionalCompensation(f.company,actor,body),
   commitConditionalCompensation(f.company,actor,{...otherBody,review_token:other.review_token})]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.equal((await pool.query('SELECT count(*)::int n FROM conditional_discount_compensations WHERE company_id=$1',[f.company])).rows[0].n,1);
 });
}
for(const side of ['customer','supplier'] as const) {
 test(`Job1 real PostgreSQL: ${side} completed surplus refund survives compensation, replay and dated reports`,async()=>{
  const f=await compensationFixture(side,'12000'),refund=await surplusRefund(f,side);
  const before=await compensationSnapshot(f.company);
  const review=await reviewConditionalCompensation(f.company,actor,f.body);
  assert.equal(review.refunded_minor,'100');assert.equal(review.before_unapplied_minor,'1100');
  assert.equal(review.after_unapplied_minor,'2100');assert.equal(review.cash_change_minor,'0');
  assert.equal(review.preserved_refunds[0].id,refund.id);
  const body={...f.body,review_token:review.review_token};
  const result=await commitConditionalCompensation(f.company,actor,body);
  const after=await compensationSnapshot(f.company);
  for(const table of ['accounting_payment_events','canonical_journal_entries','canonical_journal_lines',
    'accounting_document_sources','accounting_paid_credit_operations']) {
   const oldRows=(before as any)[table],newRows=(after as any)[table];
   for(const row of oldRows) assert.ok(newRows.some((r:any)=>JSON.stringify(r)===JSON.stringify(row)),table+' original changed');
  }
  assert.equal((after as any).canonical_journal_entries.length,(before as any).canonical_journal_entries.length+2);
  const totals=await pool.query(`SELECT sum(l.debit_minor)::text debit,sum(l.credit_minor)::text credit,
   count(*) FILTER(WHERE l.account_id=(c.mappings->>'bank')::uuid)::int cash
   FROM canonical_journal_lines l JOIN accounting_payment_configuration c ON c.company_id=l.company_id
   WHERE l.company_id=$1 AND l.journal_entry_id=ANY($2::uuid[])`,
   [f.company,[result.reversal_journal_id,result.unallocation_journal_id]]);
  assert.deepEqual(totals.rows[0],{debit:'2200',credit:'2200',cash:0});
  for(const [date,open,poolAmount] of [['2199-12-02','0','1100'],['2199-12-03','2200','2100']]) {
   const report=await compensationReports(f.company,actor,'2026-01-01',date);
   assert.equal(report.open_items.find((d:any)=>d.id===f.draft.id).open_minor,open);
   const party=report.party_balances.find((p:any)=>p.party_id===f.credit.party_id);
   assert.equal(party.unapplied_minor,poolAmount);
  }
  reconcileLifecycleReport(await compensationReports(f.company,actor,'2026-01-01','2199-12-03'),
    await compensationReports(f.company,actor,'2199-12-03','2199-12-03'),
    await compensationReports(f.company,actor,'2026-01-01','2199-12-02'),f.credit.party_id,
    {open:'2200',pool:'2100',cash:side==='customer'?'11900':'-11900',net:'10000',vat:'2000',side});
  assert.equal((await commitConditionalCompensation(f.company,actor,body)).status,'duplicate');
  await assert.rejects(()=>commitConditionalCompensation(f.company,actor,{...body,amount_minor:'900'}),/IDEMPOTENCY_CONFLICT/);
  assert.deepEqual(await compensationSnapshot(f.company),after);
 });
 test(`Job1 real PostgreSQL: ${side} refunded history rolls back every child and requires fresh authorized review`,async()=>{
  const f=await compensationFixture(side,'12000');await surplusRefund(f,side);
  const review=await reviewConditionalCompensation(f.company,actor,f.body);
  const body={...f.body,review_token:review.review_token},before=await compensationSnapshot(f.company);
  for(const stage of ['reversal','unallocation','evidence','projection']) {
   await assert.rejects(()=>commitConditionalCompensation(f.company,actor,body,async s=>{
    if(s===stage)throw Error('job1 rollback '+s);
   }),/job1 rollback/);
   assert.deepEqual(await compensationSnapshot(f.company),before);
  }
  await assert.rejects(()=>reviewConditionalCompensation(f.company,actor,{...body,date:'2199-12-01'}),/DATE_PRECEDES_SETTLEMENT_ACTIVITY/);
  const foreign=await fixture();
  await assert.rejects(()=>commitConditionalCompensation(foreign.company,actor,body),/RESOURCE_NOT_FOUND/);
  await admin.query("UPDATE accounting_document_periods SET status='CLOSED' WHERE company_id=$1 AND start_date='2199-01-01'",[f.company]);
  await assert.rejects(()=>commitConditionalCompensation(f.company,actor,body),/PERIOD_NOT_WRITABLE/);
  await admin.query("UPDATE accounting_document_periods SET status='OPEN' WHERE company_id=$1 AND start_date='2199-01-01'",[f.company]);
  await surplusRefund(f,side);
  const changed=await compensationSnapshot(f.company);
  await assert.rejects(()=>commitConditionalCompensation(f.company,actor,body),/COMPENSATION_REVIEW_STALE/);
  assert.deepEqual(await compensationSnapshot(f.company),changed);
  const fresh=await reviewConditionalCompensation(f.company,actor,body);
  assert.equal(fresh.after_unapplied_minor,'2000');
  await commitConditionalCompensation(f.company,actor,{...body,review_token:fresh.review_token});
 });
 test(`Job1 real PostgreSQL: ${side} refund racing compensation serializes without reclaiming cash`,async()=>{
  const f=await compensationFixture(side,'12000');await surplusRefund(f,side);
  const review=await reviewConditionalCompensation(f.company,actor,f.body);
  const refund={id:randomUUID(),kind:'refund',party_type:side,party_id:f.credit.party_id,payment_id:f.cash.id,
   date:'2199-12-03',reference:'Concurrent surplus only',amount_minor:'100',allocations:[]};
  const r=await previewPayment(f.company,actor,refund);
  const outcomes=await Promise.allSettled([
   commitConditionalCompensation(f.company,actor,{...f.body,review_token:review.review_token}),
   postPayment(f.company,actor,{...refund,review_token:r.review_token})]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  for(const o of outcomes) if(o.status==='rejected') assert.match(o.reason.message,/REVIEW_STALE/);
  const refreshed=await pool.query("SELECT kind,amount_minor FROM accounting_payment_events WHERE company_id=$1 AND kind IN ('payment','refund')",[f.company]);
  assert.equal(refreshed.rows.filter(e=>e.kind==='payment').length,1);
  assert.equal(refreshed.rows.filter(e=>e.kind==='refund').reduce((n,e)=>n+BigInt(e.amount_minor),0n),outcomes[1].status==='fulfilled'?200n:100n);
 });
}
for(const side of ['customer','supplier'] as const) {
 test(`real PostgreSQL: ${side} compensation and native unallocation commit once with dated reports and immutable originals`,async()=>{
  const f=await compensationFixture(side),before=await compensationSnapshot(f.company);
  assert.equal(f.credit.money.net_pence,'1000');assert.equal(f.credit.money.vat_pence,'200');assert.equal(f.credit.money.gross_pence,'1200');
  assert.equal(f.review.after_allocated_minor,'9800');assert.equal(f.review.after_open_minor,'2200');
  const [a,b]=await Promise.all([commitConditionalCompensation(f.company,actor,f.body),commitConditionalCompensation(f.company,actor,f.body)]);
  assert.deepEqual([a.status,b.status].sort(),['duplicate','posted']);
  assert.equal(a.reversal_journal_id,b.reversal_journal_id);
  const after=await compensationSnapshot(f.company);
  assert.equal(after.compensation.length,1);
  assert.deepEqual((after as any).accounting_document_sources,(before as any).accounting_document_sources);
  assert.equal((after as any).canonical_journal_entries.length,(before as any).canonical_journal_entries.length+2);
  assert.deepEqual((after as any).accounting_paid_credit_operations,(before as any).accounting_paid_credit_operations);
  const events=(after as any).accounting_payment_events.map((x:any)=>x.row);
  assert.equal(events.filter((e:any)=>e.kind==='payment').reduce((n:bigint,e:any)=>n+BigInt(e.amount_minor),0n),10800n);
  assert.equal(events.filter((e:any)=>e.kind==='unallocation').length,1);
  const old=await compensationReports(f.company,actor,'2026-01-01','2199-12-02');
  const current=await compensationReports(f.company,actor,'2026-01-01','2199-12-03');
  const delta=await compensationReports(f.company,actor,'2199-12-03','2199-12-03');
  reconcileLifecycleReport(current,delta,old,f.credit.party_id,{open:'2200',pool:'1000',
    cash:side==='customer'?'10800':'-10800',net:'10000',vat:'2000',side});
  const oldItem=old.open_items.find((d:any)=>d.id===f.draft.id),newItem=current.open_items.find((d:any)=>d.id===f.draft.id);
  assert.equal(oldItem.open_minor,'0');assert.equal(oldItem.credited_minor,'1200');
  assert.equal(newItem.open_minor,'2200');assert.equal(newItem.credited_minor,'0');assert.equal(newItem.paid_minor,'9800');
  const party=current.party_balances.find((p:any)=>p.party_id===f.credit.party_id);
  assert.equal(party.balance_minor,'2200');assert.equal(party.unapplied_minor,'1000');
  assert.equal(side==='customer'?old.vat.box1_pence:old.vat.box4_pence,'1800');
  assert.equal(side==='customer'?delta.vat.box1_pence:delta.vat.box4_pence,'200');
  assert.equal(delta.general_ledger.length,5);
  const total=await pool.query(`SELECT sum(l.debit_minor)::text debit,sum(l.credit_minor)::text credit
   FROM canonical_journal_lines l WHERE company_id=$1 AND journal_entry_id=ANY($2::uuid[])`,[f.company,[a.reversal_journal_id,a.unallocation_journal_id]]);
  assert.deepEqual(total.rows[0],{debit:'2200',credit:'2200'});
  const cashLines=await pool.query(`SELECT count(*)::int n FROM canonical_journal_lines l JOIN accounting_payment_configuration c ON c.company_id=l.company_id
   WHERE l.company_id=$1 AND l.journal_entry_id=ANY($2::uuid[]) AND l.account_id=(c.mappings->>'bank')::uuid`,[f.company,[a.reversal_journal_id,a.unallocation_journal_id]]);
  assert.equal(cashLines.rows[0].n,0);
  assert.equal((await recoverConditionalCompensation(f.company,actor,f.body.request_id)).state,'known');
  assert.equal((await recoverConditionalCompensation(f.company,actor,randomUUID())).state,'unknown');
  await assert.rejects(()=>commitConditionalCompensation(f.company,actor,{...f.body,reason:'Changed meaning'}),/IDEMPOTENCY_CONFLICT/);
  for(const sql of ['UPDATE conditional_discount_compensations SET reason=reason','DELETE FROM conditional_discount_compensations','TRUNCATE conditional_discount_compensations'])
   await assert.rejects(()=>pool.query(sql),(e:any)=>e.code==='42501');
  await assert.rejects(()=>pool.query(`INSERT INTO conditional_discount_compensations
   SELECT * FROM conditional_discount_compensations WHERE company_id=$1`,[f.company]),
   (e:any)=>e.code==='P0001'&&/Compensation child identity invalid/.test(e.message));
  const again=await conditionalCreditDraft(f,side);
  await assert.rejects(()=>reviewConditionalCredit(f.company,actor,again.id,again.revision,{request_id:randomUUID(),reason:'No second redemption'}));
 });
 for(const stage of ['reversal','unallocation','evidence','projection']) test(`real PostgreSQL: ${side} compensation rollback after ${stage}`,async()=>{
  const f=await compensationFixture(side),before=await compensationSnapshot(f.company);
  await assert.rejects(()=>commitConditionalCompensation(f.company,actor,f.body,async s=>{if(s===stage)throw Error('synthetic child failure '+s);}),/synthetic child failure/);
  assert.deepEqual(await compensationSnapshot(f.company),before);
  await commitConditionalCompensation(f.company,actor,f.body);
 });
 test(`real PostgreSQL: ${side} compensation stale, closed period, revoked membership and cross-company fail before effects`,async()=>{
  const f=await compensationFixture(side),before=await compensationSnapshot(f.company);
  await admin.query("UPDATE accounting_document_periods SET status='CLOSED' WHERE company_id=$1 AND start_date='2199-01-01'",[f.company]);
  await assert.rejects(()=>commitConditionalCompensation(f.company,actor,f.body),/PERIOD_NOT_WRITABLE/);
  await admin.query("UPDATE accounting_document_periods SET status='OPEN' WHERE company_id=$1 AND start_date='2199-01-01'",[f.company]);
  await admin.query("UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2",[f.company,actor]);
  await assert.rejects(()=>commitConditionalCompensation(f.company,actor,f.body),/RESOURCE_NOT_FOUND/);
  await admin.query("UPDATE company_users SET is_active=true WHERE company_id=$1 AND user_id=$2",[f.company,actor]);
  await admin.query("UPDATE company_users SET role='bookkeeper' WHERE company_id=$1 AND user_id=$2",[f.company,actor]);
  await assert.rejects(()=>commitConditionalCompensation(f.company,actor,f.body),(e:any)=>e.status===403);
  await admin.query("UPDATE company_users SET role='owner' WHERE company_id=$1 AND user_id=$2",[f.company,actor]);
  const foreign=await fixture();
  await assert.rejects(()=>commitConditionalCompensation(foreign.company,actor,f.body),/RESOURCE_NOT_FOUND/);
  await assert.rejects(()=>commitConditionalCompensation(f.company,actor,{...f.body,review_token:'sha256:'+'0'.repeat(64)}),/COMPENSATION_REVIEW_STALE/);
  assert.deepEqual(await compensationSnapshot(f.company),before);
 });
 test(`real PostgreSQL HTTP: ${side} compensation review/recovery are native and read-only, with no public writer`,async()=>{
  const f=await compensationFixture(side),before=await compensationSnapshot(f.company);
  const url=`${base}/companies/${f.company}/accounting-conditional-compensations`;
  const headers={'Content-Type':'application/json','x-test-actor':actor};
  const context=await fetch(url+'/context',{headers});assert.equal(context.status,200);
  assert.equal(((await context.json()) as any).data.posting_available,false);
  const response=await fetch(url+'/review',{method:'POST',headers,body:JSON.stringify(f.body)});
  assert.equal(response.status,200);const review=((await response.json()) as any).data;
  assert.equal(review.after_open_minor,'2200');assert.equal(review.readonly,true);assert.equal(review.posting_available,false);
  assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify(f.body)})).status,404);
  assert.equal((await fetch(url+'/context')).status,401);
  assert.deepEqual(await compensationSnapshot(f.company),before);
 });
 test(`real PostgreSQL: ${side} downstream refund invalidates old review and conflicting concurrent compensation rejects without duplicate effects`,async()=>{
  const f=await compensationFixture(side,'12000');
  const refund={...f.body,id:randomUUID(),kind:'refund',party_type:side,party_id:f.credit.party_id,
   payment_id:f.cash.id,date:'2199-12-02',reference:'Synthetic downstream refund',amount_minor:'100',allocations:[]};
  // Use only the native refund contract, never the compensation command fields.
  const payment={id:refund.id,kind:refund.kind,party_type:side,party_id:refund.party_id,payment_id:refund.payment_id,
   date:refund.date,reference:refund.reference,amount_minor:refund.amount_minor,allocations:[]};
  const r=await previewPayment(f.company,actor,payment);
  await postPayment(f.company,actor,{...payment,review_token:r.review_token});
  const before=await compensationSnapshot(f.company);
  await assert.rejects(()=>commitConditionalCompensation(f.company,actor,f.body),/COMPENSATION_REVIEW_STALE/);
  assert.deepEqual(await compensationSnapshot(f.company),before);
  const other=await compensationFixture(side);
  const alt={...other.body,request_id:randomUUID(),reason:'Distinct competing command'};
  const reviewed=await reviewConditionalCompensation(other.company,actor,alt);
  const results=await Promise.allSettled([commitConditionalCompensation(other.company,actor,other.body),
   commitConditionalCompensation(other.company,actor,{...alt,review_token:reviewed.review_token})]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal((await pool.query('SELECT count(*)::int n FROM conditional_discount_compensations WHERE company_id=$1',[other.company])).rows[0].n,1);
 });
}
test('isolated Chromium: native read-only review, stale-input clearing, cancel and unknown outcome without financial writes',async()=>{
 const f=await compensationFixture('customer'),before=await compensationSnapshot(f.company);
 const dir=mkdtempSync(path.join(path.dirname(socket),'compensation-browser-'));
 try {
  const frontend=path.join(process.cwd(),'artifacts/ledgerly');
  const entry=path.join(dir,'entry.jsx'),bundle=path.join(dir,'bundle.js');
  writeFileSync(entry,`
   import React from ${JSON.stringify(frontend+'/node_modules/react/index.js')};
   import {createRoot} from ${JSON.stringify(frontend+'/node_modules/react-dom/client.js')};
   import Panel from ${JSON.stringify(frontend+'/src/features/conditionalCompensation/ConditionalCompensationReview.jsx')};
   const call=async(path,body)=>{const r=await fetch('/companies/${f.company}/accounting-conditional-compensations/'+path,{
    method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-test-actor':${JSON.stringify(actor)}},...(body?{body:JSON.stringify(body)}:{})});
    const j=await r.json();if(!r.ok)throw Error(j.error?.code||'native test request failed');return j.data};
   const client={compensationContext:()=>call('context'),reviewCompensation:(_c,b)=>call('review',b),recoverCompensation:(_c,id)=>call('operations/'+id)};
   const root=createRoot(document.getElementById('root'));
   root.render(<Panel company=${JSON.stringify(f.company)} client={client}/>);
   const wait=async(fn)=>{for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,25))}throw Error('Browser condition timed out')};
   const change=(el,value)=>{Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,value);
    el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))};
   const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
   const selectFor=text=>[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(text))?.querySelector('select');
   (async()=>{
    await wait(()=>document.querySelector('select option[value="${f.credit.id}"]'));
    document.querySelector('details').open=true;
    change(selectFor('Original document and discount credit'),${JSON.stringify(f.credit.id)});
    await wait(()=>selectFor('Original qualifying payment')?.options.length>1);
    change(selectFor('Original qualifying payment'),${JSON.stringify(f.cash.id)});
    change(document.querySelectorAll('input')[0],'10');change(document.querySelectorAll('input')[1],'2199-12-03');
    change(document.querySelectorAll('input')[2],'Synthetic browser allocation change');
    button('Review adjustment').click();
    await wait(()=>document.querySelector('[aria-label="Discount compensation review"]'));
    if(!document.querySelector('[aria-label="Discount compensation review"]').textContent.includes('£22.00'))throw Error('Wrong outstanding');
    if(!button('Confirm posting — unavailable').disabled)throw Error('Public posting became available');
    change(selectFor('Adjustment'),'reverse_payment');
    await wait(()=>!document.querySelector('[aria-label="Discount compensation review"]'));
    change(document.querySelectorAll('input')[0],'108');
    button('Review adjustment').click();
    await wait(()=>document.querySelector('[aria-label="Discount compensation review"]'));
    const reversal=document.querySelector('[aria-label="Discount compensation review"]').textContent;
    if(!reversal.includes('£120.00')||!reversal.includes('changes the recorded bank balance')||!reversal.includes('All three adjustments'))
     throw Error('Cash reversal review missing');
    if(!button('Confirm posting — unavailable').disabled)throw Error('Cash reversal public posting became available');
    change(document.querySelectorAll('input')[0],'11');
    await wait(()=>!document.querySelector('[aria-label="Discount compensation review"]'));
    button('Cancel review').click();
    button('Check request outcome').click();
    await wait(()=>document.getElementById('root').textContent.includes('Its outcome is unknown'));
    const unavailable={...client,compensationContext:async()=>({available:true,can_review:false,items:[]})};
    root.render(<Panel company="synthetic-new-company" client={unavailable}/>);
    await wait(()=>document.getElementById('root').textContent.includes('posting and reversal permission'));
    if(document.querySelector('select')||document.querySelector('[aria-label="Discount compensation review"]')||
      document.getElementById('root').textContent.includes('Its outcome is unknown'))throw Error('Old company compensation state leaked');
    document.body.dataset.compensationAcceptance='passed';
   })().catch(e=>{document.body.dataset.compensationAcceptance='failed';document.body.append(document.createTextNode(e.message))});
  `);
  execFileSync('pnpm',['--filter','@workspace/api-server','exec','esbuild',entry,'--bundle','--platform=browser','--format=iife','--outfile='+bundle],{stdio:'pipe'});
  browserHtml=`<!doctype html><html><head><meta charset="utf-8"><title>SYNTHETIC COMPENSATION TEST — not a signed-in demo</title></head><body><div id="root"></div><script>${readFileSync(bundle,'utf8').replaceAll('</script','<\\/script')}</script></body></html>`;
  const child=spawn('chromium',['--headless','--no-first-run','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-sync',
   '--user-data-dir='+path.join(dir,'profile'),'--dump-dom','--virtual-time-budget=12000',base+'/synthetic-compensation-browser'],{stdio:['ignore','pipe','pipe']});
  let html='',stderr='';
  child.stdout.on('data',b=>{html+=b.toString();});child.stderr.on('data',b=>{stderr+=b.toString();});
  const code=await new Promise<number>((resolve,reject)=>{
   const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Bounded isolated Chromium timed out: '+stderr.slice(-4000)));},30000);
   child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',n=>{clearTimeout(timer);resolve(n??1);});
  });
  writeFileSync(path.join(process.cwd(),'generated-artifacts/compensation-browser.log'),stderr+'\n'+html.match(/<body[^>]*>/)?.[0]+'\n');
  assert.equal(code,0,'Isolated Chromium failed: '+stderr.slice(-4000));assert.match(html,/data-compensation-acceptance="passed"/,html.slice(-1200));
  assert.deepEqual(await compensationSnapshot(f.company),before);
  console.log('COMPENSATION_BROWSER_ACCEPTANCE',JSON.stringify({loopbackOnly:true,syntheticTestAuthSeam:true,productionClerkUnchanged:true,
   nativeReview:true,fullCashReversalReview:true,staleInputCleared:true,cancel:true,unknownNoResubmit:true,financialRowsUnchanged:true}));
 }finally{browserHtml='';rmSync(dir,{recursive:true,force:true});}
});
for(const partyType of ['customer','supplier'] as const) {
 for(const amount of ['10800','12000']) test(`real PostgreSQL: ${partyType} atomic conditional redemption ${amount}, replay and protected settlement`,async()=>{
  const f=await admissionFixture(partyType);
  await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));
  await observeConditionalOriginal(f.company,actor,f.draft.id);
  const cash=await nativeCash(f,amount,amount);
  const credit=await conditionalCreditDraft(f,partyType),body={request_id:randomUUID(),reason:'Internal redemption'};
  const review=await reviewConditionalCredit(f.company,actor,credit.id,credit.revision,body);
  const input={...body,review_token:review.review_token,releases:review.releases};
  const staleUndo={...f.body,id:randomUUID(),date:'2199-12-02',kind:'unallocation',payment_id:cash.id,amount_minor:'1',allocations:[{document_id:f.draft.id,amount_minor:'1'}]};
  const staleUndoReview=await previewPayment(f.company,actor,staleUndo);
  const results=await Promise.all([commitConditionalCredit(f.company,actor,credit.id,credit.revision,input),commitConditionalCredit(f.company,actor,credit.id,credit.revision,input)]);
  assert.deepEqual(results.map(x=>x.status).sort(),['duplicate','posted']);
  assert.equal(results[0].journal_id,results[1].journal_id);
  const totals=(await pool.query(`SELECT amount_paid::text,balance_due::text FROM ${partyType==='customer'?'sales_invoices':'purchase_bills'} WHERE id=$1`,[f.draft.id])).rows[0];
  assert.deepEqual(totals,{amount_paid:'108.00',balance_due:'0.00'});
  assert.equal((await pool.query('SELECT count(*)::int n FROM accounting_paid_credit_operations WHERE company_id=$1',[f.company])).rows[0].n,1);
  const op=(await pool.query('SELECT * FROM accounting_paid_credit_operations WHERE company_id=$1',[f.company])).rows[0];
  assert.equal(op.intent.conditional_admission.binding.document_id,f.draft.id);
  assert.equal(op.credit_id,credit.id);
  assert.equal(op.intent.released_minor,amount==='12000'?'1200':'0');
  const altered=(await pool.query('SELECT * FROM accounting_document_sources WHERE company_id=$1 AND id=$2',[f.company,credit.id])).rows[0];
  altered.source={...altered.source,invoice_number:'FORGED POSTED SOURCE'};
  const forgedIntent={...op.intent,conditional_credit_payload:canonicalConditionalPayload({source:altered.source,money:altered.money,tax_context:altered.tax_context,accounts:altered.posting_accounts})};
  const forgedRequest=randomUUID(),connection=await admin.connect();
  try {
   await connection.query('BEGIN');
   await assert.rejects(()=>connection.query('UPDATE accounting_document_sources SET source=$3 WHERE company_id=$1 AND id=$2',[f.company,credit.id,altered.source]),/Posted accounting sources are immutable/);
   await connection.query('ROLLBACK');
   // Check forged consumption independently: the rejected source mutation must
   // not leave this assertion in an aborted transaction or alter posted history.
   await connection.query('BEGIN');
   await connection.query('SET LOCAL ROLE ledgerly_api');
   await assert.rejects(()=>connection.query(`INSERT INTO accounting_paid_credit_operations(company_id,request_id,credit_id,actor_id,request_hash,intent,result) VALUES($1,$2,$3,$4,$5,$6,$7)`,[f.company,forgedRequest,credit.id,actor,op.request_hash,forgedIntent,{...op.result,request_id:forgedRequest}]),/Conditional consumption identity invalid/);
  } finally {await connection.query('ROLLBACK');connection.release();}

  await assert.rejects(()=>commitPaidCredit(f.company,actor,credit.id,credit.revision,input),/CONDITIONAL_POSTING_NOT_AVAILABLE/);
  await assert.rejects(()=>postDocument(f.company,actor,credit.id,credit.revision),/CONDITIONAL_POSTING_NOT_AVAILABLE/);
  const correctionState=async()=>(await admin.query(`SELECT
   (SELECT count(*) FROM canonical_journal_entries WHERE company_id=$1)::int journals,
   (SELECT count(*) FROM accounting_document_amendments WHERE company_id=$1)::int amendments,
   (SELECT count(*) FROM accounting_posting_effects WHERE company_id=$1)::int effects`,[f.company])).rows[0];
  const beforeCorrection=await correctionState();
  // Bound conditional journal evidence is outside ordinary correction support;
  // that earlier guard must reject without creating any correction effects.
  await assert.rejects(()=>reviewCorrection(f.company,actor,f.draft.id,f.draft.revision,{request_id:randomUUID(),reason:'Consumed original',effective_date:'2199-12-02',line_items:f.draft.source.line_items.map((x:any)=>({quantity:x.quantity,unit_price:'110'}))}),(error:any)=>error.code==='CORRECTION_JOURNAL_UNSUPPORTED');
  assert.deepEqual(await correctionState(),beforeCorrection);
  const undo={...f.body,id:randomUUID(),date:'2199-12-02',kind:'unallocation',payment_id:cash.id,amount_minor:'1',allocations:[{document_id:f.draft.id,amount_minor:'1'}]};
  await assert.rejects(()=>previewPayment(f.company,actor,undo),/CONDITIONAL_CONSUMED_PAYMENT_PROTECTED/);
  await assert.rejects(()=>postPayment(f.company,actor,{...staleUndo,review_token:staleUndoReview.review_token}),/CONDITIONAL_CONSUMED_PAYMENT_PROTECTED/);
  const reverse={...undo,id:randomUUID(),kind:'reversal',amount_minor:amount,allocations:[]};
  await assert.rejects(()=>previewPayment(f.company,actor,reverse),/CONDITIONAL_CONSUMED_PAYMENT_PROTECTED/);
  if(amount==='12000') {
   const refund={...undo,id:randomUUID(),kind:'refund',amount_minor:'1200',allocations:[]};
   const r=await previewPayment(f.company,actor,refund);await postPayment(f.company,actor,{...refund,review_token:r.review_token});
   assert.deepEqual((await pool.query(`SELECT amount_paid::text,balance_due::text FROM ${partyType==='customer'?'sales_invoices':'purchase_bills'} WHERE id=$1`,[f.draft.id])).rows[0],totals);
  }
 });
 test(`real PostgreSQL: ${partyType} conditional redemption rollback and competing identities`,async()=>{
  const f=await admissionFixture(partyType);
  await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));
  await observeConditionalOriginal(f.company,actor,f.draft.id);await nativeCash(f,'12000','12000');
  const c1=await conditionalCreditDraft(f,partyType),c2=await conditionalCreditDraft(f,partyType);
  const b1={request_id:randomUUID(),reason:'Rollback and race'},b2={request_id:randomUUID(),reason:'Competing identity'};
  const r1=await reviewConditionalCredit(f.company,actor,c1.id,c1.revision,b1),r2=await reviewConditionalCredit(f.company,actor,c2.id,c2.revision,b2);
  const i1={...b1,review_token:r1.review_token,releases:r1.releases},i2={...b2,review_token:r2.review_token,releases:r2.releases};
  const before=(await pool.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n;
  await assert.rejects(()=>commitConditionalCredit(f.company,actor,c1.id,c1.revision,i1,async tx=>{assert.equal((await queryAdapter(tx).query('SELECT count(*)::int n FROM accounting_paid_credit_operations WHERE company_id=$1',[f.company])).rows[0].n,1);throw Error('redemption rollback');}),/redemption rollback/);
  assert.equal((await pool.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n,before);
  assert.equal((await pool.query('SELECT count(*)::int n FROM accounting_paid_credit_operations WHERE company_id=$1',[f.company])).rows[0].n,0);
  assert.equal((await pool.query("SELECT count(*)::int n FROM accounting_payment_events WHERE company_id=$1 AND kind='unallocation'",[f.company])).rows[0].n,0);
  await assert.rejects(()=>postDocument(f.company,actor,c1.id,c1.revision),/CONDITIONAL_POSTING_NOT_AVAILABLE/);
  // Even the restricted SQL writer cannot manufacture consumption for a draft.
  await assert.rejects(()=>pool.query(`INSERT INTO accounting_paid_credit_operations(company_id,request_id,credit_id,actor_id,request_hash,intent,result) VALUES($1,$2,$3,$4,$5,$6,$7)`,[f.company,randomUUID(),c1.id,actor,'sha256:'+'a'.repeat(64),r1,{status:'posted',document_id:c1.id,journal_id:randomUUID(),request_id:randomUUID()}]),/Conditional consumption identity invalid/);
  const race=await Promise.allSettled([commitConditionalCredit(f.company,actor,c1.id,c1.revision,i1),commitConditionalCredit(f.company,actor,c2.id,c2.revision,i2)]);
  assert.equal(race.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(race.filter(x=>x.status==='rejected').length,1);
  assert.equal((await pool.query('SELECT count(*)::int n FROM accounting_paid_credit_operations WHERE company_id=$1',[f.company])).rows[0].n,1);
 });
}
for(const partyType of ['customer','supplier'] as const) test(`real PostgreSQL: ${partyType} redemption races eligibility loss under the same company lock`,async()=>{
 const f=await admissionFixture(partyType);
 await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));await observeConditionalOriginal(f.company,actor,f.draft.id);
 const cash=await nativeCash(f,'10800','10800'),credit=await conditionalCreditDraft(f,partyType);
 const body={request_id:randomUUID(),reason:'Race eligibility loss'},review=await reviewConditionalCredit(f.company,actor,credit.id,credit.revision,body);
 const undo={...f.body,id:randomUUID(),date:'2199-12-02',kind:'unallocation',payment_id:cash.id,amount_minor:'100',allocations:[{document_id:f.draft.id,amount_minor:'100'}]};
 const ur=await previewPayment(f.company,actor,undo);
 const race=await Promise.allSettled([
  commitConditionalCredit(f.company,actor,credit.id,credit.revision,{...body,review_token:review.review_token,releases:review.releases}),
  postPayment(f.company,actor,{...undo,review_token:ur.review_token})]);
 assert.equal(race.filter(x=>x.status==='fulfilled').length,1);
 const operations=(await pool.query('SELECT count(*)::int n FROM accounting_paid_credit_operations WHERE company_id=$1',[f.company])).rows[0].n;
 const paid=(await pool.query(`SELECT amount_paid::text FROM ${partyType==='customer'?'sales_invoices':'purchase_bills'} WHERE id=$1`,[f.draft.id])).rows[0].amount_paid;
 assert.equal(paid,operations===1?'108.00':'107.00');
});
for(const partyType of ['customer','supplier'] as const) test(`real PostgreSQL: ${partyType} redemption releases old nonqualifying pool before qualifying cash`,async()=>{
 const f=await admissionFixture(partyType),old=await nativeCash(f,'1200','0');
 await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));await observeConditionalOriginal(f.company,actor,f.draft.id);
 const allocation={...f.body,id:randomUUID(),kind:'allocation',payment_id:old.id,amount_minor:'1200',allocations:[{document_id:f.draft.id,amount_minor:'1200'}]};
 const ar=await previewPayment(f.company,actor,allocation);await postPayment(f.company,actor,{...allocation,review_token:ar.review_token});
 await nativeCash(f,'10800','10800');
 const credit=await conditionalCreditDraft(f,partyType),body={request_id:randomUUID(),reason:'Qualified-first per-parent release'};
 const review=await reviewConditionalCredit(f.company,actor,credit.id,credit.revision,body);
 assert.equal(review.conditional_admission?.qualifying_minor,'10800');assert.equal(review.releases[0].payment_id,old.id);
 assert.equal(review.releases[0].amount_minor,'1200');
 const result=await commitConditionalCredit(f.company,actor,credit.id,credit.revision,{...body,review_token:review.review_token,releases:review.releases});
 assert.equal(result.status,'posted');
 assert.deepEqual((await pool.query(`SELECT amount_paid::text,balance_due::text FROM ${partyType==='customer'?'sales_invoices':'purchase_bills'} WHERE id=$1`,[f.draft.id])).rows[0],{amount_paid:'108.00',balance_due:'0.00'});
});

for(const partyType of ['customer','supplier'] as const) test(`real PostgreSQL HTTP: ${partyType} conditional eligibility is read-only, scoped and keeps public posting closed`,async()=>{
 const f=await admissionFixture(partyType);
 await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));
 await observeConditionalOriginal(f.company,actor,f.draft.id);await nativeCash(f,'10800','10800');
 const credit=await conditionalCreditDraft(f,partyType),body={request_id:randomUUID(),reason:'Read-only HTTP eligibility'};
 const viewer=`viewer-${randomUUID()}`,inactive=`inactive-${randomUUID()}`;
 for(const [user,role,active] of [[viewer,'read_only',true],[inactive,'owner',false]])await admin.query(
  'INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,$4,$5)',[randomUUID(),f.company,user,role,active]);
 const before=await financialSnapshot(f.company);
 const result=await conditionalHttp(f.company,credit.id,body,credit.revision);
 assert.equal(result.status,200);assert.equal(result.data.readonly,true);assert.equal(result.data.posting_available,false);
 assert.deepEqual(result.data.conditional_admission,{threshold_minor:'10800',qualifying_minor:'10800',deadline:'2199-11-30'});
 assert.equal(result.data.released_minor,'0');assert.deepEqual(result.data.releases,[]);assert.equal(result.data.document_id,credit.id);assert.equal(result.data.revision,credit.revision);
 for(const key of ['review_token','intent','conditional_credit_payload'])assert.equal(Object.hasOwn(result.data,key),false,key);
 assert.deepEqual(await conditionalHttp(f.company,credit.id,body,credit.revision),result);
 assert.equal((await conditionalHttp(f.company,credit.id,body,credit.revision,null)).status,401);
 assert.equal((await conditionalHttp(f.company,credit.id,body,credit.revision,viewer)).status,403);
 assert.equal((await conditionalHttp(f.company,credit.id,body,credit.revision,inactive)).status,404);
 assert.equal((await conditionalHttp(f.company,credit.id,body,credit.revision,`foreign-${randomUUID()}`)).status,404);
 const other=await fixture();
 assert.equal((await conditionalHttp(other.company,credit.id,body,credit.revision)).status,404);
 for(const [revision,status,code] of [[undefined,428,'REVISION_REQUIRED'],[randomUUID(),409,'REVISION_CONFLICT']] as const) {
  const denied=await conditionalHttp(f.company,credit.id,body,revision);assert.equal(denied.status,status);assert.equal(denied.error.code,code);
 }
 for(const [suffix,input] of [['paid-credit/review',body],['post',{}],['paid-credit',{...body,review_token:'sha256:'+'a'.repeat(64),releases:result.data.releases}]] as const) {
  const denied=await conditionalHttp(f.company,credit.id,input,credit.revision,actor,suffix);
  assert.equal(denied.status,422);assert.equal(denied.error.code,'CONDITIONAL_POSTING_NOT_AVAILABLE');
 }
 assert.equal((await conditionalHttp(f.company,credit.id,body,credit.revision,actor,'conditional-credit')).status,404);
 assert.deepEqual(await financialSnapshot(f.company),before);
});
test('real PostgreSQL HTTP: insufficient conditional payments return guidance without financial writes',async()=>{
 const f=await admissionFixture('customer');await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));
 await observeConditionalOriginal(f.company,actor,f.draft.id);await nativeCash(f,'10799','10799');
 const credit=await conditionalCreditDraft(f,'customer'),before=await financialSnapshot(f.company);
 const result=await conditionalHttp(f.company,credit.id,{request_id:randomUUID(),reason:'Eligibility check'},credit.revision);
 assert.equal(result.status,409);assert.equal(result.error.code,'CONDITIONAL_PAYMENT_THRESHOLD_NOT_MET');
 assert.match(result.error.message,/Qualifying payments/);assert.deepEqual(await financialSnapshot(f.company),before);
});

async function replacementHttp(method:'GET'|'POST',company:string,id:string,suffix='',body?:unknown,user:string|null=actor) {
 const response=await fetch(`${base}/companies/${company}/accounting-documents/${id}/conditional-replacements${suffix}`,{method,headers:{
  ...(body!==undefined?{'Content-Type':'application/json'}:{}),...(user?{'x-test-actor':user}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const raw=await response.text();return {status:response.status,...(raw.startsWith('{')?JSON.parse(raw):{})} as any;
}
for(const side of ['customer','supplier'] as const) test(`Job12 PostgreSQL HTTP: ${side} replacement history overview, append replay, observation and scoping keep posting closed`,async()=>{
 const f=await replacementFixture(side);
 const viewer=`viewer-${randomUUID()}`,outsider=`outsider-${randomUUID()}`;
 await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'read_only',true)",[randomUUID(),f.company,viewer]);
 const empty=await replacementHttp('GET',f.company,f.draft.id);
 assert.equal(empty.status,200);
 assert.deepEqual({...empty.data,original_binding_hash:undefined},{original_binding_hash:undefined,consumed:false,current_replacement_id:null,replaceable:true,posting_available:false,replacements:[]});
 const baseline=await financialSnapshot(f.company);
 // Authentication, membership and capability.
 assert.equal((await replacementHttp('GET',f.company,f.draft.id,'',undefined,null)).status,401);
 assert.equal((await replacementHttp('GET',f.company,f.draft.id,'',undefined,outsider)).status,404);
 assert.equal((await replacementHttp('GET',f.company,f.draft.id,'',undefined,viewer)).status,200);
 const denied=await replacementHttp('POST',f.company,f.draft.id,'',f.input,viewer);
 assert.equal(denied.status,403);assert.equal(denied.error.code,'CAPABILITY_DENIED');
 assert.equal((await replacementHttp('POST',f.company,f.draft.id,'',f.input,outsider)).status,404);
 // Bypass fields never reach the database function.
 assert.equal((await replacementHttp('POST',f.company,f.draft.id,'',{...f.input,force:true})).status,422);
 assert.equal((await replacementHttp('POST',f.company,f.draft.id,'',{...f.input,attested:false})).error.code,'CONDITIONAL_ATTESTATION_REQUIRED');
 assert.deepEqual(await financialSnapshot(f.company),baseline);
 // Append and exact replay readback.
 const first=await replacementHttp('POST',f.company,f.draft.id,'',f.input);
 assert.equal(first.status,201);assert.equal(first.data.request_id,f.input.request_id);assert.equal(first.data.posting_available,false);
 assert.doesNotMatch(JSON.stringify(first),/canonical|capacity|vector|review_token|source_xid/);
 const replay=await replacementHttp('POST',f.company,f.draft.id,'',f.input);
 assert.equal(replay.status,201);assert.equal(replay.data.id,first.data.id);
 const conflict=await replacementHttp('POST',f.company,f.draft.id,'',{...f.input,evidence_text:'changed'});
 assert.equal(conflict.status,409);assert.equal(conflict.error.code,'CONDITIONAL_REPLACEMENT_REQUEST_CONFLICT');
 const stale=await replacementHttp('POST',f.company,f.draft.id,'',{...f.input,request_id:randomUUID(),terms:{...f.input.terms,agreement_id:randomUUID()}});
 assert.equal(stale.status,409);assert.equal(stale.error.code,'CONDITIONAL_REPLACEMENT_STALE');assert.match(stale.error.message,/Another replacement/);
 let view=await replacementHttp('GET',f.company,f.draft.id);
 assert.equal(view.data.current_replacement_id,first.data.id);
 assert.deepEqual(view.data.replacements.map((r:any)=>[r.position,r.current,r.observation.state,r.request_id]),[[1,true,'unobserved',f.input.request_id]]);
 assert.equal(view.data.replacements[0].evidence.terms.discount_gross_pence,'2400');
 // Observation: write capability, document membership, idempotent, no internals.
 const obsPath=`/${first.data.id}/observe`;
 assert.equal((await replacementHttp('POST',f.company,f.draft.id,obsPath,{},viewer)).status,403);
 assert.equal((await replacementHttp('POST',f.company,f.draft.id,obsPath,{bypass:true})).status,422);
 const other=await replacementFixture(side);
 assert.equal((await replacementHttp('POST',other.company,other.draft.id,obsPath,{})).status,404);
 assert.equal((await replacementHttp('POST',f.company,randomUUID(),obsPath,{})).status,404);
 const observed=await replacementHttp('POST',f.company,f.draft.id,obsPath,{});
 assert.equal(observed.status,200);assert.equal(observed.data.replacement_id,first.data.id);assert.equal(observed.data.observation.state,'observed');
 assert.equal(observed.data.posting_available,false);assert.doesNotMatch(JSON.stringify(observed),/canonical|capacity|vector|frozen/);
 assert.deepEqual((await replacementHttp('POST',f.company,f.draft.id,obsPath,{})).data,observed.data);
 // Second version: first becomes superseded but stays observed; the new one is current and unobserved.
 const second=await replacementHttp('POST',f.company,f.draft.id,'',{...f.input,request_id:randomUUID(),predecessor_id:first.data.id,terms:{...f.input.terms,agreement_id:randomUUID(),discount_gross_pence:'1800'}});
 assert.equal(second.status,201);
 view=await replacementHttp('GET',f.company,f.draft.id);
 assert.deepEqual(view.data.replacements.map((r:any)=>[r.position,r.current,r.observation.state]),[[1,false,'observed'],[2,true,'unobserved']]);
 assert.equal(view.data.replacements[1].evidence.terms.discount_gross_pence,'1800');assert.equal(view.data.consumed,false);
 // Cross-company read of the same document is not found.
 assert.equal((await replacementHttp('GET',other.company,f.draft.id)).status,404);
 // Both public posting gates remain closed after replacement and observation.
 const credit=await conditionalCreditDraft(f,side,'24');
 const journals=async()=>(await pool.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1',[f.company])).rows[0].n;
 const journalsBefore=await journals();
 const posted=await fetch(`${base}/companies/${f.company}/accounting-documents/${credit.id}/post`,{method:'POST',headers:{'Content-Type':'application/json','x-test-actor':actor,'If-Match':`"${credit.revision}"`},body:'{}'});
 const postedCode=((await posted.json()) as any).error?.code;
 assert.ok(posted.status>=400&&posted.status<500,String(posted.status));assert.ok(['CONDITIONAL_POSTING_NOT_AVAILABLE','CONDITIONAL_REPLACEMENT_REQUIRED','CONDITIONAL_REPLACEMENT_CONTEXT_CHANGED'].includes(postedCode),postedCode);
 const paid=await conditionalHttp(f.company,credit.id,{request_id:randomUUID(),reason:'Public paid-credit gate'},credit.revision,actor,'paid-credit/review');
 assert.ok(paid.status>=400&&paid.status<500,String(paid.status));assert.ok(['CONDITIONAL_POSTING_NOT_AVAILABLE','CONDITIONAL_REPLACEMENT_REQUIRED','CONDITIONAL_REPLACEMENT_CONTEXT_CHANGED'].includes(paid.error.code),paid.error.code);
 assert.equal(await journals(),journalsBefore);
 assert.equal((await pool.query('SELECT count(*)::int n FROM accounting_paid_credit_operations WHERE company_id=$1',[f.company])).rows[0].n,0);
});
test('Job12 PostgreSQL HTTP: missing replacement schema is honest 503 and records nothing',async()=>{
 const f=await replacementFixture('customer');
 const client=await admin.connect();
 try {
  await client.query('BEGIN');
  await client.query('ALTER TABLE conditional_discount_replacements DISABLE TRIGGER conditional_replacement_immutable');
  await client.query('COMMIT');
 } finally {client.release();}
 try {
  const r=await replacementHttp('GET',f.company,f.draft.id);
  assert.equal(r.status,503);assert.equal(r.error.code,'CONDITIONAL_REPLACEMENT_SCHEMA_INCOMPLETE');
  const w=await replacementHttp('POST',f.company,f.draft.id,'',f.input);
  assert.equal(w.status,503);
  assert.equal((await pool.query('SELECT count(*)::int n FROM conditional_discount_replacements WHERE company_id=$1',[f.company])).rows[0].n,0);
 } finally {await admin.query('ALTER TABLE conditional_discount_replacements ENABLE ALWAYS TRIGGER conditional_replacement_immutable');}
});

for(const partyType of ['customer','supplier'] as const) test(`real PostgreSQL HTTP: ${partyType} conditional preview rechecks unpaid capacity after further payments`,async()=>{
 const f=await admissionFixture(partyType);
 await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));
 await observeConditionalOriginal(f.company,actor,f.draft.id);
 const credit=await conditionalCreditDraft(f,partyType),body={request_id:randomUUID(),reason:'Current unpaid balance preview'};
 // A saved draft does not establish qualification or reserve the unpaid balance.
 let before=await financialSnapshot(f.company);
 let result=await conditionalHttp(f.company,credit.id,body,credit.revision);
 assert.equal(result.status,409);assert.equal(result.error.code,'CONDITIONAL_PAYMENT_THRESHOLD_NOT_MET');
 assert.deepEqual(await financialSnapshot(f.company),before);
 await nativeCash(f,'10800','10800');
 before=await financialSnapshot(f.company);
 result=await conditionalHttp(f.company,credit.id,body,credit.revision);
 assert.equal(result.status,200);assert.equal(result.data.credit_minor,'1200');
 assert.equal(result.data.offset_minor,'1200');assert.equal(result.data.released_minor,'0');
 assert.deepEqual(result.data.releases,[]);assert.equal(result.data.posting_available,false);
 assert.deepEqual(await financialSnapshot(f.company),before);
 // The same request cannot reuse an earlier preview after another tab pays.
 await nativeCash(f,'1','1');
 before=await financialSnapshot(f.company);
 result=await conditionalHttp(f.company,credit.id,body,credit.revision);
 assert.equal(result.status,409);assert.equal(result.error.code,'DISCOUNT_EXCEEDS_OUTSTANDING');
 assert.deepEqual(await financialSnapshot(f.company),before);
 await nativeCash(f,'1199','1199');
 before=await financialSnapshot(f.company);
 result=await conditionalHttp(f.company,credit.id,body,credit.revision);
 assert.equal(result.status,409);assert.equal(result.error.code,'DISCOUNT_REQUIRES_UNPAID_BALANCE');
 assert.deepEqual(await financialSnapshot(f.company),before);
});

import {reviewPublicConditionalCredit,commitCurrentConditionalDiscount,recoverCurrentConditionalDiscount} from './paidCredit';
for(const side of ['customer','supplier'] as const) {
 test(`real PostgreSQL: ${side} current conditional discount commits atomically without releasing cash and recovers exact receipt`,async()=>{
  const f=await admissionFixture(side);
  await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));await observeConditionalOriginal(f.company,actor,f.draft.id);
  await nativeCash(f,'10800','10800');
  const c=await conditionalCreditDraft(f,side),b={request_id:randomUUID(),reason:'Current policy discount'};
  const r=await reviewPublicConditionalCredit(f.company,actor,c.id,c.revision,b);
  const historical=await reviewConditionalCredit(f.company,actor,c.id,c.revision,b);
  assert.notEqual(r.review_token,historical.review_token);assert.deepEqual(r.releases,[]);assert.equal(r.released_minor,'0');
  const input={...b,review_token:r.review_token,releases:r.releases};
  const before=await financialSnapshot(f.company);
  await assert.rejects(()=>commitCurrentConditionalDiscount(f.company,actor,c.id,c.revision,{...input,review_token:historical.review_token}),/PAID_CREDIT_REVIEW_STALE/);
  await assert.rejects(()=>commitConditionalCredit(f.company,actor,c.id,c.revision,input),/PAID_CREDIT_REVIEW_STALE/);
  await assert.rejects(()=>commitCurrentConditionalDiscount(f.company,actor,c.id,c.revision,{...input,purpose:true}),/FIELD_INVALID/);
  await assert.rejects(()=>commitCurrentConditionalDiscount(f.company,actor,c.id,c.revision,input,async()=>{throw Error('current discount rollback');}),/current discount rollback/);
  assert.deepEqual(await financialSnapshot(f.company),before);
  assert.equal((await recoverCurrentConditionalDiscount(f.company,actor,b.request_id)).status,'unknown');
  const results=await Promise.all([commitCurrentConditionalDiscount(f.company,actor,c.id,c.revision,input),commitCurrentConditionalDiscount(f.company,actor,c.id,c.revision,input)]);
  assert.deepEqual(results.map(x=>x.status).sort(),['duplicate','posted']);
  assert.deepEqual(results[0].releases,[]);
  assert.equal((await commitCurrentConditionalDiscount(f.company,actor,c.id,c.revision,input)).status,'duplicate');
  await assert.rejects(()=>commitConditionalCredit(f.company,actor,c.id,c.revision,input),/IDEMPOTENCY_CONFLICT/);
  await assert.rejects(()=>commitCurrentConditionalDiscount(f.company,actor,c.id,c.revision,{...input,reason:'changed'}),/IDEMPOTENCY_CONFLICT/);
  const receipt=await recoverCurrentConditionalDiscount(f.company,actor,b.request_id);
  assert.deepEqual(receipt,{status:'recorded',request_id:b.request_id,document_id:c.id,journal_id:results[0].journal_id});
  const another=`owner-${randomUUID()}`;
  await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'owner',true)",[randomUUID(),f.company,another]);
  assert.deepEqual(await recoverCurrentConditionalDiscount(f.company,another,b.request_id),{status:'unknown',request_id:b.request_id});
  const other=await admissionFixture(side);
  assert.equal((await recoverCurrentConditionalDiscount(other.company,actor,b.request_id)).status,'unknown');
  const viewer=`viewer-${randomUUID()}`;
  await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'read_only',true)",[randomUUID(),f.company,viewer]);
  await assert.rejects(()=>recoverCurrentConditionalDiscount(f.company,viewer,b.request_id),/CAPABILITY_DENIED|ROLE_DENIED/);
  await assert.rejects(()=>recoverCurrentConditionalDiscount(f.company,'unrelated-user',b.request_id));
  assert.equal((await pool.query("SELECT count(*)::int n FROM accounting_payment_events WHERE company_id=$1 AND kind='unallocation'",[f.company])).rows[0].n,0);
 });
 for(const extra of ['1','1200'])test(`real PostgreSQL: ${side} current discount locked commit rejects ${extra} further paid pence`,async()=>{
  const f=await admissionFixture(side);await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));await observeConditionalOriginal(f.company,actor,f.draft.id);
  await nativeCash(f,'10800','10800');const c=await conditionalCreditDraft(f,side),b={request_id:randomUUID(),reason:'Payment raced review'};
  const r=await reviewPublicConditionalCredit(f.company,actor,c.id,c.revision,b);
  await nativeCash(f,extra,extra);const before=await financialSnapshot(f.company);
  const pattern=extra==='1'?/DISCOUNT_EXCEEDS_OUTSTANDING/:/DISCOUNT_REQUIRES_UNPAID_BALANCE/;
  await assert.rejects(()=>commitCurrentConditionalDiscount(f.company,actor,c.id,c.revision,{...b,review_token:r.review_token,releases:r.releases}),pattern);
  await assert.rejects(()=>reviewPublicConditionalCredit(f.company,actor,c.id,c.revision,b),pattern);
  assert.deepEqual(await financialSnapshot(f.company),before);
 });
 test(`real PostgreSQL: ${side} current discount and payment race cannot over-discount`,async()=>{
  const f=await admissionFixture(side);await withCanonicalPostingTransaction(tx=>bindInOriginalTransaction(f,tx));await observeConditionalOriginal(f.company,actor,f.draft.id);
  await nativeCash(f,'10800','10800');const c=await conditionalCreditDraft(f,side),b={request_id:randomUUID(),reason:'Concurrent payment'};
  const r=await reviewPublicConditionalCredit(f.company,actor,c.id,c.revision,b);
  const p={...f.body,id:randomUUID(),amount_minor:'1',allocations:[{document_id:f.draft.id,amount_minor:'1'}]};
  const pr=await previewPayment(f.company,actor,p);
  const race=await Promise.allSettled([commitCurrentConditionalDiscount(f.company,actor,c.id,c.revision,{...b,review_token:r.review_token,releases:r.releases}),postPayment(f.company,actor,{...p,review_token:pr.review_token})]);
  assert.equal(race.filter(x=>x.status==='fulfilled').length,1);assert.equal(race.filter(x=>x.status==='rejected').length,1);
  assert.equal((await pool.query("SELECT count(*)::int n FROM accounting_payment_events WHERE company_id=$1 AND kind='unallocation'",[f.company])).rows[0].n,0);
 });
}

import {postConditionalOriginal} from './posting';
async function connectedHttp(company:string,route:string,body?:unknown,revision?:string,user=actor) {
 const response=await fetch(`${base}/companies/${company}/${route}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','x-test-actor':user,...(revision?{'If-Match':`"${revision}"`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const json:any=await response.json();return {status:response.status,...json};
}
for(const side of ['customer','supplier'] as const)test(`real PostgreSQL HTTP: connected ${side} original binding payment discount and recovery`,async()=>{
 const f=await admissionFixture(side),originalRoute=`accounting-documents/${f.draft.id}/conditional-original`;
 const before=await financialSnapshot(f.company);
 await assert.rejects(()=>postConditionalOriginal(f.company,actor,f.draft.id,f.draft.revision,async()=>{throw Error('original rollback');}),/original rollback/);
 assert.deepEqual(await financialSnapshot(f.company),before);
 assert.equal((await pool.query('SELECT count(*)::int n FROM conditional_discount_original_bindings WHERE company_id=$1',[f.company])).rows[0].n,0);
 const original=await connectedHttp(f.company,originalRoute,{},f.draft.revision);assert.equal(original.status,200,JSON.stringify(original));
 assert.equal((await connectedHttp(f.company,originalRoute,{},f.draft.revision)).data.journal_id,original.data.journal_id);
 const observed=await connectedHttp(f.company,originalRoute+'/observe',{});assert.equal(observed.status,200,JSON.stringify(observed));
 const body={...f.body,id:randomUUID(),amount_minor:'10800',date:'2026-11-03',allocations:[{document_id:f.draft.id,amount_minor:'10800'}]};
 const pr=await connectedHttp(f.company,'accounting-payments/review',body);assert.equal(pr.status,200,JSON.stringify(pr));
 const payment=await connectedHttp(f.company,'accounting-payments',{...body,review_token:pr.data.review_token});assert.equal(payment.status,200,JSON.stringify(payment));
 const credit=await conditionalCreditDraft(f,side),route=`accounting-documents/${credit.id}/conditional-discount`,intent={request_id:randomUUID(),reason:'Connected current discount'};
 const review=await connectedHttp(f.company,route+'/review',intent,credit.revision);assert.equal(review.status,200,JSON.stringify(review));
 assert.equal(review.data.posting_available,true);assert.equal(review.data.released_minor,'0');
 for(const forbidden of ['conditional_credit_payload','binding','source','capacity'])assert.ok(!Object.hasOwn(review.data,forbidden));
 assert.deepEqual(Object.keys(review.data.conditional_admission).sort(),['deadline','qualifying_minor','threshold_minor']);
 const input={...intent,review_token:review.data.review_token,releases:[]};
 assert.equal((await connectedHttp(f.company,route,{...input,purpose:true},credit.revision)).status,422);
 const viewer='connected-viewer-'+randomUUID();await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'viewer',true)",[randomUUID(),f.company,viewer]);
 assert.equal((await connectedHttp(f.company,route,input,credit.revision,viewer)).status,403);
 const committed=await connectedHttp(f.company,route,input,credit.revision);assert.equal(committed.status,200,JSON.stringify(committed));
 const recovered=await connectedHttp(f.company,`accounting-conditional-discounts/operations/${intent.request_id}`);assert.equal(recovered.status,200,JSON.stringify(recovered));
 assert.equal(recovered.data.status,'recorded');assert.equal(recovered.data.journal_id,committed.data.journal_id);
 assert.equal((await connectedHttp(f.company,route,input,credit.revision)).data.status,'duplicate');
 assert.equal((await pool.query("SELECT count(*)::int n FROM accounting_payment_events WHERE company_id=$1 AND kind='unallocation'",[f.company])).rows[0].n,0);
 assert.deepEqual((await pool.query(`SELECT amount_paid::text,balance_due::text FROM ${side==='customer'?'sales_invoices':'purchase_bills'} WHERE id=$1`,[f.draft.id])).rows[0],{amount_paid:'108.00',balance_due:'0.00'});
 const unknown=await connectedHttp(f.company,`accounting-conditional-discounts/operations/${randomUUID()}`);assert.equal(unknown.data.status,'unknown');
});

test('isolated Chromium: current discount native commit lost response reload and receipt recovery without resubmission',async()=>{
 const f=await admissionFixture('customer');
 await postConditionalOriginal(f.company,actor,f.draft.id,f.draft.revision);await observeConditionalOriginal(f.company,actor,f.draft.id);await nativeCash(f,'10800','10800');
 const credit=await conditionalCreditDraft(f,'customer');
 const dir=mkdtempSync(path.join(path.dirname(socket),'discount-connected-browser-'));
 try {
  const frontend=path.join(process.cwd(),'artifacts/ledgerly'),entry=path.join(dir,'entry.jsx'),bundle=path.join(dir,'bundle.js');
  writeFileSync(entry,`
   import React,{useState} from ${JSON.stringify(frontend+'/node_modules/react/index.js')};
   import {createRoot} from ${JSON.stringify(frontend+'/node_modules/react-dom/client.js')};
   import Review,{DiscountRecoveryNotice} from ${JSON.stringify(frontend+'/src/features/paidCreditReview/PaidCreditReview.jsx')};
   import {prepareCurrentDiscountReview,saveDiscountRecovery,readDiscountRecovery,clearDiscountRecovery,verifyDiscountRecovery} from ${JSON.stringify(frontend+'/src/features/paidCreditReview/model.mjs')};
   const company=${JSON.stringify(f.company)},doc=${JSON.stringify(credit)},original=${JSON.stringify(f.draft)};
   const call=async(route,body,revision)=>{const r=await fetch('/companies/'+company+'/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-test-actor':${JSON.stringify(actor)},...(revision?{'If-Match':'"'+revision+'"'}:{})},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();if(!r.ok)throw Error(j.error?.code);return j.data;};
   const client={reviewConditionalDiscount:(_c,id,b,r)=>call('accounting-documents/'+id+'/conditional-discount/review',b,r)};
   let commits=0;const root=createRoot(document.getElementById('root'));
   function App(){const [pending,setPending]=useState(()=>readDiscountRecovery(localStorage,company,doc.id)),[review,setReview]=useState(null),[message,setMessage]=useState('');
    const prepare=async()=>{if(pending)return;setReview(await prepareCurrentDiscountReview(client,company,doc,crypto.randomUUID(),original));};
    const post=async()=>{if(pending||!review)return;setPending(saveDiscountRecovery(localStorage,company,doc.id,doc.revision,review.intent.request_id));commits++;await call('accounting-documents/'+doc.id+'/conditional-discount',{...review.intent,review_token:review.review_token,releases:[]},doc.revision);setMessage('Simulated response lost');};
    const recover=async()=>{const receipt=await call('accounting-conditional-discounts/operations/'+pending.request_id);if(!verifyDiscountRecovery(receipt,pending))throw Error('Unverified receipt');clearDiscountRecovery(localStorage,pending);setPending(null);setReview(null);setMessage('Recovered posted journal');};
    return <><button disabled={!!pending} onClick={prepare}>Review discount</button>{review&&<Review conditional current review={review}/>}<button disabled={!!pending||!review} onClick={post}>Confirm discount</button><DiscountRecoveryNotice pending={pending} onRecover={recover}/><p>{message}</p></>;
   }
   root.render(<App/>);
   const wait=async(fn)=>{for(let i=0;i<180;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Browser timeout');};
   const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
   (async()=>{
    await wait(()=>button('Review discount'));button('Review discount').click();await wait(()=>document.querySelector('[aria-label="Conditional discount posting review"]'));
    const text=document.querySelector('[aria-label="Conditional discount posting review"]').textContent;if(!text.includes('£12.00')||!text.includes('No paid cash is released'))throw Error('Review omitted exact unpaid policy');
    button('Confirm discount').click();await wait(()=>document.body.textContent.includes('Simulated response lost'));
    root.render(<App key="reloaded"/>);await wait(()=>document.querySelector('[aria-label="Conditional discount recovery"]')&&!document.body.textContent.includes('Simulated response lost'));
    if(!button('Review discount').disabled||!button('Confirm discount').disabled||commits!==1)throw Error('Pending operation allowed resubmission');
    button('Recover discount outcome').click();await wait(()=>document.body.textContent.includes('Recovered posted journal'));
    if(readDiscountRecovery(localStorage,company,doc.id)!==null||commits!==1)throw Error('Recovery resent or retained operation');
    document.body.dataset.connectedDiscountAcceptance='passed';
   })().catch(e=>{document.body.dataset.connectedDiscountAcceptance='failed';document.body.append(document.createTextNode(e.message));});
  `);
  execFileSync('pnpm',['--filter','@workspace/api-server','exec','esbuild',entry,'--bundle','--platform=browser','--format=iife','--outfile='+bundle],{stdio:'pipe'});
  browserHtml=`<!doctype html><html><head><meta charset="utf-8"><title>Synthetic connected discount</title></head><body><div id="root"></div><script>${readFileSync(bundle,'utf8').replaceAll('</script','<\\/script')}</script></body></html>`;
  const child=spawn('chromium',['--headless','--no-first-run','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-sync','--user-data-dir='+path.join(dir,'profile'),'--dump-dom','--virtual-time-budget=12000',base+'/synthetic-compensation-browser'],{stdio:['ignore','pipe','pipe']});
  let html='',stderr='';child.stdout.on('data',b=>{html+=b.toString();});child.stderr.on('data',b=>{stderr+=b.toString();});
  const code=await new Promise<number>((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Bounded Chromium timeout'));},30000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',n=>{clearTimeout(timer);resolve(n??1);});});
  assert.equal(code,0,stderr.slice(-2000));assert.match(html,/data-connected-discount-acceptance="passed"/,html.slice(-2000));
  assert.equal((await pool.query('SELECT count(*)::int n FROM accounting_paid_credit_operations WHERE company_id=$1',[f.company])).rows[0].n,1);
  console.log('CONNECTED_DISCOUNT_BROWSER_ACCEPTANCE',JSON.stringify({nativeCommit:true,syntheticOnly:true,actualReviewAndRecoveryComponents:true,lostResponse:true,remountRecovery:true,noResubmission:true,fullOriginalEntryUi:false}));
 }finally{browserHtml='';rmSync(dir,{recursive:true,force:true});}
});

test('real PostgreSQL HTTP: partial compensation schema blocks new current-policy admission before writes',async()=>{
 const f=await admissionFixture('customer');await postConditionalOriginal(f.company,actor,f.draft.id,f.draft.revision);await observeConditionalOriginal(f.company,actor,f.draft.id);await nativeCash(f,'10800','10800');
 const credit=await conditionalCreditDraft(f,'customer'),intent={request_id:randomUUID(),reason:'Schema check'},route=`accounting-documents/${credit.id}/conditional-discount`;
 const review=await connectedHttp(f.company,route+'/review',intent,credit.revision);assert.equal(review.status,200);
 const second=await admissionFixture('supplier'),before=await financialSnapshot(f.company),beforeSecond=await financialSnapshot(second.company);
 await admin.query('ALTER TABLE conditional_discount_compensations DISABLE TRIGGER conditional_discount_compensation_guard');
 try {
  assert.equal((await connectedHttp(f.company,route+'/review',intent,credit.revision)).status,503);
  assert.equal((await connectedHttp(f.company,route,{...intent,review_token:review.data.review_token,releases:[]},credit.revision)).status,503);
  assert.equal((await connectedHttp(second.company,`accounting-documents/${second.draft.id}/conditional-original`,{},second.draft.revision)).status,503);
  assert.deepEqual(await financialSnapshot(f.company),before);assert.deepEqual(await financialSnapshot(second.company),beforeSecond);
 }finally{await admin.query('ALTER TABLE conditional_discount_compensations ENABLE ALWAYS TRIGGER conditional_discount_compensation_guard');}
});

test('real PostgreSQL: explicit original retry rejects a missing historical binding without retrofitting it',async()=>{
 const f=await admissionFixture('customer');await postConditionalOriginal(f.company,actor,f.draft.id,f.draft.revision);
 // Disposable administrator-only corruption, before any observation references it.
 const q=await admin.connect();try {
  await q.query('BEGIN');await q.query('ALTER TABLE conditional_discount_original_bindings DISABLE TRIGGER conditional_original_immutable');
  await q.query('DELETE FROM conditional_discount_original_bindings WHERE company_id=$1 AND document_id=$2',[f.company,f.draft.id]);
  await q.query('ALTER TABLE conditional_discount_original_bindings ENABLE ALWAYS TRIGGER conditional_original_immutable');await q.query('COMMIT');
 }catch(e){await q.query('ROLLBACK');throw e;}finally{q.release();}
 const before=await financialSnapshot(f.company);
 await assert.rejects(()=>postConditionalOriginal(f.company,actor,f.draft.id,f.draft.revision),/CONDITIONAL_BINDING_INVALID/);
 assert.deepEqual(await financialSnapshot(f.company),before);
 assert.equal((await pool.query('SELECT count(*)::int n FROM conditional_discount_original_bindings WHERE company_id=$1',[f.company])).rows[0].n,0);
});
