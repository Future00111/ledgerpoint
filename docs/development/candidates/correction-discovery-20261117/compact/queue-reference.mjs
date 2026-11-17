import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const requireValue=(ok,message)=>{if(!ok)throw Error(message);};
const canonical=x=>Array.isArray(x)?x.map(canonical):plain(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
export const queueDigest=q=>createHash('sha256').update(JSON.stringify(canonical(q))).digest('hex');
export const bytesDigest=bytes=>createHash('sha256').update(bytes).digest('hex');
function checkReference(r){
 requireValue(plain(r)&&r.format==='ledgerpoint-queue-reference-v1','Invalid queue reference');
 requireValue(r.repository==='Future00111/ledgerpoint'&&r.ref==='refs/heads/codex/ledgerly-work-queue-state','Wrong repository or branch');
 requireValue(/^[a-f0-9]{40}$/.test(r.sha)&&/^[a-f0-9]{64}$/.test(r.bytesSha256)&&/^[a-f0-9]{64}$/.test(r.queueSha256),'Invalid immutable digest');
 requireValue(typeof r.path==='string'&&/^docs\/development\/candidates\/[A-Za-z0-9_./-]+\.json$/.test(r.path)&&!r.path.split('/').some(p=>!p||p==='.'||p==='..'),'Invalid archive path');
 requireValue(Number.isSafeInteger(r.revision)&&r.revision>=0&&/^[a-f0-9]{64}$/.test(r.catalogDigest),'Invalid queue identity');
}
export function queueReference({sha,path,bytes,queue}){
 const ref={format:'ledgerpoint-queue-reference-v1',repository:'Future00111/ledgerpoint',ref:'refs/heads/codex/ledgerly-work-queue-state',sha,path,bytesSha256:bytesDigest(bytes),queueSha256:queueDigest(queue),revision:queue.revision,catalogDigest:queue.catalogDigest};checkReference(ref);return ref;
}
export function buildQueueDelta(base,next,baseReference){
 checkReference(baseReference);
 requireValue(queueDigest(base)===baseReference.queueSha256&&base.revision===baseReference.revision&&base.catalogDigest===baseReference.catalogDigest,'Base mismatch');
 requireValue(Number.isSafeInteger(next.revision)&&next.revision>base.revision,'Revision must advance');
 const header=q=>Object.fromEntries(Object.entries(q).filter(([k])=>!['tasks','events','revision'].includes(k)));
 requireValue(isDeepStrictEqual(header(base),header(next)),'Queue header/catalogue changed; make a full snapshot');
 requireValue(isDeepStrictEqual(Object.keys(base.tasks).sort(),Object.keys(next.tasks).sort()),'Task set changed');
 requireValue(next.events.length>base.events.length&&isDeepStrictEqual(next.events.slice(0,base.events.length),base.events),'Historical events changed');
 return {format:'exact-queue-delta-v1',base:baseReference,fromRevision:base.revision,revision:next.revision,
  taskReplacements:Object.fromEntries(Object.keys(next.tasks).filter(k=>!isDeepStrictEqual(base.tasks[k],next.tasks[k])).map(k=>[k,structuredClone(next.tasks[k])])),
  appendedEvents:structuredClone(next.events.slice(base.events.length)),resultSha256:queueDigest(next)};
}
// The caller fetches only the immutable repository/path supplied to load.
// Always hydrate before scheduling, CLI init, currentView or queue validation.
// Existing coordinator fencing/preflight can retain the opaque reference.
export async function hydrateQueue(reference,load,validate,{catalogDigest,depth=0,seen=new Set()}={}){
 checkReference(reference);
 requireValue(typeof catalogDigest==='string'&&/^[a-f0-9]{64}$/.test(catalogDigest),'Current catalogue digest required');
 requireValue(reference.catalogDigest===catalogDigest,'Current catalogue mismatch');
 requireValue(depth<12,'Queue reference chain too deep');
 const key=reference.sha+':'+reference.path;requireValue(!seen.has(key),'Queue reference cycle');
 const visited=new Set(seen);visited.add(key);
 const bytes=await load(reference);requireValue(typeof bytes==='string'||Buffer.isBuffer(bytes),'Missing queue bytes');
 requireValue(bytesDigest(bytes)===reference.bytesSha256,'Archive byte digest mismatch');
 const artifact=JSON.parse(bytes.toString());let q;
 if(artifact.format==='exact-queue-delta-v1'){
  const base=await hydrateQueue(artifact.base,load,validate,{catalogDigest,depth:depth+1,seen:visited});
  requireValue(artifact.fromRevision===base.revision&&Number.isSafeInteger(artifact.revision)&&artifact.revision>base.revision,'Delta revision mismatch');
  requireValue(plain(artifact.taskReplacements)&&Array.isArray(artifact.appendedEvents)&&artifact.appendedEvents.length>0,'Invalid delta');
  q=structuredClone(base);
  for(const [id,record]of Object.entries(artifact.taskReplacements)){requireValue(Object.hasOwn(base.tasks,id)&&plain(record),'Invalid task replacement');q.tasks[id]=structuredClone(record);}
  q.events.push(...structuredClone(artifact.appendedEvents));q.revision=artifact.revision;
  requireValue(queueDigest(q)===artifact.resultSha256,'Delta result digest mismatch');
 }else q=artifact;
 requireValue(plain(q)&&q.revision===reference.revision&&q.catalogDigest===reference.catalogDigest&&queueDigest(q)===reference.queueSha256,'Resolved queue identity mismatch');
 validate(q);return q;
}
