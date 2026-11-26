import test from 'node:test';
import assert from 'node:assert/strict';
import { requestScope } from './model.mjs';
import { canExportTax, TAX_CSV_HEADER, TAX_CSV_FILENAME, validateTaxCsv, downloadTaxCsv, requestTaxDownload } from './taxExport.mjs';
import { createTaxPreparationsClient, TaxPreparationsError } from './taxClient.mjs';
const company = '12345678-1234-4234-8234-123456789abc', id = '12345678-1234-4234-8234-123456789abd';
const record = { id, tax_year_start: 2026, employment_income_pence: '9007199254740993', currency: 'GBP' };
const csv = `${TAX_CSV_HEADER}2026,9007199254740993,GBP\r\n`;
const nativeHeaders = { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${TAX_CSV_FILENAME}"`,
  'cache-control': 'no-store', 'x-personal-tax-company': company, 'x-personal-tax-record': id };
const response = (body = csv, status = 200, changes = {}) => ({ status, headers: new Headers({ ...nativeHeaders, ...changes }), text: async () => body });

test('export is available only to owner/preparer and preserves exact bigint pence in a single fixed numeric row', () => {
  for (const role of ['owner', 'personal_tax_preparer']) assert.equal(canExportTax(role), true);
  for (const role of ['personal_tax_submitter', 'admin', 'accountant', 'staff', 'member', 'read_only', 'payroll_preparer', 'payroll_reader', 'payroll_approver', null, {}, ['owner']]) assert.equal(canExportTax(role), false);
  for (const [year, amount] of [[1, '0'], [2026, '9007199254740993'], [9998, '9223372036854775807']]) {
    const value = `${TAX_CSV_HEADER}${year},${amount},GBP\r\n`;
    assert.equal(validateTaxCsv(value, { ...record, tax_year_start: year, employment_income_pence: amount }), value);
  }
});

test('CSV validation refuses extra rows, free text, formulas, unexpected identifiers, scope values and lossy monetary syntax', () => {
  for (const value of ['', '\uFEFF' + csv, csv + '\n', csv + '\r\n', csv + '2027,1,GBP\r\n', csv.replaceAll('\r\n', '\n'),
    csv.replace('2026,', '02026,'), csv.replace('2026,', '2025,'), csv.replace('9007199254740993', '9007199254740992'),
    csv.replace('9007199254740993', '=SUM(1)'), csv.replace('9007199254740993', '+1'), csv.replace('9007199254740993', '1.0'),
    csv.replace('9007199254740993', '01'), csv.replace('9007199254740993', '9223372036854775808'), csv.replace('GBP', 'USD'),
    csv.replace('currency', 'taxpayer_id'), csv.replace(',GBP', ',GBP,private-taxpayer'), 'x'.repeat(129), null, {}]) assert.throws(() => validateTaxCsv(value, record));
  assert.throws(() => validateTaxCsv(csv, { ...record, currency: 'USD' }));
});

test('export fetch is same-origin authenticated no-store GET with cancellation, exact scope and fixed response validation', async () => {
  const calls = [], signal = new AbortController().signal;
  const client = createTaxPreparationsClient(async (url, options) => { calls.push({ url, options }); return response(); });
  assert.equal(await client.exportCsv(company.toUpperCase(), record, 'personal_tax_preparer', signal), csv);
  assert.deepEqual(calls, [{ url: `/api/companies/${company}/personal-tax-preparations/${id}/export.csv`, options: {
    method: 'GET', credentials: 'include', cache: 'no-store', redirect: 'error', signal,
  } }]);
  await assert.rejects(client.exportCsv(company, record, 'personal_tax_submitter'), error => error.status === 403); assert.equal(calls.length, 1);
  await assert.rejects(client.exportCsv('not-company', record, 'owner'), error => error.status === 0); assert.equal(calls.length, 1);
});

