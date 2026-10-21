import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const selected=new Set(['companies','company_users','customers','suppliers','sales_invoices','purchase_bills',
  'sales_credit_notes','supplier_credit_notes','vat_tax_rules','bank_transactions','chart_of_accounts',
  'accounting_posting_effects','canonical_journal_entries','canonical_journal_lines',
  'canonical_journal_relations','accounting_audit_events']);
export function exportSchema() {
  const env=Object.fromEntries(["PATH","HOME","LANG","LC_ALL","PNPM_HOME","COREPACK_HOME"]
    .filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));
  return execFileSync('pnpm',['--filter','@workspace/db','exec','drizzle-kit','export',
    '--schema=./src/schema/index.ts','--dialect=postgresql'],{cwd:root,env,encoding:'utf8',maxBuffer:4e6});
}
export async function installSchema(admin,sql) {
  // Caller has already proved its Unix-socket identity. This never opens a connection.
  const tables=[...sql.matchAll(/CREATE TABLE "([^"]+)" \([\s\S]*?\n\);/g)];
  if(!tables.some(m=>m[1]==='canonical_journal_lines')) throw Error('Full canonical export missing');
  await admin.query('BEGIN');
  try {
    await admin.query(`DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ledgerly_api') THEN
      CREATE ROLE ledgerly_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      END IF;
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ledgerly_canonical_owner') THEN
      CREATE ROLE ledgerly_canonical_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      END IF; END $$;`);
    const old=await admin.query(`SELECT count(*)::int n FROM information_schema.columns
      WHERE table_schema='public' AND table_name='canonical_journal_entries'`);
    if(old.rows[0].n===4) {
      const count=await admin.query('SELECT count(*)::int n FROM canonical_journal_entries');
      if(count.rows[0].n!==0) throw Error('Nonempty legacy guard requires explicit review; no records replaced');
      await admin.query('ALTER TABLE canonical_journal_entries RENAME TO w03_legacy_empty_journal_guard');
    }
    for(const match of tables) if(selected.has(match[1])) {
      await admin.query(match[0].replace('CREATE TABLE ','CREATE TABLE IF NOT EXISTS '));
    }
    // Unique indexes must precede Drizzle's FK statements on a clean database.
    for(const match of sql.matchAll(/CREATE (?:UNIQUE )?INDEX "[^"]+" ON "([^"]+)"[^;]*;/g)) {
      if(selected.has(match[1])) await admin.query(match[0].replace('INDEX ','INDEX IF NOT EXISTS '));
    }
    for(const match of sql.matchAll(/ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)"[^;]*;/g)) {
      if(!selected.has(match[1])) continue;
      const target=match[0].match(/REFERENCES "public"\."([^"]+)"/)?.[1];
      if(target && !selected.has(target)) throw Error('Unexpected canonical FK dependency '+target);
      if(!(await admin.query('SELECT 1 FROM pg_constraint WHERE conname=$1',[match[2]])).rowCount) await admin.query(match[0]);
    }
    await admin.query(readFileSync(path.join(root,'lib/db/migrations/accounting-documents.review.sql'),'utf8'));
    await admin.query(readFileSync(path.join(root,'lib/db/migrations/accounting-chart.review.sql'),'utf8'));
    const legacy=(await admin.query("SELECT to_regclass('public.w03_invoice_drafts') present")).rows[0].present;
    if(!legacy) await admin.query(readFileSync(path.join(root,'lib/db/migrations/w03-invoice-drafts.review.sql'),'utf8')
      .replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,''));
    // Reuse the EXACT canonical ownership, immutable guards and finalization
    // transition guards; omit unrelated external-CI attestation functionality.
    const overlay=readFileSync(path.join(root,'scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql'),'utf8');
    const start=overlay.indexOf('ALTER TABLE public.accounting_posting_effects OWNER');
    const end=overlay.indexOf('CREATE OR REPLACE FUNCTION public.ledgerly_verify_disposable_run');
    const triggers=overlay.indexOf('DROP TRIGGER IF EXISTS ledgerly_canonical_journal_entries_guard');
    if(start<0||end<start||triggers<end) throw Error('Canonical security overlay structure changed');
    await admin.query(overlay.slice(start,end)+overlay.slice(triggers));
    await admin.query(`GRANT USAGE ON SCHEMA public TO ledgerly_api;
      GRANT SELECT,INSERT,UPDATE ON companies,company_users,customers,suppliers,chart_of_accounts,vat_tax_rules,
        sales_invoices,purchase_bills,sales_credit_notes,supplier_credit_notes,w03_invoice_drafts,
        accounting_company_configuration,accounting_document_periods,accounting_document_sources TO ledgerly_api;
      GRANT SELECT ON bank_transactions TO ledgerly_api;
      GRANT UPDATE(id) ON bank_transactions TO ledgerly_api;
      GRANT SELECT,INSERT ON accounting_document_audit,w03_invoice_draft_audit TO ledgerly_api;
      REVOKE UPDATE,DELETE,TRUNCATE ON accounting_document_audit,w03_invoice_draft_audit FROM ledgerly_api;
      REVOKE DELETE,TRUNCATE ON accounting_document_sources FROM ledgerly_api;`);
    const role=await admin.query(`SELECT rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls,
      pg_has_role('ledgerly_api','ledgerly_canonical_owner','MEMBER') owner_member
      FROM pg_roles WHERE rolname='ledgerly_api'`);
    if(Object.values(role.rows[0]).some(Boolean)) throw Error('Unsafe runtime role');
    const immutable=await admin.query(`SELECT count(*)::int n FROM pg_trigger
      WHERE tgname IN ('ledgerly_canonical_journal_entries_guard','ledgerly_canonical_journal_lines_guard',
      'ledgerly_canonical_journal_relations_guard','ledgerly_accounting_audit_events_guard',
      'ledgerly_accounting_posting_effects_guard') AND tgenabled='A'`);
    if(immutable.rows[0].n!==5) throw Error('Canonical immutable guards not intact');
    await admin.query('COMMIT');
  } catch(error) {await admin.query('ROLLBACK');throw error;}
}
