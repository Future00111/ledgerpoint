import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import pg from 'pg';
import { pool } from '@workspace/db';
import { createAuditReviewRouter } from '../../routes/auditReview';
import { saveConfiguration, addPeriod } from '../accountingDocuments/configuration';
import { saveDocument } from '../accountingDocuments/documents';
import { postDocument } from '../accountingDocuments/posting';
import { savePaymentConfiguration, previewPayment, postPayment } from '../accountingDocuments/payments';
import { saveAccount } from '../accountingDocuments/chart';
import { reviewCorrection, commitCorrection } from '../accountingDocuments/corrections';

// This suite may only connect to the disposable Unix-socket test database.
const socket = process.env.ACCOUNTING_FLOW_TEST_SOCKET ?? '';
if (!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]+\/socket$/.test(socket)) throw Error('Disposable socket required');
const admin = new pg.Pool({ host: socket, port: 55441, user: 'w03_bootstrap', database: 'ledgerly_accounting_flow_test', password: '', ssl: false, options: '' });
let server: ReturnType<ReturnType<typeof express>['listen']>, base: string;
const logs: unknown[] = [];
before(async () => {
  assert.deepEqual((await pool.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0], { db: 'ledgerly_accounting_flow_test', role: 'ledgerly_api', addr: null });
  const app = express();
  app.use((req, _res, next) => { (req as any).log = { error: (...args: unknown[]) => logs.push(args) }; next(); });
  app.use('/companies/:companyId', createAuditReviewRouter((req, res, next) => {
    const actor = req.get('x-test-actor'); if (!actor) { res.sendStatus(401); return; } (req as any).userId = actor; next();
  }));
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await pool.end(); await admin.end(); });
async function request(company: string, actor?: string, query: Record<string, string> = {}, csv = false, method = 'GET', headers: Record<string, string> = {}) {
  const response = await fetch(`${base}/companies/${company}/audit-events${csv ? '/export.csv' : ''}?${new URLSearchParams(query)}`, { method, headers: { ...(actor ? { 'x-test-actor': actor } : {}), ...headers } });
  const body = await response.text();
  return { status: response.status, headers: response.headers, text: body, data: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(body) : null };
}
async function member(company: string, actor: string, role: string | null = 'owner', active: boolean | null = true) {
  await admin.query('INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,$4,$5)', [randomUUID(), company, actor, role, active]);
}
async function fixture() {
  const company = randomUUID(), actor = 'synthetic-audit-' + randomUUID();
  await admin.query("INSERT INTO companies(id,name,country,base_currency,vat_registered,vat_scheme,vat_accounting_basis,status) VALUES($1,'Synthetic audit fixture','GB','GBP',false,'standard','invoice','active')", [company]);
  await member(company, actor); return { company, actor };
}
async function syntheticDocument(f: { company: string; actor: string }, number = 'SYNTH-AUDIT') {
  const id = randomUUID();
  await admin.query(`INSERT INTO accounting_document_sources(id,company_id,kind,number,revision,status,source,party_id,purchase_vat_eligible,money,tax_context,posting_accounts,mapping_revision)
    VALUES($1,$2,'sales_invoice',$3,$4,'draft',$5,$6,false,'{}','{}','{}',$7)`, [id, f.company, number, randomUUID(), { invoice_number: number, notes: 'PRIVATE SOURCE BODY' }, randomUUID(), randomUUID()]);
  return id;
}
async function event(f: { company: string; actor: string }, document: string, id = randomUUID(), time = '2026-01-01T10:00:00.123456Z', action = 'create', number = 'SYNTH-AUDIT') {
  await admin.query('INSERT INTO accounting_document_audit(id,company_id,document_id,actor_id,action,before_source,after_source,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, f.company, document, f.actor, action, { notes: 'PRIVATE BEFORE' }, { invoice_number: number, notes: 'PRIVATE SOURCE BODY', provider_error: 'SECRET PROVIDER TOKEN' }, time]);
  return 'documents:' + id;
}
const range = { from: '2026-01-01', to: '2026-12-31' };

test('real native draft, posted, payment and other existing audit sources are projected with verified links only', async () => {
  const f = await fixture(), customer = randomUUID();
  await admin.query("INSERT INTO customers(id,company_id,name,status) VALUES($1,$2,'Synthetic customer','active')", [customer, f.company]);
  const mappings: Record<string, string> = {}, paymentMappings: Record<string, string> = {};
  for (const [role, type] of [['receivables', 'asset'], ['payables', 'liability'], ['revenue', 'income'], ['expense', 'expense'], ['output_vat', 'liability'], ['input_vat', 'asset'], ['bank', 'asset'], ['customer_credit', 'liability'], ['supplier_prepayment', 'asset']]) {
    const id = randomUUID(); (['bank', 'customer_credit', 'supplier_prepayment'].includes(role!) ? paymentMappings : mappings)[role!] = id;
    await admin.query('INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,$3,$3,$4,true)', [id, f.company, role, type]);
  }
  await saveConfiguration(f.company, f.actor, { revision: null, mappings, business_accounting_basis: 'accrual' });
  await addPeriod(f.company, f.actor, { start_date: '2026-01-01', end_date: '2026-12-31', financial_year_label: 'Synthetic audit year' });
  await admin.query("INSERT INTO vat_tax_rules(id,company_id,code,label,rate,treatment,effective_from,is_active) VALUES($1,$2,'NO_VAT','Not VAT registered',0,'no_vat','2011-01-04',true)", [randomUUID(), f.company]);
  const doc = await saveDocument(f.company, f.actor, { kind: 'sales_invoice', purchase_vat_eligible: false, source: {
    contract: 'w03.draft.v1', currency: 'GBP', price_basis: 'including_vat', customer_id: customer, invoice_number: 'SYNTH-NATIVE-AUDIT', issue_date: '2026-10-21', due_date: '2026-10-21', payment_terms: 0, reference: '', notes: 'PRIVATE SOURCE BODY', line_items: [{ description: 'Synthetic supply', quantity: '1', unit_price: '120', tax_code: 'NO_VAT' }],
  } });
  await postDocument(f.company, f.actor, doc.id, doc.revision);
  await savePaymentConfiguration(f.company, f.actor, { revision: null, mappings: paymentMappings });
  const intent = { id: randomUUID(), kind: 'payment', party_type: 'customer', party_id: customer, payment_id: null, date: '2026-10-21', reference: 'SYNTH PAYMENT', amount_minor: '5000', allocations: [{ document_id: doc.id, amount_minor: '5000' }] };
  const preview = await previewPayment(f.company, f.actor, intent);
  await postPayment(f.company, f.actor, { ...intent, review_token: preview.review_token });
  await saveAccount(f.company, f.actor, { code: '991', name: 'Synthetic review account', account_type: 'expense', is_active: true });
  const capture = randomUUID();
  await admin.query(`INSERT INTO document_intake_sources(id,company_id,revision,sha256,media_type,filename,byte_length,content,channel,created_by)
    VALUES($1,$2,$3,$4,'application/pdf','synthetic.pdf',5,$5,'upload',$6)`, [capture, f.company, randomUUID(), '1'.repeat(64), Buffer.from('%PDF-'), f.actor]);
  await admin.query("INSERT INTO document_intake_audit(id,company_id,source_id,actor_id,action) VALUES($1,$2,$3,$4,'upload')", [randomUUID(), f.company, capture, f.actor]);
  await admin.query("INSERT INTO supplier_credit_claim_commands(company_id,request_id,actor_id,action,request_hash,claim_ids,result) VALUES($1,$2,$3,'cancel','SECRET HASH','[]',$4)", [f.company, randomUUID(), f.actor, { secret: 'SECRET RESULT' }]);
  await admin.query(`INSERT INTO w03_invoice_draft_audit(id,company_id,invoice_id,actor_id,actor_role,operation,after_revision,after_source,tax_context,tax_context_revision,request_id)
    VALUES($1,$2,$3,$4,'owner','create',$5,$6,'{}','SECRET REVISION',$7)`, [randomUUID(), f.company, doc.id, f.actor, randomUUID(), { invoice_number: 'SYNTH EARLIER', secret: 'PRIVATE LEGACY BODY' }, randomUUID()]);
  const result = await request(f.company, f.actor);
  assert.equal(result.status, 200, result.text);
  assert.deepEqual([...new Set(result.data.data.items.map((row: any) => row.category))].sort(), ['capture', 'chart', 'credit_tracking', 'documents', 'ledger', 'legacy_drafts', 'payment_setup', 'payments']);
  const posted = result.data.data.items.find((row: any) => row.category === 'documents' && row.action === 'post');
  assert.equal(posted.resource_id, doc.id); assert.ok(posted.journal_id);
  const payment = result.data.data.items.find((row: any) => row.category === 'payments');
  assert.equal(payment.resource_id, intent.id); assert.ok(payment.journal_id);
  assert.equal(result.data.data.items.find((row: any) => row.category === 'capture').resource_id, capture);
  for (const secret of ['PRIVATE SOURCE BODY', 'SECRET HASH', 'SECRET RESULT', 'SECRET REVISION', 'PRIVATE LEGACY BODY', 'request_hash', 'tax_context', 'before_source', 'after_source']) assert.equal(result.text.includes(secret), false, secret);
  const csv = await request(f.company, f.actor, {}, true); assert.equal(csv.status, 200, csv.text);
  assert.equal(csv.headers.get('cache-control'), 'no-store'); assert.equal(csv.headers.get('x-audit-company'), f.company);
  assert.equal(Number(csv.headers.get('x-audit-count')), result.data.data.items.length);

  // Real protected correction of a partially paid invoice must expose both
  // existing audit records, each linking to the original document. The ledger
  // record links to its new correction journal, never the original posting.
  const correction = await reviewCorrection(f.company, f.actor, doc.id, doc.revision, {
    request_id: randomUUID(), reason: 'Correct the agreed synthetic price', effective_date: '2026-10-22',
    line_items: [{ quantity: '1', unit_price: '110' }],
  });
  const receipt = await commitCorrection(f.company, f.actor, doc.id, doc.revision, { ...correction.intent, review_token: correction.review_token });
  assert.equal(receipt.status, 'posted'); assert.notEqual(receipt.journal_id, posted.journal_id);
  const corrected = await request(f.company, f.actor, { action: 'correction', q: 'SYNTH-NATIVE-AUDIT' });
  assert.equal(corrected.status, 200, corrected.text);
  const rows = corrected.data.data.items;
  assert.equal(rows.length, 2); assert.deepEqual(rows.map((row: any) => row.category).sort(), ['documents', 'ledger']);
  for (const row of rows) {
    assert.equal(row.resource_kind, 'sales_invoice'); assert.equal(row.resource_id, doc.id);
    assert.equal(row.reference, 'SYNTH-NATIVE-AUDIT'); assert.equal(row.actor_id, f.actor);
  }
  const correctedDocument = rows.find((row: any) => row.category === 'documents');
  assert.equal(correctedDocument.label, 'Document corrected'); assert.equal(correctedDocument.journal_id, null);
  assert.ok(correctedDocument.changed_fields.includes('line_items'));
  const correctedJournal = rows.find((row: any) => row.category === 'ledger');
  assert.equal(correctedJournal.label, 'Journal correction recorded'); assert.equal(correctedJournal.journal_id, receipt.journal_id);
  assert.equal(correctedJournal.reason, correction.intent.reason);
  for (const category of ['documents', 'ledger']) {
    const filtered = await request(f.company, f.actor, { action: 'correction', category });
    assert.equal(filtered.status, 200, filtered.text); assert.equal(filtered.data.data.items.length, 1);
    assert.equal(filtered.data.data.items[0].category, category);
  }
  const correctedCsv = await request(f.company, f.actor, { action: 'correction' }, true);
  assert.equal(correctedCsv.status, 200, correctedCsv.text); assert.equal(correctedCsv.headers.get('x-audit-count'), '2');
  assert.ok(correctedCsv.text.includes('Document corrected')); assert.ok(correctedCsv.text.includes('Journal correction recorded'));
  assert.ok(correctedCsv.text.includes(receipt.journal_id)); assert.equal(correctedCsv.text.includes('PRIVATE SOURCE BODY'), false);
  assert.equal(corrected.text.includes('PRIVATE SOURCE BODY'), false);
  const stillPosted = await request(f.company, f.actor, { category: 'documents', action: 'post' });
  assert.equal(stillPosted.data.data.items[0].journal_id, posted.journal_id);
});

test('keyset pagination retains microseconds and source tie-breakers, and rechecks access on every page', async () => {
  const f = await fixture(), doc = await syntheticDocument(f), same = randomUUID();
  const expected = [await event(f, doc, same), await event(f, doc, randomUUID(), '2026-01-01T10:00:00.123457Z'), await event(f, doc, randomUUID(), '2026-01-01T10:00:00.123455Z')];
  await admin.query("INSERT INTO accounting_payment_config_audit(id,company_id,actor_id,after_config,created_at) VALUES($1,$2,$3,'{}','2026-01-01T10:00:00.123456Z')", [same, f.company, f.actor]);
  expected.push('payment_setup:' + same);
  let cursor: string | null = null, firstCursor = '', asOf = ''; const seen: string[] = [], times: string[] = [];
  do {
    const page: any = await request(f.company, f.actor, { ...range, limit: '1', ...(cursor ? { cursor } : {}) });
    assert.equal(page.status, 200, page.text); const data = page.data.data;
    if (!asOf) asOf = data.as_of; else assert.equal(data.as_of, asOf);
    seen.push(...data.items.map((row: any) => row.event_key)); times.push(...data.items.map((row: any) => row.occurred_at));
    cursor = data.next_cursor; if (!firstCursor) firstCursor = cursor!;
  } while (cursor);
  assert.deepEqual(seen, [expected[1], expected[3], expected[0], expected[2]]);
  assert.deepEqual(times, ['2026-01-01T10:00:00.123457Z', '2026-01-01T10:00:00.123456Z', '2026-01-01T10:00:00.123456Z', '2026-01-01T10:00:00.123455Z']);
  const other = await fixture(); await member(other.company, f.actor);
  for (const [company, query] of [[other.company, { ...range, cursor: firstCursor }], [f.company, { ...range, cursor: firstCursor, q: 'changed' }]] as const)
    assert.equal((await request(company, f.actor, query)).data.error.code, 'INVALID_AUDIT_CURSOR');
  await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2', [f.company, f.actor]);
  assert.equal((await request(f.company, f.actor, { ...range, cursor: firstCursor })).status, 403);
  assert.equal((await request(f.company, f.actor, range, true)).status, 403);
});

test('tenant, membership, header and method boundaries fail closed without read-triggered writes', async () => {
  const f = await fixture(), other = await fixture(), own = await syntheticDocument(f, 'OWN RECORD'), foreign = await syntheticDocument(other, 'FOREIGN RECORD');
  await event(f, own, randomUUID(), undefined, 'create', 'OWN RECORD');
  // Even malformed historical cross-company audit references must not expose their target.
  await event(f, foreign, randomUUID(), undefined, 'create', 'FOREIGN RECORD');
  const visible = await request(f.company, f.actor); assert.equal(visible.status, 200, visible.text); assert.equal(visible.data.data.items.length, 1); assert.equal(visible.text.includes('FOREIGN RECORD'), false);
  for (const role of ['owner', 'admin', 'accountant']) {
    const actor = 'synthetic-role-' + randomUUID(); await member(f.company, actor, role);
    assert.equal((await request(f.company, actor)).status, 200); assert.equal((await request(f.company, actor, {}, true)).status, 200);
  }
  const denied = [other.actor];
  for (const role of ['staff', 'member', 'read_only', 'unknown', null]) { const actor = 'synthetic-denied-' + randomUUID(); await member(f.company, actor, role); denied.push(actor); }
  for (const active of [false, null]) { const actor = 'synthetic-inactive-' + randomUUID(); await member(f.company, actor, 'owner', active); denied.push(actor); }
  const duplicate = 'synthetic-duplicate-' + randomUUID(); await member(f.company, duplicate); await member(f.company, duplicate, 'accountant', false); denied.push(duplicate);
  for (const actor of denied) { assert.equal((await request(f.company, actor)).status, 403); assert.equal((await request(f.company, actor, {}, true)).status, 403); }
  assert.equal((await request(f.company)).status, 401);
  assert.equal((await request(f.company, f.actor, {}, false, 'GET', { 'x-company-id': other.company })).status, 400);
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) assert.equal((await request(f.company, f.actor, {}, false, method)).status, 404);
  assert.equal((await admin.query('SELECT count(*)::int n FROM accounting_document_audit WHERE company_id=$1', [f.company])).rows[0].n, 2);
  assert.equal(JSON.stringify(logs).includes('PRIVATE'), false);
});

