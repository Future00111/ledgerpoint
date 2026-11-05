import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBankPreview, checkFileSize, confirmedImportReceipt, createImportGate, markDuplicateCandidates, MAX_CSV_BYTES, MAX_CSV_ROWS, parseBankCSV, parseStatementDate, parseStatementMoney, validateMapping } from './model.mjs';

const CSV = 'Date,Description,Money In,Money Out,Balance,Reference\n2026-10-30,Customer receipt,1234.56,,2234.56,INV-1\n2026-10-31,Supplier payment,,12.34,2222.22,BILL-1';
const build = (csv = CSV, extra = {}) => buildBankPreview({ ...parseBankCSV(csv), dateFormat: 'iso', companyId: 'company-a', bankAccountId: 'bank-a', ...extra });

test('BOM, CRLF, escaped quotes and multiline quoted fields retain exact contents', () => {
  const parsed = parseBankCSV('\uFEFFDate,Description,Money In\r\n2026-10-30,"Customer, ""A""\r\nsecond line","1,234.56"\r\n');
  assert.deepEqual(parsed.headers, ['Date', 'Description', 'Money In']);
  assert.equal(parsed.rows[0][1], 'Customer, "A"\r\nsecond line');
  assert.equal(buildBankPreview({ ...parsed, companyId: 'a', bankAccountId: 'b' }).transactions[0].inDecimal, '1234.56');
});

test('malformed quoting, null bytes and missing CSV content are rejected', () => {
  for (const csv of ['', 'date,description\n', 'date,description\n2026-10-30,"unterminated', 'date,description\n2026-10-30,a"b', 'date,description\n2026-10-30,"a"x', 'date,description\n2026-10-30,a\0b', 'date,\n2026-10-30,b']) assert.throws(() => parseBankCSV(csv));
});

test('upload bytes, UTF-8 bytes, row, column and field limits are enforced before review', () => {
  assert.throws(() => checkFileSize(MAX_CSV_BYTES + 1), /1 MiB/);
  for (const size of [0, -1, Infinity, 1.5]) assert.throws(() => checkFileSize(size));
  assert.throws(() => parseBankCSV('é'.repeat(MAX_CSV_BYTES / 2 + 1)), /1 MiB/);
  assert.throws(() => parseBankCSV('date,description,money in\n' + '2026-10-30,A,1\n'.repeat(MAX_CSV_ROWS + 1)), /1,000/);
  assert.equal(parseBankCSV('date,description,money in\n' + '2026-10-30,A,1\n'.repeat(MAX_CSV_ROWS)).rows.length, MAX_CSV_ROWS);
  assert.throws(() => parseBankCSV(Array(51).fill('Column').join(',') + '\na,b'), /50 columns/);
  assert.throws(() => parseBankCSV('date,description\n2026-10-30,' + 'a'.repeat(4097)), /4,096/);
});

test('dates never guess a locale; day-first requires explicit selection', () => {
  assert.equal(parseStatementDate('2024-02-29'), '2024-02-29');
  assert.equal(parseStatementDate('03/04/2026', 'dmy'), '2026-04-03');
  assert.throws(() => parseStatementDate('03/04/2026'), /explicitly choose/);
  for (const date of ['2025-02-29', '2026-04-31', '2026-13-01', '2026-1-01', '1899-12-31', '2200-01-01', '2026-10-30T00:00:00Z', '10/30/2026']) assert.throws(() => parseStatementDate(date));
  assert.throws(() => parseStatementDate('31/04/2026', 'dmy'));
});

test('money uses exact pennies including grouped amounts and the existing numeric boundary', () => {
  for (const [input, pence, decimal] of [['0.01', '1', '0.01'], ['1,234.56', '123456', '1234.56'], ['1.2', '120', '1.20'], ['9999999999.99', '999999999999', '9999999999.99']]) {
    const amount = parseStatementMoney(input);
    assert.equal(amount.pence, pence); assert.equal(amount.decimal, decimal);
    assert.equal(BigInt(Math.round(amount.number * 100)).toString(), pence);
  }
  assert.equal(parseStatementMoney('-12.34', { negative: true }).pence, '-1234');
  assert.equal(parseStatementMoney('', { blank: 'null' }), null);
  assert.equal(parseStatementMoney('').decimal, '0.00');
});

test('money never truncates, rounds or coerces malformed values to zero', () => {
  for (const input of ['1.001', '12abc', '£12.34', '1e3', 'Infinity', 'NaN', '-1', '(1.00)', '+1', '12,34.56', '1,23,456', '10000000000.00', '1.']) assert.throws(() => parseStatementMoney(input));
});

