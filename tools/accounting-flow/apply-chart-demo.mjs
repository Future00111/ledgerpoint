import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const require=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url));
const { Client }=require('pg');
const client=new Client({host:'/tmp/ledgerly-w03-invoice-demo/socket',port:55440,
  database:'ledgerly_w03_invoice_demo',user:'w03_bootstrap',password:'',ssl:false,options:''});
try {
  await client.connect();
  const i=(await client.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0];
  if(i.db!=='ledgerly_w03_invoice_demo'||i.role!=='w03_bootstrap'||i.addr!==null) throw Error('Isolated identity mismatch');
  await client.query('BEGIN');
  const fingerprint=async()=>{
    const rows=await client.query(`SELECT jsonb_build_array(
      (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM chart_of_accounts a),
      (SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM accounting_document_sources d),
      (SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM canonical_journal_entries j),
      (SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM canonical_journal_lines l),
      (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM sales_invoices i),
      (SELECT jsonb_agg(to_jsonb(d) ORDER BY invoice_id) FROM w03_invoice_drafts d)) data`);
    return createHash('sha256').update(JSON.stringify(rows.rows[0].data)).digest('hex');
  };
  const before=await fingerprint();
  await client.query(readFileSync(new URL('../../lib/db/migrations/accounting-chart.review.sql',import.meta.url),'utf8'));
  if(await fingerprint()!==before) throw Error('Existing record fingerprint changed; rolling back');
  await client.query('COMMIT');
  console.log('Additive isolated chart metadata/audit schema ready; all existing account/document/journal fingerprints unchanged.');
} catch(e) {await client.query('ROLLBACK').catch(()=>{});throw e;}
finally {await client.end();}
