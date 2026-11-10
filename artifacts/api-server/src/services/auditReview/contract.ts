import { createHash } from 'node:crypto';

export const CATEGORIES = ['documents', 'legacy_drafts', 'payments', 'payment_setup', 'capture', 'credit_tracking', 'chart', 'ledger'] as const;
export const ACTIONS = ['create', 'edit', 'update', 'post', 'correction', 'reversal', 'payment', 'allocation', 'unallocation', 'refund', 'configure', 'upload', 'draft_created', 'receive', 'cancel', 'archive', 'restore'] as const;
export const EXPORT_LIMIT = 1000;
export type Filters = { from: string; to: string; category: string; action: string; q: string };
export type AuditQuery = { filters: Filters; limit: number; cursor: string | null };
export type Cursor = { v: 1; binding: string; as_of: string; occurred_at: string; event_key: string };
export type AuditEvent = { event_key: string; occurred_at: string; category: string; action: string; label: string; actor_id: string;
  reference: string; reason: string; resource_kind: string | null; resource_id: string | null; journal_id: string | null; changed_fields: string[] };
const MESSAGES = {
  INVALID_AUDIT_QUERY: [400, 'Choose valid audit filters and dates.'],
  INVALID_AUDIT_CURSOR: [400, 'This history page no longer matches the filters. Refresh the history.'],
  AUDIT_ACCESS_DENIED: [403, 'An owner, administrator or accountant can review company audit history.'],
  AUDIT_EXPORT_LIMIT: [409, 'This export contains more than 1,000 events. Narrow the date range or filters and try again.'],
  AUDIT_UNAVAILABLE: [503, 'Audit history is unavailable. Please retry.'],
} as const;
export class AuditError extends Error {
  readonly status: number;
  constructor(readonly code: keyof typeof MESSAGES) { super(MESSAGES[code][1]); this.status = MESSAGES[code][0]; }
}
const invalid = (): never => { throw new AuditError('INVALID_AUDIT_QUERY'); };
export const auditRole = (role: unknown) => typeof role === 'string' && ['owner', 'admin', 'accountant'].includes(role);
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '2199-12-31' &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
export function auditQuery(input: unknown, exporting = false): AuditQuery {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid();
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !(exporting ? ['from', 'to', 'category', 'action', 'q'] : ['from', 'to', 'category', 'action', 'q', 'limit', 'cursor']).includes(key))) return invalid();
  const from = value.from ?? '1900-01-01', to = value.to ?? '2199-12-31';
  if (!validDate(from) || !validDate(to) || from > to) return invalid();
  const category = value.category ?? 'all', action = value.action ?? 'all', query = value.q ?? '';
  if (typeof category !== 'string' || !['all', ...CATEGORIES].includes(category as any) ||
      typeof action !== 'string' || !['all', ...ACTIONS].includes(action as any) ||
      typeof query !== 'string' || query.length > 100 || /[\p{Cc}\p{Cf}]/u.test(query)) return invalid();
  const limit = value.limit === undefined ? 50 : typeof value.limit === 'string' && /^(?:[1-9]\d?|100)$/.test(value.limit) ? Number(value.limit) : invalid();
  if (value.cursor !== undefined && (typeof value.cursor !== 'string' || value.cursor.length < 1 || value.cursor.length > 1500 || !/^[A-Za-z0-9_-]+$/.test(value.cursor))) return invalid();
  return { filters: { from, to, category, action, q: query.trim() }, limit, cursor: value.cursor as string | undefined ?? null };
}
const binding = (company: string, filters: Filters) => createHash('sha256').update(JSON.stringify([company.toLowerCase(), filters])).digest('hex');
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value) &&
  validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.slice(0, 23) + 'Z';
