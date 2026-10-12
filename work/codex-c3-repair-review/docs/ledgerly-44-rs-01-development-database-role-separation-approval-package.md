# #44-RS-01 Development Database Role Separation — Implementation Approval Package

**Status:** PLANNING / APPROVAL ONLY — NO IMPLEMENTATION AUTHORISED  
**Proposed sub-task:** `#44-RS-01 — Development Database Role Separation`  
**Parent:** `#44 — Canonical Posting Safety Enforcement`  
**Scope:** Development database and development API connection only  
**Governance baseline:** DEC-01 through DEC-22 APPROVED  
**Decision requested:** Approval to implement this exact development-only role
separation sub-task

> This document is a planning package. It does not create roles, change
> `DATABASE_URL`, modify Replit Secrets, apply DDL, transfer ownership, change
> application code, restart workflows, deploy, publish, or change production.

## 1. Purpose

#44-RS-01 will make the Ledgerly development API run under a dedicated
non-superuser database login so the already-approved #44 persistence-level
immutability controls can be enforced by PostgreSQL rather than by application
convention alone.

This is a technical sub-task of #44. It is not a governance decision, does not
create DEC-23, and does not authorize the broader BL-06 or BL-07 work.

## 2. Verified current state

The read-only inspection established the following:

- the development `DATABASE_URL` username is `postgres`;
- `current_user` is `postgres`;
- `session_user` is `postgres`;
- `postgres` is a superuser;
- `postgres` has `rolcreaterole`, `rolcreatedb`, and login privileges;
- canonical tables are owned by `postgres`;
- the API connection currently has `UPDATE`, `DELETE`, and `TRUNCATE`
  privileges on canonical tables;
- `DATABASE_URL` is runtime-managed and currently contains a password, which
  was not displayed or recorded;
- the application creates its pool with
  `new Pool({ connectionString: process.env.DATABASE_URL })`;
- no application code hardcodes the PostgreSQL role;
- the API artifact workflow only sets `PORT` and `NODE_ENV`; it does not select
  a database role; and
- production support for custom database roles and custom production
  credentials has not been established.

The application source does not currently resolve `pg` from the workspace root
when invoked directly, but the database connection model itself is defined in
`lib/db/src/index.ts` and uses only `DATABASE_URL`.

## 3. Selected development role model

### 3.1 Administrative database principal

An administrative database principal will be used only for controlled
database-administration actions:

- `CREATE ROLE` and `ALTER ROLE`;
- schema and database DDL;
- ownership transfer;
- trigger/function installation;
- privilege grants and revocations; and
- verification of role, ownership, and privilege state.

It must not be used by the running API, application tests, or canonical posting
service. Its credential must not be placed in source code or application
runtime configuration.

### 3.2 `ledgerly_canonical_owner`

The canonical owner role is a dedicated database role with these attributes:

- `NOLOGIN`;
- `NOSUPERUSER`;
- `NOCREATEDB`;
- `NOCREATEROLE`;
- `NOREPLICATION`;
- `NOBYPASSRLS`;
- owns the five protected canonical tables;
- owns the four approved #44 immutability trigger functions; and
- is not usable as the API runtime identity.

The role must not be granted to `ledgerly_api`, `PUBLIC`, or any application
role.

### 3.3 `ledgerly_api`

The application role is a dedicated login role with these attributes:

- `LOGIN`;
- `NOSUPERUSER`;
- `NOCREATEDB`;
- `NOCREATEROLE`;
- `NOREPLICATION`;
- `NOBYPASSRLS`;
- `NOINHERIT`;
- does not own canonical tables, trigger functions, schemas, or the database;
- is not a member of `ledgerly_canonical_owner` or `postgres`;
- has no membership in any role with ownership, superuser, role-creation,
  database-creation, or schema-administration authority; and
- receives no grant option on application or canonical privileges.

The API connection must authenticate directly as `ledgerly_api`. It must not
authenticate as `postgres` and then use `SET ROLE`; that would leave a
superuser session capable of resetting the role or bypassing the protection.

## 4. Exact minimum privilege design

The role design separates runtime data access from schema administration. It
does not replace the existing BL-01-FI Principal and Tenant Guard: database
grants are not tenant authorization and do not permit unscoped application
access.

### 4.1 Database and schema

`ledgerly_api` requires:

- `CONNECT` on the development database;
- `USAGE` on schema `public`;
- no `CREATE` on schema `public`;
- no `CREATE` on the database;
- no `TEMP` privilege unless a later reviewed application path proves it is
  required; and
