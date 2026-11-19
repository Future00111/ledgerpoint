import { monthlyPlan2PostgraduateTrace } from './studentLoans.mjs';

function minorUnits(value) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,15})$/.test(value)) {
    throw new Error('SPEC_ATTACHMENT_AMOUNT');
  }
  return BigInt(value);
}

// Offline 2026–27 monthly reference. The caller supplies net attachable earnings
// after the priority order has been deducted, separately from Class 1 NI pay.
// HMRC software specification section 3 and HMRC manual CSLM18025.
export function protectedMonthlyLoanPairTrace(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !['protectedEarnings', 'netAttachableAfterOrderMinor', 'protectedLevelMinor'].every(key => Object.hasOwn(input, key))) {
    throw new Error('SPEC_ATTACHMENT_CONTEXT');
  }
  const { netAttachableAfterOrderMinor, protectedLevelMinor, protectedEarnings, ...period } = input;
  if (protectedEarnings !== true) throw new Error('SPEC_ATTACHMENT_CONTEXT');
  const net = minorUnits(netAttachableAfterOrderMinor);
  const floor = minorUnits(protectedLevelMinor);
  const ordinary = monthlyPlan2PostgraduateTrace({ ...period, protectedEarnings: false });
  const available = net > floor ? (net - floor) / 100n * 100n : 0n;
  const postgraduateDue = BigInt(ordinary.postgraduate.deductionMinor);
  const postgraduate = postgraduateDue < available ? postgraduateDue : available;
  const remaining = available - postgraduate;
  const plan2Due = BigInt(ordinary.plan2.deductionMinor);
  const plan2 = plan2Due < remaining ? plan2Due : remaining;
  return {
    qualified: false, notForPayroll: true,
    availableForLoansMinor: available.toString(),
    postgraduateDeductionMinor: postgraduate.toString(),
    plan2DeductionMinor: plan2.toString(),
    totalDeductionMinor: (postgraduate + plan2).toString(),
  };
}
