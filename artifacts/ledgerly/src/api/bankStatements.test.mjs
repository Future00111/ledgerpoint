import test from 'node:test';
import assert from 'node:assert/strict';
import { createBankStatementsClient, isUnknownOutcome } from './bankStatements.mjs';

const fake = (status, json) => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); return { ok: status < 400, status, json: async () => { if (json === undefined) throw new Error('x'); return json; } }; }; f.calls = calls; return f; };

test('client uses exact company-scoped relative URLs with credentials and unwraps data', async () => {
  const f = fake(200, { data: { ok: 1 } });
  const c = createBankStatementsClient(f);
  assert.deepEqual(await c.context('co/1'), { ok: 1 });
  await c.importReview('c', { request_id: 'r' });
  await c.importRows('c', { request_id: 'r', review_token: 't' });
  await c.importStatus('c', 'r 1');
  await c.matchReview('c', {}); await c.recordMatch('c', {}); await c.matchStatus('c', 'm');
  assert.deepEqual(f.calls.map(x => `${x.init.method} ${x.url}`), [
    'GET /api/companies/co%2F1/bank-statements/context',
    'POST /api/companies/c/bank-statements/import-review',
    'POST /api/companies/c/bank-statements/imports',
    'GET /api/companies/c/bank-statements/imports/r%201',
    'POST /api/companies/c/bank-statements/match-review',
    'POST /api/companies/c/bank-statements/matches',
    'GET /api/companies/c/bank-statements/matches/m',
  ]);
  assert.ok(f.calls.every(x => x.init.credentials === 'include'));
  assert.equal(f.calls[2].init.body, JSON.stringify({ request_id: 'r', review_token: 't' }));
});

test('errors carry status and code; 4xx is definitive, 5xx/network/unreadable is unknown', async () => {
  const c = createBankStatementsClient(fake(422, { error: { code: 'INVALID_ROWS', message: 'Row 2 bad' } }));
  await assert.rejects(c.importReview('c', {}), e => e.status === 422 && e.code === 'INVALID_ROWS' && e.message === 'Row 2 bad' && !isUnknownOutcome(e));
  const c5 = createBankStatementsClient(fake(503, undefined));
  await assert.rejects(c5.importRows('c', {}), e => isUnknownOutcome(e));
  const cu = createBankStatementsClient(fake(200, { nope: 1 }));
  await assert.rejects(cu.recordMatch('c', {}), e => isUnknownOutcome(e));
  const cn = createBankStatementsClient(async () => { throw new TypeError('network'); });
  await assert.rejects(cn.recordMatch('c', {}), e => isUnknownOutcome(e));
});

test('correction methods use exact URLs, POST bodies and unwrap data', async () => {
  const f = fake(200, { data: { status: 'unknown', request_id: 'r' } });
  const c = createBankStatementsClient(f);
  await c.correctionReview('c', { request_id: 'r', match_request_id: 'm', reason: 'x' });
  await c.recordCorrection('c', { request_id: 'r', match_request_id: 'm', reason: 'x', review_token: 't' });
  assert.deepEqual(await c.correctionStatus('c', 'r/1'), { status: 'unknown', request_id: 'r' });
  assert.deepEqual(f.calls.map(x => `${x.init.method} ${x.url}`), [
    'POST /api/companies/c/bank-statements/correction-review',
    'POST /api/companies/c/bank-statements/corrections',
    'GET /api/companies/c/bank-statements/corrections/r%2F1',
  ]);
  assert.equal(f.calls[1].init.body, JSON.stringify({ request_id: 'r', match_request_id: 'm', reason: 'x', review_token: 't' }));
});
