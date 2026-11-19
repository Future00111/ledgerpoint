import { downloadCsv } from './csvDownload.mjs';
import { effectiveDate, salaryPence } from './model.mjs';

export const PAY_CSV_FILENAME = 'payroll-pay-record.csv';
export const PAY_CSV_HEADER = 'effective_from,annual_salary_pence,currency\r\n';
export const canExportPay = role => role === 'owner' || role === 'payroll_preparer';

/** Fixed date and numeric fields only: no identifiers, free text, formulas or caller-selected columns. */
export function validatePayCsv(value, record) {
  if (typeof value !== 'string' || value.length > 128 || !value.startsWith(PAY_CSV_HEADER)) throw Error('The export could not be verified.');
  const match = /^(\d{4}-\d{2}-\d{2}),(0|[1-9][0-9]{0,18}),GBP\r\n$/.exec(value.slice(PAY_CSV_HEADER.length));
  if (!match || value !== `${PAY_CSV_HEADER}${match[1]},${match[2]},GBP\r\n` ||
      effectiveDate(match[1]) !== record.effective_from || salaryPence(match[2]) !== record.annual_salary_pence || record.currency !== 'GBP')
    throw Error('The export could not be verified.');
  return value;
}

/** Invoke only after a current-scope guard. The fixed name never contains company or employee data. */
export function downloadPayCsv(csv, record, environment = globalThis) {
  validatePayCsv(csv, record);
  downloadCsv(csv, PAY_CSV_FILENAME, environment);
}

export async function requestPayDownload({ client, companyId, record, role, token, download = downloadPayCsv }) {
  if (!canExportPay(role)) throw Error('The export is unavailable for this role.');
  const csv = await client.exportCsv(companyId, record, role, token.signal);
  if (!token.isCurrent()) return false;
  validatePayCsv(csv, record);
  download(csv, record);
  return true;
}