test('export refuses malformed/proxy/cross-scope responses and keeps raw errors or denial bodies unread', async () => {
  for (const [name, value] of [['content-type', 'text/html'], ['content-disposition', 'attachment; filename="private-taxpayer.csv"'],
    ['cache-control', 'public'], ['x-personal-tax-company', id], ['x-personal-tax-record', company]]) {
    const client = createTaxPreparationsClient(async () => response(csv, 200, { [name]: value }));
    await assert.rejects(client.exportCsv(company, record, 'owner'), error => error instanceof TaxPreparationsError && error.status === 0);
  }
  for (const fetcher of [async () => response(csv + 'private'), async () => { throw Error('private income diagnostic'); },
    async () => ({ status: 200, headers: new Headers(), text() { throw Error('bad headers must prevent reading body'); } })]) {
    await assert.rejects(createTaxPreparationsClient(fetcher).exportCsv(company, record, 'owner'), error => error.status === 0 && error.message === 'The tax input request could not be completed.');
  }
  for (const status of [201, 204, 304, 400, 401, 403, 409, 503]) {
    const client = createTaxPreparationsClient(async () => ({ status, text() { throw Error('private body must not be read'); } }));
    await assert.rejects(client.exportCsv(company, record, 'owner'), error => error.status === status && error.message === 'The tax input request could not be completed.');
  }
});

function fakeDownloadEnvironment(clickFailure = false) {
  const calls = [], timers = [];
  const link = { click() { calls.push(['click', this.download, this.href]); if (clickFailure) throw Error('Synthetic click failure'); }, remove() { calls.push(['remove']); } };
  return { calls, timers, environment: { Blob: class { constructor(parts, options) { calls.push(['blob', parts, options]); } },
    URL: { createObjectURL() { calls.push(['create-url']); return 'blob:synthetic'; }, revokeObjectURL(url) { calls.push(['revoke', url]); } },
    document: { createElement(tag) { calls.push(['element', tag]); return link; }, body: { appendChild(value) { assert.equal(value, link); calls.push(['append']); } } },
    setTimeout(callback, delay) { assert.equal(delay, 0); timers.push(callback); },
  } };
}
test('explicit download constructs only the validated CSV with static filename and cleans its DOM and object URL', () => {
  for (const fail of [false, true]) {
    const { calls, timers, environment } = fakeDownloadEnvironment(fail);
    if (fail) assert.throws(() => downloadTaxCsv(csv, record, environment), /Synthetic click failure/);
    else downloadTaxCsv(csv, record, environment);
    assert.deepEqual(calls, [['blob', [csv], { type: 'text/csv;charset=utf-8' }], ['create-url'], ['element', 'a'], ['append'], ['click', TAX_CSV_FILENAME, 'blob:synthetic'], ['remove']]);
    assert.equal(timers.length, 1); timers[0](); assert.deepEqual(calls.at(-1), ['revoke', 'blob:synthetic']);
  }
  const denied = fakeDownloadEnvironment(); assert.throws(() => downloadTaxCsv(csv + '\n', record, denied.environment)); assert.deepEqual(denied.calls, []);
});

test('a cancelled or replaced scope cannot create a file even when the server response ignores cancellation', async () => {
  for (const action of ['cancel', 'replace']) {
    const scope = requestScope(), token = scope.begin(); let release, signal; const downloads = [];
    const client = { exportCsv(_company, _record, _role, received) { signal = received; return new Promise(resolve => { release = resolve; }); } };
    const pending = requestTaxDownload({ client, companyId: company, record, role: 'owner', token, download: (...args) => downloads.push(args) });
    if (action === 'cancel') scope.cancel(); else scope.begin();
    assert.equal(signal.aborted, true); release(csv); assert.equal(await pending, false); assert.deepEqual(downloads, []);
  }
  const downloads = [], token = requestScope().begin();
  assert.equal(await requestTaxDownload({ client: { exportCsv: async () => csv }, companyId: company, record, role: 'owner', token, download: (...args) => downloads.push(args) }), true);
  assert.deepEqual(downloads, [[csv, record]]);
});
