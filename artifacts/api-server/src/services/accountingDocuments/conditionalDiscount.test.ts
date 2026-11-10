import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@workspace/db';
import { PgDialect } from 'drizzle-orm/pg-core';
import { captureCommittedPaymentWitness, observePaymentOutcome } from './conditionalDiscount';
import { hash } from './core';
import { canonicalConditionalPayload,prepareConditionalOriginal,frozenConditionalVector } from './conditionalDiscount';
import { replacementCapacityVector } from './replacementCapacity';

for (const kind of ['sales_invoice','purchase_bill']) test(`${kind}: replacement discount uses remaining line capacity, not original face value`,()=>{
 const current={kind,source:{},money:{net_pence:'10000',vat_pence:'2000',gross_pence:'12000',
   lines:[{net_pence:'10000',vat_pence:'2000',gross_pence:'12000'}]},tax_context:{lines:[{rate:'20.00'}]}};
 const credits=[{money:{lines:[{net_pence:'2000',vat_pence:'400',gross_pence:'2400'}]},tax_context:{original_line_refs:[0]}}];
 const before=JSON.stringify({current,credits});
 const result=replacementCapacityVector(current,credits,{discount_gross_pence:'1200'});
 assert.equal(result.money.gross_pence,'9600');
 assert.deepEqual(result.vector.map(({net_pence,vat_pence,gross_pence}:any)=>({net_pence,vat_pence,gross_pence})),
   [{net_pence:'1000',vat_pence:'200',gross_pence:'1200'}]);
 assert.equal(JSON.stringify({current,credits}),before);
 assert.throws(()=>replacementCapacityVector(current,credits,{discount_gross_pence:'9600'}),/CONDITIONAL_BINDING_INVALID/);
 const corrected={...current,money:{net_pence:'8000',vat_pence:'1600',gross_pence:'9600',
   lines:[{net_pence:'8000',vat_pence:'1600',gross_pence:'9600'}]}};
 assert.equal(replacementCapacityVector(corrected,credits,{discount_gross_pence:'1200'}).money.gross_pence,'7200');
});

test('replacement residual vector keeps depleted line indexes and native mixed-rate rounding',()=>{
 const current={kind:'sales_invoice',source:{},money:{gross_pence:'225',
   lines:[{net_pence:'100',vat_pence:'20',gross_pence:'120'},{net_pence:'100',vat_pence:'5',gross_pence:'105'}]},
   tax_context:{lines:[{rate:'20.00'},{rate:'5.00'}]}};
 const credit={money:{lines:[current.money.lines[0]]},tax_context:{original_line_refs:[0]}};
 const result=replacementCapacityVector(current,[credit],{discount_gross_pence:'21'});
 assert.deepEqual(result.vector.map((v:any)=>[v.line_ref,v.net_pence,v.vat_pence,v.gross_pence]),
   [['0','0','0','0'],['1','20','1','21']]);
 const over={money:{lines:[{net_pence:'99',vat_pence:'21',gross_pence:'120'}]},tax_context:{original_line_refs:[0]}};
 assert.throws(()=>replacementCapacityVector(current,[over],{discount_gross_pence:'21'}),/CORRECTION_BELOW_CREDIT_CAPACITY/);
 const wrong={...credit,tax_context:{original_line_refs:[2]}};
 assert.throws(()=>replacementCapacityVector(current,[wrong],{discount_gross_pence:'21'}),/CREDIT_HISTORY_INVALID/);
});

test('frozen conditional vector uses native deterministic gross allocation and original tax capacity',()=>{
 const row={kind:'sales_invoice',source:{conditional_discount:{discount_gross_pence:'1200'}},
   money:{gross_pence:'12000',lines:[{net_pence:'10000',vat_pence:'2000',gross_pence:'12000'}]},
   tax_context:{lines:[{rate:'20.00',code:'STANDARD'}]}};
 assert.deepEqual(frozenConditionalVector(row),[{line_ref:'0',net_pence:'1000',vat_pence:'200',
   gross_pence:'1200',original:row.money.lines[0],tax:row.tax_context.lines[0]}]);
 assert.deepEqual(frozenConditionalVector({...row,kind:'purchase_bill'}),frozenConditionalVector(row));
 assert.throws(()=>frozenConditionalVector({...row,original_id:'corrected'}),/CONDITIONAL_BINDING_INVALID/);
 assert.throws(()=>frozenConditionalVector({...row,kind:'sales_credit_note'}),/CONDITIONAL_BINDING_INVALID/);
 assert.throws(()=>frozenConditionalVector({...row,money:{...row.money,gross_pence:'12001'}}),/CONDITIONAL_BINDING_INVALID/);
});
test('canonical agreement binding hashes recursively sort keys, unlike jsonb text',()=>{
 assert.equal(hash({z:[{b:2,a:1}],a:0}),hash({a:0,z:[{a:1,b:2}]}));
 assert.notEqual(hash({a:1}),hash({a:'1'}));
});

