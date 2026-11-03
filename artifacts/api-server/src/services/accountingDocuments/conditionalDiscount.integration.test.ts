// Real PostgreSQL cases, only in the fresh disposable accounting-flow runner.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {realpathSync} from 'node:fs';
import path from 'node:path';
import pg from 'pg';
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
before(async()=>{
 assert.deepEqual((await admin.query(`SELECT current_database() db,current_user actor,inet_server_addr() addr,current_setting('data_directory') dir`)).rows[0],
  {db:'ledgerly_accounting_flow_test',actor:'w03_bootstrap',addr:null,dir:path.join(path.dirname(socket),'data')});
 assert.equal((await pool.query('SELECT current_user actor')).rows[0].actor,'ledgerly_api');
});
after(async()=>{await pool.end();await admin.end();});
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
async function insertWitness(q:any,f:any){
 return q.query(`INSERT INTO public.conditional_discount_commit_witnesses(company_id,event_id,journal_id,event_source_hash,actor_id)
 SELECT e.company_id,e.id,e.journal_id,j.source_revision,$3 FROM public.accounting_payment_events e
 JOIN public.canonical_journal_entries j ON j.id=e.journal_id WHERE e.company_id=$1 AND e.id=$2`,[f.company,f.body.id,actor]);
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
