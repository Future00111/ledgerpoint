import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolvePayrollCase} from './caseBoundary.mjs';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/hmrc-student-loans-2026-27-v1.0.json', import.meta.url)));
const registry = JSON.parse(readFileSync(new URL('../../../../../../docs/development/tax-payroll-supported-cases.json', import.meta.url)));
const plans = ['plan_1','plan_2','plan_4','plan_5','postgraduate'];
test('pinned HMRC bytes reproduce all extracted cases and logical spreadsheet row references', () => {
  const source = readFileSync(new URL('./fixtures/hmrc-student-loans-2026-27-v1.0.ods', import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'), fixture.source.sha256);
  const script = fileURLToPath(new URL('./import_hmrc_loan_fixtures.py', import.meta.url));
  assert.deepEqual(JSON.parse(execFileSync('python3', [script], {encoding:'utf8', maxBuffer:1024*1024})), fixture);
  // First published example is A11:C11 on Plan_1; amounts remain exact strings.
  assert.equal(fixture.cases[0].sourceRow, 11);
  assert.equal(fixture.cases[0].input.payMinor, '52841');
});
test('reference matrix covers all 130 exact amounts across five plans and four frequencies', () => {
  assert.equal(fixture.cases.length, 130);
  assert.equal(new Set(fixture.cases.map(c=>c.id)).size, 130);
  for (const plan of plans) {
    const cases = fixture.cases.filter(c=>c.input.plan===plan);
    assert.equal(cases.length, 26);
    assert.deepEqual(Object.fromEntries(['weekly','fortnightly','four_weekly','monthly'].map(f=>[f,cases.filter(c=>c.input.frequency===f).length])),
      {weekly:6,fortnightly:7,four_weekly:6,monthly:7});
    for(const c of cases) {
      assert.equal(c.input.taxYear,'2026-27');
      assert.match(c.input.payMinor,/^(0|[1-9][0-9]*)$/);
      assert.match(c.expected.deductionMinor,/^(0|[1-9][0-9]*)$/);
      assert.equal(BigInt(c.expected.deductionMinor)%100n,0n);
    }
    for(const frequency of ['weekly','fortnightly','four_weekly','monthly']) {
      const edge=cases.filter(c=>c.input.frequency===frequency);
      assert.equal(edge[0].expected.deductionMinor,'0');
      assert.equal(edge[1].expected.deductionMinor,'100');
      assert.equal(BigInt(edge[1].input.payMinor)-BigInt(edge[0].input.payMinor),1n);
    }
  }
});
test('reference coverage never promotes payroll calculation or another tax year', () => {
  assert.equal(fixture.status,'reference_fixtures_only_not_engine_qualification');
  for(const plan of plans) {
    const row=registry.cases.find(c=>c.id===`payroll-loan-${plan}-2026-27`);
    assert.ok(row);
    assert.equal(row.referenceFixtures.caseCount,26);
    assert.equal(row.referenceFixtures.plan,plan);
    assert.deepEqual(resolvePayrollCase(registry,row.selector),{ok:false,code:'CASE_NOT_QUALIFIED',caseId:row.id});
    assert.deepEqual(resolvePayrollCase(registry,{...row.selector,taxYear:'2027-28'}),{ok:false,code:'UNKNOWN_CASE'});
  }
});
