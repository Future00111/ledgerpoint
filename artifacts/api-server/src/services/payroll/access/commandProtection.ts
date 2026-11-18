import { SensitiveAccessError, type SensitiveContext } from './boundary';

const signatures = Object.freeze({
  pay: 'public.ledgerly_create_employee_pay_record(uuid,text,uuid,uuid,date,bigint)',
  personal_tax: 'public.ledgerly_create_personal_tax_preparation(uuid,text,uuid,uuid,integer,bigint)',
});

/** Internal closed command map; no caller-supplied SQL name, role or grant is accepted. */
export async function requireSensitiveCreationCommand(context: Pick<SensitiveContext, 'query'>, command: keyof typeof signatures) {
  if (typeof command !== 'string' || !Object.hasOwn(signatures, command)) throw new SensitiveAccessError('SENSITIVE_OPERATION_UNAVAILABLE');
  const rows = (await context.query(`SELECT pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proretset,p.prokind,p.proconfig,
    p.prorettype='text'::regtype text_result,has_function_privilege(current_user,p.oid,'EXECUTE') can_execute,
    EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
      WHERE acl.grantee<>p.proowner AND (acl.grantee<>'ledgerly_api'::regrole OR acl.privilege_type<>'EXECUTE' OR acl.is_grantable)) unsafe_acl
    FROM pg_proc p WHERE p.oid=to_regprocedure($1)`, [signatures[command]])).rows;
  if (rows.length !== 1 || rows[0].owner !== 'ledgerly_canonical_owner' || !rows[0].prosecdef || rows[0].proretset ||
      rows[0].prokind !== 'f' || !rows[0].text_result || !rows[0].can_execute || rows[0].unsafe_acl ||
      JSON.stringify(rows[0].proconfig) !== '["search_path=pg_catalog"]') throw new SensitiveAccessError('SENSITIVE_OPERATION_UNAVAILABLE');
}