const company='10000000-0000-4000-8000-000000000001',eventId='20000000-0000-4000-8000-000000000001';
const journal='30000000-0000-4000-8000-000000000001',actor='synthetic-owner';
const source={intent:{id:eventId,kind:'payment',payment_id:null,party_id:company,party_type:'customer',date:'2026-11-03',reference:'Test',amount_minor:'10800',allocations:[]}};
const event={id:eventId,kind:'payment',payment_id:null,party_id:company,party_type:'customer',reference:'Test',amount_minor:'10800',allocations:[],source,
 journal_id:journal,source_revision:hash(source),verified_journal_id:journal,verified_effect_id:'effect',event_effective_date:'2026-11-03',event_created_at:'2026-11-03 12:00:00.000001+00'};
const witness={company_id:company,event_id:eventId,journal_id:journal,event_source_hash:hash(source),
 event_created_at:event.event_created_at,observed_at:'2026-11-03 12:00:01.000001+00'};
const dialect=new PgDialect();
function fake(t:any,{installed=true,guards=6,constraints=7,member=true,row=event,receipt=witness,insertFailure=false}:any={}) {
 const calls:string[]=[];let transactions=0;let inserted=false;
 t.mock.method(db,'transaction',async(fn:any)=>{
   transactions++;
   return fn({execute:async(statement:any)=>{
     const {sql}=dialect.sqlToQuery(statement);calls.push(sql);
     let rows:any[]=[];
     if(sql.includes('FROM companies')) rows=[{id:company}];
     else if(sql.includes('FROM company_users')) rows=member?[{role:'owner',is_active:true}]:[];
     else if(sql.includes('to_regclass')) rows=[{present:installed?'conditional_discount_commit_witnesses':null}];
     else if(sql.includes('FROM pg_trigger')) rows=[{n:guards}];
     else if(sql.includes('FROM pg_constraint')) rows=[{n:constraints}];
     else if(sql.includes('FROM accounting_payment_events e')) rows=[typeof row==='function'?row(sql,calls):row];
     else if(sql.includes('INSERT INTO conditional_discount')) {if(insertFailure)throw Error('synthetic write failure');inserted=true;}
     else if(sql.includes('FROM conditional_discount_commit_witnesses')) rows=inserted?[receipt]:[];
     else throw Error('Unexpected SQL: '+sql);
     return {rows,rowCount:rows.length};
   }});
 });
 return {calls,transactions:()=>transactions};
}
test('mocked service opens a fresh transaction and validates identity before receipt insertion',async t=>{
 const f=fake(t);const r=await captureCommittedPaymentWitness(company,actor,eventId);
 assert.equal(r.status,'recorded');assert.equal(f.transactions(),1);
 assert.ok(f.calls.findIndex(s=>s.includes('FROM accounting_payment_events e'))<f.calls.findIndex(s=>s.includes('INSERT INTO conditional_discount')));
 assert.match(f.calls.find(s=>s.includes('INSERT INTO conditional_discount'))!,/ON CONFLICT\(company_id,event_id\) DO NOTHING/);
 assert.doesNotMatch(f.calls.find(s=>s.includes('INSERT INTO conditional_discount'))!,/observed_at/);
});
test('missing schema reports witness unavailable',async t=>{
 fake(t,{installed:false});assert.deepEqual(await captureCommittedPaymentWitness(company,actor,eventId),{status:'unavailable'});
});
test('partial schema fails closed before any receipt insertion',async t=>{
 const f=fake(t,{guards:2});await assert.rejects(()=>captureCommittedPaymentWitness(company,actor,eventId),/CONDITIONAL_WITNESS_SCHEMA_INCOMPLETE/);
 assert.equal(f.calls.some(s=>s.includes('INSERT INTO')),false);
});
test('membership removal cannot obtain or replay a witness',async t=>{
 const f=fake(t,{member:false});await assert.rejects(()=>captureCommittedPaymentWitness(company,actor,eventId),/RESOURCE_NOT_FOUND/);
 assert.equal(f.calls.some(s=>s.includes('FROM accounting_payment_events')),false);
});
for(const [name,patch] of [
 ['changed source bytes',{source:{...source,tampered:true}}],
 ['missing protected posting effect',{verified_effect_id:null}],
 ['changed effective date',{event_effective_date:'2026-11-04'}],
 ['changed cash amount',{amount_minor:'10799'}],
] as const) test(name+' rejects before persistence',async t=>{
 const f=fake(t,{row:{...event,...patch}});await assert.rejects(()=>captureCommittedPaymentWitness(company,actor,eventId),/PAYMENT_HISTORY_INVALID/);
 assert.equal(f.calls.some(s=>s.includes('INSERT INTO')),false);
});
test('replaced persisted receipt conflicts',async t=>{
 fake(t,{receipt:{...witness,event_source_hash:'sha256:'+'0'.repeat(64)}});
 await assert.rejects(()=>captureCommittedPaymentWitness(company,actor,eventId),/CONDITIONAL_WITNESS_INVALID/);
});
test('observer failure preserves the committed payment result and reports unavailable',async t=>{
 fake(t,{insertFailure:true});const result={status:'posted',id:eventId,journal_id:journal};
 assert.deepEqual(await observePaymentOutcome(result,company,actor,eventId,'payment',false),{...result,conditional_discount_witness:'unavailable'});
});
test('existing parent transaction and nonqualifying events never open observer transaction',async t=>{
 const f=fake(t),result={status:'posted'};
 assert.equal(await observePaymentOutcome(result,company,actor,eventId,'allocation',true),result);
 assert.equal(await observePaymentOutcome(result,company,actor,eventId,'unallocation',false),result);
 assert.equal(f.transactions(),0);
});