- no ownership, `ALTER`, `DROP`, or `GRANT OPTION` authority.

The plan will remove the default/public escalation paths relevant to this role:

- revoke database `CREATE` from `PUBLIC`;
- revoke schema `CREATE` from `PUBLIC`;
- revoke database `TEMP` from `PUBLIC` unless it is explicitly required by an
  existing application path; and
- explicitly grant `CONNECT` on the development database and `USAGE` on
  `public` to `ledgerly_api`.

The implementation must first inspect other development consumers. If removing
these `PUBLIC` privileges would break an unrelated approved development
consumer, stop and report rather than broadening `ledgerly_api` privileges.

### 4.2 Ordinary application tables

The current API uses generic entity reads and writes plus dedicated company,
AI-accountant, VAT, email, automation, and document services. The minimum
table-level DML required to preserve that current application behavior is:

| Tables | `SELECT` | `INSERT` | `UPDATE` | `DELETE` | `TRUNCATE` |
|---|---:|---:|---:|---:|---:|
| `companies` | yes | yes | yes | yes | no |
| `company_users` | yes | yes | yes | yes | no |
| `customers` | yes | yes | yes | yes | no |
| `suppliers` | yes | yes | yes | yes | no |
| `sales_invoices` | yes | yes | yes | yes | no |
| `purchase_bills` | yes | yes | yes | yes | no |
| `sales_credit_notes` | yes | yes | yes | yes | no |
| `supplier_credit_notes` | yes | yes | yes | yes | no |
| `bank_accounts` | yes | yes | yes | yes | no |
| `bank_transactions` | yes | yes | yes | yes | no |
| `chart_of_accounts` | yes | yes | yes | yes | no |
| `journal_entries` (legacy JSON compatibility table) | yes | yes | yes | yes | no |
| `vat_returns` | yes | yes | yes | yes | no |
| `vat_tax_rules` | yes | yes | yes | yes | no |
| `vat_exceptions` | yes | yes | yes | yes | no |
| `vat_adjustments` | yes | yes | yes | yes | no |
| `vat_return_audits` | yes | yes | yes | yes | no |
| `documents` | yes | yes | yes | yes | no |
| `email_accounts` | yes | yes | yes | yes | no |
| `email_rules` | yes | yes | yes | yes | no |
| `email_capture_logs` | yes | yes | yes | yes | no |
| `email_scan_configs` | yes | yes | yes | yes | no |
| `insights` | yes | yes | yes | yes | no |
| `automations` | yes | yes | yes | yes | no |
| `automation_activities` | yes | yes | yes | yes | no |
| `workflow_activities` | yes | yes | yes | yes | no |
| `account_learnings` | yes | yes | yes | yes | no |
| `account_suggestion_logs` | yes | yes | yes | yes | no |
| `suggestion_rules` | yes | yes | yes | yes | no |
| `suggestion_settings` | yes | yes | yes | yes | no |
| `bank_automation_settings` | yes | yes | yes | yes | no |
| `ai_reconciliation_results` | yes | yes | yes | yes | no |
| `ai_recommendations` | yes | yes | yes | yes | no |
| `ai_tasks` | yes | yes | yes | yes | no |
| `ai_review_decisions` | yes | yes | yes | yes | no |
| `ai_decision_audits` | yes | yes | yes | yes | no |
| `transaction_comments` | yes | yes | yes | yes | no |

These grants preserve the current application surface; they do not authorize
new product workflows. The application remains responsible for company scope,
role capability, workflow restrictions, and validation.

### 4.3 Canonical accounting tables

The following grants are deliberately narrower:

| Table | `SELECT` | `INSERT` | `UPDATE` | `DELETE` | `TRUNCATE` |
|---|---:|---:|---:|---:|---:|
| `canonical_journal_entries` | yes | yes | no | no | no |
| `canonical_journal_lines` | yes | yes | no | no | no |
| `canonical_journal_relations` | yes | yes | no | no | no |
| `accounting_audit_events` | yes | yes | no | no | no |
| `accounting_posting_effects` | yes | yes | yes, only trigger-approved finalisation | no | no |

The API role receives no `ALL PRIVILEGES` grant and no ownership-level grant.
The `UPDATE` on `accounting_posting_effects` exists only because the approved
#44 model permits the constrained `pending → posted` and
`pending → uncertain` transitions. The trigger rejects every other transition
and every identity/company/source mutation.

