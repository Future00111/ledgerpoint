import { docPath } from '../../api/accountingDocuments.mjs';
export const categories = [['all', 'All activity'], ['documents', 'Documents'], ['payments', 'Payments'], ['capture', 'Document capture'], ['credit_tracking', 'Awaiting credits'], ['chart', 'Chart of accounts'], ['ledger', 'Journals'], ['payment_setup', 'Payment setup'], ['legacy_drafts', 'Earlier invoice drafts']];
export const actions = ['all', 'create', 'edit', 'update', 'post', 'correction', 'reversal', 'payment', 'allocation', 'unallocation', 'refund', 'configure', 'upload', 'draft_created', 'receive', 'cancel', 'archive', 'restore'];
export const initialFilters = (now = new Date()) => ({ from: `${now.getUTCFullYear()}-01-01`, to: now.toISOString().slice(0, 10), category: 'all', action: 'all', q: '' });
export function filtersError(filters) {
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '2199-12-31' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!date(filters.from) || !date(filters.to) || filters.from > filters.to) return 'Choose a valid date range between 1900 and 2199.';
  if (filters.q.length > 100 || /[\p{Cc}\p{Cf}]/u.test(filters.q)) return 'Search using up to 100 ordinary text characters.';
  return '';
}
export function validateAudit(data, company, filters) {
  if (data?.company_id !== company || !data.filters || !Object.entries(filters).every(([key, value]) => data.filters[key] === (key === 'q' ? value.trim() : value)) ||
      !Array.isArray(data.items) || data.items.length > 100 || typeof data.as_of !== 'string' ||
      !(data.next_cursor === null || typeof data.next_cursor === 'string') || !data.coverage || data.capabilities?.export !== true) throw new Error('The history could not be verified for this company and filters. Refresh to try again.');
  return data;
}
export function resourcePath(event) {
  if (event.resource_kind === 'capture' && event.resource_id) return `/documents?capture=${encodeURIComponent(event.resource_id)}`;
  if (event.resource_kind === 'chart') return '/chart-of-accounts';
  if (event.resource_kind === 'credit_tracking') return '/awaiting-credits';
  if (event.resource_kind === 'payment_setup') return '/payments';
  return docPath(event.resource_kind, event.resource_id);
}
export async function guardedExport({ client, company, filters, signal, isCurrent, deliver }) {
  const result = await client.export(company, filters, signal);
  if (signal.aborted || !isCurrent()) return false;
  if (result.company_id !== company || typeof result.csv !== 'string') throw new Error('The export belongs to a different company.');
  deliver(result.csv); return true;
}
