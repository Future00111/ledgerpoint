// Offline reference only. The caller supplies synthetic notice and payday evidence.
import {reviewPairedLoanNoticeTiming} from '../../artifacts/api-server/src/services/payroll/contracts/plan1NoticeFixtures.mjs';
import {specificationTrace} from './studentLoans.mjs';

export function reviewDatedLoanDeductions(input) {
  const timing = reviewPairedLoanNoticeTiming(input);
  const {taxYear, frequency, paymentDate, payMinor, earningsBasis, protectedEarnings, correction, offPayroll} = input;

  function deduction(plan, instruction) {
    if (!instruction.instructionActive) return '0';
    return specificationTrace({taxYear, frequency, paymentDate, payMinor, earningsBasis, plan,
      protectedEarnings, correction, offPayroll, confirmedInstruction:true, concurrentLoan:false}).deductionMinor;
  }

  const studentMinor = deduction(input.plan, timing.student);
  const postgraduateMinor = deduction('postgraduate', timing.postgraduate);
  return {qualified:false, notForPayroll:true, timing, studentMinor, postgraduateMinor,
    totalDeductionMinor:(BigInt(studentMinor) + BigInt(postgraduateMinor)).toString()};
}
