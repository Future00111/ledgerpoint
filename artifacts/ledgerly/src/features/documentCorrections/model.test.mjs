import test from 'node:test';
import assert from 'node:assert/strict';
import { correctionIntent, correctionForm, createCorrectionController } from './model.mjs';
const companyId='10000000-0000-4000-8000-000000000001', documentId='10000000-0000-4000-8000-000000000002';
const revision='10000000-0000-4000-8000-000000000003', requestId='10000000-0000-4000-8000-000000000004';
const nextRevision='10000000-0000-4000-8000-000000000005', journal='10000000-0000-4000-8000-000000000006';
const token='sha256:'+'a'.repeat(64);
const money={net_pence:'10000',vat_pence:'2000',gross_pence:'12000'};
const context=()=>({document:{id:documentId,company_id:companyId,revision,source:{line_items:[{quantity:'1',unit_price:'100.00'}]}},capabilities:{review_corrections:true,correct_documents:true},blockers:[]});
const form=()=>({...correctionForm(context().document,'2026-10-30'),reason:'Price agreed later',line_items:[{quantity:'1',unit_price:'90.00'}]});
const reviewed=intent=>({intent,expected_revision:revision,review_token:token,before:{revision,money},after:{money:{net_pence:'9000',vat_pence:'1800',gross_pence:'10800'}},settlement:{paid_minor:'5000',before_open_minor:'7000',after_open_minor:'5800'}});
const receipt=()=>({id:requestId,document_id:documentId,status:'posted',revision:nextRevision,journal_id:journal});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
test('reload recovers only the server receipt and never repeats a correction POST or automatic refresh',async()=>{
 let remembered,posts=0,reads=0,refreshes=0;
 const first=setup({commitCorrection:async()=>{posts++;throw Error('lost response');}},
  {rememberRequest:id=>{remembered=id;}});
 await first.session.load();await first.session.review(form());await first.session.post();
 assert.equal(remembered,requestId);assert.equal(first.session.state.status,'unknown');first.session.dispose();
 const reloaded=setup({recoverCorrection:async(c,d,id)=>{reads++;assert.equal(c,companyId);assert.equal(d,documentId);assert.equal(id,requestId);
  return {state:'known',request_id:id,document_id:d,receipt:receipt()};},
  commitCorrection:async()=>{posts++;throw Error('must not post');}},
  {recoveryRequestId:remembered,onSaved:()=>refreshes++});
 await reloaded.session.load();assert.equal(reloaded.session.state.status,'posted');
 assert.equal(posts,1);assert.equal(reads,1);assert.equal(refreshes,0);assert.equal(reloaded.session.state.receipt.journal_id,journal);
});
test('unknown, invalid and denied recovery remain fenced without fresh review or resubmission',async()=>{
 for(const response of [{state:'unknown',request_id:requestId,document_id:documentId},
  {state:'known',request_id:requestId,document_id:documentId,receipt:{...receipt(),id:journal}},Error('Access removed')]) {
  const {session,calls}=setup({recoverCorrection:async()=>{if(response instanceof Error)throw response;return response;}},
    {recoveryRequestId:requestId});
  await session.load();await session.review(form());await session.post();
  assert.equal(session.state.status,'unknown');assert.equal(calls.length,0);
 }
});
test('failure to retain recovery locator prevents sending, and disposal fences late recovery',async()=>{
 const first=setup({}, {rememberRequest:()=>{throw Error('URL unavailable');}});
 await first.session.load();await first.session.review(form());await first.session.post();
 assert.equal(first.calls.length,0);assert.equal(first.session.state.status,'reviewed');
 const wait=deferred();let saved=0;
 const second=setup({recoverCorrection:()=>wait.promise},{recoveryRequestId:requestId,onSaved:()=>saved++});
 const reading=second.session.load();second.session.dispose();
 wait.resolve({state:'known',request_id:requestId,document_id:documentId,receipt:receipt()});await reading;
 assert.equal(saved,0);
});
function setup(overrides={},options={}) {
 const calls=[];
 const client={correctionContext:async()=>context(),reviewCorrection:async(_c,_d,intent)=>reviewed(intent),commitCorrection:async(...args)=>{calls.push(args);return receipt();},...overrides};
 const session=createCorrectionController({client,companyId,documentId,makeRequestId:()=>requestId,...options});
 return {session,calls};
}
test('correction intent keeps decimal strings and stable line positions without performing accounting',()=>{
 const input=form();input.line_items.push({quantity:'0.0001',unit_price:'999999.99',tax_code:'FORGED'});
 const result=correctionIntent(input,requestId);
 assert.deepEqual(result.line_items,[{quantity:'1',unit_price:'90.00'},{quantity:'0.0001',unit_price:'999999.99'}]);
 assert.equal(result.request_id,requestId);assert.equal(Object.hasOwn(result,'money'),false);
});
test('invalid dates, blank reasons, oversized fields and invalid identity are rejected before review',()=>{
 for(const date of ['1899-12-31','2200-01-01','2026-02-30']) assert.throws(()=>correctionIntent({...form(),effective_date:date},requestId));
 assert.throws(()=>correctionIntent({...form(),reason:' '},requestId));
 assert.throws(()=>correctionIntent({...form(),line_items:[{quantity:1,unit_price:'90'}]},requestId));
 assert.throws(()=>correctionIntent(form(),'not-an-id'));
});
test('reviewed amounts and existing partial payment come only from server and exact receipt completes once',async()=>{
 let saved=0;const {session,calls}=setup({}, {onSaved:()=>saved++});await session.load();await session.review(form());
 assert.equal(session.state.review.settlement.after_open_minor,'5800');await session.post();await session.post();
 assert.equal(calls.length,1);assert.equal(saved,1);assert.equal(session.state.status,'posted');assert.equal(session.state.pending,null);
});
test('unknown outcome keeps exact immutable request, token and revision for retry and blocks fresh edits',async()=>{
 const calls=[];const {session}=setup({commitCorrection:async(...args)=>{calls.push(args);if(calls.length===1)throw Error('Connection interrupted');return {...receipt(),status:'duplicate'};}});
 await session.load();await session.review(form());const pending=session.state.pending;assert.ok(Object.isFrozen(pending.body.line_items[0]));
 await session.post();assert.equal(session.state.status,'unknown');await session.load();session.discardReview();await session.review({...form(),reason:'Different'});
 assert.equal(session.state.pending,pending);await session.post();assert.deepEqual(calls[0],calls[1]);assert.equal(session.state.status,'posted');
});
test('definitive permission failure clears review and requires fresh authoritative context',async()=>{
 const {session}=setup({commitCorrection:async()=>{throw Object.assign(Error('Access denied'),{status:403});}});
 await session.load();await session.review(form());await session.post();assert.equal(session.state.status,'error');assert.equal(session.state.pending,null);
 await session.review(form());assert.equal(session.state.status,'error');
});
test('read-only and blocked context cannot initiate review or commit',async()=>{
 let writes=0;
 for(const changes of [{capabilities:{review_corrections:false,correct_documents:false}},{blockers:[{code:'CHILD_CREDIT',message:'Existing credit'}]}]){
  const {session}=setup({correctionContext:async()=>({...context(),...changes}),reviewCorrection:async()=>{writes++;},commitCorrection:async()=>{writes++;}});
  await session.load();await session.review(form());await session.post();assert.equal(session.state.pending,null);
 }
 assert.equal(writes,0);
});
test('foreign context and mismatched review identity never expose a commit',async()=>{
 const foreign=setup({correctionContext:async()=>({...context(),document:{...context().document,company_id:documentId}})}).session;
 await foreign.load();assert.equal(foreign.state.status,'error');assert.equal(foreign.state.context,null);
 const {session}=setup({reviewCorrection:async(_c,_d,intent)=>({...reviewed(intent),expected_revision:nextRevision})});
 await session.load();await session.review(form());assert.equal(session.state.pending,null);assert.equal(session.state.status,'ready');assert.ok(session.state.error);
});
test('late load and review results cannot replace newer scope or revive a disposed page',async()=>{
 const first=deferred(),second=deferred();let n=0;const seen=[];
 const {session}=setup({correctionContext:()=>++n===1?first.promise:second.promise},{onState:s=>seen.push(s)});
 const old=session.load(),fresh=session.load();second.resolve(context());await fresh;first.resolve({...context(),blockers:[{code:'OLD'}]});await old;
 assert.deepEqual(session.state.context.blockers,[]);
 const late=deferred();const newer=setup({reviewCorrection:()=>late.promise},{onState:s=>seen.push(s)}).session;
 await newer.load();const reviewing=newer.review(form());newer.dispose();const count=seen.length;late.resolve(reviewed(correctionIntent(form(),requestId)));await reviewing;assert.equal(seen.length,count);
});
test('an invalid or differently identified commit receipt remains an unknown outcome',async()=>{
 const {session}=setup({commitCorrection:async()=>({...receipt(),id:journal})});await session.load();await session.review(form());await session.post();
 assert.equal(session.state.status,'unknown');assert.ok(session.state.pending);
});
test('disposing after a commit starts does not claim cancellation or invoke the old page callback',async()=>{
 const response=deferred();let saved=0;const {session}=setup({commitCorrection:()=>response.promise},{onSaved:()=>saved++});
 await session.load();await session.review(form());const posting=session.post();session.dispose();response.resolve(receipt());await posting;assert.equal(saved,0);
});
test('a UI refresh failure cannot change a confirmed posting into an uncertain outcome',async()=>{
 const {session}=setup({}, {onSaved:()=>{throw Error('UI refresh failed');}});await session.load();await session.review(form());await session.post();
 assert.equal(session.state.status,'posted');assert.equal(session.state.receipt.journal_id,journal);assert.equal(session.state.pending,null);
 assert.match(session.state.error.message,/posted successfully/);
});
test('stale and denied posts clear recovery locator and require fresh context before review',async()=>{
 for(const status of [401,403,409,422]) {
  let remembered=null,loads=0;
  const {session}=setup({correctionContext:async()=>{loads++;return context();},
   commitCorrection:async()=>{throw Object.assign(Error('Rejected'),{status});}},
   {rememberRequest:id=>remembered=id,forgetRequest:()=>remembered=null});
  await session.load();await session.review(form());await session.post();
  assert.equal(remembered,null);assert.equal(session.state.requestId,null);assert.equal(session.state.context,null);
  await session.load();assert.equal(loads,2);assert.equal(session.state.status,'ready');
 }
});
test('failed locator cleanup stays fenced and never reports ready for another post',async()=>{
 const {session}=setup({commitCorrection:async()=>{throw Object.assign(Error('Stale'),{status:409});}},
  {forgetRequest:()=>{throw Error('History unavailable');}});
 await session.load();await session.review(form());await session.post();
 assert.equal(session.state.status,'unknown');assert.equal(session.state.requestId,requestId);
});
test('review response cannot substitute different quantity or price under the same request',async()=>{
 const {session,calls}=setup({reviewCorrection:async(_c,_d,intent)=>reviewed({...intent,line_items:[{quantity:'2',unit_price:'90.00'}]})});
 await session.load();await session.review(form());await session.post();
 assert.equal(session.state.status,'ready');assert.equal(session.state.pending,null);assert.equal(calls.length,0);
});
