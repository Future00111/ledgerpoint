// Real PostgreSQL cases, only in the fresh disposable accounting-flow runner.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {realpathSync} from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import express from 'express';
import {createAccountingRouter} from '../../routes/accountingDocuments';
import {pool} from '@workspace/db';
import {withCanonicalPostingTransaction} from '../accounting/canonicalPosting';
import {queryAdapter} from './core';
import {saveConfiguration,addPeriod} from './configuration';
import {savePaymentConfiguration,previewPayment,postPayment} from './payments';
import {captureCommittedPaymentWitness} from './conditionalDiscount';
const socket=process.env.ACCOUNTING_FLOW_TEST_SOCKET??'';
if(!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]{6}\/socket$/.test(socket)||realpathSync(socket)!==socket) throw Error('Fresh disposable socket required');
const admin=new pg.Pool({host:socket,port:55441,user:'w03_bootstrap',database:'ledgerly_accounting_flow_test',password:'',ssl:false});
const actor='synthetic-witness-owner';
let server:ReturnType<ReturnType<typeof express>['listen']>,base:string;
before(async()=>{
 assert.deepEqual((await admin.query(`SELECT current_database() db,current_user actor,inet_server_addr() addr,current_setting('data_directory') dir`)).rows[0],
  {db:'ledgerly_accounting_flow_test',actor:'w03_bootstrap',addr:null,dir:path.join(path.dirname(socket),'data')});
 assert.equal((await pool.query('SELECT current_user actor')).rows[0].actor,'ledgerly_api');
 const app=express();app.use(express.json());
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

import {reviewConditionalCredit,reviewPaidCredit,commitPaidCredit} from './paidCredit';
async function admissionFixture(partyType:'customer'|'supplier') {
 const f=await conditionalOriginalFixture(partyType,'2199-11-30');
 await addPeriod(f.company,actor,{start_date:'2199-01-01',end_date:'2199-12-31',financial_year_label:'Synthetic future deadline'});
 return f;
}
async function conditionalCreditDraft(f:any,partyType:'customer'|'supplier') {
 const {conditional_discount,...source}=f.draft.source;
 return saveDocument(f.company,actor,{kind:partyType==='customer'?'sales_credit_note':'supplier_credit_note',
  original_id:f.draft.id,reason:'Explicit conditional admission scenario',adjustment_method:'offset_outstanding',effective_adjustment_date:'2199-12-02',
  source:{...source,invoice_number:'CONDITIONAL-CREDIT-'+randomUUID(),issue_date:'2199-12-02',due_date:'2199-12-02',payment_terms:0,
   line_items:source.line_items.map((line:any)=>({...line,unit_price:'12'}))}});
}
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
import {reviewCorrection} from './corrections';
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
 await observeConditionalOriginal(f.company,actor,f.draft.id);await nativeCash(f,'12000','12000');
 const credit=await conditionalCreditDraft(f,partyType),body={request_id:randomUUID(),reason:'Read-only HTTP eligibility'};
 const viewer=`viewer-${randomUUID()}`,inactive=`inactive-${randomUUID()}`;
 for(const [user,role,active] of [[viewer,'read_only',true],[inactive,'owner',false]])await admin.query(
  'INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,$4,$5)',[randomUUID(),f.company,user,role,active]);
 const before=await financialSnapshot(f.company);
 const result=await conditionalHttp(f.company,credit.id,body,credit.revision);
 assert.equal(result.status,200);assert.equal(result.data.readonly,true);assert.equal(result.data.posting_available,false);
 assert.deepEqual(result.data.conditional_admission,{threshold_minor:'10800',qualifying_minor:'10800',deadline:'2199-11-30'});
 assert.equal(result.data.released_minor,'1200');assert.equal(result.data.document_id,credit.id);assert.equal(result.data.revision,credit.revision);
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
