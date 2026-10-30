import { transact, type Queryable } from '../accountingDocuments/core';
import { AuditError, auditRole, uuid, auditQuery, decodeCursor, encodeCursor, presentEvent, auditCsv, EXPORT_LIMIT, type AuditQuery } from './contract';

const COVERAGE = {
  included: ['Native document changes', 'Earlier invoice draft changes', 'Payments and payment setup', 'Document capture', 'Awaiting-credit commands', 'Chart of accounts', 'Canonical journal events'],
  excluded: ['Sign-in history', 'Company and membership changes', 'Unrecorded legacy changes', 'External email, banking and HMRC activity'],
  note: 'One business action can have several audit events, such as a document posting and its journal. Event counts are not transaction totals. References identify records; current record pages are not historical snapshots.',
};
async function authorize(q: Queryable, company: string, actor: string) {
  if (!uuid(company)) throw new AuditError('INVALID_AUDIT_QUERY');
  const result = await q.query('SELECT role,is_active FROM company_users WHERE company_id=$1 AND user_id=$2 ORDER BY id', [company, actor]);
  if (result.rowCount !== 1 || result.rows[0].is_active !== true || !auditRole(result.rows[0].role)) throw new AuditError('AUDIT_ACCESS_DENIED');
}
// Every join includes company identity; only the fixed public projection leaves PostgreSQL.
// Do not SELECT context, source, request_hash, content or arbitrary audit payloads here.
const EVENTS = `
SELECT a.created_at occurred_at,'documents:'||a.id event_key,'documents' category,CASE WHEN a.action='correct' THEN 'correction' ELSE a.action END action,a.actor_id,
 coalesce(a.after_source->>'invoice_number',d.number) reference,'' reason,d.kind resource_kind,d.id resource_id,
 CASE WHEN a.action='post' THEN d.journal_id ELSE NULL END journal_id,
 ARRAY(SELECT field FROM unnest(ARRAY['invoice_number','issue_date','due_date','payment_terms','reference','notes','price_basis','line_items','discount','discount_adjustment']) field
   WHERE a.before_source->field IS DISTINCT FROM a.after_source->field) changed_fields
FROM accounting_document_audit a JOIN accounting_document_sources d ON d.company_id=a.company_id AND d.id=a.document_id WHERE a.company_id=$1
UNION ALL
SELECT a.created_at,'legacy_drafts:'||a.id,'legacy_drafts',a.operation,a.actor_id,
 coalesce(a.after_source->>'invoice_number','Invoice draft'),'', 'sales_invoice',a.invoice_id,NULL::uuid,ARRAY[]::text[]
FROM w03_invoice_draft_audit a JOIN sales_invoices d ON d.company_id=a.company_id AND d.id=a.invoice_id WHERE a.company_id=$1
UNION ALL
SELECT a.created_at,'payments:'||a.id,'payments',a.kind,a.actor_id,a.reference,'','accounting_payment_event',a.id,a.journal_id,ARRAY[]::text[]
FROM accounting_payment_events a JOIN canonical_journal_entries j ON j.company_id=a.company_id AND j.id=a.journal_id
 AND j.source_type='accounting_payment_event' AND j.source_id=a.id::text WHERE a.company_id=$1
UNION ALL
SELECT a.created_at,'payment_setup:'||a.id,'payment_setup','configure',a.actor_id,'Payment accounts','','payment_setup',NULL::uuid,NULL::uuid,ARRAY[]::text[]
FROM accounting_payment_config_audit a WHERE a.company_id=$1
UNION ALL
SELECT a.created_at,'capture:'||a.id,'capture',a.action,a.actor_id,s.filename,'',
 CASE WHEN d.id IS NULL THEN 'capture' ELSE d.kind END,coalesce(d.id,s.id),NULL::uuid,ARRAY[]::text[]
FROM document_intake_audit a JOIN document_intake_sources s ON s.company_id=a.company_id AND s.id=a.source_id
 LEFT JOIN accounting_document_sources d ON d.company_id=a.company_id AND d.id=a.document_id WHERE a.company_id=$1
UNION ALL
SELECT a.created_at,'credit_tracking:'||a.request_id,'credit_tracking',a.action,a.actor_id,
 coalesce(d.number,'Credit tracking'),'',CASE WHEN d.id IS NULL THEN 'credit_tracking' ELSE d.kind END,d.id,NULL::uuid,ARRAY[]::text[]
FROM supplier_credit_claim_commands a LEFT JOIN supplier_credit_claims c ON c.company_id=a.company_id AND c.id::text=a.claim_ids->>0
 LEFT JOIN accounting_document_sources d ON d.company_id=a.company_id AND d.id=c.bill_id WHERE a.company_id=$1
UNION ALL
SELECT a.created_at,'chart:'||a.id,'chart',a.action,a.actor_id,
 coalesce(a.after_data->>'code','Account')||' · '||coalesce(a.after_data->>'name',''),'', 'chart',a.account_id,NULL::uuid,ARRAY[]::text[]
FROM accounting_chart_audit a JOIN chart_of_accounts c ON c.company_id=a.company_id AND c.id=a.account_id WHERE a.company_id=$1
UNION ALL
SELECT a.created_at,'ledger:'||a.id,'ledger',a.action,a.actor_id,coalesce(d.number,original_document.number,p.reference,j.reference,'Journal'),coalesce(a.reason,''),
 CASE WHEN d.id IS NOT NULL THEN d.kind WHEN original_document.id IS NOT NULL THEN original_document.kind WHEN p.id IS NOT NULL THEN 'accounting_payment_event' ELSE NULL END,
 coalesce(d.id,original_document.id,p.id),j.id,ARRAY[]::text[]
FROM accounting_audit_events a JOIN canonical_journal_entries j ON j.company_id=a.company_id AND j.id=a.journal_id
 LEFT JOIN accounting_document_sources d ON d.company_id=a.company_id AND d.id::text=a.source_id AND d.kind=a.source_type
 LEFT JOIN canonical_journal_entries original_journal ON original_journal.company_id=a.company_id AND original_journal.id=j.reversal_of_id
 LEFT JOIN accounting_document_sources original_document ON original_document.company_id=a.company_id AND original_document.journal_id=original_journal.id
  AND original_document.id::text=original_journal.source_id AND original_document.kind=original_journal.source_type
 LEFT JOIN accounting_payment_events p ON p.company_id=a.company_id AND p.id::text=a.source_id AND a.source_type='accounting_payment_event'
WHERE a.company_id=$1`;

