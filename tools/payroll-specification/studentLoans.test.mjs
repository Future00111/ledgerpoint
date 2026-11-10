import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareOfficialExamples,loadPinnedEvidence,specificationTrace,syntheticContext} from './studentLoans.mjs';
import {resolvePayrollCase} from '../../artifacts/api-server/src/services/payroll/contracts/caseBoundary.mjs';

const input=(overrides={})=>({taxYear:'2026-27',plan:'plan_1',frequency:'weekly',payMinor:'52842',...syntheticContext,...overrides});
test('pinned software order matches all 130 existing official examples, without qualification',()=>{
  const result=compareOfficialExamples();
  assert.equal(result.count,130);assert.deepEqual(result.discrepancies,[]);assert.equal(result.qualified,false);
});
for(const plan of ['plan_1','plan_2','plan_4','plan_5','postgraduate']) {
  for(const frequency of ['weekly','fortnightly','four_weekly','monthly']) {
    test(`${plan}/${frequency}: threshold and penny-wide first whole-pound boundary`,()=>{
      const row=loadPinnedEvidence().cases.filter(c=>c.input.plan===plan&&c.input.frequency===frequency);
      const trace=specificationTrace(input({plan,frequency}));
      const threshold=BigInt(trace.thresholdMinor);
      for(const pay of [0n,threshold-1n,threshold,threshold+1n])
        assert.equal(specificationTrace(input({plan,frequency,payMinor:pay.toString()})).deductionMinor,'0');
      assert.equal(BigInt(row[1].input.payMinor)-BigInt(row[0].input.payMinor),1n);
      assert.equal(specificationTrace(input(row[0].input)).deductionMinor,'0');
      assert.equal(specificationTrace(input(row[1].input)).deductionMinor,'100');
    });
  }
}
test('threshold truncates annual/period directly; never multiply rounded weekly constants or deductions',()=>{
  const fortnight=specificationTrace(input({frequency:'fortnightly',payMinor:'104572'}));
  assert.equal(fortnight.thresholdMinor,'103461');assert.equal(fortnight.deductionMinor,'0');
  // Multiplying the rounded weekly threshold gives 103460 and incorrectly £1.
  assert.equal((104572n-51730n*2n)*9n/10000n*100n,100n);
  assert.equal(specificationTrace(input({frequency:'fortnightly',payMinor:'104573'})).deductionMinor,'100');
  // Rounding each average week's deduction before multiplying would give £0.
  assert.equal(((104573n-51730n*2n)*9n/(2n*10000n))*100n*2n,0n);
});
test('invalid inputs and unsupported contexts fail closed',()=>{
  for(const delta of [{taxYear:'2025-26'},{plan:'plan_3'},{plan:'__proto__'},{frequency:'annual'},
    {payMinor:52842},{payMinor:'-1'},{payMinor:'01'},{payMinor:'1.5'},{payMinor:'10000000000000000'},
    {paymentDate:'2026-04-05'},{paymentDate:'2027-04-06'},{paymentDate:'2027-02-29'},
    {earningsBasis:'gross_pay'},{confirmedInstruction:false},{protectedEarnings:true},{concurrentLoan:true},
    {correction:true},{offPayroll:true},{extra:'not allowed'}]) assert.throws(()=>specificationTrace(input(delta)));
  for(const key of Object.keys(input())) {const i=input();delete i[key];assert.throws(()=>specificationTrace(i));}
  for(const date of ['2026-04-06','2027-04-05']) assert.equal(specificationTrace(input({paymentDate:date})).qualified,false);
});
test('trace is exact, non-cumulative, and never labels itself payroll-ready',()=>{
  const first=specificationTrace(input());specificationTrace(input({payMinor:'9999999999999999'}));
  assert.deepEqual(specificationTrace(input()),first);
  assert.equal(first.thresholdMinor,'51730');assert.equal(first.excessMinor,'1112');
  assert.equal(first.recoveryNumerator,'10008');assert.equal(first.deductionMinor,'100');
  assert.equal(first.notForPayroll,true);
});
test('every existing loan case remains blocked in the real application boundary',()=>{
  const registry=JSON.parse(readFileSync(new URL('../../docs/development/tax-payroll-supported-cases.json',import.meta.url)));
  const cases=registry.cases.filter(c=>c.id.startsWith('payroll-loan-'));
  assert.equal(cases.length,5);
  for(const c of cases) assert.deepEqual(resolvePayrollCase(registry,c.selector),
    {ok:false,code:'CASE_NOT_QUALIFIED',caseId:c.id});
});
