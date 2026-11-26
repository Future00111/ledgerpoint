// Offline 2026–27 scenario: UK, weekly or monthly PAYE, zero opening balances,
// ordinary cash earnings, supplied NI category, no other deductions or adjustments.
function earningsAbove(gross, threshold) {
  return gross > threshold ? gross - threshold : 0n;
}

function roundedNi(hundredthsOfPenny) {
  // HMRC uses the third decimal place of pounds: 0–5 down, 6–9 up.
  const pennies = hundredthsOfPenny / 100n;
  return hundredthsOfPenny % 100n >= 60n ? pennies + 1n : pennies;
}

export function calculateApril999LDraft(grossMinor, niCategory = 'A') {
  return calculateAprilEmployeeDraft(grossMinor, '999L', niCategory);
}

export function calculateAprilEmployeeDraft(grossMinor, taxCode, niCategory = 'A') {
  const gross = readGross(grossMinor);
  const due = taxForPayday(gross, gross, 0n, taxCode, 1n);
  return payslip(gross, cappedDeduction(due, gross), niCategory);
}

// Consecutive ordinary paydays with the same code and no previous employment.
export function calculateMayEmployeeDraft(aprilGrossMinor, mayGrossMinor, taxCode, niCategory = 'A') {
  return calculateMonthlyEmployeeDraft([aprilGrossMinor, mayGrossMinor], taxCode, niCategory);
}

// Supply one code throughout, or the code in force on each payday. A trailing ' M1' selects month-one treatment.
// Gross and code histories start in April.
export function calculateMonthlyEmployeeDraft(grossHistory, taxCodes, niCategory = 'A') {
  return calculateEmployeeDraft(grossHistory, taxCodes, niCategory, 'monthly');
}

export function calculateWeeklyEmployeeDraft(grossHistory, taxCodes, niCategory = 'A', week52FreePayMinor) {
  return calculateEmployeeDraft(grossHistory, taxCodes, niCategory, 'weekly', week52FreePayMinor);
}

export function calculateFortnightlyEmployeeDraft(grossHistory, taxCodes, niCategory = 'A', week52FreePayMinor) {
  return calculateEmployeeDraft(grossHistory, taxCodes, niCategory, 'fortnightly', week52FreePayMinor);
}

export function calculateFourWeeklyEmployeeDraft(grossHistory, taxCodes, niCategory = 'A', week52FreePayMinor) {
  return calculateEmployeeDraft(grossHistory, taxCodes, niCategory, 'four_weekly', week52FreePayMinor);
}

const loanPeriods = new Map([['weekly', 52n], ['fortnightly', 26n], ['four_weekly', 13n], ['monthly', 12n]]);
const studentThresholds = new Map([['plan_1', 2690000n], ['plan_2', 2938500n], ['plan_4', 3379500n], ['plan_5', 2500000n]]);

// Offline ordinary-pay scenario: gross equals Class 1 earnings, no attachment orders,
// and the caller supplies the loan instructions confirmed active for this payday.
export function calculateRegularEmployeeLoanPayslipDraft({
  grossHistory, taxCodes, frequency, niCategory = 'A', studentPlan, postgraduate, week52FreePayMinor, opening, ...extra
}) {
  if (Object.keys(extra).length) throw new RangeError('Unsupported loan payslip context');
  const periods = loanPeriods.get(frequency);
  if (!periods) throw new RangeError('Expected a regular payroll frequency');
  if (studentPlan !== null && !studentThresholds.has(studentPlan)) throw new RangeError('Expected a confirmed student plan or null');
  if (typeof postgraduate !== 'boolean') throw new RangeError('Expected postgraduate instruction status');
  const slip = calculateEmployeeDraft(grossHistory, taxCodes, niCategory, frequency, week52FreePayMinor, opening);
  const gross = BigInt(slip.grossMinor);
  // HMRC sections 3–4: truncate each period threshold to pence and each deduction to pounds.
  const deduction = (annualThreshold, rate) => earningsAbove(gross, annualThreshold / periods) * rate / 10000n * 100n;
  const student = studentPlan === null ? 0n : deduction(studentThresholds.get(studentPlan), 9n);
  const postgrad = postgraduate ? deduction(2100000n, 6n) : 0n;
  return { ...slip, studentLoanMinor: String(student), postgraduateLoanMinor: String(postgrad),
    netMinor: String(BigInt(slip.netMinor) - student - postgrad) };
}