async function read(q: Queryable, company: string, actor: string, query: AuditQuery, exporting: boolean) {
  await q.query("SET LOCAL statement_timeout = '5s'");
  await authorize(q, company, actor);
  const { filters } = query, cursor = decodeCursor(query.cursor, company, filters);
  const now = (await q.query(`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') value`)).rows[0].value;
  if (cursor && cursor.as_of > now) throw new AuditError('INVALID_AUDIT_CURSOR');
  const asOf = cursor?.as_of ?? now;
  const result = await q.query(`WITH events AS (${EVENTS})
 SELECT to_char(occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') occurred_at,
 event_key,category,action,actor_id,reference,reason,resource_kind,resource_id,journal_id,changed_fields
 FROM events WHERE occurred_at >= $2::date::timestamp AT TIME ZONE 'UTC'
 AND occurred_at < ($3::date+1)::timestamp AT TIME ZONE 'UTC' AND occurred_at <= $4::timestamptz
 AND ($5='all' OR category=$5) AND ($6='all' OR action=$6)
 AND ($7='' OR strpos(lower(coalesce(reference,'')||' '||actor_id||' '||action),lower($7))>0)
 AND ($8::timestamptz IS NULL OR (occurred_at,event_key COLLATE "C") < ($8::timestamptz,$9::text COLLATE "C"))
 ORDER BY occurred_at DESC,event_key COLLATE "C" DESC LIMIT $10`,
  [company, filters.from, filters.to, asOf, filters.category, filters.action, filters.q, cursor?.occurred_at ?? null, cursor?.event_key ?? null, (exporting ? EXPORT_LIMIT : query.limit) + 1]);
  if (exporting && result.rows.length > EXPORT_LIMIT) throw new AuditError('AUDIT_EXPORT_LIMIT');
  const more = !exporting && result.rows.length > query.limit;
  const items = (exporting ? result.rows : result.rows.slice(0, query.limit)).map(presentEvent);
  return { company_id: company, filters, items, as_of: asOf, next_cursor: more ? encodeCursor(company, filters, asOf, items.at(-1)!) : null,
    page_size: exporting ? EXPORT_LIMIT : query.limit, coverage: COVERAGE, capabilities: { export: true } };
}
export async function auditEvents(company: string, actor: string, input: unknown) {
  const query = auditQuery(input);
  return transact(q => read(q, company, actor, query, false), true);
}
export async function exportAuditEvents(company: string, actor: string, input: unknown) {
  const query = auditQuery(input, true);
  return transact(async q => { const data = await read(q, company, actor, query, true); return { company_id: company, as_of: data.as_of, count: data.items.length, csv: auditCsv(data.items) }; }, true);
}
