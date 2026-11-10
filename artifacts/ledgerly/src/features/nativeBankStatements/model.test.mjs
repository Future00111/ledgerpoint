import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshRecoveredMatch} from './model.mjs';
test('verified recovery closes stale match form before refreshing without submitting again',async()=>{
  const calls=[];
  const result=await refreshRecoveredMatch(v=>calls.push(['close',v]),async()=>{calls.push(['read']);return 'fresh remaining';});
  assert.deepEqual(calls,[['close',null],['read']]);assert.equal(result,'fresh remaining');
});
import { parseBankCSV } from '../bankImport/model.mjs';
import { formatMinor, poundsToMinor, rowsFromCsv, buildImportBody, blankManualRow, verifyImportReceipt, verifyImportReview, eligiblePayments, buildMatchBody, defaultMatchAmount, verifyMatchReceipt, pendingStore, bankLedgerFor, importBlocked, createGate, statusExplanation, unresolvedRecovery, retainPendingOnFailure } from './model.mjs';

test('failed recovery reads and retries never prove an earlier write absent',()=>{
  for(const status of [401,403,404,409,422,500,503,undefined]) {
    const error={status,message:'Access unavailable'};
    assert.equal(retainPendingOnFailure(error,'recovery'),true);
    assert.match(unresolvedRecovery(error),/still unconfirmed/);
    assert.doesNotMatch(unresolvedRecovery(error),/wrote nothing|Nothing was/);
  }
  assert.equal(retainPendingOnFailure({status:403},'initial'),false);
  assert.equal(retainPendingOnFailure({status:500},'initial'),true);
});

test('formatMinor is exact for large values', () => {
  assert.equal(formatMinor('999999999999'), '£9,999,999,999.99');
  assert.equal(formatMinor('5'), '£0.05');
  assert.equal(formatMinor('abc'), '—');
});
test('poundsToMinor is strict', () => {
  assert.equal(poundsToMinor('1,234.5'), '123450');
  for (const bad of ['0', '-1', '1.234', '£1', '1e2', '']) assert.equal(poundsToMinor(bad), null, bad);
});
test('existing CSV parser output converts to exact API decimal strings', () => {
  const file = parseBankCSV('Date,Description,Reference,Money In,Money Out\n2026-10-30,Stripe payout,SP1,"1,234.56",\n2026-10-31,Rent,,,0.10');
  const { rows, errors } = rowsFromCsv(file, { columnMap: file.columnMap, dateFormat: 'iso', companyId: 'c', bankAccountId: 'b' });
  assert.deepEqual(errors, []);
  const { body } = buildImportBody({ requestId: 'r', bankAccountId: 'b', rows });
  assert.deepEqual(body, { request_id: 'r', bank_account_id: 'b', rows: [
    { date: '2026-10-30', description: 'Stripe payout', reference: 'SP1', money_in: '1234.56', money_out: '0.00' },
    { date: '2026-10-31', description: 'Rent', reference: '', money_in: '0.00', money_out: '0.10' },
  ] });
});
test('manual rows use the same validation and report every problem', () => {
  const bad = { ...blankManualRow(1), date: '2026-02-30', description: 'x', money_in: '5' };
  const both = { ...blankManualRow(2), date: '2026-01-01', description: 'x', money_in: '5', money_out: '5' };
  const r = buildImportBody({ requestId: 'r', bankAccountId: 'b', rows: [bad, both] });
  assert.equal(r.errors.length, 2);
  assert.ok(buildImportBody({ requestId: 'r', bankAccountId: '', rows: [] }).errors.length >= 2);
});
test('import review and receipts are verified against the exact request', () => {
  const body = { request_id: 'r', rows: [{}, {}] };
  assert.throws(() => verifyImportReview({ can_import: true, duplicates: [] }, body));
  assert.ok(verifyImportReview({ review_token: 't', can_import: false, duplicates: [{ index: 0, reason: 'x' }] }, body));
  assert.equal(verifyImportReceipt({ request_id: 'r', rows: [1, 2] }, body).count, 2);
  assert.equal(verifyImportReceipt({ request_id: 'r', status: 'unknown' }, body).status, 'unknown');
  assert.throws(() => verifyImportReceipt({ request_id: 'other', rows: [1, 2] }, body));
  assert.throws(() => verifyImportReceipt({ request_id: 'r', rows: [1] }, body));
});
test('eligible payments follow direction, configured bank ledger and remaining amount', () => {
  const ctx = { bank_ledger_account_id: 'g', payments: [
    { id: 'p1', party_type: 'customer', bank_ledger_account_id: 'g', remaining_minor: '100' },
    { id: 'p2', party_type: 'supplier', bank_ledger_account_id: 'g', remaining_minor: '100' },
    { id: 'p3', party_type: 'customer', bank_ledger_account_id: 'other', remaining_minor: '100' },
    { id: 'p4', party_type: 'customer', bank_ledger_account_id: 'g', remaining_minor: '0' },
  ] };
  assert.deepEqual(eligiblePayments(ctx, { native: true, direction: 'in', status: 'unmatched' }).map(p => p.id), ['p1']);
  assert.deepEqual(eligiblePayments(ctx, { native: true, direction: 'out', status: 'partial' }).map(p => p.id), ['p2']);
  assert.deepEqual(eligiblePayments(ctx, { native: false, direction: 'in' }), []);
  assert.deepEqual(eligiblePayments(ctx, { native: true, direction: 'in', status: 'matched' }), []);
  assert.deepEqual(eligiblePayments({ ...ctx, bank_ledger_account_id: null }, { native: true, direction: 'in' }), []);
});
test('partial match amounts are bounded by both remaining amounts', () => {
  const s = { id: 's', remaining_minor: '5000' }, p = { id: 'p', remaining_minor: '3000' };
  assert.equal(defaultMatchAmount(s, p), '30.00');
  assert.deepEqual(buildMatchBody({ requestId: 'r', statement: s, payment: p, amount: '12.50' }).body, { request_id: 'r', bank_transaction_id: 's', payment_id: 'p', amount_minor: '1250' });
  assert.match(buildMatchBody({ requestId: 'r', statement: s, payment: p, amount: '30.01' }).error, /payment/);
  assert.match(buildMatchBody({ requestId: 'r', statement: { ...s, remaining_minor: '100' }, payment: p, amount: '2' }).error, /statement/);
  const body = { request_id: 'r', bank_transaction_id: 's', payment_id: 'p', amount_minor: '1250' };
  assert.equal(verifyMatchReceipt({ ...body, status: 'recorded', journal_id: 'j' }, body).receipt.journal_id, 'j');
  assert.throws(() => verifyMatchReceipt({ ...body, amount_minor: '1', status: 'recorded' }, body));
});
test('pending store is per company and per operation', () => {
  const m = new Map(); const storage = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
  const st = pendingStore(storage);
  assert.ok(st.write('a', 'import', { request_id: 'r1', rows: [] }));
  assert.equal(st.read('a', 'import').body.request_id, 'r1');
  assert.equal(st.read('b', 'import'), null); assert.equal(st.read('a', 'match'), null);
  st.clear('a', 'import'); assert.equal(st.read('a', 'import'), null);
  assert.equal(pendingStore(null).write('a', 'import', { request_id: 'x' }), false);
});
test('gate drops stale responses', () => {
  const g = createGate(); const t1 = g.begin(); const t2 = g.begin();
  assert.equal(g.current(t1), false); assert.equal(g.current(t2), true); g.cancel(); assert.equal(g.current(t2), false);
});
test('status explanations describe the remaining difference', () => {
  assert.match(statusExplanation({ status: 'partial', remaining_minor: '1050' }), /£10\.50 is still unexplained/);
  assert.match(statusExplanation({ status: 'matched', remaining_minor: '0' }), /Fully matched/);
});