function calculateEmployeeDraft(grossHistory, taxCodes, niCategory, frequency, week52FreePayMinor, opening) {
  const paye = calculatePaydayPaye(grossHistory, taxCodes, frequency, week52FreePayMinor, opening);
  return payslip(BigInt(grossHistory.at(-1)), paye, niCategory, niThresholdsByFrequency.get(frequency));
}

// One regular payment per tax week from week 1. NI uses only payments since appointment.
export function calculateWeeklyDirectorPayslipDraft(grossHistory, taxCodes, category, appointmentWeek, week52FreePayMinor) {
  return weeklyDirectorPayslip(grossHistory, taxCodes, category, appointmentWeek, week52FreePayMinor, calculateDirectorNiDraft);
}

// Final payday under the alternative method. Pass the NI already paid since appointment.
export function calculateFinalWeeklyAlternativeDirectorPayslipDraft(grossHistory, taxCodes, category, appointmentWeek, paid, week52FreePayMinor) {
  return weeklyDirectorPayslip(grossHistory, taxCodes, category, appointmentWeek, week52FreePayMinor,
    (history, niCategory, week) => reconcileDirectorNiDraft(history, niCategory, week, paid));
}

// One monthly payment from April onwards; director in post at the start of the tax year.
export function calculateFullYearMonthlyDirectorPayslipDraft(grossHistory, taxCodes, category) {
  const paye = calculatePaydayPaye(grossHistory, taxCodes, 'monthly');
  return formatDirectorPayslip(grossHistory, paye, calculateDirectorNiDraft(grossHistory, category, 1));
}

export function calculateFinalFullYearMonthlyAlternativeDirectorPayslipDraft(grossHistory, taxCodes, category, paid) {
  const paye = calculatePaydayPaye(grossHistory, taxCodes, 'monthly');
  return formatDirectorPayslip(grossHistory, paye, reconcileDirectorNiDraft(grossHistory, category, 1, paid));
}

// One dated payment per tax month, starting in April 2026. Prior NI paid, when
// provided, is the director-only balance before the final alternative-method payday.
export function calculateAppointedMonthlyDirectorPayslipDraft(payments, taxCodes, category, appointmentDate, finalPaid) {
  return calculateDatedDirectorPayslipDraft(payments, taxCodes, category, appointmentDate, 'monthly', finalPaid);
}

export function calculateDatedDirectorPayslipDraft(payments, taxCodes, category, appointmentDate, frequency, finalPaid, week52FreePayMinor) {
  return datedDirectorPayslip(payments, taxCodes, category, appointmentDate, frequency, finalPaid, week52FreePayMinor, false);
}

// Regular alternative-method payday before reconciliation. Category eligibility is supplied by payroll.
export function calculateInterimAlternativeDirectorPayslipDraft(payments, taxCodes, category, appointmentDate, frequency, week52FreePayMinor) {
  return datedDirectorPayslip(payments, taxCodes, category, appointmentDate, frequency, undefined, week52FreePayMinor, true);
}

