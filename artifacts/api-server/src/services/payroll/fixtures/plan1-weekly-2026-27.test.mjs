import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { calculateSyntheticPlan1, plan1SyntheticContract, syntheticNoticeDigest } from '../contracts/plan1SyntheticContract.mjs';
import { resolvePayrollCase } from '../contracts/caseBoundary.mjs';

const root = new URL('../../../../../../', import.meta.url);
const bytes = path => readFileSync(new URL(path, root));
const json = path => JSON.parse(bytes(path));
const digest = value => createHash('sha256').update(value).digest('hex');
const pack = JSON.parse(readFileSync(new URL('./plan1-weekly-2026-27.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./plan1-weekly-2026-27.sources.json', import.meta.url)));
// Only the actual side calls the existing synthetic trace. Expected values are
// literal independently transcribed/worked fixtures, never outputs of that trace.
const input = (notices = ['start'], override = {}) => ({
  taxYear: '2026-27', plan: 'plan_1', frequency: 'weekly', paymentDate: '2026-04-24',
  payMinor: '52842', employmentId: 'fixture-employee', earningsBasis: 'class1_ni_earnings',
  activeEmployment: true, employeeStopRequest: false, otherInstructions: [],
  notices: notices.map(key => structuredClone(pack.syntheticFacts.notices[key])),
  offPayroll: false, occupationalPensionOnly: false, deceased: false,
  protectedEarnings: false, concurrentLoan: false, correction: false, ...override,
});
const envelope = value => ({
  contractVersion: plan1SyntheticContract.version, ruleVersion: plan1SyntheticContract.ruleVersion,
  purpose: 'synthetic_development', input: value,
  verifiedNotices: value.notices.map(notice => ({
    noticeId: notice.id, noticeDigest: syntheticNoticeDigest(notice),
    identityVerified: true, availabilityVerified: true, firstPracticalPayday: notice.firstAvailablePayday,
  })),
});
const actual = value => calculateSyntheticPlan1(envelope(value));

test('official evidence bytes, subset transcription and original unqualified declarations remain pinned', () => {
  assert.equal(digest(bytes(sources.arithmetic.pinnedTextPath)), sources.arithmetic.pinnedTextSha256);
  assert.equal(digest(bytes(sources.officialRows.archivePath)), sources.officialRows.archiveSha256);
  assert.equal(digest(bytes(sources.officialRows.referencePath)), sources.officialRows.referenceSha256);
  const official = json(sources.officialRows.referencePath);
  assert.equal(official.status, 'reference_fixtures_only_not_engine_qualification');
  assert.equal(pack.officialArithmeticRows.length, 6);
  for (const row of pack.officialArithmeticRows) {
    const reference = official.cases.find(c => c.sourceSheet === 'Plan_1' && c.sourceRow === row.row);
    assert.equal(reference.input.frequency, 'weekly');
    assert.equal(reference.input.payMinor, row.payMinor);
    assert.equal(reference.expected.deductionMinor, row.deductionMinor);
  }
  const path = 'artifacts/api-server/src/services/payroll/contracts/fixtures/plan1-notice-start-stop-2026-27.json';
  assert.equal(digest(bytes(path)), '50bb5f129103167eb68afc4ec75b3b53bec53e2278eece8b18bd8dd5281638fa');
  assert.equal(json(path).status, 'reference_only_engine_not_implemented');
});

for (const [provenance, rows] of [['official', pack.officialArithmeticRows], ['authored', pack.authoredArithmeticRows]]) {
  for (const row of rows) test(`${provenance} arithmetic ${row.row ?? row.id}: ${row.payMinor}p -> ${row.deductionMinor}p`, () => {
    const result = actual(input(['start'], { payMinor: row.payMinor }));
    assert.equal(result.deductionMinor, row.deductionMinor);
    assert.equal(result.calculation.thresholdMinor, '51730');
    assert.equal(result.qualified, false);
    assert.equal(result.notForPayroll, true);
  });
}

for (const row of pack.authoredNoticeRows) test(`authored notice timing: ${row.id}`, () => {
  const result = actual(input(row.notices, {
    paymentDate: row.date, employeeStopRequest: row.employeeStopRequest ?? false,
  }));
  assert.equal(result.instructionActive, row.active);
  assert.equal(result.reason, row.reason);
  assert.equal(result.deductionMinor, row.deductionMinor);
  assert.equal(result.calculation === null, !row.active);
  assert.equal(result.qualified, false);
  assert.equal(result.notForPayroll, true);
  for (const id of row.sourceIds) assert.ok(sources.sources.some(source => source.id === id));
});

for (const row of pack.rejectionRows) test(`unsupported ${row.id} rejects even after SL2; never zero-defaults`, () => {
  for (const notices of [['start'], ['start', 'stop']]) {
    assert.throws(() => actual(input(notices, { paymentDate: '2026-05-15', ...row.override })),
      error => error.message === row.error);
  }
});

test('unknown notice authenticity or practical cutoff assertions reject instead of qualifying real payroll', () => {
  for (const field of ['identityVerified', 'availabilityVerified']) {
    for (const unknown of [false, null, undefined]) {
      const e = envelope(input());
      e.verifiedNotices[0][field] = unknown;
      assert.throws(() => calculateSyntheticPlan1(e), /SYNTHETIC_NOTICE_VERIFICATION/);
    }
  }
  const e = envelope(input());
  e.verifiedNotices = [];
  assert.throws(() => calculateSyntheticPlan1(e), /SYNTHETIC_NOTICE_VERIFICATION/);
  const missingCutoff = input();
  missingCutoff.notices[0].availabilityEvidence = '';
  assert.throws(() => actual(missingCutoff), /SYNTHETIC_NOTICE_FIELDS/);
  const onDate = input();
  onDate.notices[0].firstAvailablePayday = onDate.notices[0].effectiveDate;
  assert.throws(() => actual(onDate), /NOTICE_AVAILABILITY/);
  assert.equal(pack.syntheticFacts.noticeAuthenticityQualified, false);
  assert.equal(pack.syntheticFacts.realPayrollCutoffsQualified, false);
});

test('duplicate instructions and mismatched synthetic notice binding are rejected', () => {
  assert.throws(() => actual(input(['start', 'start'])), /NOTICE_CONFLICT/);
  const e = envelope(input());
  e.input.notices[0].receivedDate = '2026-04-09';
  assert.throws(() => calculateSyntheticPlan1(e), /SYNTHETIC_NOTICE_VERIFICATION/);
  const wrongEmployment = input();
  wrongEmployment.notices[0].employmentId = 'other-synthetic-employee';
  assert.throws(() => actual(wrongEmployment), /NOTICE_INVALID_INSTRUCTION/);
});

test('new fixture review does not qualify the original application case or expand scope', () => {
  const review = json('docs/development/tax-payroll-fixture-review.json');
  assert.equal(digest(bytes(review.fixture.path)), review.fixture.sha256);
  assert.equal(digest(bytes(review.sources.path)), review.sources.sha256);
  assert.equal(review.parentStatus, 'pending');
  assert.equal(review.independentReviewer, null);
  const registry = json('docs/development/tax-payroll-supported-cases.json');
  const row = registry.cases.find(c => c.id === 'payroll-loan-plan_1-2026-27');
  assert.deepEqual(resolvePayrollCase(registry, row.selector),
    { ok: false, code: 'CASE_NOT_QUALIFIED', caseId: row.id });
  assert.equal(pack.qualified, false);
  assert.equal(pack.notForPayroll, true);
  assert.equal(pack.status, 'bounded_fixture_candidate_pending_independent_review');
});
