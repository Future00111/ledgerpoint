import { monthlyPlan2PostgraduateTrace, regularPlan2PostgraduateTrace, regularStudentPostgraduateTrace } from './studentLoans.mjs';

function minorUnits(value) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,15})$/.test(value)) {
    throw new Error('SPEC_ATTACHMENT_AMOUNT');
  }
  return BigInt(value);
}

// Offline 2026–27 regular-period reference. The caller supplies net attachable earnings
// after the priority order has been deducted, separately from Class 1 NI pay.
// HMRC software specification section 3 and HMRC manual CSLM18025.
function protectedLoanPairTrace(input, calculateOrdinary, studentKey) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !['protectedEarnings', 'netAttachableAfterOrderMinor', 'protectedLevelMinor'].every(key => Object.hasOwn(input, key))) {
    throw new Error('SPEC_ATTACHMENT_CONTEXT');
  }
  const { netAttachableAfterOrderMinor, protectedLevelMinor, protectedEarnings, ...period } = input;
  if (protectedEarnings !== true) throw new Error('SPEC_ATTACHMENT_CONTEXT');
  const net = minorUnits(netAttachableAfterOrderMinor);
  const floor = minorUnits(protectedLevelMinor);
  const ordinary = calculateOrdinary({ ...period, protectedEarnings: false });
  const available = net > floor ? (net - floor) / 100n * 100n : 0n;
  const postgraduateDue = BigInt(ordinary.postgraduate.deductionMinor);
  const postgraduate = postgraduateDue < available ? postgraduateDue : available;
  const remaining = available - postgraduate;
  const studentDue = BigInt(ordinary[studentKey].deductionMinor);
  const student = studentDue < remaining ? studentDue : remaining;
  return {
    qualified: false, notForPayroll: true,
    availableForLoansMinor: available.toString(),
    postgraduateDeductionMinor: postgraduate.toString(),
    [studentKey + 'DeductionMinor']: student.toString(),
    totalDeductionMinor: (postgraduate + student).toString(),
  };
}

export function protectedMonthlyLoanPairTrace(input) {
  return protectedLoanPairTrace(input, monthlyPlan2PostgraduateTrace, 'plan2');
}

export function protectedRegularLoanPairTrace(input) {
  return protectedLoanPairTrace(input, regularPlan2PostgraduateTrace, 'plan2');
}

export function protectedRegularStudentPostgraduateTrace(input) {
  const result = protectedLoanPairTrace(input, regularStudentPostgraduateTrace, 'student');
  return { ...result, studentPlan: input.confirmedStudentPlan };
}