function datedDirectorPayslip(payments, taxCodes, category, appointmentDate, frequency, finalPaid, week52FreePayMinor, interim) {
  if (!niThresholdsByFrequency.has(frequency)) throw new RangeError('Unsupported dated pay frequency');
  const start = Date.UTC(2026, 3, 6);
  const end = Date.UTC(2027, 3, 6);
  const taxDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError('Expected YYYY-MM-DD');
    const timestamp = Date.parse(value + 'T00:00:00Z');
    if (!Number.isFinite(timestamp) || timestamp >= end ||
        new Date(timestamp).toISOString().slice(0, 10) !== value) throw new RangeError('Expected valid date by the end of 2026–27');
    return timestamp;
  };
  const appointed = Math.max(start, taxDate(appointmentDate));
  if (!Array.isArray(payments) || !payments.length) throw new RangeError('Expected consecutive payments');
  const intervalDays = { weekly: 7, fortnightly: 14, four_weekly: 28 }[frequency];
  let firstPayday;
  const grossHistory = [], directorHistory = [];
  for (const [index, payment] of payments.entries()) {
    const payday = taxDate(payment?.date);
    if (payday < start) throw new RangeError('Expected payday in 2026–27');
    if (frequency === 'monthly') {
      if (payday < Date.UTC(2026, 3 + index, 6) || payday >= Date.UTC(2026, 4 + index, 6)) {
        throw new RangeError('Expected one payday in each consecutive tax month');
      }
    } else {
      if (index === 0) firstPayday = payday;
      if (firstPayday >= start + intervalDays * 86400000 || payday !== firstPayday + index * intervalDays * 86400000) {
        throw new RangeError('Expected regular paydays from the first earnings period');
      }
    }
    grossHistory.push(payment.grossMinor);
    if (payday >= appointed) directorHistory.push(payment.grossMinor);
  }
  const week = Math.floor((appointed - start) / (7 * 86400000)) + 1;
  const paye = calculatePaydayPaye(grossHistory, taxCodes, frequency, week52FreePayMinor);
  if (!directorHistory.length) throw new RangeError('Expected a payday on or after appointment');
  if (interim) return payslip(BigInt(grossHistory.at(-1)), paye, category, niThresholdsByFrequency.get(frequency));
  const ni = finalPaid === undefined ? calculateDirectorNiDraft(directorHistory, category, week)
    : reconcileDirectorNiDraft(directorHistory, category, week, finalPaid);
  return formatDirectorPayslip(grossHistory, paye, ni);
}

function weeklyDirectorPayslip(grossHistory, taxCodes, category, appointmentWeek, week52FreePayMinor, calculateNi) {
  const paye = calculatePaydayPaye(grossHistory, taxCodes, 'weekly', week52FreePayMinor);
  const directorHistory = grossHistory.slice(appointmentWeek - 1);
  return formatDirectorPayslip(grossHistory, paye, calculateNi(directorHistory, category, appointmentWeek));
}

function formatDirectorPayslip(grossHistory, paye, ni) {
  return formatPayslip(BigInt(grossHistory.at(-1)), paye, BigInt(ni.employeeNiMinor), BigInt(ni.employerNiMinor));
}

function calculatePaydayPaye(grossHistory, taxCodes, frequency, week52FreePayMinor, opening) {
  const periods = frequency === 'monthly' ? 12n : 52n;
  const interval = frequency === 'fortnightly' ? 2n : frequency === 'four_weekly' ? 4n : 1n;
  const maxPayments = periods / interval + (frequency === 'monthly' ? 0n : 1n);
  if (!Array.isArray(grossHistory) || grossHistory.length < 1 || grossHistory.length > maxPayments) {
    throw new RangeError('Expected consecutive gross payments within the tax year');
  }
  const hasCodeHistory = Array.isArray(taxCodes);
  if (hasCodeHistory && taxCodes.length !== grossHistory.length) {
    throw new RangeError('Expected one tax code for each gross amount');
  }
  let grossToDate = 0n;
  let taxPaid = 0n;
  let completed = 0;
  if (opening !== undefined) {
    // Resume the same employment and frequency at the next ordinary payday.
    // Extra paydays need the prior code and free-pay record and use the full-history path.
    const keys = ['employmentId','taxYear','frequency','completedPeriods','taxablePayMinor','taxPaidMinor'];
    const minor = value => typeof value === 'string' && /^(0|[1-9][0-9]{0,15})$/.test(value);
    if (!opening || !keys.every(key => Object.hasOwn(opening,key)) || Object.keys(opening).length !== keys.length ||
        typeof opening.employmentId !== 'string' || !opening.employmentId.trim() || opening.taxYear !== '2026-27' || opening.frequency !== frequency || !Number.isInteger(opening.completedPeriods) ||
        opening.completedPeriods < 1 || opening.completedPeriods + grossHistory.length > Number(periods / interval) ||
        !minor(opening.taxablePayMinor) || !minor(opening.taxPaidMinor) || week52FreePayMinor !== undefined)
      throw new RangeError('Invalid ordinary-period PAYE opening balances');
    completed = opening.completedPeriods;
    grossToDate = BigInt(opening.taxablePayMinor);
    taxPaid = BigInt(opening.taxPaidMinor);
  }
  for (const [index, amount] of grossHistory.entries()) {
    const gross = readGross(amount);
    if (completed + index > 0 && gross === 0n) throw new RangeError('Expected a payment after the first period');
    grossToDate += gross;
    const taxCode = hasCodeHistory ? taxCodes[index] : taxCodes;
    const previousCode = hasCodeHistory ? taxCodes[index - 1] : taxCode;
    const due = taxForPayday(gross, grossToDate, taxPaid, taxCode, BigInt(completed + index + 1) * interval, periods, previousCode, interval, week52FreePayMinor);
    const deduction = cappedDeduction(due, gross);
    if (index === grossHistory.length - 1) return deduction;
    taxPaid += deduction;
  }
}

