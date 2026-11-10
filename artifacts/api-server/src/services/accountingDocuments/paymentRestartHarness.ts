/** Disposable test subprocess only. Not imported by the application entry point. */
import express from 'express';
import {pool} from '@workspace/db';
import {createAccountingRouter} from '../../routes/accountingDocuments';
import {verifyDraftBody,draftParserErrors} from '../financialDrafts/jsonBoundary';

const socket=process.env.ACCOUNTING_FLOW_TEST_SOCKET??'';
if(!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]+\/socket$/.test(socket) ||
  process.env.NODE_ENV!=='test' ||
  process.env.DATABASE_URL!==`postgresql://ledgerly_api@localhost/ledgerly_accounting_flow_test?host=${encodeURIComponent(socket)}&port=55441`) {
  throw Error('Fresh disposable payment restart target required');
}
async function main(){
  const identity=(await pool.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0];
  if(identity.db!=='ledgerly_accounting_flow_test'||identity.role!=='ledgerly_api'||identity.addr!==null)throw Error('Wrong disposable identity');
  const app=express();
  app.use(express.json({verify:verifyDraftBody}));app.use(draftParserErrors);
  app.use((req,res,next)=>{
    if(req.method==='POST' && req.get('x-test-drop-reply')==='yes'){
      const json=res.json.bind(res);
      res.json=((body:unknown)=>{
        if(res.statusCode===200){res.socket?.destroy();return res;}
        return json(body);
      }) as typeof res.json;
    }
    next();
  });
  app.use('/companies/:companyId',createAccountingRouter((req,res,next)=>{
    const actor=req.get('x-test-actor');
    if(!actor){res.status(401).json({error:{code:'UNAUTHORIZED'}});return;}
    (req as any).userId=actor;next();
  }));
  const server=app.listen(0,'127.0.0.1',()=>{
    process.send?.({port:(server.address() as any).port,pid:process.pid});
  });
  process.on('SIGTERM',()=>server.close(()=>{void pool.end().then(()=>process.exit(0));}));
}
void main().catch(()=>{console.error('Disposable restart harness failed');process.exit(1);});