test('limits: 500-char references and 500-row batches; CSV amounts stay exact strings', () => {
  const row = { ...blankManualRow(1), date: '2026-01-01', description: 'x', money_in: '0.07', reference: 'r'.repeat(500) };
  assert.equal(buildImportBody({ requestId: 'r', bankAccountId: 'b', rows: [row] }).body.rows[0].money_in, '0.07');
  assert.ok(buildImportBody({ requestId: 'r', bankAccountId: 'b', rows: [{ ...row, reference: 'r'.repeat(501) }] }).errors);
  assert.ok(buildImportBody({ requestId: 'r', bankAccountId: 'b', rows: Array(501).fill(row) }).errors.some(e => /500 rows/.test(e.message)));
  assert.ok(buildImportBody({ requestId: 'r', bankAccountId: 'b', rows: [{ ...row, money_in: '0.001' }] }).errors);
  const f = parseBankCSV('Date,Description,Money In\n2026-01-01,x,"9,999,999,999.99"');
  assert.equal(rowsFromCsv(f, { columnMap: f.columnMap, dateFormat: 'iso', companyId: 'c', bankAccountId: 'b' }).rows[0].money_in, '9999999999.99');
});
test('any duplicate blocks import even if can_import is true', () => {
  assert.equal(importBlocked({ can_import: true, duplicates: [{ index: 0, reason: 'same' }] }), true);
  assert.equal(importBlocked({ can_import: false, duplicates: [] }), true);
  assert.equal(importBlocked({ can_import: true, duplicates: [] }), false);
  assert.equal(importBlocked(null), true);
});
test('bank opening-mapped ledger takes precedence over the company default', () => {
  const ctx = { bank_ledger_account_id: 'g', banks: [{ id: 'b1', bank_ledger_account_id: 'm' }, { id: 'b2', bank_ledger_account_id: null }], payments: [
    { id: 'pm', party_type: 'customer', bank_ledger_account_id: 'm', remaining_minor: '1' },
    { id: 'pg', party_type: 'customer', bank_ledger_account_id: 'g', remaining_minor: '1' }] };
  assert.equal(bankLedgerFor(ctx, 'b1'), 'm'); assert.equal(bankLedgerFor(ctx, 'b2'), 'g');
  assert.deepEqual(eligiblePayments(ctx, { native: true, direction: 'in', bank_account_id: 'b1' }).map(p => p.id), ['pm']);
  assert.deepEqual(eligiblePayments(ctx, { native: true, direction: 'in', bank_account_id: 'b2' }).map(p => p.id), ['pg']);
});
