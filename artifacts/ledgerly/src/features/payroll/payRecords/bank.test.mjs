import test from 'node:test';
import assert from 'node:assert/strict';
import { bankEmployeeId, bankProjection, createBankLookup, validateBankDetails } from './bankModel.mjs';
import { BankDetailsError, createBankDetailsClient } from './bankClient.mjs';

const company = '12345678-1234-4234-8234-123456789abc';
const employee = '00000000-0000-0000-0000-000000000000';
const otherEmployee = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const response = (value, status = 200) => ({ status, json: async () => value });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('employee UUID lookup accepts nil and non-versioned native UUIDs while rejecting ambiguous inputs', () => {
  for (const value of [employee, otherEmployee, company.toUpperCase()]) assert.equal(bankEmployeeId(value), value.toLowerCase());
  for (const value of [null, {}, 'employee-name', `${employee}?role=owner`, ` ${employee}`, employee.slice(1)]) assert.throws(() => bankEmployeeId(value));
});
test('bank projections are exact, role-limited digit strings and retain leading zeroes', () => {
  for (const role of ['owner', 'payroll_preparer']) assert.deepEqual(validateBankDetails({ account_number: '00123456' }, role), { account_number: '00123456' });
  assert.deepEqual(validateBankDetails({ last_four: '0007' }, 'payroll_approver'), { last_four: '0007' });
  for (const role of ['payroll_reader', 'accountant', 'admin', 'personal_tax_preparer', 'personal_tax_submitter', null]) {
    assert.equal(bankProjection(role), null); assert.throws(() => validateBankDetails({ account_number: '12345678' }, role));
  }
  for (const value of [null, [], {}, { account_number: 12345678 }, { account_number: '1234567' }, { account_number: '123456789' },
    { account_number: '1234 678' }, { account_number: '１２３４５６７８' }, { last_four: '5678' },
    { account_number: '12345678', employee_id: employee }, { account_number: '12345678', last_four: '5678' }]) assert.throws(() => validateBankDetails(value, 'owner'));
  for (const value of [{ account_number: '12345678' }, { last_four: '5678', account_number: '12345678' }, { last_four: 5678 }, { last_four: '12345' }])
    assert.throws(() => validateBankDetails(value, 'payroll_approver'));
});
test('explicit bank read uses only the native GET route, strict company scope, no cache and no redirects', async () => {
  const requests = [], signal = new AbortController().signal;
  const client = createBankDetailsClient(async (url, options) => { requests.push({ url, options }); return response({ account_number: '00123456' }); });
  assert.deepEqual(Object.keys(client), ['read']);
  assert.deepEqual(await client.read(company.toUpperCase(), otherEmployee.toUpperCase(), 'owner', signal), { account_number: '00123456' });
  assert.deepEqual(requests, [{ url: `/api/companies/${company}/payroll-bank-details/${otherEmployee}`,
    options: { method: 'GET', credentials: 'include', cache: 'no-store', redirect: 'error', signal } }]);
  for (const [companyId, employeeId, role] of [[employee, employee, 'owner'], [company, '../private', 'owner'], [company, employee, 'payroll_reader'], [company, employee, 'admin']])
    await assert.rejects(client.read(companyId, employeeId, role), error => error instanceof BankDetailsError);
  assert.equal(requests.length, 1);
});
test('client refuses over-disclosure and unexpected successful statuses without exposing private diagnostics', async () => {
  for (const [role, value, status] of [['payroll_approver', { account_number: '12345678' }, 200],
    ['payroll_approver', { last_four: '5678', account_number: '12345678' }, 200], ['owner', { account_number: '12345678' }, 201],
    ['owner', { account_number: '12345678', bank_name: 'private' }, 200]]) {
    await assert.rejects(createBankDetailsClient(async () => response(value, status)).read(company, employee, role),
      error => error.message === 'Bank details could not be loaded.' && !error.message.includes('12345678'));
  }
  for (const status of [400, 401, 403, 404, 500]) {
    await assert.rejects(createBankDetailsClient(async () => ({ status, json() { assert.fail('Error body must not be read'); } })).read(company, employee, 'owner'),
      error => error.status === status && error.message === 'Bank details could not be loaded.');
  }
  for (const fetcher of [async () => { throw Error('private account 12345678'); }, async () => ({ status: 200, json() { throw Error('private malformed body'); } })])
    await assert.rejects(createBankDetailsClient(fetcher).read(company, employee, 'owner'), error => error.status === 0 && error.message === 'Bank details could not be loaded.');
});
test('lookup has no mount/change reads, coalesces repeated submission and clears old results before every lookup', async () => {
  const first = deferred(), second = deferred(); let calls = 0;
  const lookup = createBankLookup({ companyId: company, role: 'owner', client: { read() { return ++calls === 1 ? first.promise : second.promise; } } });
  lookup.changeEmployee(employee); assert.equal(calls, 0); assert.equal(lookup.getSnapshot().result, null);
  const pending = lookup.lookup(); await lookup.lookup(); assert.equal(calls, 1); assert.equal(lookup.getSnapshot().status, 'loading');
  first.resolve({ account_number: '00123456' }); await pending; assert.equal(lookup.getSnapshot().result.account_number, '00123456');
  const refreshed = lookup.lookup(); assert.equal(lookup.getSnapshot().result, null); assert.equal(lookup.getSnapshot().status, 'loading');
  second.reject(Error('private response')); await refreshed; assert.deepEqual(lookup.getSnapshot(), { employeeId: employee, status: 'failed', result: null });
});
test('editing employee cancels a lookup and ignored cancellation cannot repopulate an old employee result', async () => {
  const old = deferred(), next = deferred(); const signals = [];
  const lookup = createBankLookup({ companyId: company, role: 'owner', client: { read(c, id, role, signal) { signals.push(signal); return id === employee ? old.promise : next.promise; } } });
  lookup.changeEmployee(employee); const pending = lookup.lookup();
  lookup.changeEmployee(otherEmployee); assert.equal(signals[0].aborted, true); assert.equal(lookup.getSnapshot().result, null);
  const current = lookup.lookup(); next.resolve({ account_number: '87654321' }); await current;
  old.resolve({ account_number: '12345678' }); await pending;
  assert.deepEqual(lookup.getSnapshot(), { employeeId: otherEmployee, status: 'ready', result: { account_number: '87654321' } });
  lookup.changeEmployee('invalid'); await lookup.lookup(); assert.equal(lookup.getSnapshot().status, 'invalid'); assert.equal(lookup.getSnapshot().result, null);
  lookup.changeEmployee(`${employee}?role=owner`); await lookup.lookup(); assert.equal(lookup.getSnapshot().status, 'invalid'); assert.equal(signals.length, 2);
});
test('unmount/actor/company/role replacement disposes outstanding work and only a new explicit lookup can disclose', async () => {
  const pending = deferred(); let signal;
  const old = createBankLookup({ companyId: company, role: 'owner', client: { read(c, id, role, s) { signal = s; return pending.promise; } } });
  old.changeEmployee(employee); const work = old.lookup(); old.dispose(); assert.equal(signal.aborted, true);
  // Effect reactivation must also be safe under React's setup/cleanup/setup development cycle.
  old.activate(); pending.resolve({ account_number: '12345678' }); await work;
  assert.deepEqual(old.getSnapshot(), { employeeId: '', status: 'idle', result: null });
  let newCalls = 0;
  const next = createBankLookup({ companyId: otherEmployee, role: 'payroll_approver', client: { async read() { newCalls++; return { last_four: '5678' }; } } });
  assert.equal(newCalls, 0); next.changeEmployee(employee); await next.lookup();
  assert.deepEqual(next.getSnapshot().result, { last_four: '5678' }); assert.equal(newCalls, 1);
  next.dispose(); assert.equal(next.getSnapshot().result, null);
});
test('denied/foreign lookup clears the employee and result; malformed injected success cannot disclose', async () => {
  for (const status of [401, 403, 404]) {
    const lookup = createBankLookup({ companyId: company, role: 'owner', client: { async read() { throw Object.assign(Error('private body'), { status }); } } });
    lookup.changeEmployee(employee); await lookup.lookup(); assert.deepEqual(lookup.getSnapshot(), { employeeId: '', status: 'unavailable', result: null });
  }
  const lookup = createBankLookup({ companyId: company, role: 'payroll_approver', client: { async read() { return { account_number: '12345678' }; } } });
  lookup.changeEmployee(employee); await lookup.lookup(); assert.equal(lookup.getSnapshot().status, 'failed'); assert.equal(lookup.getSnapshot().result, null);
  let requests = 0; const denied = createBankLookup({ companyId: company, role: 'payroll_reader', client: { async read() { requests++; } } });
  denied.changeEmployee(employee); await denied.lookup(); assert.equal(requests, 0);
});
test('clearing a pending bank lookup discards a late response and allows a fresh lookup', async () => {
  const old = deferred();
  let calls = 0, signal;
  const lookup = createBankLookup({companyId:company, role:'owner', client:{
    read(companyId, employeeId, role, requestSignal) {
      calls++;
      signal = requestSignal;
      return calls === 1 ? old.promise : Promise.resolve({account_number:'00123456'});
    },
  }});
  lookup.changeEmployee(employee);
  const pending = lookup.lookup();
  lookup.changeEmployee('');
  assert.equal(signal.aborted,true);
  old.resolve({account_number:'87654321'});
  await pending;
  const cleared = {employeeId:'', status:'idle', result:null};
  assert.deepEqual(lookup.getSnapshot(),cleared);
  lookup.changeEmployee(employee);
  await lookup.lookup();
  assert.equal(lookup.getSnapshot().result.account_number,'00123456');
  lookup.changeEmployee('');
  assert.deepEqual(lookup.getSnapshot(),cleared);
  assert.equal(calls,2);
});
test('only a current unauthenticated bank response expires the workspace session', async () => {
  for (const status of [401, 403, 404, 500]) {
    for (const cleared of [false, true]) {
      const response = deferred();
      let expirations = 0;
      const lookup = createBankLookup({ companyId:company, role:'owner', client:{read:() => response.promise},
        onSessionExpired:() => { expirations++; } });
      lookup.changeEmployee(employee);
      const pending = lookup.lookup();
      if (cleared) lookup.changeEmployee('');
      response.reject(Object.assign(Error('synthetic'), {status}));
      await pending;
      assert.equal(expirations, status === 401 && !cleared ? 1 : 0);
    }
  }
});
