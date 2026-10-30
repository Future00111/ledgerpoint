import test from 'node:test';
import assert from 'node:assert/strict';
import { createBankWorkspaceReader, emptyBankWorkspace } from './model.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const row = (company = 'a', id = `${company}-transaction`) => ({ id, company_id: company, description: `${company} private payment` });
const suggestion = name => ({ suggestions: { [`${name}-transaction`]: [{ record_id: `${name}-bill`, reasons: [`${name} evidence`] }] } });

function harness(companyId = 'a') {
  const transactions = [], suggestions = [], states = [], calls = [];
  const reader = createBankWorkspaceReader({ companyId,
    loadTransactions: id => { calls.push(['transactions', id]); const request = deferred(); transactions.push(request); return request.promise; },
    loadSuggestions: id => { calls.push(['suggestions', id]); const request = deferred(); suggestions.push(request); return request.promise; },
    publish: state => states.push(state),
  });
  return { reader, transactions, suggestions, states, calls, last: () => states.at(-1) };
}

test('new company starts with no inherited rows, suggestions, errors or selections', () => {
  assert.deepEqual(emptyBankWorkspace('b'), { companyId: 'b', transactions: [], suggestions: {}, loading: true,
    suggestionsLoading: true, error: null, suggestionsError: null });
});

test('concurrent reads publish only verified rows and suggestions for their fixed company', async () => {
  const h = harness(); const done = h.reader.start();
  assert.deepEqual(h.calls, [['transactions', 'a'], ['suggestions', 'a']]);
  h.suggestions[0].resolve(suggestion('a')); await Promise.resolve();
  assert.equal(h.last().loading, true);
  h.transactions[0].resolve([row()]); await done;
  assert.equal(h.last().loading, false); assert.equal(h.last().suggestionsLoading, false);
  assert.deepEqual(h.last().transactions, [row()]);
  assert.deepEqual(h.last().suggestions, suggestion('a').suggestions);
});

test('late success and error after company switch cannot publish or trigger another old-company refresh', async () => {
  const old = harness('a'), next = harness('b');
  const first = old.reader.start(), ticket = old.reader.actionTicket();
  old.reader.stop(); const count = old.states.length;
  const second = next.reader.start();
  next.transactions[0].resolve([row('b')]); next.suggestions[0].resolve(suggestion('b')); await second;
  old.transactions[0].resolve([row('a')]); old.suggestions[0].reject(new Error('old private error')); await first;
  assert.equal(old.states.length, count);
  assert.equal(old.reader.current(ticket), false);
  await old.reader.refresh(); assert.equal(old.calls.length, 2);
  assert.deepEqual(next.last().transactions, [row('b')]);
  assert.ok(!JSON.stringify(next.states).includes('old private error'));
  assert.ok(!JSON.stringify(next.states).includes('a private payment'));
});

test('newer refresh wins independently for both requests, including an older rejected request', async () => {
  const h = harness(); const first = h.reader.start(); const second = h.reader.refresh();
  h.transactions[1].resolve([row('a', 'new-row')]); h.suggestions[1].resolve({ suggestions: { 'new-row': [{ reasons: ['new'] }] } }); await second;
  h.transactions[0].reject(new Error('stale failure')); h.suggestions[0].resolve(suggestion('old')); await first;
  assert.equal(h.last().transactions[0].id, 'new-row');
  assert.deepEqual(h.last().suggestions, { 'new-row': [{ reasons: ['new'] }] });
  assert.equal(h.last().error, null);
});

test('Strict Mode stop/start cannot revive an earlier request or action ticket', async () => {
  const h = harness(); const first = h.reader.start(), ticket = h.reader.actionTicket();
  h.reader.stop(); const second = h.reader.start();
  h.transactions[0].resolve([row('a', 'old')]); h.suggestions[0].resolve(suggestion('old')); await first;
  assert.deepEqual(h.last().transactions, []);
  assert.equal(h.reader.current(ticket), false);
  h.transactions[1].resolve([row('a', 'current')]); h.suggestions[1].resolve(suggestion('a')); await second;
  assert.equal(h.last().transactions[0].id, 'current');
});

test('invalid, mixed-company and duplicate-id transaction responses fail closed and retries recover', async () => {
  for (const invalid of [null, {}, [row('b')], [row(), row('b')], [row(), row()], [{ company_id: 'a' }]]) {
    const h = harness(); const first = h.reader.start();
    h.transactions[0].resolve(invalid); h.suggestions[0].resolve({ suggestions: {} }); await first;
    assert.deepEqual(h.last().transactions, []); assert.equal(h.last().loading, false);
    assert.match(h.last().error, /could not be verified/);
    const retry = h.reader.refresh();
    assert.equal(h.last().error, null);
    h.transactions[1].resolve([row()]); h.suggestions[1].resolve({ data: { suggestions: {} } }); await retry;
    assert.deepEqual(h.last().transactions, [row()]); assert.equal(h.last().error, null);
  }
});

test('suggestion failure clears stale suggestions, hides diagnostics, and does not remove verified transactions', async () => {
  const h = harness(); const first = h.reader.start();
  h.transactions[0].resolve([row()]); h.suggestions[0].resolve(suggestion('a')); await first;
  const retry = h.reader.refreshSuggestions();
  assert.deepEqual(h.last().suggestions, {}); assert.deepEqual(h.last().transactions, [row()]);
  h.suggestions[1].reject(new Error('private provider credential')); await retry;
  assert.match(h.last().suggestionsError, /could not be loaded/);
  assert.equal(JSON.stringify(h.states).includes('private provider credential'), false);
  assert.deepEqual(h.last().transactions, [row()]);
});

test('malformed suggestion payloads are rejected rather than rendered or treated as an empty success', async () => {
  for (const invalid of [null, {}, { suggestions: [] }, { suggestions: { row: {} } }, { suggestions: { row: [null] } },
    { suggestions: { row: [{ reasons: 'unexpected' }] } }]) {
    const h = harness(); const done = h.reader.start();
    h.transactions[0].resolve([]); h.suggestions[0].resolve(invalid); await done;
    assert.deepEqual(h.last().suggestions, {}); assert.match(h.last().suggestionsError, /could not be loaded/);
  }
});
