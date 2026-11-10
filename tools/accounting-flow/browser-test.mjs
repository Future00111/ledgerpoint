// Separate disposable lifecycle for explicit browser acceptance. Never a demo launcher.
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {root,exportSchema,installSchema} from './schema.mjs';
const require=createRequire(root+'/artifacts/api-server/package.json'),{Client}=require('pg'),{buildSync}=require('esbuild');
if(process.getuid()===0)throw Error('Unprivileged development user required');
const bankOpenings=process.argv.includes('--bank-openings');
const adversarial=process.argv.includes('--adversarial');
const bankStatements=process.argv.includes('--bank-statements')||adversarial;
const output=path.resolve(root,adversarial?'../job25-evidence/browser':bankStatements?'../job24c-evidence/browser':bankOpenings?'../job24b-evidence/browser':'../job22-evidence/browser');mkdirSync(output,{recursive:true});
if(existsSync(output+'/cleanup.json')||existsSync(output+'/fixture.json'))throw Error('Refuse to reuse browser evidence');
const dir=mkdtempSync('/tmp/ledgerly-job20-browser-'),socket=dir+'/socket';
mkdirSync(socket,{mode:0o700});
const env={PATH:process.env.PATH,HOME:dir,LANG:'C',LC_ALL:'C'};
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
let pg,api,admin,apiStopped=false,postgresStopped=false,directoryRemoved=false;
async function stop(p) {
  if(!p||p.exitCode!==null||p.signalCode!==null)return true;
  return new Promise(resolve=>{const timer=setTimeout(()=>p.kill('SIGKILL'),5000);
    p.once('exit',()=>{clearTimeout(timer);resolve(true);});p.kill('SIGTERM');});
}
try {
  execFileSync('initdb',['-D',dir+'/data','-U','w03_bootstrap','-A','trust','--no-locale','--encoding=UTF8'],{env,stdio:'pipe'});
  pg=spawn('postgres',['-D',dir+'/data','-h','','-k',socket,'-p','55443','-F'],{env,stdio:'ignore'});
  for(let i=0;i<60;i++){try {execFileSync('pg_isready',['-h',socket,'-p','55443'],{env,stdio:'pipe'});break;}
    catch {if(i===59)throw Error('Fresh PostgreSQL unavailable');await new Promise(r=>setTimeout(r,100));}}
  const connection={host:socket,port:55443,user:'w03_bootstrap',password:'',ssl:false,options:''};
  admin=new Client({...connection,database:'postgres'});await admin.connect();
  await admin.query('CREATE DATABASE ledgerly_job20_browser_test');await admin.end();
  admin=new Client({...connection,database:'ledgerly_job20_browser_test'});await admin.connect();
  const identity=(await admin.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0];
  if(identity.db!=='ledgerly_job20_browser_test'||identity.role!=='w03_bootstrap'||identity.addr!==null)throw Error('Fresh identity mismatch');
  await installSchema(admin,exportSchema(),{includeAmendments:true});
  const id=randomUUID(),customer=randomUUID(),supplier=randomUUID(),mappings={},paymentMappings={};
  await admin.query("INSERT INTO companies(id,name,country,base_currency,vat_registered,vat_scheme,vat_accounting_basis,status) VALUES($1,'Job20 disposable synthetic company','GB','GBP',true,'standard','invoice','active')",[id]);
  await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,'job20-synthetic-owner','owner',true)",[randomUUID(),id]);
  await admin.query("INSERT INTO customers(id,company_id,name,status) VALUES($1,$2,'Synthetic browser customer','active')",[customer,id]);
  await admin.query("INSERT INTO suppliers(id,company_id,name,status) VALUES($1,$2,'Synthetic browser supplier','active')",[supplier,id]);
  for(const [role,type] of [['receivables','asset'],['payables','liability'],['revenue','income'],['expense','expense'],['output_vat','liability'],['input_vat','asset'],['bank','asset'],['customer_credit','liability'],['supplier_prepayment','asset']]){
    const account=randomUUID();(['bank','customer_credit','supplier_prepayment'].includes(role)?paymentMappings:mappings)[role]=account;
    await admin.query('INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,$3,$3,$4,true)',[account,id,role,type]);
  }
  await admin.query("INSERT INTO vat_tax_rules(id,company_id,code,label,rate,treatment,effective_from,is_active,is_recoverable) VALUES($1,$2,'STANDARD_20','Standard VAT','20','standard','2011-01-04',true,true)",[randomUUID(),id]);
  if(bankOpenings||bankStatements) {
    await admin.query("INSERT INTO bank_accounts(id,company_id,account_name,currency,status) VALUES($1,$2,'Synthetic opening bank','GBP','active')",[randomUUID(),id]);
    await admin.query("INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,'3000','Opening equity','equity',true)",[randomUUID(),id]);
  }
  writeFileSync(output+'/fixture.json',JSON.stringify({id,customer,supplier,mappings,paymentMappings,source,identity,bankStatements}));
  await admin.end();admin=null;
  buildSync({entryPoints:[root+'/tools/accounting-flow/browser-server.ts'],outfile:output+'/server.cjs',bundle:true,platform:'node',format:'cjs',external:['pg','@clerk/express','pino','pino-http','pino-pretty','thread-stream'],nodePaths:[root+'/artifacts/api-server/node_modules']});
  buildSync({entryPoints:[root+'/tools/accounting-flow/browser-fixture.jsx'],outfile:output+'/bundle.js',bundle:true,platform:'browser',format:'iife',jsx:'automatic',
    nodePaths:[root+'/artifacts/ledgerly/node_modules'],
    alias:{'@/lib/useCompany':root+'/tools/accounting-flow/browser-company.mjs','@':root+'/artifacts/ledgerly/src'},
    define:{'import.meta.env':'{\"BASE_URL\":\"/\",\"DEV\":true}'}});
  api=spawn(process.execPath,[output+'/server.cjs'],{cwd:root,env:{...env,NODE_ENV:'test',NODE_PATH:root+'/artifacts/api-server/node_modules',
    JOB20_SOCKET:socket,JOB20_OUTPUT:output,JOB20_SOURCE:source,
    DATABASE_URL:`postgresql://ledgerly_api@localhost/ledgerly_job20_browser_test?host=${encodeURIComponent(socket)}&port=55443`},stdio:'inherit'});
  const deadline=Date.now()+900000;
  while(Date.now()<deadline&&!existsSync(output+'/STOP')){
    if(api.exitCode!==null||api.signalCode!==null)throw Error('Browser API exited');
    await new Promise(r=>setTimeout(r,300));
  }
} finally {
  await admin?.end().catch(()=>{});
  apiStopped=await stop(api);postgresStopped=await stop(pg);
  if(postgresStopped){rmSync(dir,{recursive:true,force:true});directoryRemoved=true;}
  writeFileSync(output+'/cleanup.json',JSON.stringify({source,syntheticOnly:true,apiStopped,postgresStopped,directoryRemoved,existingDatabasesAccessed:false}));
}
