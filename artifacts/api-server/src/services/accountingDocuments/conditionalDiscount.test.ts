import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@workspace/db';
import { PgDialect } from 'drizzle-orm/pg-core';
import { captureCommittedPaymentWitness, observePaymentOutcome } from './conditionalDiscount';
import { hash } from './core';

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
const terms={version:1,party_type:'customer',party_id:company,currency:'GBP',agreement_id:eventId,agreement_date:'2026-11-01',payment_deadline:'2026-11-30',discount_gross_pence:'1200'};
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
