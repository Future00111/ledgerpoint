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