The canonical tables are intentionally absent from the generic entity map.
That application boundary remains required in addition to the database grants.

### 4.4 Sequences and UUID defaults

The current schema uses UUID primary keys with `gen_random_uuid()` defaults and
does not declare application-owned serial/identity sequences. Therefore:

- no sequence `USAGE` or `SELECT` grant is required by the current schema;
- if a future approved schema introduces a sequence, it must receive an
  explicit sequence-level grant rather than a schema-wide grant; and
- `ledgerly_api` must not receive `USAGE` on arbitrary sequences.

The implementation must not add a sequence as part of RS-01.

### 4.5 Function execution

The current application does not call an application-defined database function.
The API therefore receives no broad `EXECUTE` privilege.

UUID defaults use the PostgreSQL/extension `gen_random_uuid()` function. Its
existing trusted function execution behavior must be verified in development;
RS-01 must not grant `EXECUTE` on arbitrary functions or grant function
ownership to `ledgerly_api`.

The four #44 trigger functions are owned by `ledgerly_canonical_owner` and
execute as trigger-owned security-definer functions as specified by #44. The
API role does not receive a direct grant that would allow replacing,
altering, or disabling them.

### 4.6 Migration and schema administration

`ledgerly_api` receives none of:

- `CREATE` on the database or schema;
- `ALTER`, `DROP`, or ownership privileges;
- `CREATE ROLE`, `ALTER ROLE`, or `DROP ROLE`;
- `CREATEDB`;
- `REPLICATION`;
- `BYPASSRLS`;
- `SET ROLE` membership to an administrative or owner role;
- `GRANT OPTION`; or
- migration-principal credentials.

The existing `@workspace/db` `push` command must not run under
`ledgerly_api`. Schema changes remain an administrative operation using the
separate administrative principal. A failed migration attempt under
`ledgerly_api` is expected to be denied.

## 5. Role membership and escalation controls

The implementation must explicitly verify these negative properties:

| Attempt | Required result |
|---|---|
| `SET ROLE postgres` | denied |
| `SET ROLE ledgerly_canonical_owner` | denied |
| `CREATE ROLE` | denied |
| `ALTER ROLE` | denied |
| `GRANT ...` | denied |
| `CREATE DATABASE` | denied |
| `CREATE SCHEMA` | denied |
| `ALTER TABLE ... OWNER TO ...` | denied |
| `ALTER FUNCTION ...` or `CREATE OR REPLACE FUNCTION` on #44 functions | denied |
| `ALTER TABLE ... DISABLE TRIGGER` | denied |
| direct header/line/relation/audit mutation | denied |
| prohibited posting-effect transition | denied |

The role catalog must show:

- `rolsuper = false`;
- `rolcreaterole = false`;
- `rolcreatedb = false`;
- `rolreplication = false`;
- `rolbypassrls = false`;
- `rolcanlogin = true`;
- `rolinherit = false`;
- no membership in `ledgerly_canonical_owner`, `postgres`, or another
  administrative role; and
- no ownership of a protected object.

`PUBLIC` defaults must not reintroduce escalation. In particular, the final
verification must inspect database, schema, table, function, and role-membership
ACLs rather than relying only on the role attributes.

## 6. Development `DATABASE_URL` and secret plan

### 6.1 Selected configuration

The development API will switch by replacing the development
`DATABASE_URL` value with a connection string for `ledgerly_api` using the
existing development database endpoint and database name.

The connection string will be stored through Replit’s secure Secrets mechanism.
It will not be stored in source code, committed files, workflow definitions,
logs, test fixtures, or documentation.

Replit documents that a manually supplied `DATABASE_URL` secret can override
the default runtime-managed value. This override is the selected development
configuration path. `PGUSER`, `PGPASSWORD`, and other `PG*` values will not be
used as a second competing configuration because the application explicitly
consumes `DATABASE_URL`.

### 6.2 Credential requirements

- Generate a strong random password for `ledgerly_api`.
- Never paste or display it in chat.
- Never print it in a command, test result, workflow log, or completion report.
- Never write it to source, a fixture, a plan, or a committed file.
- Store it only through the secure secret mechanism.
- Keep the administrative credential separate from the API credential.

The implementation must stop if a secure development secret cannot be created
or if the runtime would expose the credential to logs or source control.

### 6.3 Restart and rollback

