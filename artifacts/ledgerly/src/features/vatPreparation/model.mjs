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
const minor = value => typeof value === 'string' && /^(?:0|-?[1-9]\d{0,29})$/.test(value);

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
      || !minor(d.vat_minor) || d.vat_box !== (KINDS[d.kind].party === 'customer' ? '1' : '4')
      || (d.movement_kind !== undefined && !['original', 'financial_correction'].includes(d.movement_kind))) invalid();
    if (d.movement_kind !== 'financial_correction') {
      const credit = d.kind === 'sales_credit_note' || d.kind === 'supplier_credit_note';
      if ((credit && (BigInt(d.net_minor) > 0n || BigInt(d.vat_minor) > 0n))
          || (!credit && (BigInt(d.net_minor) < 0n || BigInt(d.vat_minor) < 0n))) invalid();
    }
  }
  // Reconcile the supplied signed facts, without calculating any tax amounts.
  const sources = sourceDocuments(data);
  if (new Set(data.posted_documents.map(d => d.journal_id)).size !== data.posted_documents.length) invalid();
  for (const [box, sourceBox, field] of [['1', '1', 'vat_minor'], ['4', '4', 'vat_minor'], ['6', '1', 'net_minor'], ['7', '4', 'net_minor']]) {
    const total = sources.filter(d => d.vat_box === sourceBox).reduce((n, d) => n + BigInt(d[field]), 0n);
    if (total !== BigInt(data.vat[`box${box}_pence`])) invalid();
  }
  const net = BigInt(data.vat.box1_pence) - BigInt(data.vat.box4_pence);
  if (BigInt(data.vat.net_payable_pence) !== net || BigInt(data.vat.box5_pence) !== (net < 0n ? -net : net)
      || data.vat.repayment !== (net < 0n)) invalid();
  if (data.vat_coverage !== undefined) validateCoverage(data, invalid);
  return data;
}

/** Validate the additive server evidence; never turn a missing capability into a successful check. */
function validateCoverage(data, invalid) {
  const coverage = data.vat_coverage;
  if (!coverage || coverage.contract !== 'vat-workings.coverage.v1' || coverage.status !== 'workings_reconciled'
      || coverage.filing_ready !== false || coverage.scope?.from !== data.from || coverage.scope?.to !== data.to
      || coverage.scope?.basis !== 'posted_source_movements' || coverage.scope?.scheme !== 'standard'
      || coverage.scope?.accounting_basis !== 'invoice' || coverage.scope?.currency !== 'GBP'
      || !Array.isArray(coverage.boxes) || coverage.boxes.length !== 9 || !Array.isArray(coverage.cases) || !coverage.cases.length
      || !Array.isArray(coverage.blockers)) invalid();
  const sources = sourceDocuments(data);
  if (coverage.movement_count !== sources.length || coverage.journal_count !== sources.length
      || coverage.source_document_count !== new Set(sources.map(d => d.id)).size) invalid();
  for (let i = 0; i < 9; i++) {
    const row = coverage.boxes[i]; const box = String(i + 1); const known = BOXES.find(item => item.box === box);
    if (!row || row.box !== box || (known
      ? row.status !== 'reconciled' || row.amount_pence !== data.vat[known.key] || row.source_total_pence !== data.vat[known.key]
      : row.status !== 'unsupported' || row.amount_pence !== null || row.source_total_pence !== null)) invalid();
  }
  if (!['INCOMPLETE_RETURN', 'SUPPORTED_CASE_REVIEW', 'FILING_UNAVAILABLE'].every(code => coverage.blockers.some(item => item?.code === code && typeof item.message === 'string' && item.message.trim()))
      || coverage.cases.some(item => !item || typeof item.id !== 'string' || typeof item.label !== 'string'
        || !['supported', 'unsupported'].includes(item.status))) invalid();
}