function cappedDeduction(due, gross) {
  return due > gross / 2n ? gross / 2n : due;
}

function readGross(grossMinor) {
  if (typeof grossMinor !== 'string' || !/^(?:0|[1-9][0-9]{0,6})$/.test(grossMinor)) {
    throw new RangeError('Expected gross from £0 through £60,000 in pence');
  }
  const gross = BigInt(grossMinor);
  if (gross > 6000000n) {
    throw new RangeError('Expected gross from £0 through £60,000 in pence');
  }
  return gross;
}

const allowanceCode = /^[1-9][0-9]{0,3}[LMNT]$/;

function taxForPayday(gross, grossToDate, taxPaid, taxCode, period, periods = 12n, previousCode, interval = 1n, week52FreePayMinor) {
  if (typeof taxCode === 'string' && taxCode.endsWith(periods === 52n ? ' W1' : ' M1')) {
    return cumulativeTax(gross, taxCode.slice(0, -3), interval, periods);
  }
  if (periods === 52n && period > 52n) {
    if (typeof taxCode !== 'string') throw new RangeError('Expected a week 53 tax code');
    const code = taxCode.replace(/^[SC]/, '');
    // Regulation 31(2) retains cumulative treatment for the basic-rate code.
    if (code !== 'BR') {
      // CWG2 §1.13: a cumulative suffix code can still have unused week 52 free pay.
      if (code === '0T' || allowanceCode.test(code)) {
        if (previousCode.endsWith(' W1')) {
          // CWG2 compares the recorded week 52 total with pay including the extra payday.
          if (typeof week52FreePayMinor !== 'string' || !/^(0|[1-9][0-9]*)$/.test(week52FreePayMinor)) {
            throw new RangeError('Expected recorded week 52 total free pay in pence after W1');
          }
          if (grossToDate <= BigInt(week52FreePayMinor)) return 0n;
        }
        const prior = previousCode.replace(/^[SC]/, '');
        if (allowanceCode.test(prior) && grossToDate <= freePay(prior, periods) * 52n) return 0n;
      }
      return cumulativeTax(gross, taxCode, interval, periods);
    }
  }
  return cumulativeTax(grossToDate, taxCode, period, periods) - taxPaid;
}

// 2026–27 annual upper limits in taxable pounds and marginal rates in percent.
const scottishBands = [
  [3967n, 19n], [16956n, 20n], [31092n, 21n],
  [62430n, 42n], [125140n, 45n], [null, 48n],
];
const restOfUkBands = [[37700n, 20n], [125140n, 40n], [null, 45n]];

function freePay(taxCode, periods) {
  let periodFreePay = 0n;
  if (taxCode !== '0T') {
    if (typeof taxCode !== 'string' || (!allowanceCode.test(taxCode) && !/^K[1-9][0-9]{0,3}$/.test(taxCode))) {
      throw new RangeError('Unsupported payroll tax code');
    }
    // HMRC v24 §4.3.1: both code families use Table A, with opposite signs.
    const isKCode = taxCode.startsWith('K');
    const number = BigInt(isKCode ? taxCode.slice(1) : taxCode.slice(0, -1));
    const blocks = (number - 1n) / 500n;
    const remainder = number - blocks * 500n;
    const periodRemainder = (remainder * 1000n + 900n + periods - 1n) / periods;
    const adjustment = blocks * (periods === 52n ? 9616n : 41667n) + periodRemainder;
    periodFreePay = isKCode ? -adjustment : adjustment;
  }
  return periodFreePay;
}

