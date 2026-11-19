import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIntent, effectiveDate, formatSalary, payrollPermissions, poundsToPence, recordId, requestScope, validateRecord, validateReceipt } from './model.mjs';

const id = '12345678-1234-4234-8234-123456789abc';
const employee = '00000000-0000-0000-0000-000000000000';
const record = { id, employee_id: employee, effective_from: '2026-04-06', annual_salary_pence: '4800000', currency: 'GBP' };

test('pay presentation grants preparation only to owner/preparer and read only to payroll roles', () => {
  for (const role of ['owner', 'payroll_preparer']) assert.deepEqual(payrollPermissions(role), { read: true, prepare: true });
  for (const role of ['payroll_reader', 'payroll_approver']) assert.deepEqual(payrollPermissions(role), { read: true, prepare: false });
  for (const role of ['admin', 'accountant', 'staff', 'member', 'read_only', 'personal_tax_preparer', 'personal_tax_submitter', 'OWNER', null, undefined, {}])
    assert.deepEqual(payrollPermissions(role), { read: false, prepare: false });
});
test('GBP conversion and display stay exact beyond Number safe integers and at bigint maximum', () => {
  for (const [pounds, pence, formatted] of [['0', '0', '£0.00'], ['0.1', '10', '£0.10'], ['48000.00', '4800000', '£48,000.00'],
    ['90071992547409.93', '9007199254740993', '£90,071,992,547,409.93'], ['92233720368547758.07', '9223372036854775807', '£92,233,720,368,547,758.07']]) {
    assert.equal(poundsToPence(pounds), pence); assert.equal(formatSalary(pence), formatted);
  }
  for (const value of ['92233720368547758.08', '1e3', '1,000', '£10', '-1', '+1', '1.001', '.50', '01', ' 1', '1 ', '', 10, null, Infinity]) assert.throws(() => poundsToPence(value));
});
test('exact Gregorian dates and separate native employee/record UUID contracts produce immutable intent', () => {
  for (const value of ['0001-01-01', '2000-02-29', '2024-02-29', '9999-12-31']) assert.equal(effectiveDate(value), value);
  for (const value of ['0000-01-01', '1900-02-29', '2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '2026-4-6', '10000-01-01']) assert.throws(() => effectiveDate(value));
  const intent = buildIntent(id.toUpperCase(), { employee, date: '2026-04-06', salary: '48000' });
  assert.deepEqual(intent, { id, employee_id: employee, effective_from: '2026-04-06', annual_salary_pence: '4800000' });
  assert.ok(Object.isFrozen(intent)); assert.throws(() => recordId(employee));
  assert.throws(() => buildIntent(id, { employee: 'someone@example.invalid', date: '2026-04-06', salary: '48000' }));
});
test('fixed role-aware projection rejects excess fields, wrong ids, currency and lossy numeric salaries', () => {
  assert.deepEqual(validateRecord(record, id, 'owner'), record);
  const { employee_id: _, ...reader } = record;
  assert.deepEqual(validateRecord(reader, id, 'payroll_reader'), reader);
  assert.throws(() => validateRecord(record, id, 'payroll_reader'));
  assert.throws(() => validateRecord(reader, id, 'owner'));
  for (const changed of [{ ...record, salary: 'private' }, { ...record, id: '12345678-1234-4234-8234-123456789abd' },
    { ...record, currency: 'USD' }, { ...record, annual_salary_pence: 4800000 }, { ...record, annual_salary_pence: '01' }, { ...record, effective_from: '2026-02-29' }])
    assert.throws(() => validateRecord(changed, id, 'owner'));
  assert.throws(() => validateRecord(record, id, 'accountant'));
});
test('receipt must match exact attempted ID and creation/replay HTTP status', () => {
  assert.deepEqual(validateReceipt({ id, status: 'created' }, id, 201), { id, status: 'created' });
  assert.deepEqual(validateReceipt({ id, status: 'replayed' }, id, 200), { id, status: 'replayed' });
  for (const [value, status] of [[{ id, status: 'created' }, 200], [{ id, status: 'replayed' }, 201], [{ id, status: 'created', private: 'x' }, 201], [null, 201]])
    assert.throws(() => validateReceipt(value, id, status));
});
test('request generations discard delayed success/error after replacement, cancellation and scope disposal', async () => {
  const scope = requestScope(), first = scope.begin();
  let resolve; const delayed = new Promise(r => { resolve = r; }).then(value => first.isCurrent() ? value : null);
  const second = scope.begin(); assert.equal(first.signal.aborted, true); assert.equal(first.isCurrent(), false);
  resolve({ salary: 'must-not-return' }); assert.equal(await delayed, null); assert.equal(second.isCurrent(), true);
  scope.cancel(); assert.equal(second.isCurrent(), false); assert.equal(second.signal.aborted, true);
  const third = scope.begin(); assert.equal(third.isCurrent(), true); assert.equal(first.isCurrent(), false);
  scope.cancel(); assert.equal(third.isCurrent(), false);
});
