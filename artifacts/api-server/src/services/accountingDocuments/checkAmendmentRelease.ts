import type { Pool } from 'pg';
import { amendmentSchema } from './amendments';
import { validateInstalledMigrationHistory } from '../../../../../tools/development/migrations/registry.mjs';

import {requireReadOnlySensitiveStorage} from '../payroll/access/recordStorage';

declare const __PAY_REVISION_MIGRATION_HISTORY__: ReadonlyArray<unknown>;
declare const __AMENDMENT_MIGRATION_HISTORY__: ReadonlyArray<unknown>;

// Both the release probe and guarded server start use one read-only snapshot.
export async function checkAmendmentRelease(pool: Pool, requirePayRevisions = false) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result = await client.query('SELECT id,sha256,contract_version,dependencies FROM public.schema_migrations');
    validateInstalledMigrationHistory(result.rows,requirePayRevisions ? __PAY_REVISION_MIGRATION_HISTORY__ : __AMENDMENT_MIGRATION_HISTORY__);
    const tablesComplete = await amendmentSchema(client);
    const functions = await client.query(`
      SELECT bool_and(to_regprocedure(signature) IS NOT NULL) AS complete
      FROM unnest($1::text[]) AS required(signature)
    `, [[
      'public.assert_conditional_capacity(uuid,uuid,jsonb,uuid)',
      'public.observe_conditional_discount_replacement(uuid,text,uuid,text,text)',
      'public.resolve_conditional_replacement(uuid,uuid,jsonb,jsonb,uuid)',
      'public.conditional_remaining_money(jsonb,jsonb)',
      'public.assert_commercial_credit(public.accounting_paid_credit_operations)',
    ]]);
    if (!tablesComplete || !functions.rows[0].complete) {
      throw Object.assign(new Error('Correction schema incomplete'), { code: 'CORRECTION_SCHEMA_INCOMPLETE' });
    }
    if (requirePayRevisions) {
      const incomplete = () => Object.assign(new Error('Payroll revision schema incomplete'), {code:'PAY_REVISION_SCHEMA_INCOMPLETE'});
      try { await requireReadOnlySensitiveStorage(client,'pay_run_draft_revisions'); }
      catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'SENSITIVE_OPERATION_UNAVAILABLE') throw incomplete();
        throw error;
      }
      const controls = await client.query(`
        SELECT count(*) = 2 AND NOT EXISTS (
          SELECT 1 FROM (VALUES
            ('company_id','uuid'),('run_id','uuid'),('revision_number','integer'),('revision_id','uuid'),
            ('period_start','date'),('period_end','date'),('payday','date'),('currency','text'),
            ('rules_version','text'),('prepared_by','text'),('prepared_at','timestamptz'),('employee_lines','jsonb')
          ) required(name,type_name)
          LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid='public.pay_run_draft_revisions'::regclass
            AND a.attname=required.name AND NOT a.attisdropped
          WHERE a.atttypid IS DISTINCT FROM to_regtype(required.type_name) OR a.attnotnull IS DISTINCT FROM true
        ) AND EXISTS (
          SELECT 1 FROM pg_catalog.pg_attribute a
          JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
          JOIN pg_catalog.pg_depend dep ON dep.classid='pg_attrdef'::regclass AND dep.objid=d.oid
          WHERE a.attrelid='public.pay_run_draft_revisions'::regclass AND a.attname='review_breakdown'
            AND a.attgenerated='s' AND a.atttypid='jsonb'::regtype AND NOT a.attisdropped
            AND dep.refclassid='pg_proc'::regclass AND dep.refobjid=to_regprocedure('public.pay_run_draft_breakdown(jsonb)')
            AND pg_get_expr(d.adbin,d.adrelid) IN ('pay_run_draft_breakdown(employee_lines)','public.pay_run_draft_breakdown(employee_lines)')
        ) AS complete FROM pg_catalog.pg_trigger t
        JOIN (VALUES
          ('pay_run_draft_revision_immutable','public.ledgerly_canonical_append_only_guard()',58,'A'),
          ('pay_run_draft_source_check','public.check_pay_run_draft_sources()',7,'O')
        ) expected(name,signature,events,enabled) ON t.tgname = expected.name
        WHERE t.tgrelid = 'public.pay_run_draft_revisions'::regclass
          AND t.tgfoid = to_regprocedure(expected.signature) AND t.tgtype = expected.events
          AND t.tgenabled::text = expected.enabled AND t.tgqual IS NULL AND t.tgnargs = 0
          AND cardinality(t.tgattr) = 0 AND NOT t.tgisinternal`);
      if (!controls.rows[0].complete) throw incomplete();
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
