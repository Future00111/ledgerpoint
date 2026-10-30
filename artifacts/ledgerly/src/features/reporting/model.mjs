import { filterLedger } from '../../lib/reportTrace.mjs';
import { reportRows } from '../../lib/ledgerCsv.mjs';

export const REPORT_TABS = [['pnl', 'Profit & loss'], ['bs', 'Balance sheet'], ['vat', 'VAT'], ['parties', 'Customer & supplier'], ['ageing', 'Aged balances'], ['tb', 'Trial balance'], ['gl', 'General ledger']];
export const MIN_DATE = '0001-01-01';
export const MAX_DATE = '9999-12-31';
export const closingReport = tab => ['tb', 'bs', 'ageing'].includes(tab);
export const reportTab = (requested, fallback = 'tb') => REPORT_TABS.some(([id]) => id === requested) ? requested : REPORT_TABS.some(([id]) => id === fallback) ? fallback : 'tb';
export const validReportDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && value >= MIN_DATE && value <= MAX_DATE && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export function dateError(from, to) {
  if (!validReportDate(from) || !validReportDate(to)) return 'Enter valid report dates.';
  return from > to ? 'The start date must be on or before the end date.' : '';
}
export function reportPeriod(params, tab, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return { from: closingReport(tab) ? MIN_DATE : params.has('from') ? params.get('from') : `${today.slice(0, 4)}-01-01`,
    to: params.has('to') ? params.get('to') : today };
}
export function periodPreset(preset, now = new Date()) {
  const today = now.toISOString().slice(0, 10), year = today.slice(0, 4), month = Number(today.slice(5, 7));
  if (preset === 'last-month') {
    const end = new Date(`${today.slice(0, 7)}-01T12:00:00Z`); end.setUTCDate(0);
    const to = end.toISOString().slice(0, 10); return { from: `${to.slice(0, 7)}-01`, to };
  }
  return { from: preset === 'month' ? `${today.slice(0, 7)}-01` : preset === 'quarter' ? `${year}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, '0')}-01` : `${year}-01-01`, to: today };
}
export const shortDate = value => validReportDate(value) ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : value;
export const reportPeriodLabel = (tab, from, to) => closingReport(tab) ? `As at ${shortDate(to)}` : `${shortDate(from)} – ${shortDate(to)}`;
export const scopeKey = (...values) => JSON.stringify(values);
export const visibleRead = (state, key, enabled = true) => !enabled ? { key, data: null, loading: false, error: null }
  : state.key === key ? state : { key, data: null, loading: true, error: null };

/** Every request owns a cancellation guard, including transports that ignore abort. */
export function requestRead({ key, load, validate = value => value, publish }) {
  const controller = new AbortController();
  const done = Promise.resolve().then(() => controller.signal.aborted ? undefined : load(controller.signal))
    .then(value => {
      if (controller.signal.aborted) return;
      const data = validate(value);
      publish({ key, data, loading: false, error: null });
    }).catch(error => { if (!controller.signal.aborted) publish({ key, data: null, loading: false, error }); });
  return { done, cancel: () => controller.abort() };
}
export function validateReport(data, from, to) {
  if (!data || data.from !== from || data.to !== to || !Array.isArray(data.general_ledger)
    || !Array.isArray(data.trial_balance) || !Array.isArray(data.party_balances) || !Array.isArray(data.party_transactions)
    || !Array.isArray(data.ageing) || !data.pnl || !data.balance_sheet || typeof data.vat?.applicable !== 'boolean') {
    throw new Error('The report could not be verified for these dates. Please retry.');
  }
  return data;
}
export function validateJournal(data, companyId, id) {
  if (data?.entry?.id !== id || data.entry.company_id !== companyId || !Array.isArray(data.lines)) throw new Error('The journal could not be verified for this company. Please retry.');
  return data;
}
export function ledgerRows(rows, { accountId, documentId, search = '' } = {}) {
  const query = search.trim().toLocaleLowerCase('en-GB');
  return filterLedger(rows, accountId, documentId).filter(row => !query || [row.account_code, row.account_name,
    row.source_number, row.source_type?.replaceAll('_', ' '), row.description].filter(Boolean).join(' ').toLocaleLowerCase('en-GB').includes(query));
}
export const statementPath = (partyId, from, to) => `/statements?${new URLSearchParams({ party_id: partyId,
  ...(from && to && !dateError(from, to) ? { from, to } : {}) })}`;
export const vatPath = (from, to) => `/vat?${new URLSearchParams({ from, to })}`;
export const ledgerAccountPath = (id, from, to, closing = false) => `/reports?${new URLSearchParams({ tab: 'gl', account_id: id, from: closing ? MIN_DATE : from, to })}`;
export function reportExport(data, tab, { companyName, from, to, accountId, documentId, partyId, search = '' }) {
  if (!data || dateError(from, to) || data.from !== from || data.to !== to || (tab === 'vat' && !data.vat.applicable)) return [];
  const rows = ledgerRows(data.general_ledger, { accountId, documentId, search });
  return [['Company', companyName], ['Report', REPORT_TABS.find(([id]) => id === tab)?.[1] || tab],
    ...(closingReport(tab) || tab === 'parties' ? [['As at', to], ['Basis', 'Closing balances include all postings through this date.']] : [['From', from, 'To', to]]),
    ...(tab === 'gl' ? [['Filters', accountId || 'All accounts', documentId || 'All documents', search || 'No text filter'], ['Included ledger lines', String(rows.length)]] : []),
    ...(tab === 'parties' && partyId ? [['Party filter', partyId]] : []),
    ...(tab === 'parties' ? [['Scope', 'Account balances only. Use account statements for transaction history.']] : []),
    ...(tab === 'vat' ? [['Scope', 'Review only: boxes 1, 4, 5, 6 and 7; not a complete VAT return or HMRC submission.'], ['Direction', data.vat.repayment ? 'Repayment' : 'Payable']] : []),
    ...reportRows({ ...data, general_ledger: rows }, tab, partyId)];
}
