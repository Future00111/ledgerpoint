// Offline 2026–27 draft for ordinary pay and supplied notice evidence.
import { reviewPairedLoanNoticeTiming, reviewRegularSingleLoanNoticeTiming } from './plan1NoticeFixtures.mjs';
import { calculateRegularEmployeeLoanPayslipDraft } from './employeeMonthOneDraft.mjs';

export function calculateDatedLoanPayslipDraft({ grossHistory, taxCodes, niCategory, week52FreePayMinor, noticeContext, priorityOrder, opening, ...extra }) {
  if (!Array.isArray(grossHistory) || !grossHistory.length) throw new RangeError('Expected consecutive gross payments');
  if (Object.keys(extra).length) throw new RangeError('Unsupported dated payslip context');
  if (opening !== undefined && (!opening || opening.employmentId !== noticeContext?.employmentId ||
      !Object.hasOwn(opening,'employmentId'))) throw new RangeError('Opening balance employment must match the notice context');
  const protectedPay = noticeContext?.protectedEarnings === true;
  if (protectedPay !== (priorityOrder !== undefined)) throw new RangeError('Priority order and protected earnings must be supplied together');
  // Timing is independent of the order. Apply the restriction after resolving both notices.
  const timingContext = protectedPay ? { ...noticeContext, protectedEarnings: false } : noticeContext;
  const paired = noticeContext?.concurrentLoan === true;
  const timing = paired ? reviewPairedLoanNoticeTiming(timingContext) : reviewRegularSingleLoanNoticeTiming(timingContext);
  const { frequency, paymentDate, payMinor, plan } = noticeContext;
  const payday = new Date(paymentDate);
  const days = (payday.getTime() - Date.UTC(2026, 3, 6)) / 86400000;
  const intervalDays = { weekly: 7, fortnightly: 14, four_weekly: 28 };
  const period = frequency === 'monthly'
    ? (payday.getUTCFullYear() - 2026) * 12 + payday.getUTCMonth() - 2 - Number(payday.getUTCDate() < 6)
    : Math.floor(days / intervalDays[frequency]) + 1;
  if (grossHistory.length + (opening?.completedPeriods ?? 0) !== period || grossHistory.at(-1) !== payMinor) {
    throw new RangeError('Notice review must match the current payslip period and gross pay');
  }
  const studentActive = paired ? timing.student.instructionActive : plan !== 'postgraduate' && timing.instructionActive;
  const postgraduate = paired ? timing.postgraduate.instructionActive : plan === 'postgraduate' && timing.instructionActive;
  const payslip = calculateRegularEmployeeLoanPayslipDraft({ grossHistory, taxCodes, niCategory, frequency, week52FreePayMinor, opening,
    studentPlan: studentActive ? plan : null, postgraduate });
  if (!protectedPay) return { payslip, timing };
  // Ordinary cash pay only. The caller supplies the actual priority deduction and
  // protected level. Pre-loan take-home pay is the attachable pay in this draft.
  if (!priorityOrder || Object.keys(priorityOrder).length !== 2 ||
      !['deductionMinor', 'protectedLevelMinor'].every(key => Object.hasOwn(priorityOrder, key) &&
        typeof priorityOrder[key] === 'string' && /^(0|[1-9][0-9]{0,15})$/.test(priorityOrder[key]))) {
    throw new RangeError('Expected a priority order deduction and protected level in pence');
  }
  const studentDue = BigInt(payslip.studentLoanMinor);
  const postgraduateDue = BigInt(payslip.postgraduateLoanMinor);
  const afterOrder = BigInt(payslip.netMinor) + studentDue + postgraduateDue - BigInt(priorityOrder.deductionMinor);
  if (afterOrder < 0n) throw new RangeError('Priority deduction exceeds available take-home pay');
  const headroom = afterOrder - BigInt(priorityOrder.protectedLevelMinor);
  const available = headroom > 0n ? headroom / 100n * 100n : 0n;
  const postgraduatePaid = postgraduateDue < available ? postgraduateDue : available;
  const remaining = available - postgraduatePaid;
  const student = studentDue < remaining ? studentDue : remaining;
  return { timing, payslip: { ...payslip, priorityOrderMinor: priorityOrder.deductionMinor,
    postgraduateLoanMinor: String(postgraduatePaid), studentLoanMinor: String(student),
    netMinor: String(afterOrder - postgraduatePaid - student) } };
}

// Advance one ordinary payday and return the exact opening record for the next.
// Year-end extra paydays continue to use the full-history calculation.
export function advanceDatedLoanPayslipDraft(request) {
  if (!Array.isArray(request?.grossHistory) || request.grossHistory.length !== 1) {
    throw new RangeError('Expected exactly one current payment');
  }
  const result = calculateDatedLoanPayslipDraft(request);
  const { opening, noticeContext } = request;
  const completedPeriods = (opening?.completedPeriods ?? 0) + 1;
  const periods = { weekly:52, fortnightly:26, four_weekly:13, monthly:12 };
  const taxablePay = BigInt(opening?.taxablePayMinor ?? 0) + BigInt(result.payslip.grossMinor);
  const taxPaid = BigInt(opening?.taxPaidMinor ?? 0) + BigInt(result.payslip.payeMinor);
  if (taxablePay > 9999999999999999n || taxPaid < 0n || taxPaid > 9999999999999999n) {
    throw new RangeError('Closing figures exceed the supported opening balance range');
  }
  const nextOpening = completedPeriods === periods[noticeContext.frequency] ? null : {
    employmentId:noticeContext.employmentId, taxYear:noticeContext.taxYear, frequency:noticeContext.frequency,
    completedPeriods, taxablePayMinor:String(taxablePay), taxPaidMinor:String(taxPaid),
  };
  return { ...result, taxablePayToDateMinor:String(taxablePay), taxPaidToDateMinor:String(taxPaid), nextOpening };
}
