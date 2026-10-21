// Rebuild ONLY derived compatibility balances in the isolated synthetic demo.
// No ambient connection string, source alteration, journal replay or reset.
import { createRequire } from 'node:module';
import { root } from './schema.mjs';
const { Client } = createRequire(root + '/artifacts/api-server/package.json')('pg');
const q = new Client({ host:'/tmp/ledgerly-w03-invoice-demo/socket',port:55440,
  database:'ledgerly_w03_invoice_demo',user:'w03_bootstrap',password:'',ssl:false,options:'' });
try {
  await q.connect();
  const i=(await q.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0];
  if(i.db!=='ledgerly_w03_invoice_demo'||i.role!=='w03_bootstrap'||i.addr!==null) throw Error('Isolated database required');
  await q.query('BEGIN');
  await q.query('SELECT id FROM companies ORDER BY id FOR UPDATE');
  const fingerprint=async()=>{
    const hashes=[];
    for(const table of ['accounting_document_sources','canonical_journal_entries','canonical_journal_lines','accounting_payment_events','chart_of_accounts'])
      hashes.push((await q.query(`SELECT md5(coalesce(string_agg(row_to_json(t)::text,',' ORDER BY id),'')) hash FROM ${table} t`)).rows[0].hash);
    return JSON.stringify(hashes);
  };
  const before=await fingerprint();
  const docs=(await q.query(`SELECT d.id,d.company_id,d.kind,(d.money->>'gross_pence')::bigint gross,
    coalesce((SELECT sum((c.money->>'gross_pence')::bigint) FROM accounting_document_sources c
      JOIN canonical_journal_entries cj ON cj.id=c.journal_id AND cj.company_id=c.company_id AND cj.status='posted'
      WHERE c.company_id=d.company_id AND c.original_id=d.id AND c.status='posted'),0)::bigint credited,
    coalesce((SELECT sum((a->>'amount_minor')::bigint*CASE WHEN e.kind='unallocation' THEN -1 ELSE 1 END)
      FROM accounting_payment_events e JOIN canonical_journal_entries ej ON ej.id=e.journal_id AND ej.company_id=e.company_id AND ej.status='posted',
        jsonb_array_elements(e.allocations) a WHERE e.company_id=d.company_id AND a->>'document_id'=d.id::text),0)::bigint paid
    FROM accounting_document_sources d JOIN canonical_journal_entries j ON j.id=d.journal_id AND j.company_id=d.company_id AND j.status='posted'
    WHERE d.status='posted' AND d.kind IN ('sales_invoice','purchase_bill') ORDER BY d.company_id,d.id`)).rows;
  const pounds=n=>`${n/100n}.${(n%100n).toString().padStart(2,'0')}`;
  for(const d of docs) {
    const paid=BigInt(d.paid),credited=BigInt(d.credited),remaining=BigInt(d.gross)-paid-credited;
    if(paid<0n||credited<0n||remaining<0n) throw Error('Invalid canonical settlement');
    const table=d.kind==='sales_invoice'?'sales_invoices':'purchase_bills';
    const old=(await q.query(`SELECT amount_paid FROM ${table} WHERE company_id=$1 AND id=$2 FOR UPDATE`,[d.company_id,d.id])).rows[0];
    if(!old || (Number(old.amount_paid)!==0 && Number(old.amount_paid)!==Number(pounds(paid)))) throw Error('Unexplained legacy payment; preserve for review');
    if((await q.query(`SELECT id FROM bank_transactions b WHERE company_id=$1 AND (to_jsonb(b)->>'linked_invoice_id'=$2::text OR to_jsonb(b)->>'linked_bill_id'=$2::text OR matched_record_id=$2::text)`,[d.company_id,d.id])).rowCount) throw Error('Legacy bank link needs review');
    const status=remaining===0n?'paid':paid+credited>0n?'part_paid':'posted';
    await q.query(`UPDATE ${table} SET amount_paid=$3,balance_due=$4,status=$5
      WHERE company_id=$1 AND id=$2`,[d.company_id,d.id,pounds(paid),pounds(remaining),status]);
  }
  if(await fingerprint()!==before) throw Error('Immutable accounting history changed');
  await q.query('COMMIT');
  console.log(`Refreshed ${docs.length} synthetic balance projections; sources, journals, payments and accounts unchanged.`);
} catch(error) {await q.query('ROLLBACK').catch(()=>{});throw error;}
finally {await q.end();}
