import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { root } from './schema.mjs';
import { ensureWorkspaceTaxRules } from './workspace-tax-rules.mjs';
const require = createRequire(root + '/artifacts/api-server/package.json');
const { Client } = require('pg');
if (process.env.NODE_ENV !== 'development' || process.env.W03_INVOICE_DEMO_MODE !== '1') throw Error('Explicit isolated development mode required');
const company = process.argv[2];
if (!company || !/^[0-9a-f-]{36}$/i.test(company)) throw Error('Pass the intended Willow demo company ID');
// All connection fields are fixed: never use DATABASE_URL or another database.
const q = new Client({ host: '/tmp/ledgerly-w03-invoice-demo/socket', port: 55440, database: 'ledgerly_w03_invoice_demo', user: 'w03_bootstrap', password: '', ssl: false, options: '', connectionTimeoutMillis: 5000 });
await q.connect();
try {
  const i = (await q.query("SELECT current_database() db,current_user actor,inet_server_addr() addr,current_setting('data_directory') data")).rows[0];
  if (i.db !== 'ledgerly_w03_invoice_demo' || i.actor !== 'w03_bootstrap' || i.addr !== null || realpathSync(i.data) !== realpathSync(path.join(root, '.local/share/ledgerly/demo/data'))) throw Error('Wrong persistent isolated demo');
  await q.query('BEGIN');
  const c = (await q.query('SELECT * FROM companies WHERE id=$1 FOR UPDATE', [company])).rows[0];
  if (c?.name !== 'Willow & Co — DEMO (synthetic)' || c.vat_registered !== true || c.vat_scheme !== 'standard' || c.vat_accounting_basis !== 'invoice') throw Error('Expected the existing Willow synthetic VAT company');
  const added = await ensureWorkspaceTaxRules(q, company);
  await q.query('COMMIT');
  console.log(JSON.stringify({ company, added, recordsPreserved: true }));
} catch (error) {
  await q.query('ROLLBACK');
  throw error;
} finally { await q.end(); }