After the secret override is saved, the development API workflow must be
restarted so new pool connections use the new login. No production workflow is
part of this sub-task.

If verification fails:

1. stop or leave disabled any canonical posting path;
2. preserve all canonical data and all role/trigger evidence;
3. remove the failed development override through the secure Secrets flow so
   the prior runtime-managed connection can be restored, or restore the prior
   development secret without exposing its value;
4. restart only the development API if connectivity must be restored;
5. keep #44 persistence protections and production posting status unchanged;
6. report the failing verification; and
7. do not delete canonical data or weaken triggers to make the API start.

Reverting the connection to `postgres` is a temporary development recovery
measure only. It does not mean RS-01 or #44 passed, and canonical posting must
remain disabled until a non-superuser runtime identity is verified.

## 7. Canonical ownership transfer

### 7.1 Tables

The following five existing #40 tables will be owned by
`ledgerly_canonical_owner`:

1. `accounting_posting_effects`;
2. `canonical_journal_entries`;
3. `canonical_journal_lines`;
4. `canonical_journal_relations`; and
5. `accounting_audit_events`.

Ownership transfer is development-only and must not rewrite, migrate, backfill,
delete, reinterpret, or transform rows.

### 7.2 #44 trigger objects

When the approved #44 triggers are created, `ledgerly_canonical_owner` will own
these four functions:

1. the canonical journal header mutation-rejection function;
2. the canonical journal line mutation-rejection function;
3. the append-only relation/audit mutation-rejection function; and
4. the constrained posting-effect transition function.

The actual function names must be recorded in the implementation report and
must be owned by `ledgerly_canonical_owner`. PostgreSQL triggers do not have an
independent role owner; the trigger objects are protected by their parent table
ownership and the API role’s lack of `ALTER`/`DISABLE` authority.

Indexes and constraints belonging to the five tables remain table-owned
dependent objects. The API role must not own or alter them.

## 8. Exact proposed implementation sequence

This sequence is for a future approved implementation. It is not being run by
this planning task.

1. Capture database name, endpoint metadata, current role state, table owners,
   memberships, ACLs, default privileges, functions, and existing canonical
   rows. Do not capture or print passwords.
2. Confirm the administrative principal is separate from the running API
   process and is authorized only for the controlled database operation.
3. Create `ledgerly_canonical_owner` as `NOLOGIN`, non-superuser,
   `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS`, and `NOINHERIT`.
4. Generate a strong `ledgerly_api` credential outside source control and
   create `ledgerly_api` as `LOGIN`, `NOSUPERUSER`, `NOCREATEDB`,
   `NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS`, and `NOINHERIT`.
5. Verify both role attribute sets before granting anything.
6. Revoke any accidental or inherited membership involving
   `ledgerly_api`; verify it cannot assume `postgres` or
   `ledgerly_canonical_owner`.
7. Remove unsafe `PUBLIC` database/schema defaults after checking unrelated
   development consumers.
8. Grant `CONNECT` and schema `USAGE` to `ledgerly_api`.
9. Grant the explicit ordinary-table privileges in section 4.2.
10. Grant the explicit canonical privileges in section 4.3, with no canonical
    `UPDATE`, `DELETE`, or `TRUNCATE` except constrained effect finalisation.
11. Transfer ownership of the five canonical tables to
    `ledgerly_canonical_owner`.
12. Create the approved #44 trigger functions owned by
    `ledgerly_canonical_owner`, install the triggers, and make them
    `ENABLE ALWAYS` as part of the approved #44 implementation.
13. Verify owners, ACLs, function owners, trigger state, unique indexes, and
    canonical data preservation.
14. Securely replace the development `DATABASE_URL` with the
    `ledgerly_api` connection string. Do not change `PGUSER` or other competing
    runtime-managed values.
15. Restart only the development API workflow.
16. Verify the API’s actual connection identity and session identity.
17. Run role-escalation, privilege, canonical-mutation, and trigger tests using
    the actual API connection.
18. Run permitted application reads/writes, BL-01-FI tests, #40/#44
    development tests, health checks, type checks, and existing regression
    tests.
19. Record exact non-secret role/ownership/grant results and failures.
20. Leave production posting disabled and report whether RS-01 passed.

If any step requires a role, grant, DDL object, code change, infrastructure
change, or production action not listed here, stop before performing it.

## 9. Mandatory verification matrix

The future implementation must test the actual application connection, not
only an administrative session.