test('correction, date and literal search filters work; CSV formula sanitisation and export cap are explicit', async () => {
  const f = await fixture(), doc = await syntheticDocument(f);
  await event(f, doc, randomUUID(), '2026-01-01T23:59:59.999999Z', 'correct', 'SYNTH%_MATCH');
  await event(f, doc, randomUUID(), '2026-01-02T00:00:00.000000Z', 'create', '\t=UNSAFE()');
  const corrected = await request(f.company, f.actor, { from: '2026-01-01', to: '2026-01-01', action: 'correction' });
  assert.equal(corrected.status, 200, corrected.text); assert.equal(corrected.data.data.items.length, 1);
  assert.equal(corrected.data.data.items[0].label, 'Document corrected'); assert.equal(corrected.data.data.items[0].journal_id, null);
  assert.equal((await request(f.company, f.actor, { q: '%_' })).data.data.items.length, 1);
  const csv = await request(f.company, f.actor, { from: '2026-01-02', to: '2026-01-02' }, true);
  assert.equal(csv.status, 200, csv.text); assert.ok(csv.text.includes('"\' =UNSAFE()"')); assert.equal(csv.text.includes('\t'), false);
  await admin.query(`INSERT INTO accounting_document_audit(id,company_id,document_id,actor_id,action,after_source,created_at)
    SELECT gen_random_uuid(),$1,$2,$3,'edit','{"invoice_number":"BULK"}'::jsonb,'2026-02-01T00:00:00Z' FROM generate_series(1,1001)`, [f.company, doc, f.actor]);
  const over = await request(f.company, f.actor, range, true); assert.equal(over.status, 409, over.text); assert.equal(over.data.error.code, 'AUDIT_EXPORT_LIMIT');
  assert.equal((await request(f.company, f.actor, { from: '2026-01-01', to: '2026-01-01' }, true)).status, 200);
  assert.equal((await request(f.company, f.actor, { limit: '101' })).status, 400);
  assert.equal((await request(f.company, f.actor, { cursor: 'invalid' })).status, 400);
});
