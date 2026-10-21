import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { root } from './schema.mjs';
const { Client } = createRequire(root + '/artifacts/api-server/package.json')('pg');
const admin = new Client({ host:'/tmp/ledgerly-w03-invoice-demo/socket',port:55440,
  database:'ledgerly_w03_invoice_demo',user:'w03_bootstrap',password:'',ssl:false,options:'' });
try {
  await admin.connect();
  const i=(await admin.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0];
  if(i.db!=='ledgerly_w03_invoice_demo'||i.role!=='w03_bootstrap'||i.addr!==null) throw Error('Isolated database identity mismatch');
  const fingerprint=async()=>{
    const result=[];
    for(const table of ['accounting_document_sources','canonical_journal_entries','canonical_journal_lines','chart_of_accounts'])
      result.push((await admin.query(`SELECT md5(coalesce(string_agg(row_to_json(t)::text,',' ORDER BY id),'')) value FROM ${table} t`)).rows[0].value);
    return JSON.stringify(result);
  };
  await admin.query('BEGIN');
  const before=await fingerprint();
  await admin.query(readFileSync(root+'/lib/db/migrations/accounting-payments.review.sql','utf8'));
  if(await fingerprint()!==before) throw Error('Existing accounting records changed');
  await admin.query('COMMIT');
  console.log('W06 schema installed only in isolated development DB; existing documents, journals and accounts unchanged.');
} catch(e) {await admin.query('ROLLBACK').catch(()=>{});throw e;}
finally {await admin.end();}