function cumulativeTax(grossToDate, suppliedCode, period, periods) {
  if (suppliedCode === 'NT') return 0n;
  const scottish = typeof suppliedCode === 'string' && suppliedCode.startsWith('S');
  const welsh = typeof suppliedCode === 'string' && suppliedCode.startsWith('C');
  const taxCode = scottish || welsh ? suppliedCode.slice(1) : suppliedCode;
  const wholePounds = grossToDate / 100n;
  if (taxCode === 'BR') return wholePounds * 20n;
  if (taxCode === 'D0') return wholePounds * (scottish ? 21n : 40n);
  if (taxCode === 'D1') return wholePounds * (scottish ? 42n : 45n);
  if (scottish && taxCode === 'D2') return wholePounds * 45n;
  if (scottish && taxCode === 'D3') return wholePounds * 48n;
  const periodFreePay = freePay(taxCode, periods);
  const taxablePence = earningsAbove(grossToDate, periodFreePay * period);
  const taxableWholePounds = taxablePence / 100n;
  // HMRC PAYE routines v24: select the rate before truncating taxable pounds.
  let lowerLimit = 0n;
  let annualTaxPence = 0n;
  for (const [upperLimit, rate] of scottish ? scottishBands : restOfUkBands) {
    if (upperLimit === null || taxablePence <= ((upperLimit * period + periods - 1n) / periods) * 100n) {
      // Both period thresholds are truncated separately to £0.0001.
      const threshold = lowerLimit * 10000n * period / periods;
      const taxAtThreshold = annualTaxPence * 100n * period / periods;
      return (taxAtThreshold + (taxableWholePounds * 10000n - threshold) * rate / 100n) / 100n;
    }
    annualTaxPence += (upperLimit - lowerLimit) * rate;
    lowerLimit = upperLimit;
  }
}

// Current payday only. Main employee rates are in basis points; thresholds are in pence.
const niCategories = new Map([
  ['A', [800n, 'standard']], ['B', [185n, 'standard']], ['C', [0n, 'standard']], ['J', [200n, 'standard']],
  ['F', [800n, 'zone']], ['I', [185n, 'zone']], ['S', [0n, 'zone']], ['L', [200n, 'zone']],
  ['N', [800n, 'zone']], ['E', [185n, 'zone']], ['K', [0n, 'zone']], ['D', [200n, 'zone']],
  ['H', [800n, 'upper']], ['M', [800n, 'upper']], ['V', [800n, 'upper']], ['Z', [200n, 'upper']],
]);

const monthlyThresholds = { primary: 104800n, standard: 41700n, zone: 208300n, upper: 418900n };
const weeklyThresholds = { primary: 24200n, standard: 9600n, zone: 48100n, upper: 96700n };

function contributions(gross, niCategory, thresholds) {
  const terms = niCategories.get(niCategory);
  if (!terms) throw new RangeError('Unsupported employee NI category');
  const [mainRate, employerThreshold] = terms;
  const aboveUpperLimit = earningsAbove(gross, thresholds.upper);
  const mainBandEarnings = earningsAbove(gross, thresholds.primary) - aboveUpperLimit;
  const employeeNi = mainRate === 0n ? 0n : roundedNi(mainBandEarnings * mainRate / 100n) + roundedNi(aboveUpperLimit * 2n);
  const employerNi = roundedNi(earningsAbove(gross, thresholds[employerThreshold]) * 15n);
  return { employeeNi, employerNi };
}

export function calculateWeeklyNiDraft(grossMinor, niCategory = 'A') {
  return calculatePeriodNiDraft(grossMinor, 'weekly', niCategory);
}

