import { KINDS } from '../../api/accountingDocuments.mjs';
import { decimalMinor } from '../../lib/ledgerCsv.mjs';

export const BOXES = [
  { box: '1', label: 'VAT due on sales', key: 'box1_pence', side: 'sales' },
  { box: '4', label: 'VAT reclaimed on purchases', key: 'box4_pence', side: 'purchases' },
  { box: '5', label: 'Net VAT', key: 'box5_pence', side: 'all' },
  { box: '6', label: 'Sales excluding VAT', key: 'box6_pence', side: 'sales' },
  { box: '7', label: 'Purchases excluding VAT', key: 'box7_pence', side: 'purchases' },
];
export const MIN_DATE = '1900-01-01';
export const MAX_DATE = '9999-12-31';
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && value >= MIN_DATE && value <= MAX_DATE && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const minor = value => typeof value === 'string' && /^-?\d+$/.test(value);

export function initialPeriod(now = new Date()) {
  return { from: `${now.getUTCFullYear()}-${String(Math.floor(now.getUTCMonth() / 3) * 3 + 1).padStart(2, '0')}-01`, to: now.toISOString().slice(0, 10) };
}

/** Explicit empty/malformed URL dates stay visible for validation, never silently reset. */
export function periodFromParams(params, now = new Date()) {
  const initial = initialPeriod(now);
  return { from: params.has('from') ? params.get('from') : initial.from, to: params.has('to') ? params.get('to') : initial.to };
}

export function periodError(from, to) {
  if (!validDate(from) || !validDate(to)) return 'Enter valid start and end dates between 1900 and 9999.';
  if (from > to) return 'The start date must be on or before the end date.';
  return '';
}

export const scopeKey = (companyId, from, to, refresh = 0) => JSON.stringify([companyId ?? null, from, to, refresh]);

/** Hide old-company/old-period/old-refresh data during render, before effects run. */
export function visibleState(state, key) {
  return state.key === key ? state : { key, data: null, loading: true, error: null };
}

export function validateSnapshot(data, from, to) {
  const invalid = () => { throw new Error('The VAT workings could not be verified. Please retry.'); };
  if (!data || data.from !== from || data.to !== to || typeof data.vat?.applicable !== 'boolean') invalid();
  if (!data.vat.applicable) return data;
  if (!BOXES.every(b => minor(data.vat[b.key])) || !minor(data.vat.net_payable_pence)
    || typeof data.vat.repayment !== 'boolean' || !Array.isArray(data.posted_documents)) invalid();
  for (const d of data.posted_documents) {
    if (!KINDS[d.kind] || typeof d.id !== 'string' || !d.id || typeof d.journal_id !== 'string' || !d.journal_id
      || !validDate(d.date) || !minor(d.net_minor) || !minor(d.gross_minor)
      || !minor(d.vat_minor) || d.vat_box !== (KINDS[d.kind].party === 'customer' ? '1' : '4')) invalid();
  }
  // Reconcile the supplied signed facts, without calculating any tax amounts.
  for (const box of ['1', '4']) {
    const total = sourceDocuments(data).filter(d => d.vat_box === box).reduce((n, d) => n + BigInt(d.vat_minor), 0n);
    if (total !== BigInt(data.vat[`box${box}_pence`])) invalid();
  }
  return data;
}

/** Cancellation also guards clients which resolve after ignoring AbortSignal. */
export function requestWorkings({ companyId, from, to, key, load, publish }) {
  const controller = new AbortController();
  const finish = state => { if (!controller.signal.aborted) publish({ key, ...state }); };
  const done = Promise.resolve().then(() => {
    if (controller.signal.aborted) return;
    return load(companyId, from, to, controller.signal);
  }).then(data => {
    if (!controller.signal.aborted) finish({ data: validateSnapshot(data, from, to), loading: false, error: null });
  }).catch(error => finish({ data: null, loading: false, error }));
  return { cancel: () => controller.abort(), done };
}

/** Select server facts; never infer VAT from gross/net differences or tax rates. */
export function sourceDocuments(data, side = 'all', search = '') {
  if (data?.vat?.applicable !== true) return [];
  const query = search.trim().toLocaleLowerCase('en-GB');
  return data.posted_documents.filter(d => d.date >= data.from && d.date <= data.to
    && (side === 'all' || (KINDS[d.kind].party === 'customer' ? 'sales' : 'purchases') === side)
    && (!query || [d.number, d.party_name, KINDS[d.kind].label].filter(Boolean).join(' ').toLocaleLowerCase('en-GB').includes(query)));
}

export function workingsRows(data, companyName) {
  if (data?.vat?.applicable !== true) return [];
  const docs = sourceDocuments(data);
  return [
    ['VAT workings - review only; not a filed return'], ['Company', companyName], ['From', data.from, 'To', data.to],
    ['Scope', 'Standard scheme, invoice basis. Boxes 1, 4, 5, 6 and 7 only. Not a complete nine-box return.'],
    ['Basis', 'Posted documents and their canonical journals; drafts and historical VAT projections excluded.'],
    ['Box', 'Description', 'Amount GBP'],
    ...BOXES.map(b => [b.box, b.label, decimalMinor(data.vat[b.key])]),
    ['Net position', data.vat.repayment ? 'Repayment' : 'Payable', decimalMinor(data.vat.net_payable_pence)],
    [], ['Sources', 'Signed amounts supplied by the accounting report. Credits reduce the relevant totals.'],
    ['Posting date', 'Document', 'Type', 'Customer or supplier', 'Net GBP', 'VAT in workings GBP', 'Gross GBP', 'Source ID', 'Journal ID'],
    ...docs.map(d => [d.date, d.number, KINDS[d.kind].label, d.party_name, decimalMinor(d.net_minor),
      decimalMinor(d.vat_minor), decimalMinor(d.gross_minor), d.id, d.journal_id]),
  ];
}

export function workingsError(error) {
  if (error?.code === 'VAT_SETUP_UNSUPPORTED') return 'VAT workings currently support the standard VAT scheme on an invoice basis. This company uses an unsupported VAT setup.';
  if (error?.code === 'COMPANY_SETUP_UNSUPPORTED') return 'These VAT workings support UK companies with GBP as their base currency.';
  if (error?.code === 'VAT_SETUP_INCOMPLETE') return 'VAT registration details are incomplete. Check this company’s accounting setup.';
  return error?.message || 'VAT workings could not be loaded. Please retry.';
}
