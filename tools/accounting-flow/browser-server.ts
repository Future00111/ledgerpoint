import express from 'express';
import {readFileSync,writeFileSync} from 'node:fs';
import {pool} from '@workspace/db';
import {createAccountingRouter} from '../../artifacts/api-server/src/routes/accountingDocuments';
import {createDocumentIntakeRouter} from '../../artifacts/api-server/src/routes/documentIntake';
import {createEntitiesRouter} from '../../artifacts/api-server/src/routes/entities';
import {verifyDraftBody,draftParserErrors} from '../../artifacts/api-server/src/services/financialDrafts/jsonBoundary';
import {saveConfiguration,addPeriod} from '../../artifacts/api-server/src/services/accountingDocuments/configuration';
import {savePaymentConfiguration,previewPayment,postPayment} from '../../artifacts/api-server/src/services/accountingDocuments/payments';
import {randomUUID} from 'node:crypto';
import {reports} from '../../artifacts/api-server/src/services/accountingDocuments/reports';

async function main() {
  const socket=process.env.JOB20_SOCKET??'',dir=process.env.JOB20_OUTPUT??'';
  if(process.env.NODE_ENV!=='test'||!/^\/tmp\/ledgerly-job20-browser-[A-Za-z0-9]+\/socket$/.test(socket)||
    process.env.DATABASE_URL!==`postgresql://ledgerly_api@localhost/ledgerly_job20_browser_test?host=${encodeURIComponent(socket)}&port=55443`)
    throw Error('Fresh private browser database required');
  const identity=(await pool.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0];
  if(identity.db!=='ledgerly_job20_browser_test'||identity.role!=='ledgerly_api'||identity.addr!==null)throw Error('Identity mismatch');
  const fixture=JSON.parse(readFileSync(dir+'/fixture.json','utf8')),actor='job20-synthetic-owner';
  await saveConfiguration(fixture.id,actor,{revision:null,business_accounting_basis:'accrual',mappings:fixture.mappings});
  await savePaymentConfiguration(fixture.id,actor,{revision:null,mappings:fixture.paymentMappings});
  await addPeriod(fixture.id,actor,{start_date:'2026-01-01',end_date:'2026-12-31',financial_year_label:'Synthetic 2026'});
  if(fixture.bankStatements) {
    const intent={id:randomUUID(),kind:'payment',party_type:'customer',party_id:fixture.customer,payment_id:null,
      date:'2026-10-21',reference:'Native synthetic receipt 120',amount_minor:'12000',allocations:[]};
    const review=await previewPayment(fixture.id,actor,intent);
    const posted=await postPayment(fixture.id,actor,{...intent,review_token:review.review_token});
    writeFileSync(dir+'/native-payment.json',JSON.stringify({intent,posted,syntheticOnly:true}));
  }
  const app=express();app.use(express.json({verify:verifyDraftBody}));app.use(draftParserErrors);
  const auth:express.RequestHandler=(req,res,next)=>{
    if(req.get('x-test-actor')!==actor){res.status(401).json({error:{code:'UNAUTHORIZED'}});return;}
    (req as any).userId=actor;next();
  };
  app.use('/api/companies/:companyId/document-intake',createDocumentIntakeRouter(auth));
  app.use('/api/companies/:companyId',createAccountingRouter(auth));
  app.use('/api/entities',createEntitiesRouter(auth));
  app.use('/api',(_req,res)=>{res.status(404).json({error:{code:'FIXTURE_ROUTE_UNAVAILABLE'}});});
  app.get('/fixture',(_req,res)=>res.json({id:fixture.id,name:'Job20 disposable synthetic company',vat_registered:true}));
  app.get('/health',(_req,res)=>res.json({source:process.env.JOB20_SOURCE,synthetic:true,identity,jobs:false}));
  app.get('/bundle.js',(_req,res)=>res.type('js').send(readFileSync(dir+'/bundle.js')));
  app.use((_req,res)=>res.type('html').send('<!doctype html><html><head><title>Synthetic native accounting acceptance</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'));
  const server=app.listen(58972,'127.0.0.1',()=>console.log('READY http://127.0.0.1:58972/invoices/new'));
  process.on('SIGTERM',()=>{server.close(async()=>{
    try {writeFileSync(dir+'/final-report.json',JSON.stringify(await reports(fixture.id,actor,'2026-01-01','2026-12-31'),null,2));}
    finally {await pool.end();process.exit(0);}
  });});
}
main().catch(()=>{console.error('Synthetic browser server failed');process.exit(1);});
