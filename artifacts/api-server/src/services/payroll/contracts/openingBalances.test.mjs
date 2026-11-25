import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateDatedLoanPayslipDraft } from './datedLoanPayslipDraft.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/hmrc-paye-2026-27-v1.1.json', import.meta.url)));
const byId = new Map(fixture.cases.map(row => [row.id,row]));
const context = { taxYear:'2026-27', plan:'plan_2', employmentId:'synthetic-job', earningsBasis:'class1_ni_earnings',
  activeEmployment:true, employeeStopRequest:false, otherInstructions:[], notices:[], occupationalPensionOnly:false,
  deceased:false, protectedEarnings:false, concurrentLoan:false, correction:false, offPayroll:false };

function example(row) {
  const { input, previousExampleId } = row;
  const previous = byId.get(previousExampleId);
  assert.equal(previous.input.period, input.period - 1);
  const monthly = input.frequency === 'monthly';
  const paymentDate = new Date(monthly ? Date.UTC(2026,2+input.period,20) : Date.UTC(2026,3,6+7*(input.period-1)));
  return {
    grossHistory:[input.grossPayMinor], taxCodes:input.taxCode + (input.week1Month1 === 'WM1' ? (monthly ? ' M1' : ' W1') : ''),
    noticeContext:{...context,frequency:input.frequency,payMinor:input.grossPayMinor,paymentDate:paymentDate.toISOString().slice(0,10)},
    opening:{employmentId:context.employmentId,taxYear:input.taxYear,frequency:input.frequency,completedPeriods:previous.input.period,
      taxablePayMinor:previous.input.taxablePayToDateMinor,taxPaidMinor:previous.expected.taxDueToDateMinor},
  };
}

const resumable = fixture.cases.filter(row => row.input.period > 1);
for (const row of resumable) {
  test('resume from preceding HMRC workbook row: '+row.id, () => {
    const request = example(row);
    const { payslip } = calculateDatedLoanPayslipDraft(request);
    assert.equal(payslip.payeMinor,row.expected.taxDueMinor);
    assert.equal(String(BigInt(request.opening.taxPaidMinor)+BigInt(payslip.payeMinor)),row.expected.taxDueToDateMinor);
    assert.equal(String(BigInt(request.opening.taxablePayMinor)+BigInt(payslip.grossMinor)),row.input.taxablePayToDateMinor);
  });
}

test('resume rejects an incompatible opening record or a gap before the current payday', () => {
  const request = example(resumable[0]);
  for (const change of [{employmentId:'other-job'},{taxYear:'2025-26'},{frequency:'weekly'},{completedPeriods:0},{completedPeriods:3},
    {taxablePayMinor:'1.00'},{taxPaidMinor:'-1'},{taxPaidMinor:1},{other:'0'}]) {
    assert.throws(()=>calculateDatedLoanPayslipDraft({...request,opening:{...request.opening,...change}}),RangeError);
  }
});

test('a resumed series carries actual deductions through later code changes and refunds', () => {
  for (const row of resumable.filter(item => item.input.period > 2)) {
    const preceding = byId.get(row.previousExampleId);
    const request = example(preceding), current = example(row);
    const { payslip } = calculateDatedLoanPayslipDraft({...current, opening:request.opening,
      grossHistory:[...request.grossHistory,...current.grossHistory], taxCodes:[request.taxCodes,current.taxCodes]});
    assert.equal(payslip.payeMinor,row.expected.taxDueMinor,row.id);
  }
});
