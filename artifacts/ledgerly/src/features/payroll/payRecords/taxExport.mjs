import { salaryPence } from './model.mjs';
import { taxYear } from './taxModel.mjs';

export const TAX_CSV_FILENAME = 'personal-tax-input.csv';
export const TAX_CSV_HEADER = 'tax_year_start,employment_income_pence,currency\r\n';
export const canExportTax = role => role === 'owner' || role === 'personal_tax_preparer';

/** Fixed numeric fields only: no identifiers, free text, formulas or caller-selected columns. */
export function validateTaxCsv(value, record) {
  if (typeof value !== 'string' || value.length > 128 || !value.startsWith(TAX_CSV_HEADER)) throw Error('The export could not be verified.');
  const match = /^([1-9][0-9]{0,3}),(0|[1-9][0-9]{0,18}),GBP\r\n$/.exec(value.slice(TAX_CSV_HEADER.length));
  if (!match || value !== `${TAX_CSV_HEADER}${match[1]},${match[2]},GBP\r\n` ||
      taxYear(Number(match[1])) !== record.tax_year_start || salaryPence(match[2]) !== record.employment_income_pence || record.currency !== 'GBP')
    throw Error('The export could not be verified.');
  return value;
}

/** Invoke only after a current-scope guard. The fixed name never contains company or taxpayer data. */
export function downloadTaxCsv(csv, record, environment = globalThis) {
  validateTaxCsv(csv, record);
  const blob = new environment.Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = environment.URL.createObjectURL(blob);
  let link;
  try {
    link = environment.document.createElement('a');
    link.href = url; link.download = TAX_CSV_FILENAME; link.hidden = true;
    environment.document.body.appendChild(link); link.click();
  } finally {
    try { link?.remove(); }
    finally {
      // Allow the click to consume its URL; always release the in-memory file afterwards.
      environment.setTimeout(() => environment.URL.revokeObjectURL(url), 0);
    }
  }
}

export async function requestTaxDownload({ client, companyId, record, role, token, download = downloadTaxCsv }) {
  if (!canExportTax(role)) throw Error('The export is unavailable for this role.');
  const csv = await client.exportCsv(companyId, record, role, token.signal);
  if (!token.isCurrent()) return false;
  validateTaxCsv(csv, record);
  download(csv, record);
  return true;
}