test('missing foreign-key or validated-clock constraint rejects witness',async t=>{
 const f=fake(t,{constraints:4});await assert.rejects(()=>captureCommittedPaymentWitness(company,actor,eventId),/CONDITIONAL_WITNESS_SCHEMA_INCOMPLETE/);
 assert.equal(f.calls.some(s=>s.includes('INSERT INTO')),false);
});
test('allocation also verifies its immutable parent payment before observing',async t=>{
 const allocationSource={intent:{...source.intent,kind:'allocation',payment_id:company}};let reads=0;
 const f=fake(t,{row:()=>++reads===1?{...event,kind:'allocation',payment_id:company,source:allocationSource,source_revision:hash(allocationSource)}:{...event,id:company,verified_effect_id:null}});
 await assert.rejects(()=>captureCommittedPaymentWitness(company,actor,eventId),/PAYMENT_HISTORY_INVALID/);
 assert.equal(reads,2);assert.equal(f.calls.some(s=>s.includes('INSERT INTO')),false);
});
test('exact retry returns first persisted observation without replacing its clock',async t=>{
 const f=fake(t);const first=await captureCommittedPaymentWitness(company,actor,eventId);
 const second=await captureCommittedPaymentWitness(company,actor,eventId);
 assert.deepEqual(second,first);assert.equal(f.transactions(),2);
 assert.equal(f.calls.some(s=>/^UPDATE|^DELETE/.test(s)),false);
});

