// Shared read-only database evidence comparison. No restore or CLI dependencies.
import { createHash } from 'node:crypto';
const quote = name => `"${name.replaceAll('"', '""')}"`;
const digest = values => createHash('sha256').update(JSON.stringify(values)).digest('hex');

export async function fingerprintDatabase(client) {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const { rows: tables } = await client.query(`SELECT c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname`);
    const fingerprints = [];
    for (const { name } of tables) {
      const { rows } = await client.query(`SELECT to_jsonb(t)::text value FROM public.${quote(name)} t ORDER BY to_jsonb(t)::text`);
      fingerprints.push({ table: name, rows: rows.length, sha256: digest(rows.map(row => row.value)) });
    }
    const { rows: guards } = await client.query(`SELECT c.relname table_name,t.tgname name,t.tgenabled enabled,pg_get_triggerdef(t.oid) definition
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`);
    const { rows: constraints } = await client.query(`SELECT c.relname table_name,k.conname name,pg_get_constraintdef(k.oid) definition
      FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' ORDER BY c.relname,k.conname`);
    const { rows: indexes } = await client.query(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`);
    const { rows: functions } = await client.query(`SELECT p.proname name,pg_get_userbyid(p.proowner) owner,p.proacl::text privileges,pg_get_functiondef(p.oid) definition
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'
      ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)`);
    const { rows: schemas } = await client.query(`SELECT nspname name,pg_get_userbyid(nspowner) owner,nspacl::text privileges
      FROM pg_namespace WHERE nspname='public'`);
    const { rows: owners } = await client.query(`SELECT c.relname name,pg_get_userbyid(c.relowner) owner FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m') ORDER BY c.relname`);
    const { rows: tableGrants } = await client.query(`SELECT table_name,grantee,privilege_type,is_grantable FROM information_schema.table_privileges
      WHERE table_schema='public' ORDER BY table_name,grantee,privilege_type,is_grantable`);
    const { rows: columnGrants } = await client.query(`SELECT table_name,column_name,grantee,privilege_type,is_grantable FROM information_schema.column_privileges
      WHERE table_schema='public' ORDER BY table_name,column_name,grantee,privilege_type,is_grantable`);
    await client.query('COMMIT');
    return { tables: fingerprints, controls: digest({ guards, constraints, indexes, functions, schemas, owners, tableGrants, columnGrants }) };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}

export function assertSameFingerprint(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Restored evidence, schema controls or permissions do not match.');
}

