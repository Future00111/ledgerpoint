import test from 'node:test';import assert from 'node:assert/strict';import {prepareCreditReview} from './model.mjs';
test('only explicit absent-schema review falls back; no posting call or ambiguous error is retried',async()=>{
 const calls=[];const client={reviewPaidCredit:async(...args)=>{calls.push(args);throw Object.assign(new Error('unavailable'),{code:'PAID_CREDIT_SCHEMA_UNAVAILABLE'});},post:()=>assert.fail('no mutation during review')};
 assert.deepEqual(await prepareCreditReview(client,'co',{id:'credit',revision:'r',reason:'return'},'req'),{paidCredit:null,paidCreditUnavailable:true});assert.equal(calls.length,1);
 for(const code of ['PAID_CREDIT_SCHEMA_INCOMPLETE','PAID_CREDIT_REVIEW_STALE','NETWORK_ERROR','CAPABILITY_DENIED'])await assert.rejects(()=>prepareCreditReview({...client,reviewPaidCredit:async()=>{throw Object.assign(new Error(code),{code});}},'co',{id:'credit'},'req'),e=>e.code===code);
});
test('review preserves exact server allocation vector and request identity',async()=>{
 const server={releases:[{id:'child',amount_minor:'1200'}],intent:{request_id:'req'}};
 const result=await prepareCreditReview({reviewPaidCredit:async(c,id,b,r)=>{assert.deepEqual([c,id,b,r],['co','credit',{request_id:'req',reason:'return'},'r']);return server;}},'co',{id:'credit',reason:'return',revision:'r'},'req');assert.equal(result.paidCredit,server);assert.equal(result.paidCreditUnavailable,false);
});
test('persisted original selects the dedicated read-only conditional preview and preserves server values',async()=>{
 const doc={id:'credit',original_id:'original',reason:'Agreed discount',revision:'r'};
 const original={id:'original',source:{conditional_discount:{payment_deadline:'2199-11-30'}}};
 const preview={document_id:'credit',revision:'r',original_id:'original',readonly:true,posting_available:false,conditional_admission:{threshold_minor:'10800',qualifying_minor:'10800',deadline:'2199-11-30'},released_minor:'1200',releases:[{amount_minor:'1200'}]};
 const client={reviewConditionalCredit:async(...args)=>{assert.deepEqual(args,['co','credit',{request_id:'req',reason:doc.reason},'r']);return preview;},reviewPaidCredit:()=>assert.fail('conditional must not enter ordinary review'),post:()=>assert.fail('read-only'),commitPaidCredit:()=>assert.fail('read-only')};
 assert.deepEqual(await prepareCreditReview(client,'co',doc,'req',original),{paidCredit:null,paidCreditUnavailable:false,conditionalCredit:preview});
 for(const code of ['PAID_CREDIT_SCHEMA_UNAVAILABLE','CONDITIONAL_PAYMENT_THRESHOLD_NOT_MET','REVISION_CONFLICT','NETWORK_ERROR','CAPABILITY_DENIED']) {
  await assert.rejects(()=>prepareCreditReview({...client,reviewConditionalCredit:async()=>{throw Object.assign(new Error(code),{code});}},'co',doc,'req',original),e=>e.code===code);
 }
 for(const change of [{posting_available:true},{document_id:'wrong'},{revision:'old'},{original_id:'foreign'}])await assert.rejects(()=>prepareCreditReview({...client,reviewConditionalCredit:async()=>({...preview,...change})},'co',doc,'req',original),/could not be verified/);
});
test('missing or mismatched persisted original fails closed; draft terms cannot select conditional flow',async()=>{
 const doc={id:'credit',original_id:'original',source:{conditional_discount:{payment_deadline:'2199-11-30'}}};
 const client={reviewPaidCredit:async()=>({ordinary:true}),reviewConditionalCredit:()=>assert.fail('draft terms are not authority')};
 for(const original of [null,{id:'foreign',source:{}},{id:'original'}])await assert.rejects(()=>prepareCreditReview(client,'co',doc,'req',original),/Reload the linked original/);
 const result=await prepareCreditReview(client,'co',doc,'req',{id:'original',source:{conditional_discount:null}});
 assert.deepEqual(result.paidCredit,{ordinary:true});assert.equal(result.conditionalCredit,undefined);
});