export function coverageRows(data) {
  if (!data?.vat_coverage) return [['Coverage', 'Coverage check unavailable. Refresh before relying on the reconciliation status.']];
  return [['Coverage', 'Workings only; five supported boxes are reconciled. This is not a complete or filing-ready return.'],
    ['Box', 'Status', 'Workings GBP', 'Reconciled source amount GBP'],
    ...data.vat_coverage.boxes.map(box => [box.box, box.status === 'reconciled' ? 'Reconciled' : 'Not implemented — unknown amount',
      box.amount_pence === null ? '' : decimalMinor(box.amount_pence), box.source_total_pence === null ? '' : decimalMinor(box.source_total_pence)]),
    ...data.vat_coverage.blockers.map(item => ['Review boundary', item.message])];
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

/** Scope the visible filters too, so an old search cannot hide a new period's evidence. */
export function visibleSourceFilter(filter, key) {
  return filter.key === key ? filter : { key, selected: 'all', search: '' };
}

export function selectedSourceDocuments(data, selected = 'all', search = '') {
  const box = BOXES.find(item => item.box === selected);
  if (selected !== 'all' && !box) throw new Error('Choose a supported VAT workings box.');
  return sourceDocuments(data, box?.side ?? 'all', search);
}

const sourceHeader = () => ['Posting date', 'Document', 'Type', 'Customer or supplier', 'Net GBP', 'VAT in workings GBP', 'Gross GBP', 'Source ID', 'Journal ID', 'Movement'];
const sourceRow = d => [d.date, d.number, KINDS[d.kind].label, d.party_name, decimalMinor(d.net_minor),
  decimalMinor(d.vat_minor), decimalMinor(d.gross_minor), d.id, d.journal_id,
  d.movement_kind === 'financial_correction' ? 'Financial correction' : 'Original posting'];

/** Evidence subset only: never calculate a tax figure or imply this is a return. */
export function filteredSourceRows(data, { companyId, companyName, selected = 'all', search = '' }) {
  if (data?.vat?.applicable !== true) return [];
  if (typeof companyId !== 'string' || !companyId.trim() || typeof companyName !== 'string' || !companyName.trim()) {
    throw new Error('The company for this export could not be verified. Refresh the workings.');
  }
  validateSnapshot(data, data.from, data.to);
  const docs = selectedSourceDocuments(data, selected, search);
  const box = BOXES.find(item => item.box === selected);
  return [
    ['Filtered VAT source evidence - review only; not a complete VAT return'],
    ['Company', companyName], ['Company ID', companyId], ['From', data.from, 'To', data.to],
    ['Related sources', box ? `Box ${box.box}: ${box.label}` : 'All supported source movements'],
    ['Search', search], ['Movements selected', String(docs.length), 'Of', String(sourceDocuments(data).length)],
    ['Meaning', 'Only source movements matching the visible filters. This is not a VAT return or filing receipt.'],
    ['Box 5 boundary', 'Related sources include both sales and purchases. Their VAT column must not be summed as the net VAT return figure.'],
    ['Return boundary', 'Boxes 2, 3, 8 and 9 remain unsupported with unknown amounts, not assumed zero. Filing is unavailable.'],
    ['Basis', 'Signed amounts supplied by the accounting report. Drafts and historical VAT projections excluded.'],
    [], sourceHeader(), ...docs.map(sourceRow),
  ];
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
    [], ...coverageRows(data),
    [], ['Sources', 'Signed amounts supplied by the accounting report. Credits reduce the relevant totals.'],
    sourceHeader(), ...docs.map(sourceRow),
  ];
}

export function workingsError(error) {
  if (error?.code === 'VAT_SETUP_UNSUPPORTED') return 'VAT workings currently support the standard VAT scheme on an invoice basis. This company uses an unsupported VAT setup.';
  if (error?.code === 'COMPANY_SETUP_UNSUPPORTED') return 'These VAT workings support UK companies with GBP as their base currency.';
  if (error?.code === 'VAT_SETUP_INCOMPLETE') return 'VAT registration details are incomplete. Check this company’s accounting setup.';
  return error?.message || 'VAT workings could not be loaded. Please retry.';
}
