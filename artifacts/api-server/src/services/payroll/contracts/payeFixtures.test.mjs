import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolvePayrollCase} from './caseBoundary.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/hmrc-paye-2026-27-v1.1.json',import.meta.url)));
const registry=JSON.parse(readFileSync(new URL('../../../../../../docs/development/tax-payroll-supported-cases.json',import.meta.url)));

test('pinned PAYE v1.1 source reproduces all cells, provenance and published changes',()=>{
  const bytes=readFileSync(new URL('./fixtures/hmrc-paye-2026-27-v1.1.zip',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.source.sha256);
  const script=fileURLToPath(new URL('./import_hmrc_paye_fixtures.py',import.meta.url));
  assert.deepEqual(JSON.parse(execFileSync('python3',[script],{encoding:'utf8',maxBuffer:2*1024*1024})),fixture);
  assert.match(fixture.source.publishedChanges,/273\.29/);
  assert.equal(fixture.source.workbooks.length,3);
});
test('PAYE references retain every regional sheet, exact signed money and sequence links',()=>{
  assert.equal(fixture.cases.length,168);
  assert.equal(new Set(fixture.cases.map(c=>c.id)).size,168);
  assert.equal(new Set(fixture.cases.map(c=>c.sequenceId)).size,22);
  const counts={};const previous=new Map();
  for(const c of fixture.cases){
    counts[c.input.region]=(counts[c.input.region]??0)+1;
    assert.equal(c.previousExampleId,previous.get(c.sequenceId)??null);previous.set(c.sequenceId,c.id);
    for(const money of [c.input.grossPayMinor,c.input.taxablePayToDateMinor,...Object.values(c.expected)]) assert.match(money,/^-?(0|[1-9][0-9]*)$/);
    assert.equal(c.input.taxYear,'2026-27');assert.ok(['monthly','weekly'].includes(c.input.frequency));
    assert.ok(c.sourceRow>=6);assert.ok(Number.isInteger(c.input.period));
    assert.deepEqual(Object.keys(c.sourceNumericLexemes),['B','C','G','H']);
  }
  assert.deepEqual(counts,{scotland:64,rest_of_uk:64,wales:40});
  assert.ok(fixture.cases.some(c=>BigInt(c.expected.taxDueMinor)<0n),'Official refund examples retained');
  for(const [row,amount] of [[6,'27329'],[7,'34724']]){
    const c=fixture.cases.find(c=>c.input.region==='scotland'&&c.sourceSheet==='K_cumul_mthly'&&c.sourceRow===row);
    assert.equal(c.expected.taxDueMinor,amount);
  }
});
test('regional PAYE references remain unqualified and cannot enable another tax year',()=>{
  assert.equal(fixture.status,'reference_fixtures_only_not_engine_qualification');
  for(const region of ['rest_of_uk','scotland','wales']){
    const row=registry.cases.find(c=>c.id===`payroll-paye-${region}-2026-27`);
    assert.equal(row.referenceFixtures.caseCount,fixture.cases.filter(c=>c.input.region===region).length);
    assert.equal(row.qualificationEvidence,null);
    assert.deepEqual(resolvePayrollCase(registry,row.selector),{ok:false,code:'CASE_NOT_QUALIFIED',caseId:row.id});
    assert.deepEqual(resolvePayrollCase(registry,{...row.selector,taxYear:'2027-28'}),{ok:false,code:'UNKNOWN_CASE'});
  }
});
