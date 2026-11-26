import test from 'node:test';
import assert from 'node:assert/strict';
import { requestScope } from './model.mjs';
import { canExportPay, PAY_CSV_HEADER, PAY_CSV_FILENAME, validatePayCsv, downloadPayCsv, requestPayDownload } from './payExport.mjs';
import { createPayRecordsClient, PayRecordsError } from './client.mjs';
const company = '12345678-1234-4234-8234-123456789abc', id = '12345678-1234-4234-8234-123456789abd';
const record = { id, effective_from: '2026-04-06', annual_salary_pence: '9007199254740993', currency: 'GBP' };
const csv = `${PAY_CSV_HEADER}2026-04-06,9007199254740993,GBP\r\n`;
const nativeHeaders = { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${PAY_CSV_FILENAME}"`,
  'cache-control': 'no-store', 'x-payroll-company': company, 'x-payroll-record': id };
const response = (body = csv, status = 200, changes = {}) => ({ status, headers: new Headers({ ...nativeHeaders, ...changes }), text: async () => body });

test('export is available only to owner/preparer and preserves exact bigint pence in a single fixed date and numeric row', () => {
  for (const role of ['owner', 'payroll_preparer']) assert.equal(canExportPay(role), true);
  for (const role of ['payroll_reader', 'payroll_approver', 'admin', 'accountant', 'staff', 'member', 'read_only', 'personal_tax_preparer', 'personal_tax_submitter', null, {}, ['owner']]) assert.equal(canExportPay(role), false);
  for (const [date, amount] of [['0001-01-01', '0'], ['2024-02-29', '9007199254740993'], ['9999-12-31', '9223372036854775807']]) {
    const value = `${PAY_CSV_HEADER}${date},${amount},GBP\r\n`;
    assert.equal(validatePayCsv(value, { ...record, effective_from: date, annual_salary_pence: amount }), value);
  }
});

test('CSV validation refuses extra rows, free text, formulas, unexpected identifiers, scope values and lossy monetary syntax', () => {
  for (const value of ['', '\uFEFF' + csv, csv + '\n', csv + '\r\n', csv + '2027-04-06,1,GBP\r\n', csv.replaceAll('\r\n', '\n'),
    csv.replace('2026-04-06,', '2026-4-6,'), csv.replace('2026-04-06,', '2025-04-06,'), csv.replace('9007199254740993', '9007199254740992'),
    csv.replace('9007199254740993', '=SUM(1)'), csv.replace('9007199254740993', '+1'), csv.replace('9007199254740993', '1.0'),
    csv.replace('9007199254740993', '01'), csv.replace('9007199254740993', '9223372036854775808'), csv.replace('GBP', 'USD'),
    csv.replace('currency', 'employee_id'), csv.replace(',GBP', ',GBP,private-employee'), 'x'.repeat(129), null, {}]) assert.throws(() => validatePayCsv(value, record));
  assert.throws(() => validatePayCsv(csv, { ...record, currency: 'USD' }));
  for (const date of ['0000-01-01', '2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-01-00'])
    assert.throws(() => validatePayCsv(csv.replace('2026-04-06', date), { ...record, effective_from: date }));
});

test('export fetch is same-origin authenticated no-store GET with cancellation, exact scope and fixed response validation', async () => {
  const calls = [], signal = new AbortController().signal;
  const client = createPayRecordsClient(async (url, options) => { calls.push({ url, options }); return response(); });
  assert.equal(await client.exportCsv(company.toUpperCase(), record, 'payroll_preparer', signal), csv);
  assert.deepEqual(calls, [{ url: `/api/companies/${company}/payroll-pay-records/${id}/export.csv`, options: {
    method: 'GET', credentials: 'include', cache: 'no-store', redirect: 'error', signal,
  } }]);
  await assert.rejects(client.exportCsv(company, record, 'payroll_reader'), error => error.status === 403); assert.equal(calls.length, 1);
  await assert.rejects(client.exportCsv('not-company', record, 'owner'), error => error.status === 0); assert.equal(calls.length, 1);
});

test('export refuses malformed/proxy/cross-scope responses and keeps raw errors or denial bodies unread', async () => {
  for (const [name, value] of [['content-type', 'text/html'], ['content-disposition', 'attachment; filename="private-employee.csv"'],
    ['cache-control', 'public'], ['x-payroll-company', id], ['x-payroll-record', company]]) {
    const client = createPayRecordsClient(async () => response(csv, 200, { [name]: value }));
    await assert.rejects(client.exportCsv(company, record, 'owner'), error => error instanceof PayRecordsError && error.status === 0);
  }
  for (const fetcher of [async () => response(csv + 'private'), async () => { throw Error('private income diagnostic'); },
    async () => ({ status: 200, headers: new Headers(), text() { throw Error('bad headers must prevent reading body'); } })]) {
    await assert.rejects(createPayRecordsClient(fetcher).exportCsv(company, record, 'owner'), error => error.status === 0 && error.message === 'The pay record request could not be completed.');
  }
  for (const status of [201, 204, 304, 400, 401, 403, 409, 503]) {
    const client = createPayRecordsClient(async () => ({ status, text() { throw Error('private body must not be read'); } }));
    await assert.rejects(client.exportCsv(company, record, 'owner'), error => error.status === status && error.message === 'The pay record request could not be completed.');
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
    if (fail) assert.throws(() => downloadPayCsv(csv, record, environment), /Synthetic click failure/);
    else downloadPayCsv(csv, record, environment);
    assert.deepEqual(calls, [['blob', [csv], { type: 'text/csv;charset=utf-8' }], ['create-url'], ['element', 'a'], ['append'], ['click', PAY_CSV_FILENAME, 'blob:synthetic'], ['remove']]);
    assert.equal(timers.length, 1); timers[0](); assert.deepEqual(calls.at(-1), ['revoke', 'blob:synthetic']);
  }
  const denied = fakeDownloadEnvironment(); assert.throws(() => downloadPayCsv(csv + '\n', record, denied.environment)); assert.deepEqual(denied.calls, []);
});

test('a cancelled or replaced scope cannot create a file even when the server response ignores cancellation', async () => {
  for (const action of ['cancel', 'replace']) {
    const scope = requestScope(), token = scope.begin(); let release, signal; const downloads = [];
    const client = { exportCsv(_company, _record, _role, received) { signal = received; return new Promise(resolve => { release = resolve; }); } };
    const pending = requestPayDownload({ client, companyId: company, record, role: 'owner', token, download: (...args) => downloads.push(args) });
    if (action === 'cancel') scope.cancel(); else scope.begin();
    assert.equal(signal.aborted, true); release(csv); assert.equal(await pending, false); assert.deepEqual(downloads, []);
  }
  const downloads = [], token = requestScope().begin();
  assert.equal(await requestPayDownload({ client: { exportCsv: async () => csv }, companyId: company, record, role: 'owner', token, download: (...args) => downloads.push(args) }), true);
  assert.deepEqual(downloads, [[csv, record]]);
});
