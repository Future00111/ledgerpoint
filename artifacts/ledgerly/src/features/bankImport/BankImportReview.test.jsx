import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import BankImportReview from './BankImportReview';
import { buildBankPreview, markDuplicateCandidates, parseBankCSV } from './model.mjs';

const parsed = parseBankCSV('Date,Description,Money In\n2026-10-30,<script>alert(1)</script>,12.34\n2026-10-30,<script>alert(1)</script>,12.34');
const rows = markDuplicateCandidates(buildBankPreview({ ...parsed, companyId: 'a', bankAccountId: 'b' }).transactions, []);
const render = extra => renderToStaticMarkup(<BankImportReview rows={rows} excluded={new Set()} onInclude={() => {}} onDuplicatesReviewed={() => {}} {...extra} />);

test('review exposes every source row, exact money and explicit duplicate acknowledgement', () => {
  const html = render();
  assert.match(html, /2 of 2 rows selected/);
  assert.match(html, /Include CSV row 2/); assert.match(html, /Include CSV row 3/);
  assert.match(html, /12\.34/); assert.match(html, /0\.00/);
  assert.match(html, /no row has been removed automatically/);
  assert.match(html, /I have reviewed the possible duplicates/);
  assert.match(html, /not payments or reconciliation/);
  assert.equal(html.includes('<script>'), false);
});

test('explicit exclusions update the count and a pending/uncertain import disables choices', () => {
  const html = render({ excluded: new Set([2]), disabled: true });
  assert.match(html, /1 of 2 rows selected/);
  assert.equal((html.match(/disabled=""/g) || []).length, 3);
});

test('history coverage advisory remains visible even when no duplicate candidates were found', () => {
  const html = render({ rows: rows.map(row => ({ ...row, possibleDuplicate: false })) });
  assert.match(html, /Duplicate warnings do not cover all historical bank transactions/);
  assert.match(html, /No warning does not prove a row is new/);
  assert.match(html, /Check your existing bank history before importing a file again/);
  assert.equal(html.includes('I have reviewed the possible duplicates'), false);
});
