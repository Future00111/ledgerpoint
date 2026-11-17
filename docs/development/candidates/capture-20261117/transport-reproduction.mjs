import assert from 'node:assert/strict';import http from 'node:http';import {createRequire} from 'node:module';import path from 'node:path';
const require=createRequire(path.join(process.cwd(),'artifacts/api-server/package.json')),express=require('express');
const {createDocumentIntakeClient}=await import(path.resolve('artifacts/ledgerly/src/api/documentIntake.mjs'));
const app=express();app.use(express.json());let posts=0,committed=false;
app.post('/api/companies/company/document-intake/source/draft',(req,res)=>{posts++;committed=true;const body={data:{document:{id:'committed-document'},source:{id:'source',document_id:'committed-document'}}};res.status(201).type('json').set('Content-Length',String(Buffer.byteLength(JSON.stringify(body))));res.flushHeaders();res.write('{"data":',()=>res.destroy());});
app.get('/api/companies/company/document-intake/source',(req,res)=>res.json({data:{source:{id:'source',document_id:committed?'committed-document':null},can_manage:true}}));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port;
try {
 const wire=await new Promise((resolve,reject)=>{const req=http.request(origin+'/api/companies/company/document-intake/source/draft',{method:'POST',headers:{'Content-Type':'application/json'}},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('aborted',()=>resolve({status:res.statusCode,body,complete:res.complete}));res.on('error',()=>{});res.on('end',()=>reject(Error('interrupted body unexpectedly completed')));});req.on('error',reject);req.end('{}');});
 assert.deepEqual(wire,{status:201,body:'{"data":',complete:false});console.log('HTTP wire evidence',JSON.stringify(wire));
 const api=createDocumentIntakeClient((url,options)=>fetch(origin+url,options));
 await assert.rejects(api.draft('company','source',{},'revision'),/source-file response could not be verified|terminated|fetch failed/);
 const recovered=await api.get('company','source');assert.equal(recovered.source.document_id,'committed-document');assert.equal(posts,2);console.log('Native client rejects incomplete committed response, then read recovers persisted document without another POST. Two explicit probes, two POSTs.');
}finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
