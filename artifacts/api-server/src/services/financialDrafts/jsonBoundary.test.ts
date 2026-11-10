import test from 'node:test';
import assert from 'node:assert/strict';
import type {Request} from 'express';
import {verifyDraftBody} from './jsonBoundary';
const req=(path:string)=>({path} as Request);
test('capture JSON rejects duplicate financial keys before JSON.parse loses them',()=>{
  for(const path of ['/api/companies/id/document-intake/id/draft','/api/companies/id/DOCUMENT-INTAKE/id/Draft/'])
  assert.throws(()=>verifyDraftBody(req(path),null,
    Buffer.from('{"envelope":{"source":{"quantity":"1","quantity":"2"}}}')),
    (e:any)=>e.code==='DUPLICATE_KEY');
});
test('capture raw body bounds separate upload bytes from review envelopes',()=>{
  const large=Buffer.from(JSON.stringify({content_base64:'A'.repeat(2*1024*1024)}));
  assert.doesNotThrow(()=>verifyDraftBody(req('/api/companies/id/document-intake/upload'),null,large));
  assert.doesNotThrow(()=>verifyDraftBody(req('/api/companies/id/Document-Intake/UPLOAD/'),null,large));
  assert.throws(()=>verifyDraftBody(req('/api/companies/id/document-intake/id/review'),null,large),
    (e:any)=>e.code==='BODY_TOO_LARGE');
  assert.throws(()=>verifyDraftBody(req('/api/companies/id/document-intake/upload'),null,Buffer.alloc(8*1024*1024+1)),
    (e:any)=>e.code==='BODY_TOO_LARGE');
});
test('capture malformed JSON fails closed and existing draft bounds remain active',()=>{
  assert.throws(()=>verifyDraftBody(req('/api/companies/id/document-intake/upload'),null,Buffer.from('{')),
    (e:any)=>e.code==='MALFORMED_JSON');
  assert.throws(()=>verifyDraftBody(req('/api/companies/id/financial-drafts/invoices'),null,Buffer.alloc(1024*1024+1)),
    (e:any)=>e.code==='BODY_TOO_LARGE');
});
