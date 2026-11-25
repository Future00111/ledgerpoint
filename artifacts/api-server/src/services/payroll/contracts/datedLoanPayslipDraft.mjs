// Offline 2026–27 draft for one loan, ordinary pay and supplied notice evidence.
import { reviewRegularSingleLoanNoticeTiming } from './plan1NoticeFixtures.mjs';
import { calculateRegularEmployeeLoanPayslipDraft } from './employeeMonthOneDraft.mjs';

export function calculateDatedLoanPayslipDraft({ grossHistory, taxCodes, niCategory, week52FreePayMinor, noticeContext }) {
  if (!Array.isArray(grossHistory) || !grossHistory.length) throw new RangeError('Expected consecutive gross payments');
  const timing = reviewRegularSingleLoanNoticeTiming(noticeContext);
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
  const payslip = calculateRegularEmployeeLoanPayslipDraft({ grossHistory, taxCodes, niCategory, frequency, week52FreePayMinor,
    studentPlan: timing.instructionActive && plan !== 'postgraduate' ? plan : null,
    postgraduate: timing.instructionActive && plan === 'postgraduate' });
  return { payslip, timing };
}
