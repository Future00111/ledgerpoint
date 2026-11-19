/** Registered only by the fresh disposable accounting integration suite. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {commitCorrection,recoverCorrection,terminateCorrectionAttempt} from '../accountingDocuments/corrections';
import {pool} from '@workspace/db';
import {createAccountingRouter} from '../../routes/accountingDocuments';
import express from 'express';
import path from 'node:path';

export function registerCorrectionAdmissionJourney({fixture,create,post,source,request,admin,actor,readOnly,socket}:any){
 const binding=(r:any)=>({expected_revision:r.expected_revision,request_hash:r.request_hash,review_hash:r.review_hash});
 async function prepare(kind:string,reason='Synthetic correction admission'){
  const f=await fixture(),doc=await create(f,kind,source(kind==='sales_invoice'?f.customer:f.supplier));await post(f,doc);
  const intent={request_id:randomUUID(),reason,effective_date:'2026-10-22',line_items:[{quantity:'1',unit_price:'108'}]};
  const reviewed=await request(f.company,`/accounting-documents/${doc.id}/corrections/review`,'POST',intent,doc.revision);assert.equal(reviewed.status,200,JSON.stringify(reviewed));
  return {f,doc,command:{...intent,review_token:reviewed.data.review_token},route:`/accounting-documents/${doc.id}/corrections/operations/${intent.request_id}`};
 }
 const effects=async(f:any,doc:any)=>(await admin.query(`SELECT
  (SELECT to_jsonb(d) FROM accounting_document_sources d WHERE company_id=$1 AND id=$2) original,
  (SELECT count(*)::int FROM accounting_document_amendments WHERE company_id=$1) amendments,
  (SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM canonical_journal_entries j WHERE company_id=$1) journals,
  (SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM canonical_journal_lines j WHERE company_id=$1) lines,
  (SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM accounting_posting_effects j WHERE company_id=$1) effects`,[f.company,doc.id])).rows[0];
 const failAfterAdmission=async()=>{throw Error('Synthetic admission interruption');};
 for(const kind of ['sales_invoice','purchase_bill'])test(`${kind}: admitted rollback is discoverable and explicit closure fences old writers before a fresh review`,async()=>{
  const {f,doc,command,route}=await prepare(kind),before=await effects(f,doc);
  assert.equal((await request(f.company,route)).data.state,'unknown');
  await assert.rejects(()=>commitCorrection(f.company,actor,doc.id,doc.revision,command,async()=>{throw Error('Atomic correction rollback');}),e=>(e as any).correctionAttemptAdmitted===true&&String(e).includes('Atomic correction rollback'));
  const pending=(await request(f.company,route)).data;assert.equal(pending.state,'pending');assert.deepEqual(await effects(f,doc),before);
  assert.equal((await request(f.company,route.replace('/'+command.request_id,''))).data.pending[0].request_id,command.request_id);
  const replacement={...command,request_id:randomUUID()};
  assert.equal((await request(f.company,`/accounting-documents/${doc.id}/corrections/review`,'POST',replacement,doc.revision)).error.code,'CORRECTION_ATTEMPT_UNRESOLVED');
  assert.equal((await request(f.company,`/accounting-documents/${doc.id}/corrections`,'POST',replacement,doc.revision)).error.code,'CORRECTION_ATTEMPT_UNRESOLVED');
  await assert.rejects(()=>commitCorrection(f.company,actor,doc.id,doc.revision,{...command,reason:'Substituted'}),(e:any)=>e.code==='IDEMPOTENCY_CONFLICT');
  const another='correction-other-'+randomUUID();await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'owner',true)",[randomUUID(),f.company,another]);
  assert.equal((await request(f.company,route,'GET',undefined,undefined,another)).status,404);
  assert.equal((await request(f.company,route+'/no-effect','POST',binding(pending),undefined,another)).status,404);
  assert.equal((await request(f.company,route+'/no-effect','POST',binding(pending),undefined,readOnly)).status,403);
  const foreign=await fixture();assert.equal((await request(foreign.company,route)).status,404);
  assert.equal((await request(f.company,route+'/no-effect','POST',{...binding(pending),review_hash:'bad'})).status,409);
  await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2',[f.company,actor]);
  assert.equal((await request(f.company,route)).status,404);assert.equal((await request(f.company,route+'/no-effect','POST',binding(pending))).status,404);
  await admin.query('UPDATE company_users SET is_active=true WHERE company_id=$1 AND user_id=$2',[f.company,actor]);
  const closed=await request(f.company,route+'/no-effect','POST',binding(pending));assert.equal(closed.data.state,'no_effect');
  assert.deepEqual((await request(f.company,route)).data,closed.data);assert.deepEqual((await request(f.company,route+'/no-effect','POST',binding(pending))).data,closed.data);
  assert.equal((await request(f.company,route.replace('/'+command.request_id,''))).data.pending[0].state,'no_effect');
  assert.equal((await request(f.company,`/accounting-documents/${doc.id}/corrections`,'POST',command,doc.revision)).error.correction_attempt,'admitted');
  assert.deepEqual(await effects(f,doc),before);
  const reviewed=await request(f.company,`/accounting-documents/${doc.id}/corrections/review`,'POST',replacement,doc.revision);assert.equal(reviewed.status,200);
  const fresh=await request(f.company,`/accounting-documents/${doc.id}/corrections`,'POST',{...replacement,review_token:reviewed.data.review_token},doc.revision);assert.equal(fresh.status,200);
  assert.equal((await effects(f,doc)).amendments,1);assert.deepEqual((await effects(f,doc)).original,before.original);
  for(const table of ['correction_attempt_admissions','correction_attempt_no_effect']){
   await assert.rejects(()=>pool.query(`DELETE FROM ${table} WHERE company_id=$1`,[f.company]),(e:any)=>e.code==='42501');
   await assert.rejects(()=>admin.query(`DELETE FROM ${table} WHERE company_id=$1`,[f.company]),/immutable/);
   await assert.rejects(()=>admin.query(`TRUNCATE ${table} CASCADE`),/immutable/);
  }
 });
 test('correction terminal waits for an active writer and canonical outcome wins; terminal-first permanently prevents the delayed write',async()=>{
  for(const first of ['writer','terminal']){
   const {f,doc,command,route}=await prepare('sales_invoice');let enter!:()=>void,release!:()=>void;
   const entered=new Promise<void>(r=>enter=r),resume=new Promise<void>(r=>release=r),pause=async()=>{enter();await resume;};
   const posting=commitCorrection(f.company,actor,doc.id,doc.revision,command,first==='writer'?pause:undefined,first==='terminal'?pause:undefined).then(value=>({value}),error=>({error}));
   try{await entered;const pending=(await request(f.company,route)).data;assert.equal(pending.state,'pending');
    const terminal=request(f.company,route+'/no-effect','POST',binding(pending));
    if(first==='writer'){
     let waiting=false;for(let i=0;i<200;i++){waiting=(await admin.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT * FROM companies WHERE id=%'")).rowCount>0;if(waiting)break;await new Promise(r=>setTimeout(r,10));}assert.equal(waiting,true);release();
     const done=await posting,closed=await terminal;assert.ok('value'in done);assert.equal(closed.data.state,'known');assert.equal(closed.data.receipt.journal_id,(done as any).value.journal_id);assert.equal((await request(f.company,route)).data.state,'known');
    }else{const closed=await terminal;assert.equal(closed.data.state,'no_effect');release();const done=await posting;assert.equal((done as any).error.code,'CORRECTION_ATTEMPT_TERMINATED');assert.equal((await effects(f,doc)).amendments,0);}
   }finally{release();await posting;}
  }
 });
 test('correction orphan effects refuse recovery, termination and replacement without claiming no effect',async()=>{
  const {f,doc,command,route}=await prepare('purchase_bill');await assert.rejects(()=>commitCorrection(f.company,actor,doc.id,doc.revision,command,undefined,failAfterAdmission));
  const pending=(await request(f.company,route)).data;
  await admin.query(`INSERT INTO accounting_posting_effects(id,company_id,source_type,source_id,posting_kind,economic_effect_id,idempotency_key,command_fingerprint,status,created_by_type,created_by_id)
    VALUES($1,$2,'canonical_journal',$3,'document_correction',$4,$4,'synthetic-correction-orphan','uncertain','user',$5)`,[randomUUID(),f.company,doc.journal_id??(await request(f.company,`/accounting-documents/${doc.id}`)).data.journal_id,`document-correction:${doc.id}:${command.request_id}`,actor]);
  assert.equal((await request(f.company,route)).error.code,'CORRECTION_HISTORY_INVALID');assert.equal((await request(f.company,route+'/no-effect','POST',binding(pending))).error.code,'CORRECTION_HISTORY_INVALID');
  assert.equal((await request(f.company,route.replace('/'+command.request_id,''))).error.code,'CORRECTION_HISTORY_INVALID');
  assert.equal((await admin.query('SELECT count(*)::int n FROM correction_attempt_no_effect WHERE company_id=$1',[f.company])).rows[0].n,0);
 });
 test('native correction restore fixtures retain pending, terminal and known identities',async()=>{
  for(const outcome of ['pending','no_effect','known']){
   const {f,doc,command}=await prepare(outcome==='known'?'sales_invoice':'purchase_bill','Restore correction '+outcome);
   if(outcome==='known')await commitCorrection(f.company,actor,doc.id,doc.revision,command);
   else{await assert.rejects(()=>commitCorrection(f.company,actor,doc.id,doc.revision,command,undefined,failAfterAdmission));if(outcome==='no_effect'){const pending=await recoverCorrection(f.company,actor,doc.id,command.request_id);await terminateCorrectionAttempt(f.company,actor,doc.id,command.request_id,binding(pending));}}
   assert.equal((await recoverCorrection(f.company,actor,doc.id,command.request_id)).state,outcome);
  }
 });
 test('admitted native unique violation is marked through HTTP/client and keeps its recovery UUID',async()=>{
  const {f,doc}=await prepare('sales_invoice');
  const {createAccountingClient}=await import(path.join(process.cwd(),'artifacts/ledgerly/src/api/accountingDocuments.mjs'));
  const {createCorrectionController}=await import(path.join(process.cwd(),'artifacts/ledgerly/src/features/documentCorrections/model.mjs'));
  const app=express();app.use(express.json());app.use('/companies/:companyId',createAccountingRouter((req,_res,next)=>{(req as any).userId=actor;next();},async tx=>{const {queryAdapter}=await import('../accountingDocuments/core');await queryAdapter(tx).query('INSERT INTO correction_attempt_admissions SELECT * FROM correction_attempt_admissions WHERE company_id=$1',[f.company]);}));
  const listener=app.listen(0,'127.0.0.1');await new Promise<void>(r=>listener.once('listening',r));
  try{const base='http://127.0.0.1:'+(listener.address() as any).port;const client=createAccountingClient((url:string,init:any)=>fetch(base+url.replace('/api',''),init));let remembered=null;
   const controller=createCorrectionController({client,companyId:f.company,documentId:doc.id,rememberRequest:(id:string)=>remembered=id});
   await controller.load();await controller.review({reason:'Native unique rollback',effective_date:'2026-10-22',line_items:[{quantity:'1',unit_price:'108'}]});await controller.post();
   assert.equal(controller.state.status,'unknown');assert.equal(controller.state.error.status,409);assert.equal(controller.state.error.correctionAttemptAdmitted,true);assert.equal(controller.state.requestId,remembered);assert.ok(remembered);
   await controller.recover();assert.equal(controller.state.outcome,'pending');assert.equal((await effects(f,doc)).amendments,0);controller.dispose();
  }finally{listener.closeAllConnections();await new Promise<void>(r=>listener.close(()=>r()));}
 });
 test('correction admission survives actual process death and re-login without browser payload or duplicate effects',async()=>{
  const cp=await import('node:child_process');const file=path.join(process.cwd(),'generated-artifacts/correction-restart-harness.cjs');
  cp.execFileSync('pnpm',['--filter','@workspace/api-server','exec','esbuild','src/services/operationRecovery/correctionRestartHarness.ts','--bundle','--platform=node','--format=cjs','--external:pg','--external:@clerk/express','--outfile='+file],{stdio:'pipe'});
  const env={PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C',LC_ALL:'C',NODE_ENV:'test',NODE_PATH:path.join(process.cwd(),'artifacts/api-server/node_modules'),ACCOUNTING_FLOW_TEST_SOCKET:socket,DATABASE_URL:`postgresql://ledgerly_api@localhost/ledgerly_accounting_flow_test?host=${encodeURIComponent(socket)}&port=55441`};
  const children:ReturnType<typeof cp.fork>[]=[];
  const message=(child:ReturnType<typeof cp.fork>,field:string)=>new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Correction restart handshake timeout')),15000);const got=(value:any)=>{if(value[field]){clearTimeout(timer);child.off('message',got);resolve(value);}else if(value.failed){clearTimeout(timer);reject(Error('Correction child failed'));}};child.on('message',got);child.once('error',e=>{clearTimeout(timer);reject(e);});});
  const start=async()=>{const child=cp.fork(file,[],{env,stdio:['ignore','ignore','inherit','ipc']});children.push(child);const ready=await message(child,'ready');return {child,...ready};};
  const stop=async(child:ReturnType<typeof cp.fork>)=>{if(child.exitCode!==null||child.signalCode!==null)return;await new Promise<void>(r=>{const force=setTimeout(()=>child.kill('SIGKILL'),5000);child.once('exit',()=>{clearTimeout(force);r();});child.kill('SIGKILL');});};
  try{const {f,doc,command,route}=await prepare('purchase_bill');const first=await start(),admitted=message(first.child,'admitted');first.child.send({action:'admit',company:f.company,actor,document:doc.id,revision:doc.revision,command});await admitted;await stop(first.child);
   const second=await start();const recovered=await fetch(`http://127.0.0.1:${second.port}/companies/${f.company}${route}`,{headers:{'x-test-actor':actor}}).then(r=>r.json()) as any;assert.equal(recovered.data.state,'pending');assert.equal((await effects(f,doc)).amendments,0);
   await commitCorrection(f.company,actor,doc.id,doc.revision,command);assert.equal((await recoverCorrection(f.company,actor,doc.id,command.request_id)).state,'known');assert.equal((await effects(f,doc)).amendments,1);
  }finally{for(const child of children)await stop(child);}
 });
 test('legacy committed recovery works without admission schema; partial recovery schema fails closed',async()=>{
  const {f,doc,command}=await prepare('sales_invoice');const posted=await commitCorrection(f.company,actor,doc.id,doc.revision,command);
  await admin.query('ALTER TABLE correction_attempt_admissions RENAME TO synthetic_hidden_correction_admissions');
  try{await assert.rejects(()=>recoverCorrection(f.company,actor,doc.id,command.request_id),(e:any)=>e.code==='CORRECTION_RECOVERY_SCHEMA_INCOMPLETE');
   await admin.query('ALTER TABLE correction_attempt_no_effect RENAME TO synthetic_hidden_correction_terminal');
   try{const recovered=await recoverCorrection(f.company,actor,doc.id,command.request_id);assert.equal((recovered as any).receipt.journal_id,posted.journal_id);}finally{await admin.query('ALTER TABLE synthetic_hidden_correction_terminal RENAME TO correction_attempt_no_effect');}
  }finally{await admin.query('ALTER TABLE synthetic_hidden_correction_admissions RENAME TO correction_attempt_admissions');}
 });
 for(const kind of ['sales_invoice','purchase_bill'])for(const mode of ['late','terminal'])test(`isolated Chromium: ${kind} admitted correction ${mode} recovery requires explicit verified progression`,async()=>{
  const fs=await import('node:fs'),cp=await import('node:child_process'),{createRequire}=await import('node:module');
  const {f,doc,command}=await prepare(kind);let enter!:()=>void,release!:()=>void;
  const entered=new Promise<void>(r=>enter=r),resume=new Promise<void>(r=>release=r);
  const posting=commitCorrection(f.company,actor,doc.id,doc.revision,command,undefined,async()=>{enter();if(mode==='terminal')throw Error('Synthetic admission interruption');await resume;}).then(value=>({value}),error=>({error}));
  await entered;if(mode==='terminal')assert.ok('error'in await posting);
  const before=await effects(f,doc),dir=fs.mkdtempSync('/tmp/correction-admission-browser-'),root=process.cwd(),entry=path.join(dir,'entry.jsx'),bundle=path.join(dir,'bundle.js');
  const app=express();app.use(express.json());let pages=0,financialPosts=0,closures=0,reads=0,stage='startup',report:(r:any)=>void=()=>{};
  app.post('/acceptance',(req,res)=>{res.json({ok:true});report(req.body);});app.post('/progress',(req,res)=>{stage=String(req.body.stage);res.json({ok:true});});
  app.get('/scenario',(_req,res)=>res.json({reloaded:pages>1}));app.post('/release',async(_req,res)=>{release();const result=await posting;res.json(result);});
  app.use('/api/companies/:companyId',(req,_res,next)=>{if(req.method==='POST'){if(req.path.endsWith('/no-effect'))closures++;else financialPosts++;}if(req.method==='GET'&&req.path.includes('/corrections/operations/'))reads++;(req as any).userId=actor;next();},createAccountingRouter((_req,_res,next)=>next()));
  const listener=app.listen(0,'127.0.0.1');await new Promise<void>(r=>listener.once('listening',r));let browser:ReturnType<typeof cp.spawn>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  try{
   fs.writeFileSync(entry,`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import DocumentCorrections from '@/features/documentCorrections/DocumentCorrections.jsx';
const mode=${JSON.stringify(mode)},requestId=${JSON.stringify(command.request_id)};let refreshes=0;const assert=(v,m)=>{if(!v)throw Error(m)};
const report=(passed,error=null)=>fetch('/acceptance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passed,error,refreshes})});window.addEventListener('error',e=>report(false,e.message));window.addEventListener('unhandledrejection',e=>report(false,String(e.reason)));
function App(){const[receipt,setReceipt]=useState(null);return <MemoryRouter><DocumentCorrections companyId=${JSON.stringify(f.company)} documentId=${JSON.stringify(doc.id)} onSaved={r=>{assert(!location.search.includes('correction_'),'locator survived completion');assert(r.id===requestId&&r.journal_id&&r.revision,'wrong receipt');refreshes++;setReceipt(r);}}/>{receipt&&<p data-testid="recorded">Recorded {receipt.id}</p>}</MemoryRouter>}createRoot(document.getElementById('root')).render(<App/>);
const button=t=>[...document.querySelectorAll('button')].find(b=>b.textContent===t),wait=async(fn,label)=>{await fetch('/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage:label})});for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error(label+' '+document.body.textContent.slice(-1600));};
(async()=>{const scenario=await fetch('/scenario').then(r=>r.json());await wait(()=>button('Find a recorded correction'),'entry');
if(!scenario.reloaded){button('Find a recorded correction').click();await wait(()=>button('This is my correction — verify receipt'),'pending choice');assert(document.body.textContent.includes(requestId),'missing admitted identity');assert(!button('Close this attempt without posting'),'automatically selected');button('This is my correction — verify receipt').click();await wait(()=>button('Close this attempt without posting'),'pending verified');assert(refreshes===0,'premature refresh');location.reload();return;}
await wait(()=>button('Close this attempt without posting'),'pending after actual reload');assert(localStorage.length===0&&sessionStorage.length===0,'browser payload persisted');
if(mode==='late'){const released=await fetch('/release',{method:'POST'}).then(r=>r.json());assert(released.value?.id===requestId,'original did not finish');button('Check this correction again').click();await wait(()=>document.querySelector('[data-testid="recorded"]'),'canonical receipt');assert(refreshes===1,'duplicate refresh');}
else{button('Close this attempt without posting').click();await wait(()=>button('Confirm closing this attempt'),'explicit confirmation');assert(!button('Verify closure and start a fresh review'),'unconfirmed closure unlocked');button('Confirm closing this attempt').click();await wait(()=>button('Verify closure and start a fresh review'),'fresh closed receipt');assert(button('Close').disabled,'terminal alone unlocked');button('Verify closure and start a fresh review').click();await wait(()=>button('Review revised amounts')&&!button('Review revised amounts').disabled,'fresh server review context');assert(!location.search.includes('correction_'),'terminal locator survived');assert(refreshes===0,'no-effect refreshed as posted');}
assert(localStorage.length===0&&sessionStorage.length===0,'financial data stored');await report(true);})().catch(e=>report(false,e.message));`);
   createRequire(path.join(root,'artifacts/api-server/package.json'))('esbuild').buildSync({entryPoints:[entry],outfile:bundle,bundle:true,platform:'browser',format:'iife',jsx:'automatic',alias:{'@':path.join(root,'artifacts/ledgerly/src')},nodePaths:[path.join(root,'artifacts/ledgerly/node_modules')],define:{'process.env.NODE_ENV':'"production"'}});
   app.get('/bundle.js',(_req,res)=>res.type('js').send(fs.readFileSync(bundle,'utf8')));app.get('/correction',(_req,res)=>{pages++;res.type('html').send('<!doctype html><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script>');});
   const completed=new Promise<any>((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Correction admission browser deadline at '+stage)),35000);report=value=>{clearTimeout(timer);resolve(value);};});
   browser=cp.spawn('chromium',['--headless','--disable-gpu','--no-first-run','--disable-background-networking','--user-data-dir='+path.join(dir,'profile'),'http://127.0.0.1:'+(listener.address() as any).port+'/correction'],{stdio:['ignore','pipe','pipe']});let stderr='';browser.stdout!.resume();browser.stderr!.on('data',c=>stderr=(stderr+c).slice(-4000));
   const failed=new Promise<never>((_,reject)=>{browser!.once('error',reject);browser!.once('exit',code=>reject(Error('Chromium exited '+code+' '+stderr)));});
   const result=await Promise.race([completed,failed]);assert.equal(result.passed,true,JSON.stringify({...result,stage}));assert.equal(result.refreshes,mode==='late'?1:0);assert.equal(financialPosts,0);assert.equal(closures,mode==='terminal'?1:0);assert.equal(pages,2);assert.equal(reads,mode==='late'?3:5);
   const after=await effects(f,doc);assert.deepEqual(after.original,before.original);if(mode==='terminal')assert.deepEqual(after,before);else{assert.equal(after.amendments,1);assert.equal(after.journals.length,before.journals.length+1);}
   console.log('CORRECTION_ADMISSION_BROWSER_ACCEPTANCE',JSON.stringify({kind,mode,actualMountedComponent:true,nativeApi:true,actualReload:true,financialPosts:0,explicitClosure:mode==='terminal',freshVerification:true,browserStorageEmpty:true,realClerk:false}));
  }finally{clearTimeout(timer);report=()=>{};release();await posting;if(browser?.pid&&browser.exitCode===null&&browser.signalCode===null)await new Promise<void>(r=>{const force=setTimeout(()=>browser?.kill('SIGKILL'),5000);browser!.once('exit',()=>{clearTimeout(force);r();});browser!.kill('SIGTERM');});listener.closeAllConnections();await new Promise<void>(r=>listener.close(()=>r()));fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
 });
}
