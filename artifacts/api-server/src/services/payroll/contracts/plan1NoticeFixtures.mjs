/** Offline notice-timing review only. Not a payroll eligibility or calculation service. */
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys) => plain(x) && Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const text = x => typeof x === 'string' && x.trim().length > 0;
const date = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)
  && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x;
const fail = code => { throw new Error(code); };
const exclusions = ['offPayroll','occupationalPensionOnly','deceased','protectedEarnings','concurrentLoan','correction'];
const inputFields = ['taxYear','plan','frequency','paymentDate','payMinor','employmentId','earningsBasis',
  'activeEmployment','employeeStopRequest','otherInstructions','notices', ...exclusions];
const noticeFields = ['id','type','plan','employmentId','effectiveDate','receivedDate','firstAvailablePayday','availabilityEvidence'];

/** Applies sourced student and postgraduate start/stop timing to explicitly supplied synthetic availability facts.
 * Does not authenticate notices, infer the first practical payday, or qualify actual employees.
 * No P45, starter, GNS, exceptional instructions, plan changes or conflicting notices in this slice.
 */
function reviewNoticeTiming(input, weeklyPlan1Only) {
  if (!exact(input, inputFields)) fail('NOTICE_INPUT_FIELDS');
  if (input.taxYear !== '2026-27' ||
      !['plan_1','plan_2','plan_4','plan_5','postgraduate'].includes(input.plan) ||
      !['weekly','fortnightly','four_weekly','monthly'].includes(input.frequency) ||
      (weeklyPlan1Only && (input.plan !== 'plan_1' || input.frequency !== 'weekly'))) fail('NOTICE_UNSUPPORTED_CASE');
  const startType = input.plan === 'postgraduate' ? 'PGL1' : 'SL1';
  const stopType = input.plan === 'postgraduate' ? 'PGL2' : 'SL2';
  if (!date(input.paymentDate) || input.paymentDate < '2026-04-06' || input.paymentDate > '2027-04-05') fail('NOTICE_PAYMENT_DATE');
  if (!text(input.employmentId) || typeof input.payMinor !== 'string' || !/^(0|[1-9][0-9]{0,15})$/.test(input.payMinor)) fail('NOTICE_INPUT_FIELDS');
  if (input.earningsBasis !== 'class1_ni_earnings' || input.activeEmployment !== true
    || typeof input.employeeStopRequest !== 'boolean' || exclusions.some(k => input[k] !== false)
    || !Array.isArray(input.otherInstructions) || input.otherInstructions.length !== 0) fail('NOTICE_EXCLUDED_CONTEXT');
  if (!Array.isArray(input.notices) || input.notices.length > 2) fail('NOTICE_CONFLICT');
  const byType = new Map(), ids = new Set();
  for (const n of input.notices) {
    if (!exact(n, noticeFields) || !text(n.id) || (n.type !== startType && n.type !== stopType)
      || n.plan !== input.plan || n.employmentId !== input.employmentId || !text(n.availabilityEvidence)
      || !date(n.effectiveDate) || !date(n.receivedDate) || !date(n.firstAvailablePayday)) fail('NOTICE_INVALID_INSTRUCTION');
    if (byType.has(n.type) || ids.has(n.id)) fail('NOTICE_CONFLICT');
    // HMRC specifies AFTER the notice date, not on it. Receipt alone is not payday availability.
    if (n.firstAvailablePayday <= n.effectiveDate || n.firstAvailablePayday < n.receivedDate) fail('NOTICE_AVAILABILITY');
    ids.add(n.id); byType.set(n.type,n);
  }
  const start = byType.get(startType), stop = byType.get(stopType);
  if (stop && (!start || stop.effectiveDate < start.effectiveDate
    || stop.firstAvailablePayday <= start.firstAvailablePayday)) fail('NOTICE_CONFLICT');
  let instructionActive = false, reason = 'NO_START_INSTRUCTION';
  if (start) {
    instructionActive = input.paymentDate >= start.firstAvailablePayday;
    reason = instructionActive ? 'START_APPLIES' : 'BEFORE_FIRST_AVAILABLE_START';
  }
  if (stop && input.paymentDate >= stop.firstAvailablePayday) {
    instructionActive = false; reason = 'STOP_APPLIES';
  }
  // An employee request is deliberately not an HMRC stop instruction.
  return {qualified:false, notForPayroll:true, instructionActive, reason};
}

export function reviewPlan1NoticeTiming(input) {
  return reviewNoticeTiming(input, true);
}

export function reviewRegularSingleLoanNoticeTiming(input) {
  return reviewNoticeTiming(input, false);
}

// Offline review of one regular student plan alongside a postgraduate loan.
export function reviewPairedLoanNoticeTiming(input) {
  if (!exact(input, inputFields)) fail('NOTICE_INPUT_FIELDS');
  if (input.concurrentLoan !== true || !['plan_1','plan_2','plan_4','plan_5'].includes(input.plan)) fail('NOTICE_UNSUPPORTED_CASE');
  if (!Array.isArray(input.notices) || input.notices.length > 4) fail('NOTICE_CONFLICT');
  const student = [], postgraduate = [], ids = new Set();
  for (const notice of input.notices) {
    if (!exact(notice, noticeFields) || (notice.plan !== input.plan && notice.plan !== 'postgraduate')) fail('NOTICE_INVALID_INSTRUCTION');
    if (ids.has(notice.id)) fail('NOTICE_CONFLICT');
    ids.add(notice.id);
    (notice.plan === 'postgraduate' ? postgraduate : student).push(notice);
  }
  const context = {...input, concurrentLoan:false};
  return {
    qualified:false, notForPayroll:true,
    student:reviewRegularSingleLoanNoticeTiming({...context, notices:student}),
    postgraduate:reviewRegularSingleLoanNoticeTiming({...context, plan:'postgraduate', notices:postgraduate}),
  };
}
