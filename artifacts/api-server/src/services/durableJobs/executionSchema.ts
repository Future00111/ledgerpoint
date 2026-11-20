import type { Queryable } from '../accountingDocuments/core';
import { requireQueueSchema } from './schema';
import { fail } from '../financialDrafts/contract';
// Pinned additive input, paired with structural checks; a history row alone is insufficient.
export const executionMigrationSha256='4d40f0c36ca3de578c1abc1a904b57967dd5de84180f4f558491ebf40f6a4d88';
const tables={
 durable_job_execution_events:{columns:'company_id:uuid,job_id:text,sequence:integer,kind:text,actor_id:text,payload:jsonb,job_snapshot:jsonb,recorded_at:timestamp with time zone',checks:5,keys:['p:company_id,job_id,sequence','f:company_id,job_id>durable_jobs:company_id,job_id']},
 durable_job_execution_outbox:{columns:'company_id:uuid,job_id:text,sequence:integer,topic:text,created_at:timestamp with time zone',checks:1,keys:['p:company_id,job_id,sequence','f:company_id,job_id,sequence>durable_job_execution_events:company_id,job_id,sequence']},
};
const unavailable=()=>fail(503,'DURABLE_EXECUTION_SCHEMA_UNAVAILABLE');
export async function requireExecutionSchema(q:Queryable){
 await requireQueueSchema(q);
 if((await q.query('SELECT current_user actor')).rows[0]?.actor!=='ledgerly_api')unavailable();
 const roles=(await q.query("SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,pg_has_role('ledgerly_api','ledgerly_canonical_owner','MEMBER') owner_member FROM pg_roles WHERE rolname='ledgerly_api'")).rows;
 if(roles.length!==1||Object.values(roles[0]).some(Boolean))unavailable();
 const owners=(await q.query("SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname='ledgerly_canonical_owner'")).rows;
 if(owners.length!==1||Object.values(owners[0]).some(Boolean))unavailable();
 const relations=(await q.query(`SELECT c.relname,pg_get_userbyid(c.relowner) owner,c.relkind,
  has_table_privilege('ledgerly_api',c.oid,'SELECT') s,has_table_privilege('ledgerly_api',c.oid,'INSERT') i,
  has_table_privilege('ledgerly_api',c.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') unsafe,
  has_any_column_privilege('ledgerly_api',c.oid,'UPDATE') column_update
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[])`,[Object.keys(tables)])).rows;
 if(relations.length!==2||relations.some(r=>r.owner!=='ledgerly_canonical_owner'||r.relkind!=='r'||!r.s||!r.i||r.unsafe||r.column_update))unavailable();
 const history=(await q.query("SELECT to_regclass('public.schema_migrations') present")).rows[0];if(!history?.present)unavailable();
 const h=(await q.query("SELECT sha256,contract_version,dependencies FROM schema_migrations WHERE id='durable-job-execution'")).rows;
 if(h.length!==1||h[0].sha256!==executionMigrationSha256||h[0].contract_version!==1||JSON.stringify(h[0].dependencies)!=='["durable-jobs"]')unavailable();
 const acl=(await q.query(`SELECT pg_get_userbyid(c.relowner) owner,COALESCE(r.rolname,'PUBLIC') grantee,a.privilege_type,a.is_grantable
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee
  WHERE n.nspname='public' AND c.relname=ANY($1::text[])`,[Object.keys(tables)])).rows;
 if(acl.some(a=>a.grantee!==a.owner && (a.grantee!=='ledgerly_api'||!['SELECT','INSERT'].includes(a.privilege_type)||a.is_grantable)))unavailable();
 for(const [table,spec]of Object.entries(tables)){
  const cols=(await q.query(`SELECT a.attname||':'||format_type(a.atttypid,a.atttypmod) field,a.attnotnull,COALESCE(cardinality(a.attacl),0)=0 no_column_acl
   FROM pg_attribute a WHERE a.attrelid=('public.'||$1)::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,[table])).rows;
  if(cols.map(r=>r.field).join(',')!==spec.columns||cols.some(r=>!r.attnotnull||!r.no_column_acl))unavailable();
  const constraints=(await q.query(`SELECT c.contype,c.convalidated,c.condeferrable,c.confupdtype,c.confdeltype,
   (SELECT n.nspname FROM pg_class x JOIN pg_namespace n ON n.oid=x.relnamespace WHERE x.oid=c.confrelid) target_schema,
   ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n,o) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.n ORDER BY k.o) local_columns,
   (SELECT relname FROM pg_class WHERE oid=c.confrelid) target,
   ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(n,o) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.n ORDER BY k.o) foreign_columns,
   pg_get_constraintdef(c.oid) definition FROM pg_constraint c WHERE c.conrelid=('public.'||$1)::regclass AND c.contype<>'n'`,[table])).rows;
  const keys=constraints.filter(r=>r.contype!=='c').map(r=>r.contype+':'+r.local_columns.join(',')+(r.contype==='f'?'>'+r.target+':'+r.foreign_columns.join(','):'')).sort();
  if(constraints.some(r=>!r.convalidated||r.condeferrable||(r.contype==='f'&&(r.target_schema!=='public'||r.confupdtype!=='a'||r.confdeltype!=='a')))||constraints.filter(r=>r.contype==='c').length!==spec.checks||JSON.stringify(keys)!==JSON.stringify([...spec.keys].sort()))unavailable();
  const normalized=(value:string)=>value.split(/('(?:''|[^'])*')/g).map((part,index)=>index%2?part:part.replaceAll('::text','').replace(/\s/g,'')).join('');
  const expectedChecks:Record<string,string[]>={
   durable_job_execution_events:[
    "CHECK (((sequence >= 1) AND (sequence <= 32)))",
    "CHECK ((kind = ANY (ARRAY['start'::text, 'release'::text, 'cancel'::text, 'failure'::text, 'result'::text])))",
    "CHECK (((length(btrim(actor_id)) >= 1) AND (length(btrim(actor_id)) <= 200)))",
    "CHECK (((jsonb_typeof(payload) = 'object'::text) AND (octet_length((payload)::text) <= 3145728)))",
    "CHECK (((jsonb_typeof(job_snapshot) = 'object'::text) AND (octet_length((job_snapshot)::text) <= 3145728)))"],
   durable_job_execution_outbox:["CHECK ((topic = 'document-intake.durable-execution.v1'::text))"],
  };
  if(JSON.stringify(constraints.filter(r=>r.contype==='c').map(r=>normalized(r.definition)).sort())!==JSON.stringify(expectedChecks[table]!.map(normalized).sort()))unavailable();
  const triggers=(await q.query(`SELECT t.tgname,t.tgenabled,t.tgtype,p.proname,pg_get_userbyid(p.proowner) owner,p.prosrc,t.tgqual IS NULL unconditional,octet_length(t.tgargs) args_length
   FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid=('public.'||$1)::regclass AND NOT t.tgisinternal ORDER BY t.tgname`,[table])).rows;
  if(triggers.length!==2||triggers.some(t=>t.tgenabled!=='A'||!t.unconditional||t.args_length!==0||t.proname!=='durable_job_history_immutable'||t.owner!=='ledgerly_canonical_owner'||t.prosrc.trim()!=="BEGIN RAISE EXCEPTION 'Durable job history is immutable'; END")||
   !triggers.some(t=>t.tgname===table+'_immutable'&&t.tgtype===27)||!triggers.some(t=>t.tgname===table+'_no_truncate'&&t.tgtype===34))unavailable();
 }
}
