
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const out=path.resolve(process.argv[2]), host=path.join(out,'verified-G'), candidate=path.join(host,'candidate');
const G='706dc6a31f85733ba0c251f40b2c09f5a9312269', C7='787d76decfa345e3c1104231e08d5ab00bc90259';
const hash=b=>createHash('sha256').update(b).digest('hex');
const git=(cwd,...a)=>execFileSync('git',['-C',cwd,...a],{encoding:'utf8'}).trim();
const read=async n=>JSON.parse(await fs.readFile(path.join(out,n),'utf8'));
const checks=[]; const check=(name,fn)=>{fn();checks.push(name)};
try{
 const artifact=await read('artifacts.json'), run=await read('run.json'), jobs=await read('jobs.json');
 const member='ledgerly-44-ti-03-283124e1-47d4-4754-ae97-e0f59c2f579e.json';
 const e=await read('members/'+member);
 check('GitHub run and job identity',()=>{
  assert.equal(run.id,38621069723);assert.equal(run.run_attempt,1);assert.equal(run.event,'workflow_dispatch');
  assert.equal(run.head_sha,G);assert.equal(run.head_branch,'main');assert.equal(run.conclusion,'success');
  assert.equal(jobs.jobs.length,1);assert.equal(jobs.jobs[0].id,116048423733);
  assert.equal(jobs.jobs[0].conclusion,'success');assert.equal(jobs.jobs[0].steps.length,9);
  assert.ok(jobs.jobs[0].steps.every(s=>s.conclusion==='success'));
 });
 const zipHash=hash(await fs.readFile(path.join(out,'original-artifact.zip')));
 check('Original artifact digest equals GitHub metadata',()=>{
  assert.equal(artifact.artifacts.length,1);assert.equal(artifact.artifacts[0].id,12288971026);
  assert.equal(artifact.artifacts[0].digest,'sha256:'+zipHash);
  assert.equal(zipHash,'41ccf0941649ffd35e9e1e5e5d588e46f3a2b3579af943fffe2f720e7fdd048f');
 });
 check('Frozen G and C7 checkouts',()=>{
  assert.equal(git(host,'rev-parse','HEAD'),G);assert.equal(git(candidate,'rev-parse','HEAD'),C7);
  git(host,'merge-base','--is-ancestor',C7,G);
  for(const cwd of [host,candidate])assert.equal(git(cwd,'status','--porcelain','--untracked-files=no'),'');
 });
 const req=createRequire(path.join(candidate,'package.json'));
 check('Pinned AJV validator',()=>assert.equal(req('ajv/package.json').version,'8.20.0'));
 const schemaRel='docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json';
 const schemaBytes=await fs.readFile(path.join(candidate,schemaRel));
 check('Artifact schema is exact frozen C7 schema',()=>assert.deepEqual(schemaBytes,execFileSync('git',['-C',candidate,'show',C7+':'+schemaRel])));
 const artifactSchema=await fs.readFile(path.join(out,'members/ledgerly-44-ti-03-evidence.schema.json'));
 check('Uploaded schema matches source byte for byte',()=>assert.deepEqual(schemaBytes,artifactSchema));
 const wf='.github/workflows/ledgerly-canonical-postgresql.yml';
 const workflowSha=hash(await fs.readFile(path.join(host,wf)));
 const specs=['.dockerignore','.ci/ledgerly-canonical/Dockerfile.test','.github','artifacts','lib','scripts',schemaRel,'package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.base.json','tsconfig.json'];
 const files=execFileSync('git',['-C',candidate,'ls-files','-z','--',...specs],{encoding:'utf8'}).split('\0').filter(Boolean).sort();
 const h=createHash('sha256');for(const f of files){h.update(f);h.update('\0');h.update(await fs.readFile(path.join(candidate,f)));h.update('\0')}
 const sourceTreeSha256=h.digest('hex');
 check('Execution tree independently recomputed',()=>{assert.equal(files.length,564);assert.equal(sourceTreeSha256,e.binding.sourceTreeSha256)});
 const ci={provider:'github-actions',repository:'Future00111/ledgerpoint',workflow:'Ledgerly canonical PostgreSQL qualification',workflowRef:'Future00111/ledgerpoint/'+wf+'@refs/heads/main',runId:'38621069723',runAttempt:'1',job:'canonical-postgresql',workflowSourceCommit:G,implementationSourceCommit:C7,identityMode:'activated',sourceRef:'refs/heads/main',refProtected:true,ancestryVerified:true,workflowCheckoutClean:true,implementationCheckoutClean:true};
 Object.assign(process.env,{GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF_PROTECTED:'true',GITHUB_REF:'refs/heads/main',GITHUB_SHA:G,GITHUB_REPOSITORY:ci.repository,GITHUB_WORKFLOW:ci.workflow,GITHUB_WORKFLOW_REF:ci.workflowRef,GITHUB_JOB:ci.job,GITHUB_RUN_ID:ci.runId,GITHUB_RUN_ATTEMPT:ci.runAttempt,LEDGERLY_IDENTITY_MODE:'activated',LEDGERLY_APPROVED_CANDIDATE_SHA:C7,LEDGERLY_IMPLEMENTATION_SOURCE_SHA:C7,LEDGERLY_WORKFLOW_ROOT:host});
 const coordinator=await import(pathToFileURL(path.join(candidate,'scripts/ci/run-ledgerly-canonical-postgresql.mjs')));
 const trusted=await coordinator.buildTrustedEvidenceContext(ci,{version:2,identityMode:'activated',implementationSourceCommit:C7,workflowSourceSha256:workflowSha,sourceTreeSha256,files});
 check('Strict AJV2020 and branded source-bound acceptance',()=>coordinator.validateEvidenceContract(e,trusted));
 check('All ten source digests recomputed',()=>{assert.equal(Object.keys(trusted.sourceDigests).length,10);assert.deepEqual(e.binding.sourceDigests,trusted.sourceDigests)});
 const neg='missingRunBinding forgedRunDatabaseMismatch malformedUri targetChangingQuery wrongHost wrongPort wrongDatabase wrongRole parentDatabaseUrl replitMarker inheritedPgOverride unpinnedImage untrustedEvent unauthorizedWorkflow cleanupBindingMismatch evidenceCredentialPattern roleEscalation triggerDisable'.split(' ');
 check('All 18 named negative controls',()=>{assert.deepEqual(Object.keys(e.negativeControls).sort(),[...neg].sort());assert.ok(neg.every(n=>e.negativeControls[n]===true))});
 const cleanup='logicalDrop databaseAbsent containerRemoved networkRemoved credentialMaterialRemoved'.split(' ');
 check('All five named cleanup checks',()=>{assert.deepEqual(Object.keys(e.cleanup).sort(),[...cleanup].sort());assert.ok(cleanup.every(n=>e.cleanup[n]===true))});
 const log=await fs.readFile(path.join(out,'logs/Disposable canonical PostgreSQL qualification/5_Run TI-03 qualification.txt'),'utf8');
 const tests=['canonical integration suite is bound to an empty API-role disposable database','canonical posting persists a balanced immutable journal, audit, and retry-safe effect','canonical posting fails closed for stale sources, closed periods, invalid accounts, and company mismatch','canonical posting is atomic under audit failure, concurrent retries, and additive reversal','SC-01 enforces company-scoped relation identity, uniqueness, and atomic rollback','owner journal locks serialize transactions without API mutation privileges'];
 check('Six accounting test names and zero fail/skip/cancel/todo',()=>{
  for(const t of tests)assert.ok(log.includes(t),t);
  for(const [k,v]of Object.entries({tests:6,pass:6,fail:0,cancelled:0,skipped:0,todo:0}))assert.match(log,new RegExp('(?:# |ℹ )'+k+' '+v+'(?:\\s|$)'));
 });
 const marker=n=>{const lines=log.split('\n').filter(l=>l.includes(n+' '));assert.equal(lines.length,1,n);return JSON.parse(lines[0].slice(lines[0].indexOf(n+' ')+n.length+1))};
 check('Concurrency log matches evidence and proves distinct overlapping transactions',()=>{
  const c=e.runtime.concurrencyEvidence;assert.deepEqual(marker('LEDGERLY_CONCURRENCY_EVIDENCE'),c);
  assert.equal(c.expected,2);assert.equal(c.arrivals.length,2);assert.equal(new Set(c.arrivals.map(x=>x.backendPid)).size,2);assert.equal(new Set(c.arrivals.map(x=>x.transactionId)).size,2);
  assert.ok(c.arrivals.every(x=>x.arrivedAt<=c.releasedAt));assert.equal(c.overlapProven,true);
 });
 check('Journal lock log and scoped privilege checks',()=>{
  const j=e.runtime.journalLockEvidence;assert.deepEqual(marker('LEDGERLY_JOURNAL_LOCK_EVIDENCE'),j);
  assert.equal(j.functionOwner,'ledgerly_canonical_owner');assert.equal(j.callerHasUpdate,false);
  for(const k of ['scopedLookupsRejected','directMutationDenied','temporaryShadowRejected','transactionalRowLockProven'])assert.equal(j[k],true);
  assert.equal(new Set(j.backendPids).size,2);
 });
 check('Negative privilege log matches evidence',()=>{
  assert.deepEqual(marker('LEDGERLY_NEGATIVE_PRIVILEGE_EVIDENCE'),e.runtime.negativePrivilegeEvidence);
  assert.ok(Object.values(e.runtime.negativePrivilegeEvidence).every(x=>x===true));
 });
 check('Fresh UUID, database and API identity',()=>{
  assert.equal(e.binding.databaseName,'ledgerly_canonical_test_'+e.binding.runUuid.replaceAll('-',''));
  assert.equal(e.runtime.databaseName,e.binding.databaseName);assert.equal(e.runtime.testIdentity.runId,e.binding.runUuid);
  assert.equal(e.runtime.testIdentity.databaseName,e.binding.databaseName);
  assert.equal(e.runtime.currentUser,'ledgerly_api');assert.equal(e.runtime.sessionUser,'ledgerly_api');
  assert.notEqual(e.binding.runUuid,'e91f7ef1-4da2-4c08-b16b-5028c429f296');
 });
 check('Role separation, ownership, ALWAYS triggers, FK validation and lock ACL',()=>{
  for(const name of ['ledgerly_api','ledgerly_canonical_owner']){
   const r=e.bootstrap.roleSeparation.find(x=>x.name===name);assert.ok(r);
   for(const k of ['superuser','inherit','createDatabase','createRole','replication','bypassRls'])assert.equal(r[k],false);
   assert.equal(r.login,name==='ledgerly_api');
  }
  assert.equal(e.bootstrap.memberships,0);assert.equal(e.bootstrap.ownership.length,5);
  assert.ok(e.bootstrap.ownership.every(x=>x.owner==='ledgerly_canonical_owner'));
  assert.equal(e.bootstrap.triggers.length,5);assert.ok(e.bootstrap.triggers.every(x=>x.enabled==='A'));
  assert.equal(e.bootstrap.constraints.length,17);assert.equal(e.bootstrap.indexes.length,4);
  assert.equal(e.bootstrap.relationForeignKeys.length,7);assert.ok(e.bootstrap.relationForeignKeys.every(x=>x.validated===true));
  const j=e.bootstrap.journalLock;assert.equal(j.owner,'ledgerly_canonical_owner');assert.equal(j.securityDefiner,true);
  assert.deepEqual(j.searchPath,['search_path=pg_catalog, pg_temp']);assert.equal(j.apiExecute,true);
  for(const k of ['publicExecute','apiUpdate','apiDelete','apiTruncate'])assert.equal(j[k],false);
 });
 check('Isolation and credential scan',()=>{for(const [k,v]of Object.entries(e.isolation))assert.equal(v,!['heliumdbContacted','productionContacted'].includes(k))});
 const evidenceHash=hash(await fs.readFile(path.join(out,'members',member)));
 check('Final evidence hash in retained log',()=>assert.ok(log.includes(evidenceHash)));
 const completion=marker('LEDGERLY_CANONICAL_TEST_COMPLETION');
 const summary={kind:'offline-verification-of-original-run',verifiedAt:new Date().toISOString(),allPassed:true,checks,runId:ci.runId,runAttempt:ci.runAttempt,workflowSource:G,implementationSource:C7,artifactSha256:zipHash,evidenceSha256:evidenceHash,schemaSha256:hash(schemaBytes),logsZipSha256:hash(await fs.readFile(path.join(out,'original-logs.zip'))),sourceFiles:files.length,sourceDigests:trusted.sourceDigests,accountingTests:tests,negativeControls:e.negativeControls,cleanup:e.cleanup,concurrency:e.runtime.concurrencyEvidence,journalLock:e.runtime.journalLockEvidence,completion,bootstrapRecovery:e.bootstrap.schemaPush,noQualificationRerun:true,noDatabaseOrDockerAccess:true,ownerAcceptance:'PENDING'};
 await fs.writeFile(path.join(out,'offline-verification-result.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({allPassed:true,checks:checks.length,accountingTests:6,negativeControls:18,cleanupChecks:5}));
}catch(error){await fs.writeFile(path.join(out,'offline-verification-failure.json'),JSON.stringify({allPassed:false,passedChecks:checks,error:String(error),stack:error.stack},null,2)+'\n');throw error}
