const MAX_PENCE = 9223372036854775807n;
const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMPLOYEE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PAYROLL_READ_ROLES = Object.freeze(['owner', 'payroll_preparer', 'payroll_reader', 'payroll_approver']);
export function payrollPermissions(role) {
  return { read: PAYROLL_READ_ROLES.includes(role), prepare: role === 'owner' || role === 'payroll_preparer' };
}
export function recordId(value) {
  if (typeof value !== 'string' || !RECORD_ID.test(value)) throw Error('Enter a valid pay record ID.');
  return value.toLowerCase();
}
function employeeId(value) {
  if (typeof value !== 'string' || !EMPLOYEE_ID.test(value)) throw Error('Enter the employee reference as a UUID.');
  return value.toLowerCase();
}
export function effectiveDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Enter a real date in YYYY-MM-DD format.');
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw Error('Enter a real date between years 0001 and 9999.');
  return value;
}
export function salaryPence(value) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(value) || BigInt(value) > MAX_PENCE) throw Error('The salary amount is outside the supported range.');
  return value;
}
export function poundsToPence(value) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,16})(?:\.[0-9]{1,2})?$/.test(value)) throw Error('Enter pounds with up to two decimal places, without commas or a currency symbol.');
  const [whole, fraction = ''] = value.split('.');
  return salaryPence((BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))).toString());
}
export function formatSalary(value) {
  const amount = BigInt(salaryPence(value));
  return `£${(amount / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(amount % 100n).padStart(2, '0')}`;
}
export function buildIntent(id, form) {
  return Object.freeze({ id: recordId(id), employee_id: employeeId(form.employee),
    effective_from: effectiveDate(form.date), annual_salary_pence: poundsToPence(form.salary) });
}
function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}
export function validateIntent(value) {
  if (!exactKeys(value, ['id', 'employee_id', 'effective_from', 'annual_salary_pence'])) throw Error('The pay request could not be verified.');
  return Object.freeze({ id: recordId(value.id), employee_id: employeeId(value.employee_id),
    effective_from: effectiveDate(value.effective_from), annual_salary_pence: salaryPence(value.annual_salary_pence) });
}
export function validateReceipt(value, id, status) {
  if (!exactKeys(value, ['id', 'status']) || value.id !== recordId(id) ||
      !((status === 201 && value.status === 'created') || (status === 200 && value.status === 'replayed'))) throw Error('The save response could not be verified.');
  return { id: value.id, status: value.status };
}
export function validateRecord(value, id, role) {
  const permission = payrollPermissions(role);
  const keys = ['id', 'effective_from', 'annual_salary_pence', 'currency', ...(permission.prepare ? ['employee_id'] : [])];
  if (!permission.read || !exactKeys(value, keys) || value.id !== recordId(id) || value.currency !== 'GBP') throw Error('The pay record response could not be verified.');
  return { id: value.id, effective_from: effectiveDate(value.effective_from), annual_salary_pence: salaryPence(value.annual_salary_pence),
    currency: 'GBP', ...(permission.prepare ? { employee_id: employeeId(value.employee_id) } : {}) };
}
/** Abort is only an optimisation: generation checks discard responses even when a transport ignores it. */
export function requestScope() {
  let generation = 0, controller;
  const cancel = () => { generation++; controller?.abort(); };
  return { cancel, begin() {
    cancel(); controller = new AbortController(); const current = generation;
    return { signal: controller.signal, isCurrent: () => current === generation };
  } };
}
