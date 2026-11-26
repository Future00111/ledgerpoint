import type { Pool } from 'pg';
import { amendmentSchema } from './amendments';
import { validateInstalledMigrationHistory } from '../../../../../tools/development/migrations/registry.mjs';

declare const __AMENDMENT_MIGRATION_HISTORY__: ReadonlyArray<unknown>;

// Both the release probe and guarded server start use one read-only snapshot.
export async function checkAmendmentRelease(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result = await client.query('SELECT id,sha256,contract_version,dependencies FROM public.schema_migrations');
    validateInstalledMigrationHistory(result.rows,__AMENDMENT_MIGRATION_HISTORY__);
    if (!await amendmentSchema(client)) throw Error('CORRECTION_SCHEMA_INCOMPLETE');
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
    if (!functions.rows[0].complete) throw Error('CORRECTION_SCHEMA_INCOMPLETE');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
