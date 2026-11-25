import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { advanceDatedLoanPayslipDraft, calculateDatedLoanPayslipDraft } from './datedLoanPayslipDraft.mjs';

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

for (const region of ['rest_of_uk','scotland','wales']) {
  for (const frequency of ['weekly','monthly']) {
    test(region+' '+frequency+' carries generated balances across every official sequence', () => {
      const balances = new Map();
      for (const row of fixture.cases.filter(row => row.input.region === region && row.input.frequency === frequency)) {
        const { input } = row, monthly = frequency === 'monthly';
        const day = monthly ? Date.UTC(2026,2+input.period,20) : Date.UTC(2026,3,6+7*(input.period-1));
        const opening = input.period === 1 ? undefined : balances.get(row.previousExampleId);
        const result = advanceDatedLoanPayslipDraft({
          opening, grossHistory:[input.grossPayMinor],
          taxCodes:input.taxCode + (input.week1Month1 === 'WM1' ? (monthly ? ' M1' : ' W1') : ''),
          noticeContext:{...context, frequency, paymentDate:new Date(day).toISOString().slice(0,10), payMinor:input.grossPayMinor},
        });
        assert.equal(result.payslip.payeMinor,row.expected.taxDueMinor,row.id);
        assert.equal(result.taxPaidToDateMinor,row.expected.taxDueToDateMinor,row.id);
        assert.equal(result.taxablePayToDateMinor,input.taxablePayToDateMinor,row.id);
        balances.set(row.id,result.nextOpening);
      }
    });
  }
}

for (const [frequency,periods,days] of [['weekly',52,7],['fortnightly',26,14],['four_weekly',13,28],['monthly',12,0]]) {
  test(frequency+' rolls forward every ordinary payday and closes the annual balances', () => {
    let opening;
    for (let period=1;period<=periods;period++) {
      const date = days ? Date.UTC(2026,3,6+(period-1)*days) : Date.UTC(2026,2+period,20);
      const result = advanceDatedLoanPayslipDraft({ opening, grossHistory:['100000'], taxCodes:'BR',
        noticeContext:{...context, frequency,paymentDate:new Date(date).toISOString().slice(0,10),payMinor:'100000'} });
      assert.equal(result.taxablePayToDateMinor,String(period*100000));
      assert.equal(result.taxPaidToDateMinor,String(period*20000));
      opening=result.nextOpening;
      if (period<periods) assert.equal(opening.completedPeriods,period);
    }
    assert.equal(opening,null);
  });
}

test('advancing a draft refuses replay of multiple payments and a non-reusable closing balance', () => {
  const request = example(resumable[0]);
  assert.throws(()=>advanceDatedLoanPayslipDraft({...request,grossHistory:['10000','20000']}),RangeError);
  assert.throws(()=>advanceDatedLoanPayslipDraft({...request,opening:{...request.opening,taxablePayMinor:'9999999999999999'}}),RangeError);
});