test('duplicate mappings are blocked, including ambiguous automatically mapped headers', () => {
  assert.throws(() => validateMapping(['date', 'description', 'money in', 'credit'], { 0: 'date', 1: 'description', 2: 'money_in', 3: 'money_in' }), /only once/);
  assert.throws(() => build('Date,Description,Money In,Credit\n2026-10-30,A,1,1'), /only once/);
  assert.throws(() => validateMapping(['date', 'amount'], { 0: 'date' }), /Description/);
  assert.throws(() => validateMapping(['date'], { 1: 'money_in' }), /valid column/);
});

test('valid receipt/payment preview preserves typed exact amounts, company and bank scope', () => {
  const { transactions, errors } = build();
  assert.deepEqual(errors, []);
  assert.equal(transactions.length, 2);
  assert.deepEqual(transactions[0], { sourceRow: 2, inDecimal: '1234.56', outDecimal: '0.00', payload: {
    company_id: 'company-a', bank_account_id: 'bank-a', date: '2026-10-30', description: 'Customer receipt', reference: 'INV-1',
    money_in: 1234.56, money_out: 0, balance: '2234.56', type: 'income',
  } });
  assert.equal(transactions[1].payload.type, 'expense');
  assert.equal(transactions[1].sourceRow, 3);
  assert.equal(Object.hasOwn(transactions[0].payload, 'status'), false);
  assert.equal(Object.hasOwn(transactions[0].payload, 'matched_record_id'), false);
});

test('invalid rows block the entire file and identify the CSV row without partial import', () => {
  const result = build(CSV + '\n2026-02-30,Wrong date,1,,,' + '\n2026-11-01,Both amounts,1,2,,');
  assert.deepEqual(result.transactions, []);
  assert.deepEqual(result.errors.map(error => error.row), [4, 5]);
  assert.match(result.errors[0].message, /real date/);
  assert.match(result.errors[1].message, /exactly one/);
  assert.match(build('Date,Description,Money In\n2026-10-30,A').errors[0].message, /Expected 3 columns/);
  assert.match(build('Date,Description,Money In\n2026-10-30,A,0').errors[0].message, /exactly one/);
  assert.match(build('Date,Description,Money In\n2026-10-30,,1').errors[0].message, /Description/);
  assert.throws(() => build(CSV, { bankAccountId: '' }), /authorised bank/);
});

test('missing balance stays unknown rather than a fabricated zero', () => {
  assert.equal(build('Date,Description,Money In\n2026-10-30,A,1').transactions[0].payload.balance, null);
});

test('same-value transactions are retained and flagged, never silently deduplicated', () => {
  const original = build().transactions;
  const same = { ...original[0], sourceRow: 4 };
  const marked = markDuplicateCandidates([...original, same], [original[1].payload]);
  assert.equal(marked.length, 3);
  assert.deepEqual(marked.map(row => row.possibleDuplicate), [true, true, true]);
  assert.equal(markDuplicateCandidates(original, []).some(row => row.possibleDuplicate), false);
  assert.equal(markDuplicateCandidates(original, [{ date: 'invalid' }])[0].possibleDuplicate, false);
  assert.equal(Object.hasOwn(original[0], 'possibleDuplicate'), false);
});

test('a newer file, another company and dialog cancellation fence late asynchronous reads', async () => {
  const gate = createImportGate();
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const old = gate.begin('company-a:true');
  const applied = [];
  const read = pending.then(value => { if (gate.current(old, 'company-a:true')) applied.push(value); });
  const next = gate.begin('company-a:true');
  resolve('old CSV'); await read;
  assert.deepEqual(applied, []);
  assert.equal(gate.current(next, 'company-b:true'), false);
  assert.equal(gate.current(next, 'company-a:true'), true);
  gate.cancel(); assert.equal(gate.current(next, 'company-a:true'), false);
});

test('only a complete scoped import receipt can report success', () => {
  const selected = build().transactions;
  const receipt = { success: true, analysis_status: 'complete', data: selected.map((row, i) => ({ ...row.payload, id: `transaction-${i}` })) };
  assert.deepEqual(confirmedImportReceipt(receipt, selected, 'company-a', 'bank-a'), { count: 2, analysisStatus: 'complete' });
  for (const invalid of [null, { data: receipt.data }, { ...receipt, data: [] }, { ...receipt, data: [receipt.data[0], receipt.data[0]] },
    { ...receipt, data: receipt.data.map(row => ({ ...row, company_id: 'company-b' })) },
    { ...receipt, data: receipt.data.map(row => ({ ...row, bank_account_id: 'bank-b' })) }]) assert.throws(() => confirmedImportReceipt(invalid, selected, 'company-a', 'bank-a'), /Unverified/);
});
