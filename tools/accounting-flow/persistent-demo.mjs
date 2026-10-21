/** Development-only PostgreSQL data in the workspace; a disposable Unix socket. */
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, realpathSync, lstatSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { root, exportSchema, installSchema } from './schema.mjs';
const require=createRequire(root+'/artifacts/api-server/package.json');
const {Client}=require('pg');
const base=path.join(root,'.local/share/ledgerly/demo');
const data=path.join(base,'data');
const socket='/tmp/ledgerly-w03-invoice-demo/socket';
const ready=path.join(base,'ready.json');
const env=Object.fromEntries(['PATH','HOME','LANG','LC_ALL'].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));
const connection={host:socket,port:55440,database:'ledgerly_w03_invoice_demo',user:'w03_bootstrap',password:'',ssl:false,options:'',connectionTimeoutMillis:5000};
const run=(cmd,args)=>execFileSync(cmd,args,{env,stdio:'pipe',encoding:'utf8',timeout:60000});
function privateDirectory(dir) {
  if(existsSync(dir) && lstatSync(dir).isSymbolicLink()) throw Error('Demo directories must not be symbolic links');
  mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);
}
async function identity(database=connection.database) {
  const q=new Client({...connection,database});await q.connect();
  try {
    const r=(await q.query("SELECT current_database() db,current_user actor,inet_server_addr() addr,current_setting('data_directory') data")).rows[0];
    if(r.db!==database || r.actor!=='w03_bootstrap' || r.addr!==null || realpathSync(r.data)!==realpathSync(data)) throw Error('Persistent demo identity mismatch');
  } finally {await q.end();}
}
async function start() {
  if(!existsSync(ready) || !existsSync(path.join(data,'PG_VERSION'))) throw Error('Persistent demo is not initialised. An explicit create is required; no automatic reset.');
  const marker=JSON.parse(readFileSync(ready,'utf8'));
  if(marker.version!==1 || marker.database!==connection.database) throw Error('Unexpected persistent demo marker');
  privateDirectory(path.dirname(socket));privateDirectory(socket);
  if(spawnSync('pg_ctl',['-D',data,'status'],{env,stdio:'pipe'}).status!==0) {
    run('pg_ctl',['-D',data,'-l',path.join(base,'postgres.log'),'-o',`-h '' -k ${socket} -p 55440`,'-w','start']);
  }
  await identity();
  console.log('Persistent isolated demo ready; existing records preserved.');
}
async function create() {
  // Never overwrite either a surviving old demo or an existing persistent cluster.
  if(existsSync(data) || existsSync(ready) || existsSync('/tmp/ledgerly-w03-invoice-demo/data')) throw Error('Existing demo detected. Refusing to recreate or replace records.');
  if(existsSync(path.join(socket,'.s.PGSQL.55440'))) throw Error('Socket already in use. Inspect the existing demo first.');
  privateDirectory(base);privateDirectory(path.dirname(socket));privateDirectory(socket);
  run('initdb',['-D',data,'-U','w03_bootstrap','-A','trust','--no-locale','--encoding=UTF8']);
  // fsync remains enabled; only a private Unix socket is opened.
  run('pg_ctl',['-D',data,'-l',path.join(base,'postgres.log'),'-o',`-h '' -k ${socket} -p 55440`,'-w','start']);
  await identity('postgres');
  let q=new Client({...connection,database:'postgres'});await q.connect();
  try {await q.query('CREATE DATABASE ledgerly_w03_invoice_demo');} finally {await q.end();}
  q=new Client(connection);await q.connect();
  try {await installSchema(q,exportSchema());} finally {await q.end();}
  writeFileSync(ready,JSON.stringify({version:1,database:connection.database,created:new Date().toISOString(),syntheticOnly:true},null,2)+'\n',{mode:0o600});
  await identity();console.log('Fresh persistent isolated demo created. No companies or financial records were posted.');
}
async function backup() {
  await start();const dir=path.join(base,'backups');privateDirectory(dir);
  const file=path.join(dir,`demo-${new Date().toISOString().replaceAll(':','-')}.dump`);
  run('pg_dump',['-h',socket,'-p','55440','-U','w03_bootstrap','-d',connection.database,'--format=custom','--file',file]);
  chmodSync(file,0o600);console.log('Backup saved:',file);
}
const command=process.argv[2];
if(command==='start-if-enabled' && process.env.W03_INVOICE_DEMO_MODE===undefined) process.exit(0);
if(process.env.W03_INVOICE_DEMO_MODE!=='1' || process.env.NODE_ENV!=='development') throw Error('Requires explicit isolated development mode; external database credentials are never used.');
if(command==='create') await create();
else if(command==='start' || command==='start-if-enabled') await start();
else if(command==='backup') await backup();
else if(command==='status') {await identity();console.log('Persistent demo identity verified.');}
else throw Error('Use create, start, start-if-enabled, status or backup. No reset or deletion command exists.');
