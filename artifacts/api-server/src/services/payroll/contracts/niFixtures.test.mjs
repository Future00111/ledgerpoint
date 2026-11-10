import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateCaseRegistry } from '../../tax/contracts/caseRegistry.mjs';
import { selectNiReference } from './niReference.mjs';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/hmrc-ni-2026-27-v1.0.json', import.meta.url)));
const registry = JSON.parse(readFileSync(new URL('../../../../../../docs/development/tax-payroll-supported-cases.json', import.meta.url)));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
test('director NI references preserve distinct annual and reconciliation stages without qualifying an engine',()=>{
  execFileSync('python',['-B',fileURLToPath(new URL('./director_fixtures_test.py',import.meta.url))],{stdio:'pipe'});
});
test('NI official archive reproduces every cached reference cell without network or engine calculations', () => {
  assert.equal(digest(readFileSync(new URL('./fixtures/hmrc-ni-2026-27-v1.0.zip', import.meta.url))),fixture.source.sha256);
  const reproduced=JSON.parse(execFileSync('python',['-B',fileURLToPath(new URL('./import_hmrc_ni_fixtures.py',import.meta.url))],{maxBuffer:4*1024*1024}));
  assert.deepEqual(reproduced,fixture);
});
test('NI references cover 16 categories and four frequencies with source lineage and balanced exact pennies',()=>{
  assert.equal(fixture.cases.length,896);
  assert.equal(new Set(fixture.cases.map(c=>c.id)).size,896);
  for(const category of 'ABCHJMVZFISLDEKN') for(const frequency of ['weekly','fortnightly','four_weekly','monthly']) {
    const cases=fixture.cases.filter(c=>c.input.category===category&&c.input.frequency===frequency);
    assert.equal(cases.length,14);
    for(const c of cases) {
      assert.equal(c.input.taxYear,'2026-27');assert.ok([0,1].includes(c.input.period));
      assert.equal(c.sourceSheet,`Cat_${category}`);assert.ok(c.sourceRow>=5);
      assert.ok(fixture.source.workbooks.some(b=>b.path===c.sourceWorkbook));
      for(const amount of [c.input.grossPayMinor,...Object.values(c.expected)]) assert.match(amount,/^\d+$/);
      assert.equal(BigInt(c.expected.employeeNiMinor)+BigInt(c.expected.employerNiMinor),BigInt(c.expected.totalNiMinor));
    }
  }
});
test('four official period-zero rows remain visible and quarantined rather than silently repaired',()=>{
  const anomalies=fixture.cases.filter(c=>c.sourceIssues.length);
  assert.deepEqual(anomalies.map(c=>[c.sourceSheet,c.sourceRow]),[['Cat_S',26],['Cat_S',44],['Cat_L',26],['Cat_L',44]]);
  for(const c of fixture.cases) {
    assert.equal(c.input.period,Number(c.sourceNumericLexemes.C));
    assert.deepEqual(c.sourceIssues,c.input.period===0?['period_zero_requires_source_clarification']:[]);
  }
});
test('reference lookup fails closed for quarantined, ambiguous, wrong-year and changed-status inputs',()=>{
  for(const row of fixture.cases) {
    const result=selectNiReference(fixture,row.id,'2026-27');
    assert.equal(result.ok,row.sourceIssues.length===0);
    if(result.ok) {assert.equal(result.engineQualified,false);assert.equal(result.referenceOnly,true);}
    else assert.equal(result.code,'NI_REFERENCE_REQUIRES_SOURCE_CLARIFICATION');
  }
  const row=fixture.cases[0];
  assert.equal(selectNiReference(fixture,row.id,'2027-28').ok,false);
  assert.equal(selectNiReference({...fixture,status:'supported'},row.id,'2026-27').ok,false);
  assert.equal(selectNiReference({...fixture,cases:[row,row]},row.id,'2026-27').ok,false);
  assert.equal(selectNiReference(fixture,'missing','2026-27').ok,false);
  const anomaly=fixture.cases.find(c=>c.sourceIssues.length);
  assert.equal(selectNiReference({...fixture,cases:[{...anomaly,sourceIssues:[]}]},anomaly.id,'2026-27').ok,false);
});
test('official penny boundaries and relief categories are explicit reference values, not invented rates',()=>{
  const find=(category,gross)=>fixture.cases.find(c=>c.input.category===category&&c.input.frequency==='weekly'&&c.input.grossPayMinor===gross).expected;
  assert.deepEqual(find('A','9603'),{employeeNiMinor:'0',employerNiMinor:'0',totalNiMinor:'0'});
  assert.deepEqual(find('A','9604'),{employeeNiMinor:'0',employerNiMinor:'1',totalNiMinor:'1'});
  assert.deepEqual(find('H','9604'),{employeeNiMinor:'0',employerNiMinor:'0',totalNiMinor:'0'});
  assert.ok(fixture.cases.some(c=>c.sourceNumericLexemes.F.length>10));
});
test('NI reference pack is linked without promoting the case register or claiming accountant review',()=>{
  validateCaseRegistry(registry);
  const family=registry.payrollPrerequisites.families.find(f=>f.id==='national_insurance');
  assert.equal(family.status,'unqualified');assert.equal(family.expectedResultEvidence,null);
  assert.equal(family.referenceFixturePack.path,'artifacts/api-server/src/services/payroll/contracts/fixtures/hmrc-ni-2026-27-v1.0.json');
  assert.equal(family.referenceFixturePack.sourceSha256,fixture.source.sha256);
  assert.equal(family.referenceFixturePack.caseCount,896);
  assert.equal(family.referenceFixturePack.qualification,fixture.status);
  assert.equal(fixture.independentReview,null);
  assert.equal(fixture.effectiveFrom,'2026-04-06');assert.equal(fixture.effectiveTo,'2027-04-05');
  assert.ok(fixture.limitations.some(x=>x.includes('Directors')));
  assert.ok(registry.cases.every(c=>c.status!=='supported'));
});