### 9.1 Runtime identity

- `current_user = ledgerly_api`;
- `session_user = ledgerly_api` for a direct login;
- `rolsuper = false`;
- `rolcreaterole = false`;
- `rolcreatedb = false`;
- `rolreplication = false`;
- `rolbypassrls = false`;
- `rolcanlogin = true`; and
- `rolinherit = false`.

### 9.2 Ownership and membership

- `ledgerly_api` does not own any canonical table;
- `ledgerly_canonical_owner` owns all five canonical tables;
- `ledgerly_canonical_owner` owns all four #44 trigger functions after they
  are created;
- `ledgerly_api` is not a member of `ledgerly_canonical_owner`;
- `ledgerly_api` is not a member of `postgres` or another admin role;
- canonical indexes/constraints remain dependent on owner-controlled tables;
  and
- existing canonical row counts and hashes/field snapshots are unchanged by
  role setup.

### 9.3 Privilege and escalation resistance

- direct `SET ROLE postgres` fails;
- direct `SET ROLE ledgerly_canonical_owner` fails;
- `CREATE ROLE`, `ALTER ROLE`, and `GRANT` fail;
- `CREATE DATABASE` and `CREATE SCHEMA` fail;
- ownership alteration fails;
- trigger-function alteration fails;
- trigger disabling fails;
- `PUBLIC` cannot grant an effective escalation path;
- database/schema `CREATE` is not available through `PUBLIC`;
- `ledgerly_api` has no grant option; and
- migration/schema administration fails under the API connection.

### 9.4 Canonical mutation resistance

Using a posted canonical fixture:

- header `UPDATE` fails;
- line `UPDATE` fails;
- header `DELETE` fails;
- line `DELETE` fails;
- header `TRUNCATE` fails;
- relation and audit `UPDATE`/`DELETE` fail;
- relation and audit `TRUNCATE` fail;
- prohibited posting-effect transitions fail;
- changing status, company, ownership, source, or economic-effect identity
  fails; and
- all original rows remain unchanged after every failed attempt.

### 9.5 Required application behavior

- the API starts with `ledgerly_api`;
- `/api/healthz` passes;
- ordinary permitted reads work;
- ordinary permitted application writes work;
- canonical `SELECT`/`INSERT` paths work;
- posting-effect finalisation works only through its approved transition;
- BL-01-FI tests pass;
- existing application tests pass;
- #40/#44 development tests connect using `ledgerly_api`; and
- the legacy JSON `journal_entries` table remains untouched by role setup.

## 10. Application impact

**Expected application code change: NONE.**

The database library already reads:

```ts
new Pool({ connectionString: process.env.DATABASE_URL })
```

Changing the development `DATABASE_URL` value changes the login without
changing source code, route behavior, or the artifact workflow command.

The operational impact is intentional:

- the API can no longer run schema migrations;
- the API can no longer directly mutate protected canonical records;
- schema administration must use the separate administrative principal; and
- any application path that unexpectedly requires broad canonical mutation must
  fail and be reviewed rather than receiving a broader grant.

If implementation discovers that application code must change to select the
new role, this package is not sufficient for that change. Stop and record a
separate approval dependency rather than silently adding code changes.

## 11. Production boundary

#44-RS-01 is development-only. It does not authorize:

- production role creation;
- production secret changes;
- production ownership transfer;
- production schema changes;
- Publish configuration;
- deployment;
- publishing;
- production posting;
- historical migration or cutover;
- BL-06 as a whole;
- BL-07;
- #41 execution;
- RLS;
- invoice, bill, payment, allocation, refund, bank, reconciliation, VAT-return,
  period-management, or year-end workflows.

A separate future production-readiness review must verify Replit’s supported
production model for:

- custom non-superuser login roles;
- a `NOLOGIN` canonical owner;
- privilege persistence;
- production connection-string override;
- role persistence through Publish; and
- recovery if the production database provider does not expose the same role
  model.

Until that review passes:

**PRODUCTION POSTING REMAINS DISABLED.**

## 12. Rollback plan

If the new development API role causes startup, query, or regression failures:

1. keep canonical posting disabled;
2. do not delete or alter canonical rows;
3. preserve the owner role and trigger protections;
4. revert only the development connection through the secure secret
   mechanism, without exposing either credential;
5. restart the development API only if needed to restore development
   connectivity;
6. use the administrative principal for any required schema inspection;
7. do not grant `postgres`-level privileges to `ledgerly_api`; and
8. report the exact failed check and leave RS-01 incomplete.

