import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewPlan1NoticeTiming} from './plan1NoticeFixtures.mjs';
import {loadPinnedEvidence, specificationTrace} from '../../../../../../tools/payroll-specification/studentLoans.mjs';
import {resolveQualifiedCase} from '../../tax/contracts/caseRegistry.mjs';
const pack=JSON.parse(readFileSync(new URL('./fixtures/plan1-notice-start-stop-2026-27.json',import.meta.url)));
const corpus=loadPinnedEvidence();
const registry=JSON.parse(readFileSync(new URL('../../../../../../docs/development/tax-payroll-supported-cases.json',import.meta.url)));
function observe(input) {
  const timing=reviewPlan1NoticeTiming(input);
  const calculation=timing.instructionActive ? specificationTrace({taxYear:input.taxYear,plan:input.plan,
    frequency:input.frequency,payMinor:input.payMinor,paymentDate:input.paymentDate,earningsBasis:input.earningsBasis,
    confirmedInstruction:true,protectedEarnings:false,concurrentLoan:false,correction:false,offPayroll:false}) : null;
  return {timing,calculation,deductionMinor:calculation?.deductionMinor??'0'};
}
for(const scenario of pack.cases) test(`Plan1 dated notice: ${scenario.id}`,()=>{
  const before=JSON.stringify(scenario),result=observe(scenario.input);
  assert.equal(result.timing.qualified,false);assert.equal(result.timing.notForPayroll,true);
  assert.equal(result.timing.instructionActive,scenario.expected.instructionActive);
  assert.equal(result.timing.reason,scenario.expected.reason);
  assert.equal(result.deductionMinor,scenario.expected.deductionMinor);
  assert.equal(scenario.provenance.kind,'authored_dated_scenario_not_official_HMRC_notice_example');
  assert.equal(scenario.provenance.independentReview,null);
  assert.ok(scenario.provenance.timingSourceIds.every(id=>pack.sources[id]));
  if(result.timing.instructionActive){
    const official=corpus.cases.find(c=>c.id===scenario.provenance.amountSource);
    assert.equal(official.input.payMinor,scenario.input.payMinor);
    assert.equal(official.expected.deductionMinor,scenario.expected.deductionMinor);
    assert.equal(official.input.plan,scenario.input.plan);
    assert.equal(official.input.frequency,scenario.input.frequency);
    assert.equal(official.input.taxYear,scenario.input.taxYear);
  } else assert.equal(result.calculation,null);
  assert.equal(JSON.stringify(scenario),before);
});
test('rounding witness is source-based and official penny-wide boundary remains intact',()=>{
  const witness=pack.roundingWitness;
  for(const [row,pay,amount,excess,numerator] of [[11,'52841','0','1111','9999'],[12,'52842','100','1112','10008']]){
    const input={...pack.cases.find(c=>c.id==='first-start-payday-upper-boundary').input,payMinor:pay};
    const trace=observe(input).calculation,official=corpus.cases.find(c=>c.id===`hmrc-loan-2026-27-plan_1-row-${row}`);
    assert.equal(official.sourceSheet,'Plan_1');assert.equal(official.sourceRow,row);
    assert.equal(official.expected.deductionMinor,amount);
    assert.equal(trace.annualThresholdMinor,witness.annualThresholdMinor);
    assert.equal(trace.periodsPerYear,witness.periodsPerYear);
    assert.equal(trace.thresholdMinor,witness.thresholdMinor);
    assert.equal(trace.excessMinor,excess);assert.equal(trace.recoveryNumerator,numerator);
    assert.equal(trace.wholePoundsDenominator,witness.wholePoundsDenominator);
  }
});
test('missing availability, mismatched employment, conflicting notices and ambiguous context reject',()=>{
  const valid=pack.cases.find(c=>c.id==='first-start-payday-upper-boundary').input;
  for(const mutate of [
    i=>delete i.notices[0].firstAvailablePayday,
    i=>i.notices[0].availabilityEvidence='',
    i=>i.notices[0].firstAvailablePayday=i.notices[0].effectiveDate,
    i=>i.notices[0].receivedDate='2026-04-18',
    i=>i.notices[0].effectiveDate='2026-02-30',
    i=>i.notices[0].employmentId='different-employee',
    i=>i.notices[0].plan='plan_2',
    i=>i.notices.push({...i.notices[0],id:'duplicate'}),
    i=>i.notices[0].type='SL2',
    i=>i.notices[0].type='P45',
    i=>i.otherInstructions=['GNS'],
    i=>i.otherInstructions=['starter'],
    i=>i.offPayroll=true,i=>i.protectedEarnings=true,i=>i.concurrentLoan=true,
    i=>i.deceased=true,i=>i.occupationalPensionOnly=true,i=>i.correction=true,
    i=>i.activeEmployment=false,i=>i.taxYear='2027-28',i=>i.frequency='monthly',
    i=>i.paymentDate='2026-04-05',i=>i.paymentDate='2027-04-06',
    i=>delete i.employeeStopRequest,i=>i.unrecognisedInstruction=true,
  ]){const input=structuredClone(valid);mutate(input);assert.throws(()=>observe(input),/^Error: NOTICE_/);}
});
test('same-day notice dates cannot silently apply start or stop early; receipt alone is insufficient',()=>{
  const get=id=>pack.cases.find(c=>c.id===id);
  assert.equal(observe(get('on-start-date').input).deductionMinor,'0');
  assert.equal(observe(get('on-stop-date-still-active').input).deductionMinor,'100');
  assert.equal(observe(get('late-start-before-practical-payday').input).deductionMinor,'0');
  assert.equal(observe(get('late-stop-before-practical-payday').input).deductionMinor,'100');
  assert.equal(observe(get('employee-request-does-not-stop').input).deductionMinor,'100');
});
test('register link preserves unqualified boundary and precise remaining parent work',()=>{
  const row=registry.cases.find(c=>c.id===pack.caseId);
  assert.equal(pack.cases.length,16);
  assert.equal(new Set(pack.cases.map(c=>c.id)).size,16);
  assert.equal(row.fixturePrerequisite.noticeTimingReference.caseCount,16);
  assert.equal(row.fixturePrerequisite.noticeTimingReference.qualificationEvidence,null);
  assert.equal(row.fixturePrerequisite.noticeTimingReference.status,'reference_only_engine_not_implemented');
  assert.deepEqual(resolveQualifiedCase(registry,row.selector),{ok:false,code:'CASE_NOT_QUALIFIED',caseId:row.id});
  assert.ok(pack.remaining.length>=4);
  assert.equal(pack.amountEvidence.archiveSha256,corpus.source.sha256);
  for(const source of Object.values(pack.sources)){
    assert.ok(source.url.startsWith('https://www.gov.uk/'));
    assert.equal(source.checkedAt,'2026-11-16');
  }
});
