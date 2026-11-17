import {realpathSync}from'node:fs';
/** Must run before dynamic imports of @workspace/db or application services. */
export function disposableTarget(restored=false){
 const socket=process.env.ACCOUNTING_FLOW_TEST_SOCKET??'',database=restored?'ledgerly_accounting_flow_restore_test':'ledgerly_accounting_flow_test';
 if(!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]{6}\/socket$/.test(socket)||realpathSync(socket)!==socket||process.env.NODE_ENV!=='test'||
  process.env.DATABASE_URL!==`postgresql://ledgerly_api@localhost/${database}?host=${encodeURIComponent(socket)}&port=55441`||process.env.W03_INVOICE_DEMO_MODE!==undefined)
  throw Error('Exact disposable durable queue socket required');
 return {socket,database};
}
export async function verifyTarget(q:{query:Function},database:string,user='ledgerly_api'){
 const identity=(await q.query('SELECT current_database() db,current_user actor,inet_server_addr() addr')).rows[0];
 const socket=process.env.ACCOUNTING_FLOW_TEST_SOCKET!;
 const settings=(await q.query("SELECT current_setting('unix_socket_directories') socket,current_setting('port') port")).rows[0];
 if(settings.socket!==socket||settings.port!=='55441')throw Error('Disposable socket identity mismatch');
 if(user==='w03_bootstrap'){const directory=(await q.query("SELECT current_setting('data_directory') directory")).rows[0].directory;if(realpathSync(directory)!==socket.replace(/\/socket$/,'/data'))throw Error('Disposable data directory mismatch');}
 if(identity.db!==database||identity.actor!==user||identity.addr!==null)throw Error('Disposable durable queue identity mismatch');
}
