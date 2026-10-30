import { decimalMinor } from '../../lib/ledgerCsv.mjs';

/** Filters select existing server rows; they never recompute an account balance. */
export function filterPayments(payments, { search = '', direction = 'all', balance = 'all' } = {}) {
  const query = search.trim().toLowerCase();
  return payments.filter(payment =>
    (!query || `${payment.source?.party_name ?? ''} ${payment.reference ?? ''}`.toLowerCase().includes(query)) &&
    (direction === 'all' || payment.party_type === (direction === 'received' ? 'customer' : 'supplier')) &&
    (balance !== 'unapplied' || BigInt(payment.unapplied_minor) > 0n));
}

export function statementPath(context, payment) {
  const parties = payment?.party_type === 'customer' ? context?.customers : payment?.party_type === 'supplier' ? context?.suppliers : null;
  return parties?.some(party => party.id === payment.party_id)
    ? `/statements?party_id=${encodeURIComponent(payment.party_id)}` : null;
}

/** A shortcut is consumed once, including when another payment is already open. */
export function createPaymentShortcutGate() {
  const consumed = new Set();
  return {
    take({ entry, intent, contextLoaded, canPost, configured, ledgerReady, busy, unresolved, formOpen }) {
      if (intent !== 'payment') return 'none';
      if (consumed.has(entry)) return 'discard';
      if (unresolved || formOpen || (contextLoaded && !canPost)) {
        consumed.add(entry); return 'discard';
      }
      if (!contextLoaded || !canPost || !configured || !ledgerReady || busy) return 'wait';
      consumed.add(entry); return 'open';
    },
  };
}

export function clearPaymentShortcut(params) {
  const next = new URLSearchParams(params);
  next.delete('new');
  return next;
}

export function statementDateError(from, to) {
  const valid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to)) return 'Enter a valid start and end date.';
  return from > to ? 'The end date must be on or after the start date.' : null;
}

export function statementPeriod(params, defaults) {
  return { from: params.get('from') ?? defaults.from, to: params.get('to') ?? defaults.to };
}

/** Guard even clients that ignore AbortSignal; no old-company party list may win. */
export function loadStatementParties(companyId, api, { success, failure }) {
  const controller = new AbortController();
  const promise = Promise.resolve().then(() => api.paymentContext(companyId, controller.signal)).then(context => {
    if (controller.signal.aborted) return;
    if (!Array.isArray(context?.customers) || !Array.isArray(context?.suppliers)) throw new Error('Customer and supplier accounts could not be verified.');
    success({ companyId, parties: [
      ...context.customers.map(party => ({ ...party, type: 'customer' })),
      ...context.suppliers.map(party => ({ ...party, type: 'supplier' })),
    ] });
  }).catch(error => { if (!controller.signal.aborted) failure(error); });
  return { promise, cancel: () => controller.abort() };
}

export function selectedStatementParty(state, companyId, id) {
  return state?.companyId === companyId && !state.loading && !state.error
    ? state.parties.find(party => party.id === id) ?? null : null;
}

/** Either failed source can recover; failure in one must not suppress the other. */
export function retryStatementReads(reloadParties, refreshLedger) {
  return Promise.allSettled([Promise.resolve().then(reloadParties), Promise.resolve().then(refreshLedger)]);
}

export function statementCsvRows({ companyName, party, from, to, statement: st }) {
  return [
    ['Company', companyName], ['Party', party.name], ['Period', from, to],
    ['Date', 'Reference', 'Type', 'AR/AP change GBP', 'Unapplied change GBP', 'Running AR/AP GBP', 'Running unapplied GBP'],
    [from, 'Opening balance', '', '', '', decimalMinor(st.opening), decimalMinor(st.openingUnapplied)],
    ...st.rows.map(t => [t.date, t.number, t.payment_kind || t.source_type, decimalMinor(t.balance_effect_minor), decimalMinor(t.unapplied_effect_minor), decimalMinor(t.running_balance_minor), decimalMinor(t.running_unapplied_minor)]),
    [to, 'Closing balance', '', '', '', decimalMinor(st.closing), decimalMinor(st.unapplied)],
    ['Net balance after unapplied credit/prepayment', decimalMinor(st.net)],
  ];
}
