import test from 'node:test';
import assert from 'node:assert/strict';
import { vatStatusNotification } from './vatStatusNotification.mjs';

test('legacy submitted or filed flags are presented as recorded status, not filing success', () => {
  for (const status of ['submitted', 'filed']) {
    const notification = vatStatusNotification([{ status, created_date: '2026-10-30' }]);
    assert.equal(notification.title, `VAT return marked as ${status}`);
    assert.equal(notification.route, '/vat');
    assert.equal(notification.date, '2026-10-30');
    assert.match(notification.desc, /Check the HMRC acknowledgement/);
    assert.doesNotMatch(`${notification.title} ${notification.desc}`, /submission successful|was submitted to HMRC/i);
  }
});

test('approved, locked, draft and missing records do not become submission notifications', () => {
  assert.equal(vatStatusNotification(null), null);
  assert.equal(vatStatusNotification([]), null);
  assert.equal(vatStatusNotification([{ status: 'approved', locked: true }, { status: 'draft' }]), null);
});
