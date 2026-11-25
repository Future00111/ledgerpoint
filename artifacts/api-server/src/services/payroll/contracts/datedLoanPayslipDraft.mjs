// Offline 2026–27 draft for ordinary pay and supplied notice evidence.
import { reviewPairedLoanNoticeTiming, reviewRegularSingleLoanNoticeTiming } from './plan1NoticeFixtures.mjs';
import { calculateRegularEmployeeLoanPayslipDraft } from './employeeMonthOneDraft.mjs';

export function calculateDatedLoanPayslipDraft({ grossHistory, taxCodes, niCategory, week52FreePayMinor, noticeContext }) {
  if (!Array.isArray(grossHistory) || !grossHistory.length) throw new RangeError('Expected consecutive gross payments');
  const paired = noticeContext?.concurrentLoan === true;
  const timing = paired ? reviewPairedLoanNoticeTiming(noticeContext) : reviewRegularSingleLoanNoticeTiming(noticeContext);
  const { frequency, paymentDate, payMinor, plan } = noticeContext;
  const payday = new Date(paymentDate);
  const days = (payday.getTime() - Date.UTC(2026, 3, 6)) / 86400000;
  const intervalDays = { weekly: 7, fortnightly: 14, four_weekly: 28 };
  const period = frequency === 'monthly'
    ? (payday.getUTCFullYear() - 2026) * 12 + payday.getUTCMonth() - 2 - Number(payday.getUTCDate() < 6)
    : Math.floor(days / intervalDays[frequency]) + 1;
  if (grossHistory.length !== period || grossHistory.at(-1) !== payMinor) {
    throw new RangeError('Notice review must match the current payslip period and gross pay');
  }
  const studentActive = paired ? timing.student.instructionActive : plan !== 'postgraduate' && timing.instructionActive;
  const postgraduate = paired ? timing.postgraduate.instructionActive : plan === 'postgraduate' && timing.instructionActive;
  const payslip = calculateRegularEmployeeLoanPayslipDraft({ grossHistory, taxCodes, niCategory, frequency, week52FreePayMinor,
    studentPlan: studentActive ? plan : null, postgraduate });
  return { payslip, timing };
}