/** The cursor is a query continuation, never authentication. Every page rechecks access. */
export function decodeCursor(value: string | null, company: string, filters: Filters): Cursor | null {
  if (value === null) return null;
  try {
    if (typeof value !== 'string' || value.length < 1 || value.length > 1500 || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error();
    const row = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!row || Array.isArray(row) || Object.keys(row).sort().join(',') !== 'as_of,binding,event_key,occurred_at,v' || row.v !== 1 ||
        row.binding !== binding(company, filters) || !timestamp(row.as_of) || !timestamp(row.occurred_at) || row.occurred_at > row.as_of ||
        typeof row.event_key !== 'string' || !CATEGORIES.some(category => row.event_key.startsWith(category + ':') && uuid(row.event_key.slice(category.length + 1)))) throw Error();
    return row;
  } catch { throw new AuditError('INVALID_AUDIT_CURSOR'); }
}
export function encodeCursor(company: string, filters: Filters, asOf: string, last: Pick<AuditEvent, 'occurred_at' | 'event_key'>): string {
  return Buffer.from(JSON.stringify({ v: 1, binding: binding(company, filters), as_of: asOf, occurred_at: last.occurred_at, event_key: last.event_key })).toString('base64url');
}
export function safeText(value: unknown, max = 250): string {
  return (typeof value === 'string' ? value : '').replace(/[\p{Cc}\p{Cf}]/gu, ' ').slice(0, max);
}
const labels: Record<string, string> = {
  'documents:create': 'Draft created', 'documents:edit': 'Draft edited', 'documents:post': 'Document posted', 'documents:correction': 'Document corrected',
  'legacy_drafts:create': 'Invoice draft created (earlier editor)', 'legacy_drafts:update': 'Invoice draft edited (earlier editor)',
  'payments:payment': 'Payment recorded', 'payments:allocation': 'Payment allocated', 'payments:unallocation': 'Allocation reversed',
  'payments:refund': 'Refund recorded', 'payments:reversal': 'Payment reversed', 'payment_setup:configure': 'Payment accounts changed',
  'capture:upload': 'Document uploaded', 'capture:draft_created': 'Uploaded document converted to draft',
  'credit_tracking:create': 'Awaiting-credit items added', 'credit_tracking:receive': 'Credit receipt confirmed', 'credit_tracking:cancel': 'Awaiting-credit item cancelled',
  'chart:create': 'Account created', 'chart:edit': 'Account edited', 'chart:archive': 'Account archived', 'chart:restore': 'Account restored',
  'ledger:post': 'Journal posted', 'ledger:correction': 'Journal correction recorded', 'ledger:reversal': 'Journal reversed',
};
const resourceKinds = ['sales_invoice', 'purchase_bill', 'sales_credit_note', 'supplier_credit_note', 'accounting_payment_event', 'capture', 'chart', 'payment_setup', 'credit_tracking'];
export function presentEvent(row: Record<string, any>): AuditEvent {
  return { event_key: row.event_key, occurred_at: row.occurred_at, category: row.category, action: safeText(row.action, 60),
    label: labels[row.category + ':' + row.action] ?? 'Recorded change', actor_id: safeText(row.actor_id), reference: safeText(row.reference),
    reason: safeText(row.reason, 1000), resource_kind: resourceKinds.includes(row.resource_kind) ? row.resource_kind : null,
    resource_id: uuid(row.resource_id) ? row.resource_id : null, journal_id: uuid(row.journal_id) ? row.journal_id : null,
    changed_fields: Array.isArray(row.changed_fields) ? row.changed_fields.filter((key: unknown) => typeof key === 'string' && /^[a-z_]{1,50}$/.test(key)).slice(0, 20) : [] };
}
export function csvCell(value: string): string {
  const text = safeText(value, 2000);
  return '"' + (/^\s*[=+\-@]/u.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
}
export function auditCsv(events: AuditEvent[]): string {
  if (events.length > EXPORT_LIMIT) throw new AuditError('AUDIT_EXPORT_LIMIT');
  const rows = [['Recorded at (UTC)', 'Category', 'Action', 'Actor ID', 'Reference', 'Record type', 'Record ID', 'Journal ID', 'Reason', 'Changed fields', 'Audit event ID'],
    ...events.map(row => [row.occurred_at, row.category, row.label, row.actor_id, row.reference, row.resource_kind ?? '', row.resource_id ?? '', row.journal_id ?? '', row.reason, row.changed_fields.join('; '), row.event_key])];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