import {evidenceBytes,validateConditionalDraft} from './conditionalDiscount';
import {parseConditionalTerms,conditionalTermsHash,parseInvoice,draftSourceFingerprint} from '../financialDrafts/contract';
const terms={version:1,party_type:'customer',party_id:company,currency:'GBP',agreement_id:eventId,agreement_date:'2026-11-01',payment_deadline:'2026-11-30',discount_gross_pence:'1200'} as const;
const draft={contract:'w03.draft.v1',currency:'GBP',customer_id:company,invoice_number:'COND-1',issue_date:'2026-11-01',due_date:'2026-11-30',payment_terms:29,reference:'',notes:'',line_items:[{description:'Test',quantity:'1',unit_price:'120',tax_code:'NONE'}]};
test('bounded UTF8 preserves exact Unicode/newline bytes and rejects malformed UTF16',()=>{
 assert.equal(evidenceBytes('é😀\n"/\\').toString('utf8'),'é😀\n"/\\');
 assert.equal(evidenceBytes('é'.repeat(32768)).length,65536);
 for(const value of ['é'.repeat(32769),'\ud800','\udc00','\u0000','']) assert.throws(()=>evidenceBytes(value),/CONDITIONAL_EVIDENCE/);
});
test('conditional terms hash excludes receipt and rejects unknown versions/fields',()=>{
 const t=parseConditionalTerms(terms);
 assert.equal(conditionalTermsHash(t),conditionalTermsHash({...t,evidence_receipt_id:journal} as any));
 assert.notEqual(conditionalTermsHash(t),conditionalTermsHash({...t,party_type:'supplier'}));
 for(const patch of [{version:2},{discount_gross_pence:'0'},{payment_deadline:'2026-10-01'},{untrusted_hash:'x'}]) assert.throws(()=>parseConditionalTerms({...terms,...patch}));
});
test('draft terms can change or clear, ordinary discounts conflict and absent source hash stays identical',()=>{
 const old=parseInvoice(draft),bound=parseInvoice({...draft,conditional_discount:{...terms,evidence_receipt_id:journal}});
 assert.equal(draftSourceFingerprint(old),draftSourceFingerprint({...old,conditional_discount:undefined}));
 assert.equal(parseInvoice({contract:'w03.draft.v1',conditional_discount:null},bound).conditional_discount,undefined);
 assert.notEqual(draftSourceFingerprint(old),draftSourceFingerprint(bound));
 assert.throws(()=>parseInvoice({...bound,discount:{type:'amount',value:'1.00'}}),/DISCOUNT_CONFLICT/);
 assert.throws(()=>parseInvoice({...bound,customer_id:eventId}),/CONDITIONAL_TERMS_INVALID/);
});
test('zero net entitlement and wrong party reject before receipt access',async()=>{
 const q={query:()=>{throw Error('Receipt must not be accessed')}} as any;
 const source=parseInvoice({...draft,conditional_discount:{...terms,evidence_receipt_id:journal}});
 await assert.rejects(()=>validateConditionalDraft(q,company,source,'customer','1200'),/CONDITIONAL_TERMS_INVALID/);
 await assert.rejects(()=>validateConditionalDraft(q,company,source,'supplier','12000'),/CONDITIONAL_TERMS_INVALID/);
});
test('conditional UUIDs canonicalize uppercase A-F without changing legacy customer source bytes',()=>{
 const upper='ABCDEFAB-CDEF-4ABC-8ABC-ABCDEFABCDEF',lower=upper.toLowerCase();
 const raw={...terms,party_id:upper,agreement_id:upper,evidence_receipt_id:upper};
 const parsed=parseConditionalTerms(raw,true) as any;
 assert.equal(parsed.party_id,lower);assert.equal(parsed.agreement_id,lower);assert.equal(parsed.evidence_receipt_id,lower);
 assert.equal(conditionalTermsHash(parsed),conditionalTermsHash({...parsed,party_id:upper,agreement_id:upper}));
 const saved=parseInvoice({...draft,customer_id:upper,conditional_discount:raw});
 assert.equal(saved.customer_id,upper);assert.equal(saved.conditional_discount?.party_id,lower);
 assert.equal(parseInvoice({...draft,customer_id:upper}).customer_id,upper);
});

import {bindConditionalOriginal,observeConditionalOriginal,conditionalOriginalSchema} from './conditionalDiscount';
const originalSource={...draft,conditional_discount:{...terms,evidence_receipt_id:journal}};
const originalRow={id:eventId,kind:'sales_invoice',status:'posted',revision:'synthetic-original-revision',journal_id:journal,party_id:company,
 source:originalSource,money:{gross_pence:'12000',net_pence:'12000',vat_pence:'0',lines:[{net_pence:'12000',vat_pence:'0',gross_pence:'12000'}]},
 tax_context:{lines:[{rate:'0.00',code:'NONE'}]},posting_accounts:{receivables:company,revenue:eventId}};
const evidenceRow={id:journal,version:1,attested:true,currency:'GBP',party_id:company,party_type:'customer',terms,
 terms_hash:conditionalTermsHash(terms),evidence_text:'Synthetic agreement',evidence_hash:'sha256:'+createHash('sha256').update('Synthetic agreement').digest('hex')};
