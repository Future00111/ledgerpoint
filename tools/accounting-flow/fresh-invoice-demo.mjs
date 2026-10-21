/** Owner-requested clean demo. Copy setup, preserve prior posted history intact. */
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { realpathSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { root } from './schema.mjs';
const require = createRequire(root + '/artifacts/api-server/package.json');
const { Client } = require('pg');
if (process.env.NODE_ENV !== 'development' || process.env.W03_INVOICE_DEMO_MODE !== '1') throw Error('Explicit isolated development mode required');
const original = process.argv[2];
if (!original || !/^[0-9a-f-]{36}$/i.test(original)) throw Error('Pass the existing Willow synthetic company ID');
const name = 'Willow & Co — CLEAN DEMO (synthetic)';
const previousName = 'Willow & Co — PREVIOUS DEMO (synthetic)';
const marker = path.join(root, '.local/share/ledgerly/demo/clean-invoice-demo.json');
if (existsSync(marker)) throw Error('Clean demo already recorded; no repeat reset');
const q = new Client({ host: '/tmp/ledgerly-w03-invoice-demo/socket', port: 55440, database: 'ledgerly_w03_invoice_demo', user: 'w03_bootstrap', password: '', ssl: false, options: '', connectionTimeoutMillis: 5000 });
const financialTables = ['accounting_document_sources', 'canonical_journal_entries', 'canonical_journal_lines', 'accounting_payment_events'];
async function fingerprint(company) {
  const result = {};
  for (const table of financialTables) {
    const rows = (await q.query(`SELECT row_to_json(t) value FROM ${table} t WHERE company_id=$1 ORDER BY id`, [company])).rows;
    result[table] = { count: rows.length, hash: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
  }
  return result;
}
await q.connect();
let result;
try {
  const i = (await q.query("SELECT current_database() db,current_user actor,inet_server_addr() addr,current_setting('data_directory') data")).rows[0];
  if (i.db !== 'ledgerly_w03_invoice_demo' || i.actor !== 'w03_bootstrap' || i.addr !== null || realpathSync(i.data) !== realpathSync(path.join(root, '.local/share/ledgerly/demo/data'))) throw Error('Wrong persistent isolated demo');
  await q.query('BEGIN');
  const source = (await q.query('SELECT * FROM companies WHERE id=$1 FOR UPDATE', [original])).rows[0];
  if (source?.name !== 'Willow & Co — DEMO (synthetic)' || source.country !== 'GB' || source.base_currency !== 'GBP' || source.vat_registered !== true || source.vat_scheme !== 'standard' || source.vat_accounting_basis !== 'invoice') throw Error('Unexpected source demo');
  if ((await q.query('SELECT 1 FROM companies WHERE name=$1', [name])).rowCount) throw Error('Clean demo already exists');
  const owners = (await q.query("SELECT user_id FROM company_users WHERE company_id=$1 AND is_active=true AND role='owner'", [original])).rows;
  if (owners.length !== 1) throw Error('Expected one active owner');
  const before = await fingerprint(original);
  const company = randomUUID();
  await q.query(`INSERT INTO companies(id,name,country,base_currency,vat_registered,vat_scheme,vat_accounting_basis,financial_year_end,business_type,status)
    VALUES($1,$2,'GB','GBP',true,'standard','invoice',$3,$4,'active')`, [company, name, source.financial_year_end, source.business_type]);
  await q.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'owner',true)", [randomUUID(), company, owners[0].user_id]);
  const accounts = new Map();
  const chart = (await q.query('SELECT * FROM chart_of_accounts WHERE company_id=$1 ORDER BY code,id', [original])).rows;
  for (const a of chart) {
    const id = randomUUID(); accounts.set(a.id, id);
    await q.query('INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,account_subtype,description,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, company, a.code, a.name, a.account_type, a.account_subtype, a.description, a.is_active]);
  }
  for (const a of (await q.query('SELECT * FROM accounting_account_presentation WHERE company_id=$1', [original])).rows) {
    if (!accounts.has(a.account_id)) throw Error('Missing presentation account');
    await q.query('INSERT INTO accounting_account_presentation(account_id,company_id,report_group,display_order) VALUES($1,$2,$3,$4)', [accounts.get(a.account_id), company, a.report_group, a.display_order]);
  }
  const remap = mappings => Object.fromEntries(Object.entries(mappings).map(([key, id]) => { if (!accounts.has(id)) throw Error('Missing configured account'); return [key, accounts.get(id)]; }));
  const config = (await q.query('SELECT * FROM accounting_company_configuration WHERE company_id=$1', [original])).rows[0];
  if (config?.business_accounting_basis !== 'accrual') throw Error('Missing accrual setup');
  await q.query("INSERT INTO accounting_company_configuration(company_id,revision,business_accounting_basis,mappings) VALUES($1,$2,'accrual',$3)", [company, randomUUID(), remap(config.mappings)]);
  const payment = (await q.query('SELECT * FROM accounting_payment_configuration WHERE company_id=$1', [original])).rows[0];
  if (payment) await q.query('INSERT INTO accounting_payment_configuration(company_id,revision,mappings) VALUES($1,$2,$3)', [company, randomUUID(), remap(payment.mappings)]);
  const periods = (await q.query('SELECT *,start_date::text,end_date::text FROM accounting_document_periods WHERE company_id=$1', [original])).rows;
  for (const p of periods) await q.query('INSERT INTO accounting_document_periods(id,company_id,financial_year_id,start_date,end_date,status) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), company, p.financial_year_id, p.start_date, p.end_date, p.status]);
  const tax = (await q.query('SELECT *,effective_from::text,effective_to::text FROM vat_tax_rules WHERE company_id=$1', [original])).rows;
  for (const t of tax) await q.query('INSERT INTO vat_tax_rules(id,company_id,code,label,rate,treatment,effective_from,effective_to,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [randomUUID(), company, t.code, t.label, t.rate, t.treatment, t.effective_from, t.effective_to, t.is_active]);
  const parties = {};
  for (const table of ['customers', 'suppliers']) {
    parties[table] = [];
    for (const p of (await q.query(`SELECT name,status,payment_terms FROM ${table} WHERE company_id=$1 ORDER BY name`, [original])).rows) {
      const id = randomUUID();
      await q.query(`INSERT INTO ${table}(id,company_id,name,status,payment_terms) VALUES($1,$2,$3,$4,$5)`, [id, company, p.name, p.status, p.payment_terms]);
      parties[table].push({ id, name: p.name });
    }
  }
  await q.query('UPDATE companies SET name=$2,updated_at=now() WHERE id=$1', [original, previousName]);
  const after = await fingerprint(original), clean = await fingerprint(company);
  if (JSON.stringify(before) !== JSON.stringify(after) || Object.values(clean).some(v => v.count !== 0)) throw Error('Unexpected financial records');
  result = { previous: { id: original, name: previousName, records: before }, company: { id: company, name }, parties, clean, setup: { accounts: chart.length, taxRules: tax.length, periods: periods.length }, syntheticOnly: true, created: new Date().toISOString() };
  await q.query('COMMIT');
} catch (error) { await q.query('ROLLBACK'); throw error; }
finally { await q.end(); }
writeFileSync(marker, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify(result));
