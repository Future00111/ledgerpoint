import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import pg from 'pg';
import { pool } from '@workspace/db';
import { createAccountingRouter } from '../../routes/accountingDocuments';
import { buildVatCoverage } from './vatCoverage';

const socket = process.env.ACCOUNTING_FLOW_TEST_SOCKET ?? '';
if (!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]+\/socket$/.test(socket)) throw Error('Disposable socket required');
const admin = new pg.Pool({ host: socket, port: 55441, user: 'w03_bootstrap', database: 'ledgerly_accounting_flow_test',
  password: () => '', ssl: false, options: '-c timezone=UTC' });
const actor = 'synthetic-vat-coverage-owner', reader = 'synthetic-vat-coverage-reader';
let server: ReturnType<ReturnType<typeof express>['listen']>, base: string;
before(async () => {
  assert.deepEqual((await pool.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0],
    { db: 'ledgerly_accounting_flow_test', role: 'ledgerly_api', addr: null });
  const app = express(); app.use(express.json());
  app.use('/companies/:companyId', createAccountingRouter((req, res, next) => {
    const user = req.get('x-test-actor'); if (!user) { res.sendStatus(401); return; }
    (req as any).userId = user; next();
  }));
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end(); await admin.end();
});
async function request(company: string, path: string, method = 'GET', body?: unknown, revision?: string, user: string | null = actor) {
  const response = await fetch(`${base}/companies/${company}${path}`, { method, headers: {
    ...(user ? { 'x-test-actor': user } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(revision ? { 'If-Match': `"${revision}"` } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const raw = await response.text();
  return { status: response.status, ...(raw && raw.startsWith('{') ? JSON.parse(raw) : {}) } as any;
}
async function fixture(vat = true) {
  const company = randomUUID(), customer = randomUUID(), supplier = randomUUID();
  await admin.query(`INSERT INTO companies(id,name,country,base_currency,vat_registered,vat_scheme,vat_accounting_basis,status)
    VALUES($1,'Synthetic VAT coverage','GB','GBP',$2,'standard','invoice','active')`, [company, vat]);
  for (const [user, role] of [[actor, 'owner'], [reader, 'read_only']]) await admin.query(
    'INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,$4,true)', [randomUUID(), company, user, role]);
  await admin.query("INSERT INTO customers(id,company_id,name,status) VALUES($1,$2,'Synthetic VAT customer','active')", [customer, company]);
  await admin.query("INSERT INTO suppliers(id,company_id,name,status) VALUES($1,$2,'Synthetic VAT supplier','active')", [supplier, company]);
  const mappings: Record<string, string> = {};
  for (const [role, type] of [['receivables', 'asset'], ['payables', 'liability'], ['revenue', 'income'], ['expense', 'expense'], ['output_vat', 'liability'], ['input_vat', 'asset']]) {
    const id = randomUUID(); mappings[role!] = id;
    await admin.query('INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,$3,$3,$4,true)', [id, company, role, type]);
  }
  assert.equal((await request(company, '/accounting-configuration', 'PUT', { revision: null, mappings, business_accounting_basis: 'accrual' })).status, 200);
  assert.equal((await request(company, '/accounting-periods', 'POST', { start_date: '2026-01-01', end_date: '2026-12-31', financial_year_label: 'Synthetic 2026' })).status, 201);
  for (const [code, rate, treatment] of [['STANDARD', '20', 'standard'], ['REDUCED', '5', 'reduced'], ['ZERO', '0', 'zero'],
    ['EXEMPT', '0', 'exempt'], ['OUTSIDE', '0', 'outside_scope'], ['NO_VAT', '0', 'no_vat']]) await admin.query(
    `INSERT INTO vat_tax_rules(id,company_id,code,label,rate,treatment,effective_from,is_active)
      VALUES($1,$2,$3,$3,$4,$5,'2026-01-01',true)`, [randomUUID(), company, code, rate, treatment]);
  return { company, customer, supplier };
}
function source(party: string, basis = 'excluding_vat', codes = ['STANDARD', 'REDUCED', 'ZERO', 'EXEMPT', 'OUTSIDE']) {
  return { contract: 'w03.draft.v1', currency: 'GBP', price_basis: basis, customer_id: party, invoice_number: `SYN-VAT-${randomUUID()}`,
    issue_date: '2026-10-10', due_date: '2026-10-10', payment_terms: 0, reference: '', notes: 'Synthetic VAT coverage fixture',
    line_items: codes.map(tax_code => ({ description: tax_code, quantity: '1', unit_price: '100', tax_code })) };
}
async function postNew(f: any, kind: string, value: any, extra: any = {}) {
  const saved = await request(f.company, '/accounting-documents', 'POST', { kind, source: value,
    purchase_vat_eligible: kind === 'purchase_bill', ...extra });
  assert.equal(saved.status, 201, JSON.stringify(saved));
  const posted = await request(f.company, `/accounting-documents/${saved.data.id}/post`, 'POST', {}, saved.data.revision);
  assert.equal(posted.status, 200, JSON.stringify(posted)); return saved.data;
}
async function credit(f: any, original: any) {
  return postNew(f, original.kind === 'sales_invoice' ? 'sales_credit_note' : 'supplier_credit_note', {
    ...original.source, invoice_number: `SYN-VAT-CREDIT-${randomUUID()}`, issue_date: '2026-10-25', due_date: '2026-10-25',
    line_items: original.source.line_items.map((line: any) => ({ ...line, quantity: '0.1' })),
  }, { original_id: original.id, reason: 'Synthetic source-linked partial return', adjustment_method: 'offset_outstanding',
    effective_adjustment_date: '2026-10-25', original_line_refs: original.source.line_items.map((_line: any, index: number) => index) });
}
const reportPath = '/accounting-reports?from=2026-10-01&to=2026-10-31';

test('native mixed treatments, inclusive purchases, linked credits and nonrecoverable VAT reconcile all covered boxes', async () => {
  const f = await fixture();
  const sale = await postNew(f, 'sales_invoice', source(f.customer));
  const purchase = await postNew(f, 'purchase_bill', source(f.supplier, 'including_vat'));
  await postNew(f, 'purchase_bill', source(f.supplier, 'excluding_vat', ['STANDARD']), { purchase_vat_eligible: false });
  const salesCredit = await credit(f, sale), supplierCredit = await credit(f, purchase);
  assert.deepEqual([sale.money.net_pence, sale.money.vat_pence], ['50000', '2500']);
  assert.deepEqual([purchase.money.net_pence, purchase.money.vat_pence], ['47857', '2143']);
  assert.deepEqual([supplierCredit.money.net_pence, supplierCredit.money.vat_pence], ['4785', '215']);
  assert.equal(salesCredit.tax_context.original_document_id, sale.id);
  const report = await request(f.company, reportPath, 'GET', undefined, undefined, reader);
  assert.equal(report.status, 200, JSON.stringify(report));
  assert.deepEqual(['box1_pence', 'box4_pence', 'box5_pence', 'box6_pence', 'box7_pence'].map(key => report.data.vat[key]),
    ['2250', '1928', '322', '45000', '53072']);
  const coverage = buildVatCoverage({ from: report.data.from, to: report.data.to, vat: report.data.vat, movements: report.data.posted_documents });
  assert.deepEqual(report.data.vat_coverage, coverage);
  assert.equal(coverage.filing_ready, false); assert.equal(coverage.movement_count, 5);
  assert.ok(coverage.boxes.filter(box => box.status === 'unsupported').every(box => box.amount_pence === null));
  const historical = await request(f.company, '/accounting-reports?from=2026-10-01&to=2026-10-20');
  assert.equal(historical.status, 200);
  assert.equal(historical.data.vat.box1_pence, '2500'); assert.equal(historical.data.vat.box4_pence, '2143');
  assert.equal(historical.data.vat_coverage.movement_count, 3);
});

test('non-VAT native documents report not-applicable instead of a reconciled filing-ready return', async () => {
  const f = await fixture(false);
  await postNew(f, 'sales_invoice', source(f.customer, 'excluding_vat', ['NO_VAT']));
  const report = await request(f.company, reportPath);
  assert.equal(report.status, 200, JSON.stringify(report));
  assert.equal(report.data.vat_coverage.status, 'not_applicable');
  assert.equal(report.data.vat_coverage.filing_ready, false); assert.deepEqual(report.data.vat_coverage.boxes, []);
});

test('unsupported VAT setups and foreign or missing actors cannot obtain apparently reconciled workings', async () => {
  const f = await fixture();
  assert.equal((await request(f.company, reportPath, 'GET', undefined, undefined, 'synthetic-unrelated-user')).status, 404);
  assert.equal((await request(f.company, reportPath, 'GET', undefined, undefined, null)).status, 401);
  await admin.query("UPDATE companies SET vat_accounting_basis='cash' WHERE id=$1", [f.company]);
  const report = await request(f.company, reportPath);
  assert.equal(report.status, 422); assert.equal(report.error.code, 'VAT_SETUP_UNSUPPORTED');
  assert.equal(report.data, undefined);
});
