import { SensitiveAccessError, type SensitiveContext } from './boundary';

const stores = Object.freeze(['employee_pay_records', 'personal_tax_preparations'] as const);
type SensitiveStore = typeof stores[number];
const unavailable = (): never => { throw new SensitiveAccessError('SENSITIVE_OPERATION_UNAVAILABLE'); };

/** Internal closed relation allowlist. No request-controlled table name or direct runtime writes. */
export async function requireReadOnlySensitiveStorage(context: Pick<SensitiveContext, 'query'>, store: SensitiveStore) {
  if (!(stores as readonly unknown[]).includes(store)) unavailable();
  const rows = (await context.query(`SELECT current_user actor,pg_get_userbyid(c.relowner) owner,c.relkind,
    has_table_privilege(current_user,c.oid,'SELECT') can_read,
    has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') can_mutate,
    has_any_column_privilege(current_user,c.oid,'INSERT') can_insert_column,
    has_any_column_privilege(current_user,c.oid,'UPDATE') can_update_column
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=$1`, [store])).rows;
  if (rows.length !== 1 || rows[0].actor !== 'ledgerly_api' || rows[0].owner !== 'ledgerly_canonical_owner' ||
      rows[0].relkind !== 'r' || !rows[0].can_read || rows[0].can_mutate || rows[0].can_insert_column || rows[0].can_update_column) unavailable();
}