import {createHash} from 'node:crypto';
const originalBinding={version:1,company_id:company,document_id:eventId,revision:originalRow.revision,source_hash:hash(originalSource),
 financial_hash:hash({source:originalSource,money:originalRow.money,tax_context:originalRow.tax_context,accounts:originalRow.posting_accounts}),
 party_id:company,currency:'GBP',evidence_id:journal,terms_hash:evidenceRow.terms_hash,
 gross_pence:'12000',discount_gross_pence:'1200',deadline:'2026-11-30',vector:frozenConditionalVector(originalRow)};
function originalFake(t:any,{binding=originalBinding,bindingHash=hash(binding),missing=false,guards=9,constraints=10,owned=true,writable=false,members=1,existing=false,bound=true,snapshot=false,parentValid=true}:any={}) {
 const calls:string[]=[];let observed=existing;let transactions=0;let passedBinding:any;
 const receipt={observed_at:'2026-11-04 17:00:00.000001+00'};
 const query=async(sql:string,params:any[]=[])=>{
  calls.push(sql);let rows:any[]=[];
  if(sql.includes('FROM companies')) rows=[{id:company}];
  else if(sql.includes('FROM company_users')) rows=Array.from({length:members},()=>({role:'owner',is_active:true}));
  else if(sql.includes('FROM unnest')) rows=['origins','bindings','observations'].map(present=>({present:missing?null:present}));
  else if(sql.includes('bool_and(pg_get_userbyid')) rows=[{n:3,owned,writable}];
  else if(sql.includes('FROM pg_trigger t JOIN')) rows=[{n:guards}];
  else if(sql.includes('conrelid=ANY')) rows=[{n:constraints}];
  else if(sql.includes('FROM conditional_discount_replacements')) rows=[];
  else if(sql.includes('to_regclass')) rows=[{present:'conditional_discount_evidence'}];
  else if(sql.includes('FROM pg_trigger')) rows=[{n:2}];
  else if(sql.includes('pg_get_userbyid(relowner) owner')) rows=[{n:11,owner:'ledgerly_canonical_owner',writable:false}];
  else if(sql.includes('FROM conditional_discount_evidence')) rows=[evidenceRow];
  else if(sql.includes('FROM conditional_discount_original_bindings')) rows=bound?[{company_id:company,document_id:eventId,journal_id:journal,binding,binding_hash:bindingHash,canonical_payload:canonicalConditionalPayload(binding),...(snapshot?receipt:{})}]:[];
  else if(sql.includes('FROM canonical_journal_entries j')) rows=parentValid?[{id:journal}]:[];
  else if(sql.includes('FROM accounting_document_sources')&&sql.includes('original_id=$2')) rows=[];
  else if(sql.includes('FROM accounting_document_sources')) rows=[originalRow];
  else if(sql.includes('public.bind_conditional_discount_original')) passedBinding={binding:JSON.parse(params[3]),hash:params[4],payload:params[6]};
  else if(sql.includes('public.observe_conditional_discount_original')) observed=true;
  else if(sql.includes('FROM conditional_discount_original_observations')) rows=observed?[receipt]:[];
  else throw Error('Unexpected original SQL: '+sql);
  return {rows,rowCount:rows.length};
 };
 t.mock.method(db,'transaction',async(fn:any)=>{transactions++;return fn({execute:async(statement:any)=>{const {sql,params}=dialect.sqlToQuery(statement);return query(sql,params);}});});
 return {q:{query} as any,calls,transactions:()=>transactions,passed:()=>passedBinding,receipt};
}
test('original binder persists the complete native snapshot in its supplied transaction',async t=>{
 const f=originalFake(t,{bound:false});assert.deepEqual(await bindConditionalOriginal(f.q,company,actor,eventId),originalBinding);
 assert.deepEqual(f.passed(),{binding:originalBinding,hash:hash(originalBinding),payload:canonicalConditionalPayload(originalBinding)});
 assert.equal(f.transactions(),0);
});
test('original observer opens fresh transaction and exact replay retains first DB clock',async t=>{
 const f=originalFake(t);
 assert.deepEqual(await observeConditionalOriginal(company,actor,eventId),f.receipt);
 assert.deepEqual(await observeConditionalOriginal(company,actor,eventId),f.receipt);
 assert.equal(f.transactions(),2);
 assert.equal(f.calls.filter(s=>s.includes('public.observe_conditional_discount_original')).length,1);
});
for(const [name,options] of Object.entries({absent:{missing:true},guard:{guards:8},constraint:{constraints:8},owner:{owned:false},grant:{writable:true}}))
 test(`original ${name} schema defect rejects before binding or observing`,async t=>{
  const f=originalFake(t,options);
  await assert.rejects(()=>bindConditionalOriginal(f.q,company,actor,eventId),/CONDITIONAL_BINDING_SCHEMA_INCOMPLETE/);
  await assert.rejects(()=>observeConditionalOriginal(company,actor,eventId),/CONDITIONAL_BINDING_SCHEMA_INCOMPLETE/);
  assert.equal(f.calls.some(s=>s.includes('public.bind_conditional')||s.includes('public.observe_conditional')),false);
 });
