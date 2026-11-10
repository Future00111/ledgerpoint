import {fail,uuid} from '../financialDrafts/contract';
import {scope,transact,hash,exactFields,type Queryable} from './core';
import {matches,statementRows,nativePayments} from './bankStatements';

function intent(body:unknown) {
 const b=exactFields(body,['request_id','match_request_id','reason','review_token']);
 if(typeof b.reason!=='string'||!b.reason.trim()||b.reason.trim().length>1000)fail(422,'BANK_CORRECTION_REASON_REQUIRED');
 return {request_id:uuid(b.request_id),match_request_id:uuid(b.match_request_id),reason:b.reason.trim()};
}
async function receipt(q:Queryable,company:string,id:string) {
 const r=(await q.query(`SELECT c.*,m.bank_transaction_id,m.payment_id,m.amount_minor,m.journal_id
   FROM accounting_bank_match_corrections c JOIN accounting_bank_matches m
   ON m.company_id=c.company_id AND m.request_id=c.match_request_id WHERE c.company_id=$1 AND c.request_id=$2`,
   [company,id])).rows[0];
 if(!r)return null;
 if(hash(r.evidence)!==r.evidence_hash)fail(503,'BANK_CORRECTION_HISTORY_INVALID');
 return {status:'recorded',request_id:r.request_id,match_request_id:r.match_request_id,
   bank_transaction_id:r.bank_transaction_id,payment_id:r.payment_id,released_minor:r.amount_minor,
   journal_id:r.journal_id,reason:r.reason,effective_at:new Date(r.effective_at).toISOString(),actor_id:r.actor_id};
}
async function plan(q:Queryable,company:string,actor:string,b:ReturnType<typeof intent>) {
 await scope(q,company,actor,true,true);
 const match=(await matches(q,company)).find(m=>m.request_id===b.match_request_id);
 if(!match)fail(404,'RESOURCE_NOT_FOUND');
 if(!match.active)fail(409,'BANK_MATCH_ALREADY_CORRECTED');
 const statement=(await statementRows(q,company)).find(s=>s.id===match.bank_transaction_id);
 const payment=(await nativePayments(q,company)).find(p=>p.id===match.payment_id);
 if(!statement||!payment)fail(503,'BANK_MATCH_HISTORY_INVALID');
 const evidence=JSON.parse(JSON.stringify({intent:b,match,statement,
   payment_source_hash:hash(payment.source),payment_remaining:payment.remaining_minor}));
 return {intent:b,match,evidence,review_token:hash(evidence),
   statement_remaining_minor:(BigInt(statement.remaining_minor)+BigInt(match.amount_minor)).toString(),
   payment_remaining_minor:(BigInt(payment.remaining_minor)+BigInt(match.amount_minor)).toString()};
}
export async function reviewBankCorrection(company:string,actor:string,body:unknown) {
 return transact(q=>plan(q,company,actor,intent(body)));
}
export async function recoverBankCorrection(company:string,actor:string,id:string) {
 uuid(id);return transact(async q=>{
   await scope(q,company,actor);
   return await receipt(q,company,id)??{status:'unknown',request_id:id};
 },true);
}
export async function confirmBankCorrection(company:string,actor:string,body:unknown,testHook?:(q:Queryable)=>Promise<void>) {
 const b=intent(body),expected=(body as any).review_token;
 return transact(async q=>{
   await scope(q,company,actor,true,true);
   const prior=(await q.query('SELECT intent FROM accounting_bank_match_corrections WHERE company_id=$1 AND request_id=$2',[company,b.request_id])).rows[0];
   if(prior) {
     if(hash(prior.intent)!==hash(b))fail(409,'BANK_CORRECTION_REQUEST_CONFLICT');
     return receipt(q,company,b.request_id);
   }
   const p=await plan(q,company,actor,b);
   if(typeof expected!=='string')fail(428,'BANK_CORRECTION_REVIEW_REQUIRED');
   if(expected!==p.review_token)fail(409,'BANK_CORRECTION_REVIEW_STALE');
   await q.query(`INSERT INTO accounting_bank_match_corrections
     (company_id,request_id,match_request_id,intent,evidence,evidence_hash,actor_id,reason)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
     [company,b.request_id,b.match_request_id,JSON.stringify(b),JSON.stringify(p.evidence),p.review_token,actor,b.reason]);
   await testHook?.(q);
   return receipt(q,company,b.request_id);
 });
}
