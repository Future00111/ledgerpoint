// CJS acceptance bundles run outside package-local node_modules. This smoke
// checks real dependency resolution and fail-closed target setup, not persistence.
// EPERM is a socket sandbox refusal, accepted only here as loading evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../../..');
const api=path.join(root,'artifacts/api-server');
const {buildSync}=createRequire(path.join(api,'package.json'))('esbuild');
test('compiled disposable guard resolves pg through NODE_PATH and refuses an absent private server',()=>{
 const output=mkdtempSync('/tmp/ledgerpoint-queue-module-');
 const cluster=mkdtempSync('/tmp/ledgerly-accounting-flow-tests-'),socket=path.join(cluster,'socket');
 try{
  mkdirSync(socket,{mode:0o700});
  const endpoint=path.join(socket,'.s.PGSQL.55441');assert.equal(existsSync(endpoint),false);
  const outfile=path.join(output,'guard.cjs');
  buildSync({absWorkingDir:root,entryPoints:[path.join(api,'src/services/durableJobs/testTarget.ts')],outfile,
   bundle:true,platform:'node',format:'cjs',external:['pg'],logLevel:'silent'});
  const child=`const assert=require('node:assert/strict');
const {verifyTarget}=require(${JSON.stringify(outfile)});
let nativeQueries=0;
verifyTarget({query:async()=>{nativeQueries++;throw Error('Native runtime must remain unused');}},'ledgerly_accounting_flow_test')
 .then(()=>{throw Error('An absent private server unexpectedly connected');})
 .catch(error=>{
  assert.ok(['ENOENT','ECONNREFUSED','EPERM'].includes(error.code),String(error));
  assert.ok(String(error.message).includes(${JSON.stringify(endpoint)}),String(error));
  assert.equal(nativeQueries,0);
  console.log(JSON.stringify({dependencyLoaded:true,privateServerAbsent:true,nativeQueries,failureCode:error.code}));
 }).catch(error=>{console.error(error);process.exitCode=1;});`;
  const result=execFileSync(process.execPath,['--input-type=commonjs','--eval',child],{
   cwd:output,encoding:'utf8',timeout:10000,
   env:{NODE_ENV:'test',NODE_PATH:path.join(api,'node_modules'),ACCOUNTING_FLOW_TEST_SOCKET:socket,
    DATABASE_URL:`postgresql://ledgerly_api@localhost/ledgerly_accounting_flow_test?host=${encodeURIComponent(socket)}&port=55441`},
  });
  const proof=JSON.parse(result.trim());
  const {failureCode,...facts}=proof;
  assert.deepEqual(facts,{dependencyLoaded:true,privateServerAbsent:true,nativeQueries:0});
  assert.ok(['ENOENT','ECONNREFUSED','EPERM'].includes(failureCode));
  assert.equal(existsSync(endpoint),false);
  console.log('DURABLE_GUARD_MODULE_LOADING',JSON.stringify(proof));
 }finally{rmSync(output,{recursive:true,force:true});rmSync(cluster,{recursive:true,force:true});}
});
