import { mkdtempSync,mkdirSync,rmSync,writeFileSync } from 'node:fs';
import { execFileSync,spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { root,exportSchema,installSchema } from './schema.mjs';

const require=createRequire(root+'/artifacts/api-server/package.json'),{Client}=require('pg');
const dir=mkdtempSync('/tmp/ledgerly-accounting-flow-tests-'),socket=dir+'/socket',port=55441;
mkdirSync(socket,{mode:0o700});
const env={PATH:process.env.PATH,HOME:dir,LANG:'C',LC_ALL:'C'};
let server,admin,stopped=false,removed=false,exitCode=1;
const receipt=root+'/generated-artifacts/accounting-flow-cleanup.json';
try {
  execFileSync('initdb',['-D',dir+'/data','-U','w03_bootstrap','-A','trust','--no-locale','--encoding=UTF8'],{env,stdio:'pipe'});
  server=spawn('postgres',['-D',dir+'/data','-h','','-k',socket,'-p',String(port),'-F'],{env,stdio:['ignore','ignore','ignore']});
  for(let attempt=0;attempt<60;attempt++){
    if(execFileSync('pg_isready',['-h',socket,'-p',String(port)],{env,stdio:'pipe',timeout:1000}).toString().includes('accepting')) break;
  }
} catch(error) {
  // pg_isready can initially return nonzero while the server starts.
  if(!server) throw error;
}
try {
  for(let attempt=0;attempt<60;attempt++) {
    try {execFileSync('pg_isready',['-h',socket,'-p',String(port)],{env,stdio:'pipe'});break;}
    catch {if(attempt===59) throw Error('Disposable PostgreSQL did not start');await new Promise(r=>setTimeout(r,50));}
  }
  admin=new Client({host:socket,port,user:'w03_bootstrap',database:'postgres',password:'',ssl:false,options:''});await admin.connect();
  await admin.query('CREATE DATABASE ledgerly_accounting_flow_test');await admin.end();
  admin=new Client({host:socket,port,user:'w03_bootstrap',database:'ledgerly_accounting_flow_test',password:'',ssl:false,options:''});await admin.connect();
  await installSchema(admin,exportSchema());await admin.end();admin=null;
  execFileSync('pnpm',['--filter','@workspace/api-server','exec','esbuild','src/services/accountingDocuments/integration.test.ts',
    '--bundle','--platform=node','--format=cjs','--external:pg','--external:@clerk/express',
    '--outfile=../../generated-artifacts/accounting-flow.test.cjs'],{cwd:root,stdio:'inherit'});
  const testEnv={...env,NODE_ENV:'test',NODE_PATH:root+'/artifacts/api-server/node_modules',
    ACCOUNTING_FLOW_TEST_SOCKET:socket,
    DATABASE_URL:`postgresql://ledgerly_api@localhost/ledgerly_accounting_flow_test?host=${encodeURIComponent(socket)}&port=${port}`};
  const result=spawn(process.execPath,['--test',root+'/generated-artifacts/accounting-flow.test.cjs'],{cwd:root,env:testEnv,stdio:'inherit'});
  exitCode=await new Promise((resolve,reject)=>{result.on('error',reject);result.on('exit',code=>resolve(code??1));});
} finally {
  await admin?.end();
  if(server) {const ended=new Promise(r=>server.once('exit',r));server.kill('SIGTERM');await ended;stopped=true;}
  rmSync(dir,{recursive:true,force:true});removed=true;
  writeFileSync(receipt,JSON.stringify({syntheticOnly:true,postgresStopped:stopped,directoryRemoved:removed,
    ambientDatabaseCredentialsUsed:false,productionContact:false},null,2)+'\n');
}
process.exitCode=exitCode;
