const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const esbuild=require(path.resolve('artifacts/api-server/node_modules/esbuild'));
(async()=>{
for(const [file,marker,handle] of [['integration.test.ts',"test('isolated Chromium: unpaid and partial discounts",'browser'],['conditionalDiscount.integration.test.ts',"for (const side of ['customer','supplier'] as const) test(`isolated Chromium: ${side} full-paid ordinary commercial",'child']]){
 const text=fs.readFileSync('artifacts/api-server/src/services/accountingDocuments/'+file,'utf8').split(marker)[1];
 const block=text.split('  const acceptance=await new Promise<any>((resolve,reject)=>{')[1].split('\n  assert.equal(acceptance')[0];
 const ts='return function start('+handle+'){let report=(value:any)=>{},stage="probe-stage",stderr="probe-stderr";const promise=new Promise<any>((resolve,reject)=>{'+block+'return {promise,deliver:(value:any)=>report(value)};}';
 const code=esbuild.transformSync(ts,{loader:'ts',format:'cjs'}).code;
 const start=new Function('setTimeout','clearTimeout',code)((fn,ms)=>setTimeout(fn,Math.min(ms,15)),clearTimeout);
 for(const mode of ['success','explicit failure','missing report','early exit','process error']){
  const child=new EventEmitter(),run=start(child);
  if(mode==='success')run.deliver({passed:true});
  if(mode==='explicit failure')run.deliver({passed:false,error:'synthetic error'});
  if(mode==='early exit')child.emit('exit',0);
  if(mode==='process error')child.emit('error',Error('synthetic process failure'));
  if(mode==='success')assert.equal((await run.promise).passed,true);
  if(mode==='explicit failure'){const value=await run.promise;assert.equal(value.passed,false);assert.throws(()=>assert.equal(value.passed,true));assert.equal(value.error,'synthetic error');}
  else if(!['success'].includes(mode))await assert.rejects(run.promise,mode==='missing report'?/timeout at probe-stage/:mode==='early exit'?/exited before.*probe-stage/:/synthetic process failure/);
  assert.equal(child.listenerCount('exit'),0);assert.equal(child.listenerCount('error'),0);
  console.log(file,mode,'PASS');
 }
}
const text=fs.readFileSync('artifacts/api-server/src/services/accountingDocuments/conditionalDiscount.integration.test.ts','utf8');
const line=text.split('\n').find(line=>line.includes("app.post('/synthetic-browser-result'"));const route=line.slice(line.indexOf('(req,res)=>{')+12,line.lastIndexOf('});'));
let received=[];const active={id:'current-run',receive:v=>received.push(v)};const routeCall=new Function('req','res','browserAcceptance',route);const responses=[];const res={sendStatus:s=>responses.push(s),json:v=>responses.push(v)};
routeCall({body:{id:'stale-run',passed:true}},res,active);assert.deepEqual(responses,[409]);assert.equal(received.length,0);
routeCall({body:{id:'current-run',passed:true}},res,undefined);assert.deepEqual(responses,[409,409]);assert.equal(received.length,0);
routeCall({body:{id:'current-run',passed:false,error:'expected failure'}},res,active);assert.equal(received.length,1);assert.equal(received[0].passed,false);console.log('Report route stale ID / absent run denied, matching failure delivered PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
