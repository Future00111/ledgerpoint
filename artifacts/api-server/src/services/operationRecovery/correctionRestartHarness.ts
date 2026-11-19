/** Disposable subprocess only; never imported by the application. */
import express from 'express';
import {pool} from '@workspace/db';
import {createAccountingRouter} from '../../routes/accountingDocuments';
import {commitCorrection} from '../accountingDocuments/corrections';
const socket=process.env.ACCOUNTING_FLOW_TEST_SOCKET??'';
if(!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]+\/socket$/.test(socket)||process.env.NODE_ENV!=='test'||process.env.DATABASE_URL!==`postgresql://ledgerly_api@localhost/ledgerly_accounting_flow_test?host=${encodeURIComponent(socket)}&port=55441`)throw Error('Disposable correction restart target required');
async function main(){
 const identity=(await pool.query('SELECT current_database() db,current_user actor,inet_server_addr() addr')).rows[0];
 if(identity.db!=='ledgerly_accounting_flow_test'||identity.actor!=='ledgerly_api'||identity.addr!==null)throw Error('Wrong disposable identity');
 const app=express();app.use(express.json());app.use('/companies/:companyId',createAccountingRouter((req,res,next)=>{const actor=req.get('x-test-actor');if(!actor){res.status(401).end();return;}(req as any).userId=actor;next();}));
 const server=app.listen(0,'127.0.0.1',()=>process.send?.({ready:true,port:(server.address() as any).port}));
 process.on('message',(message:any)=>{if(message?.action==='admit')void commitCorrection(message.company,message.actor,message.document,message.revision,message.command,undefined,async()=>{process.send?.({admitted:message.command.request_id});await new Promise<void>(()=>{});}).catch(()=>process.send?.({failed:true}));});
 process.on('SIGTERM',()=>server.close(()=>{void pool.end().then(()=>process.exit(0));}));
}
void main().catch(()=>process.exit(1));