for(const [field,value] of Object.entries({revision:'changed',source_hash:hash('changed'),financial_hash:hash('changed'),journal_id:eventId,party_id:eventId,
 currency:'EUR',evidence_id:eventId,terms_hash:hash('changed'),gross_pence:'12001',discount_gross_pence:'1199',deadline:'2026-12-01',vector:[],extra:'untrusted'}))
 test(`self-consistent poisoned original ${field} cannot obtain or replay observation`,async t=>{
  const f=originalFake(t,{binding:{...originalBinding,[field]:value},existing:true});
  await assert.rejects(()=>observeConditionalOriginal(company,actor,eventId),/CONDITIONAL_BINDING_INVALID/);
  assert.equal(f.calls.some(s=>s.includes('FROM conditional_discount_original_observations')||s.includes('public.observe_conditional')),false);
 });
test('original binding hash tamper rejects before canonical source lookup',async t=>{
 const f=originalFake(t,{bindingHash:hash('forged')});
 await assert.rejects(()=>observeConditionalOriginal(company,actor,eventId),/CONDITIONAL_BINDING_INVALID/);
 assert.equal(f.calls.some(s=>s.includes('FROM accounting_document_sources')),false);
});
for(const members of [0,2]) test(`original observer refuses ${members} matching memberships before evidence access`,async t=>{
 const f=originalFake(t,{members});
 await assert.rejects(()=>observeConditionalOriginal(company,actor,eventId),/RESOURCE_NOT_FOUND/);
 assert.equal(f.calls.some(s=>s.includes('FROM conditional_discount_original_bindings')),false);
});

test('exact original binding retry reads immutable snapshot without a second insertion',async t=>{
 const f=originalFake(t);assert.deepEqual(await bindConditionalOriginal(f.q,company,actor,eventId),originalBinding);
 assert.equal(f.passed(),undefined);
});
test('binding retry rejects poisoned self-consistent existing snapshot',async t=>{
 const f=originalFake(t,{binding:{...originalBinding,deadline:'2026-12-01'}});
 await assert.rejects(()=>bindConditionalOriginal(f.q,company,actor,eventId),/CONDITIONAL_BINDING_INVALID/);
 assert.equal(f.passed(),undefined);
});

test('native pre-journal commitment excludes journal linkage and equals existing canonical hash',async t=>{
 const f=originalFake(t);
 const prepared=await prepareConditionalOriginal(f.q,company,{...originalRow,status:'draft',journal_id:null});
 assert.deepEqual(prepared.binding,originalBinding);
 assert.equal(Object.hasOwn(prepared.binding,'journal_id'),false);
 assert.equal(prepared.bindingHash,hash(originalBinding));
 assert.equal(prepared.bindingHash,'sha256:'+createHash('sha256').update(prepared.canonicalPayload,'utf8').digest('hex'));
 assert.deepEqual(JSON.parse(prepared.canonicalPayload),originalBinding);
 const unicode={z:'é😀\n"/\\',a:[{y:1,x:'0'}]};
 assert.equal('sha256:'+createHash('sha256').update(canonicalConditionalPayload(unicode),'utf8').digest('hex'),hash(unicode));
 assert.throws(()=>canonicalConditionalPayload({value:'x'.repeat(1048576)}),/CONDITIONAL_BINDING_INVALID/);
});