Temporary connection rollback does not authorize canonical posting. A role or
ownership rollback itself requires administrative approval and must be
performed only if leaving the partial role state is less safe than restoring
the captured development state. No production rollback is included.

## 13. Risks and stop conditions

### Risks

- Replit may not support the custom-role connection override in the eventual
  production environment.
- Revoking `PUBLIC` defaults may affect an unrelated development consumer and
  must be checked before applying.
- Existing generic application behavior may rely on table DML that is broader
  than the intended product authorization; database grants must not be used
  to conceal that issue.
- A privileged session could bypass table protections; the running API must
  never use that session.
- A connection override failure could leave the API on the unsafe `postgres`
  connection; posting must remain disabled until identity verification passes.

### Mandatory stop conditions

Stop before applying changes if:

- `DATABASE_URL` cannot be securely overridden for development;
- a true direct `ledgerly_api` login cannot be used;
- `ledgerly_api` is or must remain a superuser;
- `ledgerly_api` must own a canonical table;
- `ledgerly_api` must receive superuser-equivalent permissions;
- `ledgerly_api` can assume `postgres` or `ledgerly_canonical_owner`;
- trigger protection cannot be owned and disabled only by the administrative
  boundary;
- current application behavior requires broad canonical `UPDATE`, `DELETE`, or
  `TRUNCATE`;
- removing public defaults would break an approved consumer and no narrow
  replacement is available;
- role separation requires unapproved code, infrastructure, or schema changes;
- production support is being used as a reason to change development scope; or
- any credential would be exposed in source, logs, tests, documentation, or
  chat.

Do not substitute `SET ROLE`, application-only immutability, a shared
superuser, broad grants, or RLS for this selected model.

## 14. Governance and status

- DEC-01 through DEC-22 remain approved.
- DEC-23 does not exist.
- DEC-12 remains exclusively Payment, Allocation and Settlement Policy.
- Source freshness remains implementation-level.
- DEC-04 remains authoritative for immutability.
- DEC-21 RLS remains defence-in-depth only.
- BL-01-FI remains complete.
- #40-CF-01 remains incomplete.
- #44 remains incomplete.
- #44-RS-01 remains proposed only.
- BL-06 remains blocked.
- BL-07 remains blocked.
- #41 remains planning-only.
- Production posting remains disabled.

## 15. Approval gates

Before implementation begins, the user must explicitly approve:

1. the exact development-only scope in this package;
2. creation of the `ledgerly_api` login role with the exact non-superuser
   attributes in section 3.3;
3. creation of the `ledgerly_canonical_owner` `NOLOGIN` owner role;
4. the explicit minimum grants and revocations in section 4;
5. the prohibition on API role membership or `SET ROLE` escalation;
6. ownership transfer of only the five canonical tables and the four approved
   #44 trigger functions when created;
7. secure development `DATABASE_URL` override behavior;
8. development-only workflow restart and rollback behavior;
9. the complete actual-runtime verification matrix; and
10. the production boundary and continued production-posting disablement.

Approval must not be inferred from reviewing this document, the previous #44
approval, database reachability, or the fact that PostgreSQL reports that the
current superuser can create roles.

## 16. Definition of done

#44-RS-01 is complete only when:

- the actual development API connects directly as `ledgerly_api`;
- `current_user` and `session_user` are verified as expected;
- all required non-superuser role attributes are verified;
- `ledgerly_api` cannot create roles/databases, grant privileges, assume an
  administrative role, alter ownership, alter functions, or disable triggers;
- `ledgerly_canonical_owner` owns the five canonical tables;
- the approved #44 trigger functions are owned by
  `ledgerly_canonical_owner`;
- canonical mutation grants are absent from `ledgerly_api`;
- effect finalisation works only through the approved trigger transitions;
- ordinary application functionality continues to work with explicit grants;
- schema administration is denied to the API role;
- `/api/healthz`, BL-01-FI, #40/#44 development tests, and application
  regression tests pass;
- canonical data and legacy JSON journal data remain untouched;
- no production secret, role, schema, workflow, deployment, or posting state
  changes;
- no unapproved code, infrastructure, DDL, RLS, or product domain was added;
  and
- an independent review confirms the actual runtime connection and negative
  privilege tests.

## 17. Final verdict

READY FOR #44-RS-01 IMPLEMENTATION APPROVAL