import test from 'node:test';import assert from 'node:assert/strict';
import {createEvidence}from'../documentIntake/evidence';
import {createExtractionJob,adaptExtractionResult,extractionResultPayload}from'../documentIntake/extraction/contract';
import {applyExecutionEvent,reconstructExecution,executionContract,type ExecutionEvent}from'./executionContract';
const company='11111111-1111-4111-8111-111111111111',source={company_id:company,evidence:createEvidence({source_id:'22222222-2222-4222-8222-222222222222',channel:'upload',media_type:'application/pdf',bytes:Buffer.from('%PDF-1.7 synthetic execution')})};
const base=()=>createExtractionJob({...source,request_id:'33333333-3333-4333-8333-333333333333',recipe:{provider:'synthetic',version:'1'},max_attempts:2});
const lease='44444444-4444-4444-8444-444444444444',second='55555555-5555-4555-8555-555555555555';
const output={pages:[{page:1,text:'Synthetic evidence'}],candidate:null};
function history(){let state={job:base(),sequence:0,reservations:[] as any[]};const events:ExecutionEvent[]=[],outbox:unknown[]=[];return{events,outbox,get state(){return state;},append(kind:string,payload:unknown){state=applyExecutionEvent(state,kind,payload,source);events.push({sequence:state.sequence,kind,actor_id:'synthetic',payload:structuredClone(payload),job_snapshot:structuredClone(state.job)});outbox.push({sequence:state.sequence,topic:executionContract});return state;}};}
const start={lease_id:lease,started_at_ms:1000,expires_at_ms:2000};
test('execution replay retains a verified result and independently reconstructs branded objects',()=>{
 const h=history();h.append('start',start);h.append('result',{lease_id:lease,settled_at_ms:1500,output});h.append('release',{lease_id:lease});
 const recovered=reconstructExecution(base(),JSON.parse(JSON.stringify(h.events)),JSON.parse(JSON.stringify(h.outbox)),source);
 assert.deepEqual(recovered,h.state);assert.equal(recovered.job.status,'review_required');assert.equal(recovered.job.result?.review.can_post,false);assert.equal(recovered.reservations[0]?.closed,true);
 assert.deepEqual(extractionResultPayload(adaptExtractionResult(source,output)),output);
 assert.throws(()=>extractionResultPayload({...recovered.job.result!}),{code:'EXTRACTION_RESULT_UNVERIFIED'});
});
test('logical expiry cannot release physical occupancy and retry is bounded',()=>{
 const h=history();h.append('start',start);h.append('failure',{lease_id:lease,settled_at_ms:2000,failure:{code:'TIMEOUT'}});
 assert.equal(h.state.job.status,'retryable');assert.equal(h.state.reservations[0]?.closed,false);
 assert.throws(()=>h.append('start',{lease_id:second,started_at_ms:3000,expires_at_ms:4000}));
 h.append('release',{lease_id:lease});assert.throws(()=>h.append('start',{lease_id:second,started_at_ms:2999,expires_at_ms:4000}));
 h.append('start',{lease_id:second,started_at_ms:3000,expires_at_ms:4000});h.append('failure',{lease_id:second,settled_at_ms:4000,failure:{code:'TIMEOUT'}});h.append('release',{lease_id:second});
 assert.equal(h.state.job.status,'failed');assert.throws(()=>h.append('start',{lease_id:'66666666-6666-4666-8666-666666666666',started_at_ms:5000,expires_at_ms:6000}));
 assert.deepEqual(reconstructExecution(base(),h.events,h.outbox,source),h.state);
});
test('cancelled/stale/expired attempts cannot commit a result or release another reservation',()=>{
 const h=history();h.append('start',start);
 for(const payload of[{lease_id:second,settled_at_ms:1500,output},{lease_id:lease,settled_at_ms:2000,output}])assert.throws(()=>h.append('result',payload));
 h.append('cancel',{expected_revision:1});assert.equal(h.state.job.status,'cancelled');
 assert.throws(()=>h.append('result',{lease_id:lease,settled_at_ms:1500,output}));assert.throws(()=>h.append('release',{lease_id:second}));
 h.append('release',{lease_id:lease});assert.throws(()=>h.append('release',{lease_id:lease}));
 assert.deepEqual(reconstructExecution(base(),h.events,h.outbox,source),h.state);
});
test('stored gaps, forged snapshots/results, extra fields and missing outbox fail closed',()=>{
 const h=history();h.append('start',start);h.append('result',{lease_id:lease,settled_at_ms:1500,output});
 for(const mutate of[(e:any[])=>e[0].sequence=2,(e:any[])=>e[0].job_snapshot.max_attempts=5,(e:any[])=>e[1].job_snapshot.result.review.can_post=true,
  (e:any[])=>e[1].payload.output.pages[0].text='Changed',(e:any[])=>e[0].payload.admin=true,(e:any[])=>e[1].payload.settled_at_ms=999,(e:any[])=>e[0].actor_id='',(e:any[])=>e.push(e[1])]){
  const events=structuredClone(h.events);mutate(events);assert.throws(()=>reconstructExecution(base(),events,h.outbox,source));
 }
 assert.throws(()=>reconstructExecution(base(),h.events,[],source));
});
