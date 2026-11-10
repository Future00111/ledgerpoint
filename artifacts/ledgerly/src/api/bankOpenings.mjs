/** Bank opening balances. Server is authoritative for eligibility, posting and balances. */
export function createBankOpeningsClient(fetcher = (...a) => fetch(...a)) {
  const call = async (url, { method = 'GET', body, signal } = {}) => {
    const res = await fetcher(url, {
      method, credentials: 'include', signal,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const e = json?.error;
      throw Object.assign(new Error(e?.message || `Request failed (${res.status}).`), { status: res.status, code: e?.code });
    }
    if (!json || !Object.hasOwn(json, 'data')) throw new Error('The opening balance response could not be verified. Refresh before continuing.');
    return json.data;
  };
  const base = c => `/api/companies/${encodeURIComponent(c)}/opening-balances`;
  return {
    context: (c, signal) => call(`${base(c)}/context`, { signal }),
    get: (c, bankId, signal) => call(`${base(c)}/${encodeURIComponent(bankId)}`, { signal }),
    review: (c, intent, signal) => call(`${base(c)}/review`, { method: 'POST', body: intent, signal }),
    post: (c, intent, reviewToken, signal) => call(base(c), { method: 'POST', body: { ...intent, review_token: reviewToken }, signal }),
  };
}
export const bankOpenings = createBankOpeningsClient();

export const MAX_PENCE = 999999999999n;
/** Strict pounds string -> positive integer pence string. Commas only as valid thousands groups. No rounding; null when invalid. */
export function poundsToPence(input) {
  const s = String(input ?? '').trim();
  const m = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const pence = BigInt(m[1].replace(/,/g, '')) * 100n + BigInt((m[2] || '').padEnd(2, '0'));
  return pence > 0n && pence <= MAX_PENCE ? pence.toString() : null;
}

/** Chart fields used exactly as returned: account_type, is_active, code, name. */
export const isActive = a => a?.is_active === true;
const BANK_TYPES = new Set(['asset', 'assets']);
/** Only the configured payment bank GL is eligible; null/absent config means no choice. */
export const bankLedgerOptions = (accounts, configuredId) => configuredId
  ? (accounts || []).filter(a => isActive(a) && BANK_TYPES.has(a.account_type) && a.id === configuredId) : [];
export const equityOptions = accounts => (accounts || []).filter(a => isActive(a) && a.account_type === 'equity');

export function buildIntent({ requestId, bankAccountId, bankLedgerAccountId, balancingAccountId, effectiveDate, amount, direction }) {
  const amount_minor = poundsToPence(amount);
  const errors = [];
  if (!bankAccountId) errors.push('Choose a bank account.');
  if (!bankLedgerAccountId) errors.push('Choose the bank ledger account.');
  if (!balancingAccountId) errors.push('Choose the equity balancing account.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate || '')) errors.push('Enter the effective date.');
  if (!amount_minor) errors.push('Enter a positive amount in pounds with at most two decimal places.');
  if (direction !== 'debit' && direction !== 'credit') errors.push('Choose positive balance or overdraft.');
  if (errors.length) return { errors };
  return { intent: { request_id: requestId, bank_account_id: bankAccountId, bank_ledger_account_id: bankLedgerAccountId, balancing_account_id: balancingAccountId, effective_date: effectiveDate, amount_minor, direction } };
}

const key = (c, b) => `ledgerpoint:bank-opening:pending:${c}:${b}`;
/** Stores only the intent (no tokens or credentials) so a reload can recover by GET. */
export const pendingStore = (storage = globalThis.sessionStorage) => ({
  read(c, b) { try { const v = storage?.getItem(key(c, b)); return v ? JSON.parse(v) : null; } catch { return null; } },
  /** Returns true only if the intent was durably written and reads back identically. */
  write(c, b, intent) {
    try {
      if (!storage) return false;
      const v = JSON.stringify({ intent });
      storage.setItem(key(c, b), v);
      return storage.getItem(key(c, b)) === v;
    } catch { return false; }
  },
  clear(c, b) { try { storage?.removeItem(key(c, b)); } catch { /* storage unavailable */ } },
});

/** Network failure or 5xx = outcome unknown; 4xx = definitive rejection. */
export const isAlreadyPosted = e => e?.status === 409 && e?.code === 'OPENING_ALREADY_POSTED';
export const isUnknownOutcome = e => !e?.status || e.status >= 500;
