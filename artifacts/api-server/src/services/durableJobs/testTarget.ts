import {realpathSync}from'node:fs';
/** Must run before dynamic imports of @workspace/db or application services. */
export function disposableTarget(restored=false){
 const socket=process.env.ACCOUNTING_FLOW_TEST_SOCKET??'',database=restored?'ledgerly_accounting_flow_restore_test':'ledgerly_accounting_flow_test';
 if(!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]{6}\/socket$/.test(socket)||realpathSync(socket)!==socket||process.env.NODE_ENV!=='test'||
  process.env.DATABASE_URL!==`postgresql://ledgerly_api@localhost/${database}?host=${encodeURIComponent(socket)}&port=55441`||process.env.W03_INVOICE_DEMO_MODE!==undefined)
  throw Error('Exact disposable durable queue socket required');
 return {socket,database};
}
async function identity(q:{query:Function},database:string,user:string){
 const found=(await q.query('SELECT current_database() db,current_user actor,inet_server_addr() addr')).rows[0];
 if(found.db!==database||found.actor!==user||found.addr!==null)throw Error('Disposable durable queue identity mismatch');
}
async function serverSettings(q:{query:Function},socket:string){
 const settings=(await q.query("SELECT current_setting('unix_socket_directories') socket,current_setting('port') port,current_setting('data_directory') directory")).rows[0];
 if(settings.socket!==socket||settings.port!=='55441'||realpathSync(settings.directory)!==socket.replace(/\/socket$/,'/data'))
  throw Error('Disposable server identity mismatch');
}
export async function verifyTarget(q:{query:Function},database:string,user='ledgerly_api'){
 const target=disposableTarget(database==='ledgerly_accounting_flow_restore_test');
 if(target.database!==database||!['ledgerly_api','w03_bootstrap'].includes(user))throw Error('Unexpected disposable identity');
 if(user==='w03_bootstrap'){
  await identity(q,database,user);await serverSettings(q,target.socket);return;
 }
 // PostgreSQL restricts socket/data-directory settings. A separate guarded,
 // explicit disposable bootstrap connection verifies them and closes before
 // the native runtime is used. The application role receives no extra grants.
 const {Client}=await import('pg');
 const bootstrap=new Client({host:target.socket,port:55441,user:'w03_bootstrap',database,
  password:()=>'',ssl:false,options:'-c timezone=UTC'});
 try{await bootstrap.connect();await identity(bootstrap,database,'w03_bootstrap');await serverSettings(bootstrap,target.socket);}
 finally{await bootstrap.end();}
 await identity(q,database,'ledgerly_api');
}