const niThresholdsByFrequency = new Map([
  ['weekly', weeklyThresholds],
  ['fortnightly', { primary: 48400n, standard: 19300n, zone: 96200n, upper: 193400n }],
  ['four_weekly', { primary: 96700n, standard: 38500n, zone: 192400n, upper: 386700n }],
  ['monthly', monthlyThresholds],
]);

export function calculatePeriodNiDraft(grossMinor, frequency, niCategory = 'A') {
  const thresholds = niThresholdsByFrequency.get(frequency);
  if (!thresholds) throw new RangeError('Unsupported NI earnings period');
  const { employeeNi, employerNi } = contributions(readGross(grossMinor), niCategory, thresholds);
  return { employeeNiMinor: String(employeeNi), employerNiMinor: String(employerNi),
    totalNiMinor: String(employeeNi + employerNi) };
}

function payslip(gross, paye, niCategory, thresholds = monthlyThresholds) {
  const { employeeNi, employerNi } = contributions(gross, niCategory, thresholds);
  return formatPayslip(gross, paye, employeeNi, employerNi);
}

function formatPayslip(gross, paye, employeeNi, employerNi) {
  return {
    grossMinor: String(gross),
    payeMinor: String(paye),
    employeeNiMinor: String(employeeNi),
    employerNiMinor: String(employerNi),
    netMinor: String(gross - paye - employeeNi),
  };
}

// Standard annual method, 2026–27. Director in post at the start of the tax year,
// category A throughout, with all NI-able payments supplied in chronological order.
export function calculateFullYearCategoryADirectorNiDraft(grossHistory) {
  return calculateDirectorNiDraft(grossHistory, 'A', 1);
}

// Supply NI-able earnings since appointment and one unchanged category throughout.
export function calculateDirectorNiDraft(grossHistory, category, appointmentWeek) {
  const thresholds = directorThresholds(category, appointmentWeek);
  if (!Array.isArray(grossHistory) || grossHistory.length === 0) {
    throw new RangeError('Expected director payments starting with the first payday');
  }
  const currentGross = readGross(grossHistory.at(-1));
  let previousGross = 0n;
  for (const gross of grossHistory.slice(0, -1)) previousGross += readGross(gross);
  const previous = contributions(previousGross, category, thresholds);
  const current = contributions(previousGross + currentGross, category, thresholds);
  return directorNiBalance(current, previous);
}

// Last payday under the alternative method. Recorded totals exclude this payday.
export function reconcileDirectorNiDraft(grossHistory, category, appointmentWeek, paid) {
  const thresholds = directorThresholds(category, appointmentWeek);
  if (!Array.isArray(grossHistory) || grossHistory.length === 0) throw new RangeError('Expected director pay history');
  let grossToDate = 0n;
  for (const amount of grossHistory) grossToDate += readGross(amount);
  const readPaid = amount => {
    if (typeof amount !== 'string' || !/^(0|[1-9][0-9]*)$/.test(amount)) throw new RangeError('Expected NI paid in whole pence');
    return BigInt(amount);
  };
  return directorNiBalance(contributions(grossToDate, category, thresholds), {
    employeeNi: readPaid(paid?.employeeNiMinor), employerNi: readPaid(paid?.employerNiMinor),
  });
}

function directorThresholds(category, appointmentWeek) {
  if (!niCategories.has(category)) throw new RangeError('Unsupported director NI category');
  if (!Number.isInteger(appointmentWeek) || appointmentWeek < 1 || appointmentWeek > 53) {
    throw new RangeError('Expected appointment week from 1 through 53');
  }
  // CA44 sections 24–25: count the appointment week, then round each threshold up in pounds.
  const weeks = BigInt(Math.max(1, 53 - appointmentWeek));
  const threshold = annualPounds => ((annualPounds * weeks + 51n) / 52n) * 100n;
  return { primary: threshold(12570n), standard: threshold(5000n), zone: threshold(25000n), upper: threshold(50270n) };
}

function directorNiBalance(current, previous) {
  const employee = current.employeeNi - previous.employeeNi;
  const employer = current.employerNi - previous.employerNi;
  return { employeeNiMinor: String(employee), employerNiMinor: String(employer),
    totalNiMinor: String(employee + employer) };
}