test('source wiring: conditional form review hides confirmation and guards the posting handler',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../../pages/AccountingDocumentForm.jsx',import.meta.url),'utf8');
 assert.match(source,/prepareCreditReview\(accounting,activeCompany.id,doc,crypto.randomUUID\(\),originalDoc\)/);
 assert.match(source,/discountPending \|\| !canPost/);
 assert.match(source,/\{!review\?\.conditionalCredit && <Button type="button" onClick=\{post\}/);
 assert.match(source,/if\(stillCurrent\(\)\)setReview/);
});

import {prepareCurrentDiscountReview,saveDiscountRecovery,readDiscountRecovery,verifyDiscountRecovery} from './model.mjs';
test('current policy review validates identity, unpaid cap, and token; no historical fallback',async()=>{
 const doc={id:'credit',revision:'r',original_id:'original',reason:'discount'},original={id:'original',source:{conditional_discount:{}}};
 const value={posting_available:true,review_token:'sha256:'+'a'.repeat(64),intent:{request_id:'request'},document_id:'credit',revision:'r',original_id:'original',conditional_admission:{},released_minor:'0',releases:[]};
 const client={reviewConditionalDiscount:async()=>value};assert.equal(await prepareCurrentDiscountReview(client,'company',doc,'request',original),value);
 for(const delta of [{posting_available:false},{released_minor:'1'},{releases:[{}]},{intent:{request_id:'other'}},{review_token:'bad'},{original_id:'foreign'}])await assert.rejects(()=>prepareCurrentDiscountReview({reviewConditionalDiscount:async()=>({...value,...delta})},'company',doc,'request',original),/could not be verified/);
});
test('minimal durable recovery stays scoped and unknown cannot authorize another submission',()=>{
 const values=new Map(),storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)};
 const pending=saveDiscountRecovery(storage,'company','credit','r','request');
 assert.deepEqual(readDiscountRecovery(storage,'company','credit'),pending);assert.equal(readDiscountRecovery(storage,'other','credit'),null);
 const receipt={status:'recorded',request_id:'request',document_id:'credit',journal_id:'11111111-1111-4111-a111-111111111111'};
 for(const status of ['posted','duplicate','recorded'])assert.equal(verifyDiscountRecovery({...receipt,status},pending),true);
 for(const delta of [{status:'unknown'},{request_id:'wrong'},{document_id:'wrong'},{journal_id:''}])assert.equal(verifyDiscountRecovery({...receipt,...delta},pending),false);
 assert.equal(values.size,1);assert.ok(![...values.values()][0].includes('review_token'));
 values.set([...values.keys()][0],'{invalid');assert.throws(()=>readDiscountRecovery(storage,'company','credit'),/must be recovered/);
});
import {clearDiscountRecovery} from './model.mjs';
test('durable locator collision and late completions cannot replace or clear another request',()=>{
 const values=new Map(),storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k),removeItem:k=>values.delete(k)};
 const first=saveDiscountRecovery(storage,'company','credit','r','first');
 assert.deepEqual(saveDiscountRecovery(storage,'company','credit','r','first'),first);
 assert.throws(()=>saveDiscountRecovery(storage,'company','credit','r','second'),/Recover the existing/);
 clearDiscountRecovery(storage,{...first,request_id:'second'});assert.deepEqual(readDiscountRecovery(storage,'company','credit'),first);
 clearDiscountRecovery(storage,first);assert.equal(readDiscountRecovery(storage,'company','credit'),null);
 assert.throws(()=>saveDiscountRecovery({...storage,setItem:()=>{throw Error('storage unavailable')}},'company','credit','r','first'),/storage unavailable/);
});
