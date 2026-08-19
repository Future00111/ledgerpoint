// Fetch helpers for the AI Accountant Phase 2 endpoints.
async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

const q = (id) => encodeURIComponent(id);

export const aiApi = {
  refresh: (companyId) =>
    api('/api/ai/accountant/refresh', { method: 'POST', body: JSON.stringify({ company_id: companyId }) }),
  summary: (companyId) => api(`/api/ai/accountant/summary?company_id=${q(companyId)}`),
  recommendations: (companyId, statuses) =>
    api(`/api/ai/accountant/recommendations?company_id=${q(companyId)}${statuses ? `&status=${statuses.join(',')}` : ''}`),
  decide: (id, decision, note, snoozedUntil) =>
    api(`/api/ai/accountant/recommendations/${q(id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, note, snoozed_until: snoozedUntil }),
    }),
  decisions: (companyId) => api(`/api/ai/accountant/decisions?company_id=${q(companyId)}`),
  activity: (companyId) => api(`/api/ai/accountant/activity?company_id=${q(companyId)}`),
  explain: (bankTransactionId) =>
    api(`/api/ai/accountant/explain?bank_transaction_id=${q(bankTransactionId)}`),
  reviewSummary: (companyId) => api(`/api/ai/review-summary?company_id=${q(companyId)}`),
  insights: (companyId) =>
    api('/api/ai/insights', { method: 'POST', body: JSON.stringify({ company_id: companyId }) }),
  analyse: (companyId) =>
    api('/api/ai/reconciliation/analyse', { method: 'POST', body: JSON.stringify({ company_id: companyId }) }),
};

export const gbp = (n) => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;

export const DOMAIN_LABELS = {
  revenue: 'Revenue',
  expense: 'Expenses',
  vat: 'VAT',
  debtor: 'Debtors',
  creditor: 'Creditors',
  cashflow: 'Cash flow',
};

export const PRIORITY_STYLES = {
  high: { label: 'High', chip: 'bg-red-50 border-red-200 text-red-700', dot: 'bg-red-500' },
  medium: { label: 'Medium', chip: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-400' },
  low: { label: 'Low', chip: 'bg-slate-50 border-slate-200 text-slate-600', dot: 'bg-slate-400' },
};