import {conditionalPaymentSnapshot} from './conditionalDiscount';
test('payment snapshot includes validated observed originals and hashes the exact receipt identity',async t=>{
 const f=originalFake(t,{snapshot:true});
 const result=await conditionalPaymentSnapshot(f.q,company,'customer',company,'payment',null,[]);
 assert.deepEqual(result,{version:1,bindings:[{company_id:company,document_id:eventId,journal_id:journal,binding_hash:hash(originalBinding),observed_at:f.receipt.observed_at}]});
 assert.equal(f.calls.some(s=>/^\s*(INSERT|SELECT public\.observe_)/.test(s)),false);
});
test('explicit empty payment snapshot differs from missing or partial schema',async t=>{
 const f=originalFake(t,{snapshot:true,bound:false});
 assert.deepEqual(await conditionalPaymentSnapshot(f.q,company,'customer',company,'payment',null,[]),{version:1,bindings:[]});
 const broken=originalFake(t,{missing:true});
 await assert.rejects(()=>conditionalPaymentSnapshot(broken.q,company,'customer',company,'payment',null,[]),/CONDITIONAL_BINDING_SCHEMA_INCOMPLETE/);
});
test('legacy payment cannot acquire new bindings at later allocation',async t=>{
 const f=originalFake(t,{snapshot:true});
 assert.deepEqual(await conditionalPaymentSnapshot(f.q,company,'customer',company,'allocation',{source:{}},[{document_id:eventId}]),{version:1,bindings:[]});
 assert.equal(f.calls.some(s=>s.includes('FROM conditional_discount_original_bindings')),false);
});
for(const defect of ['hash','receipt','extra','parent-journal']) test(`allocation rejects changed frozen ${defect}`,async t=>{
 const f=originalFake(t,{snapshot:true,parentValid:defect!=='parent-journal'});
 const snapshot=await conditionalPaymentSnapshot(f.q,company,'customer',company,'payment',null,[]);
 const item=snapshot.bindings[0]!;
 if(defect==='hash') item.binding_hash=hash('changed');
 if(defect==='receipt') item.observed_at='2026-11-05 17:00:00+00';
 if(defect==='extra') (item as any).untrusted=true;
 const parent={id:eventId,journal_id:journal,source:{conditional_binding_snapshot:snapshot}};
 await assert.rejects(()=>conditionalPaymentSnapshot(f.q,company,'customer',company,'allocation',parent,[{document_id:eventId}]),/CONDITIONAL_PAYMENT_SNAPSHOT_INVALID|PAYMENT_HISTORY_INVALID/);
});

for(const prior of [null,{version:2,bindings:[]},{version:1,bindings:[null]}]) test('malformed persisted snapshot rejects with explicit integrity error',async t=>{
 const f=originalFake(t,{snapshot:true});
 await assert.rejects(()=>conditionalPaymentSnapshot(f.q,company,'customer',company,'allocation',{id:eventId,journal_id:journal,source:{conditional_binding_snapshot:prior}},[]),/CONDITIONAL_PAYMENT_SNAPSHOT_INVALID/);
});

import {conditionalClock,conditionalEventTimely,assertNoConditionalCredit} from './conditionalDiscount';
test('conditional deadline and causal comparisons preserve all six UTC fractional digits',()=>{
 const binding='2026-11-01T00:00:00.000001Z',created='2026-11-01T00:00:00.000002Z';
 assert.equal(conditionalEventTimely(created,'2026-11-30T23:59:59.999999Z',binding,'2026-11-30','2026-11-30'),true);
 assert.equal(conditionalEventTimely(created,'2026-12-01T00:00:00.000000Z',binding,'2026-11-30','2026-11-30'),false);
 assert.equal(conditionalEventTimely(binding,'2026-11-30T23:59:59.999999Z',binding,'2026-11-30','2026-11-30'),false);
 assert.equal(conditionalEventTimely(created,'2026-11-30T23:59:59.999999Z',binding,'2026-12-01','2026-11-30'),false);
 for(const clock of ['2026-11-01T00:00:00.001Z','2026-11-01 00:00:00.000001+00','2026-02-30T00:00:00.000001Z']) assert.throws(()=>conditionalClock(clock),/CONDITIONAL_CLOCK_INVALID/);
});
test('public credit guard rejects source terms and incomplete schema independently',async()=>{
 const q:any={query:async()=>({rows:[]})};
 await assert.rejects(()=>assertNoConditionalCredit(q,company,{id:eventId,source:{conditional_discount:{}}}),/CONDITIONAL_POSTING_NOT_AVAILABLE/);
 await assert.rejects(()=>assertNoConditionalCredit(q,company,{id:eventId,source:{}}),/CONDITIONAL_BINDING_SCHEMA_INCOMPLETE/);
});
