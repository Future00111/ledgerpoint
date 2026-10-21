import { createRequire } from 'node:module';
import { root,exportSchema,installSchema } from './schema.mjs';
const require=createRequire(root+'/artifacts/api-server/package.json');
const {Client}=require('pg');
// Fixed socket only. The external DATABASE_URL and ambient libpq variables are never used.
const admin=new Client({host:'/tmp/ledgerly-w03-invoice-demo/socket',port:55440,
  database:'ledgerly_w03_invoice_demo',user:'w03_bootstrap',password:'',ssl:false,options:''});
try {
  await admin.connect();
  const identity=(await admin.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0];
  if(identity.db!=='ledgerly_w03_invoice_demo'||identity.role!=='w03_bootstrap'||identity.addr!==null) throw Error('Isolated database identity mismatch');
  const ids=['915a6fe4-db75-4ed4-8301-33c4461ebea8','b85eeca4-5302-4037-b0ff-baf3746e2c36','c81f485b-5aaa-42e3-bc93-778fedc5371f'];
  const fingerprint=async()=>JSON.stringify((await admin.query(`SELECT row_to_json(i) invoice,row_to_json(d) draft FROM sales_invoices i
    JOIN w03_invoice_drafts d ON d.invoice_id=i.id WHERE i.id=ANY($1::uuid[]) ORDER BY i.id`,[ids])).rows);
  const before=await fingerprint();
  if(JSON.parse(before).length!==3) throw Error('Expected three preserved demo drafts');
  await installSchema(admin,exportSchema());
  if(await fingerprint()!==before) throw Error('Preserved draft comparison failed');
  console.log('Isolated full canonical schema installed; five immutable guards enabled; all three existing drafts byte-equivalent.');
} finally {await admin.end();}
