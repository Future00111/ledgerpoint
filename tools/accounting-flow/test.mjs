import { mkdtempSync,mkdirSync,rmSync,writeFileSync } from 'node:fs';
import { execFileSync,spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { root,exportSchema,installSchema } from './schema.mjs';
import { runRestoreDrill } from './restore-drill.mjs';

const require=createRequire(root+'/artifacts/api-server/package.json'),{Client}=require('pg');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dir=mkdtempSync('/tmp/ledgerly-accounting-flow-tests-'),socket=dir+'/socket',port=55441;
mkdirSync(socket,{mode:0o700});
const env={PATH:process.env.PATH,HOME:dir,LANG:'C',LC_ALL:'C'};
let server,admin,stopped=false,removed=false,exitCode=1,restore=null;
const receipt=root+'/generated-artifacts/accounting-flow-cleanup.json';
const restoreReceipt=root+'/generated-artifacts/accounting-restore-drill.json';
const runId=randomUUID(),startedAt=new Date().toISOString();
mkdirSync(root+'/generated-artifacts',{recursive:true});
rmSync(receipt,{force:true});rmSync(restoreReceipt,{force:true});
async function stopServer(child) {
  if(!child || !child.pid || child.exitCode!==null || child.signalCode!==null) return true;
  return new Promise(resolve=>{
    let forceTimer,deadline;
    const finish=stopped=>{clearTimeout(forceTimer);clearTimeout(deadline);child.off('exit',onExit);resolve(stopped);};
    const onExit=()=>finish(true);
    child.once('exit',onExit);
    forceTimer=setTimeout(()=>child.kill('SIGKILL'),5000);
    deadline=setTimeout(()=>finish(false),10000);
    child.kill('SIGTERM');
  });
}
try {
  execFileSync('initdb',['-D',dir+'/data','-U','w03_bootstrap','-A','trust','--no-locale','--encoding=UTF8'],{env,stdio:'pipe'});
  server=spawn('postgres',['-D',dir+'/data','-h','','-k',socket,'-p',String(port),'-F'],{env,stdio:['ignore','ignore','ignore']});
  let startupError;
  server.on('error',error=>{startupError=error;});
  for(let attempt=0;attempt<60;attempt++) {
    if(startupError || server.exitCode!==null || server.signalCode!==null) throw Error('Disposable PostgreSQL exited during startup');
    try {execFileSync('pg_isready',['-h',socket,'-p',String(port)],{env,stdio:'pipe',timeout:1000});break;}
    catch {if(attempt===59) throw Error('Disposable PostgreSQL did not start');await new Promise(r=>setTimeout(r,50));}
  }
  admin=new Client({host:socket,port,user:'w03_bootstrap',database:'postgres',password:()=>'',ssl:false,options:'-c timezone=UTC'});await admin.connect();
  await admin.query('CREATE DATABASE ledgerly_accounting_flow_test');await admin.end();
  admin=new Client({host:socket,port,user:'w03_bootstrap',database:'ledgerly_accounting_flow_test',password:()=>'',ssl:false,options:'-c timezone=UTC'});await admin.connect();
  await installSchema(admin,exportSchema(),{includeAmendments:true});await admin.end();admin=null;
  // The canonical suite requires its own empty baseline and UUID-bound identity.
  // Never reuse the accounting fixtures or a caller-supplied database.
  const canonicalDatabase='ledgerly_canonical_test_'+runId.replaceAll('-','');
  admin=new Client({host:socket,port,user:'w03_bootstrap',database:'postgres',password:()=>'',ssl:false});
  await admin.connect();await admin.query(`CREATE DATABASE ${canonicalDatabase}`);
  await admin.query(`REVOKE TEMPORARY ON DATABASE ${canonicalDatabase} FROM PUBLIC`);await admin.end();
  admin=new Client({host:socket,port,user:'w03_bootstrap',database:canonicalDatabase,password:()=>'',ssl:false});
  await admin.connect();await installSchema(admin,exportSchema(),{includeAmendments:true});await admin.end();admin=null;
  const testEnv={...env,NODE_ENV:'test',NODE_PATH:root+'/artifacts/api-server/node_modules',
    ACCOUNTING_FLOW_TEST_SOCKET:socket,
    DATABASE_URL:`postgresql://ledgerly_api@localhost/ledgerly_accounting_flow_test?host=${encodeURIComponent(socket)}&port=${port}`};
  for(const [entry,output] of [
    ['src/services/accounting/canonicalPosting.integration.test.ts','canonical-posting-flow.test.cjs'],
    ['src/services/accountingDocuments/integration.test.ts','accounting-flow.test.cjs'],
    ['src/services/accountingDocuments/conditionalDiscount.integration.test.ts','conditional-discount-flow.test.cjs'],
    ['src/services/accountingDocuments/conditionalDiscount.test.ts','conditional-discount-unit.test.cjs'],
    ['src/security/integration.test.ts','security-flow.test.cjs'],
    ['src/services/accountingDocuments/corrections.integration.test.ts','corrections-flow.test.cjs'],
    ['src/services/accountingDocuments/vatCoverage.integration.test.ts','vat-coverage-flow.test.cjs'],
    ['src/services/auditReview/integration.test.ts','audit-review-flow.test.cjs'],
    ['../../tools/development/migrations/partial-schema.test.mjs','partial-schema-flow.test.cjs'],
  ]) {
    execFileSync('pnpm',['--filter','@workspace/api-server','exec','esbuild',entry,
      '--bundle','--platform=node','--format=cjs','--external:pg','--external:@clerk/express',
      '--external:pino','--external:pino-http','--external:pino-pretty','--external:thread-stream',
      '--outfile=../../generated-artifacts/'+output],{cwd:root,stdio:'inherit'});
    const suiteEnv=output==='canonical-posting-flow.test.cjs' ? {...testEnv,
      DATABASE_URL:`postgresql://ledgerly_api@localhost/${canonicalDatabase}?host=${encodeURIComponent(socket)}&port=${port}`,
      LEDGERLY_CANONICAL_TEST_DATABASE_NAME:canonicalDatabase,
      LEDGERLY_CANONICAL_TEST_RUN_ID:runId,
      LEDGERLY_CANONICAL_TEST_ENVIRONMENT:'development-disposable-test'} : testEnv;
    const result=spawn(process.execPath,['--test',root+'/generated-artifacts/'+output],{cwd:root,env:suiteEnv,stdio:'inherit'});
    exitCode=await new Promise((resolve,reject)=>{result.on('error',reject);result.on('exit',code=>resolve(code??1));});
    if(exitCode!==0) break;
  }
  if(exitCode===0) {
    restore={runId,sourceCommit,startedAt,...await runRestoreDrill({Client,directory:dir,socket,port})};
    execFileSync('pnpm',['--filter','@workspace/api-server','exec','esbuild',
      'src/services/accountingDocuments/conditionalCompensation.restore.test.ts','--bundle','--platform=node',
      '--format=cjs','--external:pg','--outfile=../../generated-artifacts/compensation-restore.test.cjs'],{cwd:root,stdio:'inherit'});
    const result=spawn(process.execPath,['--test',root+'/generated-artifacts/compensation-restore.test.cjs'],{cwd:root,
      env:{...testEnv,DATABASE_URL:`postgresql://ledgerly_api@localhost/ledgerly_accounting_flow_restore_test?host=${encodeURIComponent(socket)}&port=${port}`},stdio:'inherit'});
    exitCode=await new Promise((resolve,reject)=>{result.on('error',reject);result.on('exit',code=>resolve(code??1));});
    restore.compensationAcceptanceVerified=exitCode===0;
    writeFileSync(restoreReceipt,JSON.stringify(restore,null,2)+'\n');
    console.log('Disposable backup/restore verified: original rows, restored evidence and restricted runtime match.');
  }
} finally {
  try {await admin?.end();} catch {console.error('Disposable admin connection close failed; continuing server cleanup.');}
  stopped=await stopServer(server);
  if(stopped) {try {rmSync(dir,{recursive:true,force:true});removed=true;} catch {console.error('Disposable directory cleanup failed.');}}
  writeFileSync(receipt,JSON.stringify({runId,sourceCommit,startedAt,syntheticOnly:true,postgresStopped:stopped,directoryRemoved:removed,
    ambientDatabaseCredentialsUsed:false,productionContact:false,restoreVerified:restore!==null},null,2)+'\n');
  if(!stopped || !removed) exitCode=1;
}
process.exitCode=exitCode;
