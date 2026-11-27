import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import {spawn, execFileSync} from "node:child_process";
import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import path from "node:path";
import pg from "pg";
import { pool } from "@workspace/db";
import { createCompaniesRouter } from "../routes/companies";
import { SENSITIVE_ACTIONS, type SensitiveAction } from "./roles";
import { withPayrollAccess, SensitiveAccessError } from "../services/payroll/access/service";
import { withPersonalTaxAccess } from "../services/tax/access/service";
import type { PersonalTaxPreparationCreation } from "../services/tax/access/preparationRecord";

const socket = process.env.ACCOUNTING_FLOW_TEST_SOCKET ?? "";
if (!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]+\/socket$/.test(socket)) throw Error("Disposable socket required");
const admin = new pg.Pool({ host: socket, port: 55441, user: "w03_bootstrap", database: "ledgerly_accounting_flow_test", password: "", ssl: false, options: "" });
let server: ReturnType<ReturnType<typeof express>["listen"]>, base: string;
let identityCalls = 0;
let providerFailure = false;
const identities = new Set<string>();
const emailIdentities = new Map<string, string>();
const logs: unknown[] = [];
let deleteGrantScopeActive = false;
let payBrowserPage = '', payBrowserScript = '';
let reportPayBrowser: ((result: {ok: boolean; stage?: string}) => void) | undefined;
before(async () => {
  const identity = (await pool.query("SELECT current_database() db,current_user role,inet_server_addr() addr")).rows[0];
  assert.deepEqual(identity, { db: "ledgerly_accounting_flow_test", role: "ledgerly_api", addr: null });
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { (req as any).log = { error: (...args: unknown[]) => logs.push(args) }; next(); });
  app.get('/pay-ui-fixture', (_req,res) => res.type('html').send(payBrowserPage));
  app.get('/pay-ui-bundle', (_req,res) => res.type('application/javascript').send(payBrowserScript));
  app.post('/pay-ui-result', (req,res) => {
    if (!reportPayBrowser) { res.sendStatus(404); return; }
    const stage = ['entry','retry','csv-download','bank-detail','pay-denial-clears-bank','reader','company-change','initial','history','refresh','scope','empty','denial'].includes(req.body?.stage) ? req.body.stage : 'unknown';
    reportPayBrowser({ok: req.body?.ok === true, stage}); res.sendStatus(200);
  });
  app.use(createCompaniesRouter((req, res, next) => {
    const actor = req.get("x-test-actor");
    if (!actor) { res.sendStatus(401); return; }
    (req as any).userId = actor; next();
  }, {
    async byId(id) {
      identityCalls++;
      if (providerFailure) throw new Error("provider secret-token and private SQL diagnostics");
      return identities.has(id) ? { id } : null;
    },
    async byEmail(email) { identityCalls++; const id = emailIdentities.get(email); return id ? { id } : null; },
  }));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  try {
    assert.equal(deleteGrantScopeActive, false);
    await assertDefaultDeletePrivileges();
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.end(); await admin.end();
  }
});

type DeleteFixtureTable = 'companies' | 'company_users';
async function deletePrivilegeSnapshot() {
  return (await pool.query(`SELECT c.relname table_name,
    has_table_privilege(current_user,c.oid,'SELECT') can_read,
    has_table_privilege(current_user,c.oid,'INSERT') can_insert,
    has_table_privilege(current_user,c.oid,'UPDATE') can_update,
    has_table_privilege(current_user,c.oid,'DELETE') can_delete,
    has_table_privilege(current_user,c.oid,'TRUNCATE') can_truncate
    FROM pg_class c WHERE c.oid IN ('public.companies'::regclass,'public.company_users'::regclass)
    ORDER BY c.relname`)).rows;
}
async function assertDefaultDeletePrivileges() {
  const privileges = await deletePrivilegeSnapshot();
  assert.equal(privileges.length, 2);
  assert.ok(privileges.every(row => row.can_delete === false), 'canonical runtime must not gain DELETE privileges');
  return privileges;
}
/** Tests run serially. Grant only around an awaited delete request, never suite-wide.
 * This qualifies the pre-existing route conditionally; the canonical runtime cannot delete. */
async function withDisposableDeletePrivileges<T>(tables: readonly DeleteFixtureTable[], operation: () => Promise<T>): Promise<T> {
  assert.equal(deleteGrantScopeActive, false, 'delete privilege fixtures must not overlap');
  assert.ok(tables.length > 0 && tables.every(table => ['companies', 'company_users'].includes(table)));
  deleteGrantScopeActive = true;
  let restoreRequired = false;
  let baseline: Awaited<ReturnType<typeof deletePrivilegeSnapshot>> | undefined;
  const relations = [...new Set(tables)].map(table => `public.${table}`).join(',');
  try {
    baseline = await assertDefaultDeletePrivileges();
    restoreRequired = true;
    await admin.query(`GRANT DELETE ON ${relations} TO ledgerly_api`);
    assert.deepEqual(await deletePrivilegeSnapshot(), baseline.map(row => ({ ...row, can_delete: tables.includes(row.table_name) })));
    return await operation();
  } finally {
    try {
      if (restoreRequired) {
        await admin.query(`REVOKE DELETE ON ${relations} FROM ledgerly_api`);
        assert.deepEqual(await assertDefaultDeletePrivileges(), baseline);
      }
    } finally { deleteGrantScopeActive = false; }
  }
}
async function request(path: string, method = "GET", body?: unknown, actor?: string) {
  const response = await fetch(base + path, { method, headers: {
    ...(actor ? { "x-test-actor": actor } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.text(), cacheControl: response.headers.get('cache-control') };
}
async function fixture() {
  const company = randomUUID(), owner = `synthetic-owner-${randomUUID()}`;
  await admin.query("INSERT INTO companies(id,name) VALUES($1,'Synthetic security fixture')", [company]);
  await addMember(company, owner);
  return { company, owner };
}
async function addMember(company: string, user: string, role: string | null = "owner", active: boolean | null = true) {
  await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,$4,$5)", [randomUUID(), company, user, role, active]);
  identities.add(user);
}
async function activeOwners(company: string) {
  return (await admin.query("SELECT user_id FROM company_users WHERE company_id=$1 AND role='owner' AND is_active=true", [company])).rows;
}

test("concurrent owner self-demotions serialize and retain exactly one active owner", async () => {
  const f = await fixture(), second = `synthetic-owner-${randomUUID()}`;
  await addMember(f.company, second);
  const results = await Promise.all([f.owner, second].map(actor => request(`/${f.company}/members/${actor}`, "PUT", { role: "accountant" }, actor)));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal((await activeOwners(f.company)).length, 1);
  assert.match(results.find(result => result.status === 409)!.body, /last_owner/);
});

test("unverified identities cannot become a substitute owner or permit self-demotion", async () => {
  const f = await fixture(), fake = `not-a-clerk-user-${randomUUID()}`;
  const beforeCalls = identityCalls;
  const added = await request(`/${f.company}/members`, "POST", { user_id: fake, role: "owner" }, f.owner);
  assert.equal(added.status, 404);
  assert.equal(identityCalls, beforeCalls + 1);
  assert.equal((await admin.query("SELECT id FROM company_users WHERE company_id=$1 AND user_id=$2", [f.company, fake])).rowCount, 0);
  assert.equal((await request(`/${f.company}/members/${f.owner}`, "PUT", { role: "member" }, f.owner)).status, 409);
  assert.equal((await activeOwners(f.company)).length, 1);
});

test("invalid roles are rejected before identity lookup or writes on add, edit and invite", async () => {
  const f = await fixture(); const beforeCalls = identityCalls;
  for (const role of [null, "superadmin", "OWNER", {}, ["owner"]]) {
    for (const [path, method, body] of [
      [`/${f.company}/members`, "POST", { user_id: "synthetic-new", role }],
      [`/${f.company}/members/${f.owner}`, "PUT", { role }],
      [`/${f.company}/invite`, "POST", { email: "synthetic@example.test", role }],
    ] as const) assert.equal((await request(path, method, body, f.owner)).status, 400);
  }
  assert.equal(identityCalls, beforeCalls);
  assert.equal((await activeOwners(f.company)).length, 1);
});

test("nonowners, inactive, unknown, null and cross-company memberships cannot escalate; active duplicates are rejected", async () => {
  const f = await fixture(), other = await fixture(); const beforeCalls = identityCalls;
  const actors: string[] = [other.owner];
  for (const role of ["admin", "accountant", "staff", "member", "read_only", "unknown", null]) {
    const actor = `synthetic-actor-${randomUUID()}`; actors.push(actor); await addMember(f.company, actor, role);
  }
  for (const active of [false, null]) {
    const actor = `synthetic-inactive-${randomUUID()}`; actors.push(actor); await addMember(f.company, actor, "owner", active);
  }
  const duplicate = `synthetic-duplicate-${randomUUID()}`; actors.push(duplicate);
  await addMember(f.company, duplicate, "member");
  // The real database prevents conflicting active rows. Preserve that guard;
  // ambiguous membership policy is exercised separately by the pure unit tests.
  await assert.rejects(() => addMember(f.company, duplicate, "owner"), error => {
    const databaseError = error as { code?: string; constraint?: string };
    assert.equal(databaseError.code, "23505");
    assert.equal(databaseError.constraint, "w03_active_membership_identity");
    return true;
  });
  assert.deepEqual((await admin.query(
    "SELECT role,is_active FROM company_users WHERE company_id=$1 AND user_id=$2",
    [f.company, duplicate],
  )).rows, [{ role: "member", is_active: true }]);
  for (const actor of actors) {
    assert.equal((await request(`/${f.company}/members/${f.owner}`, "PUT", { role: "member" }, actor)).status, 403, actor);
    assert.equal((await request(`/${f.company}/members`, "POST", { user_id: "synthetic-new", role: "owner" }, actor)).status, 403, actor);
  }
  assert.equal(identityCalls, beforeCalls);
  assert.equal((await request(`/${f.company}/members/${f.owner}`, "PUT", { role: "member" })).status, 401);
  assert.equal((await activeOwners(f.company)).some(row => row.user_id === f.owner), true);
});

test("company mass assignment is rejected and provider failures redact logs and public errors", async () => {
  const f = await fixture();
  for (const data of [{ id: randomUUID() }, { updated_at: "1900-01-01" }, { user_id: "attacker" }, { role: "owner" }]) {
    assert.equal((await request(`/${f.company}`, "PUT", data, f.owner)).status, 400);
    assert.equal((await request("/", "POST", { name: "Synthetic invalid company", ...data }, f.owner)).status, 400);
  }
  providerFailure = true;
  try {
    const result = await request(`/${f.company}/members`, "POST", { user_id: "synthetic-provider-failure", role: "member" }, f.owner);
    assert.equal(result.status, 500);
    assert.equal(result.body.includes("secret-token"), false);
    assert.equal(JSON.stringify(logs).includes("secret-token"), false);
    assert.match(result.body, /Unable to complete/);
  } finally { providerFailure = false; }
});


test("company detail updates recheck authority after concurrent removal or demotion wins the company lock", async () => {
  for (const change of ["revoke", "demote"] as const) {
    const f = await fixture(), editor = `synthetic-editor-${randomUUID()}`;
    await addMember(f.company, editor, "accountant");
    assert.equal((await request(`/${f.company}`, "PUT", { name: "Before concurrent change" }, editor)).status, 200);
    const blocker = await admin.connect();
    let pending: Promise<{ status: number; body: string }> | undefined;
    try {
      await blocker.query("BEGIN");
      const { rows: [{ pid }] } = await blocker.query("SELECT pg_backend_pid() pid");
      await blocker.query("SELECT id FROM companies WHERE id=$1 FOR UPDATE", [f.company]);
      pending = request(`/${f.company}`, "PUT", { name: "Unauthorised delayed edit" }, editor);
      // Observe the real request waiting on this transaction, rather than racing
      // arbitrary sleeps. The previous implementation waited only at its UPDATE.
      const deadline = Date.now() + 5000;
      let waiting = false;
      while (Date.now() < deadline) {
        waiting = (await admin.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='ledgerly_api' AND $1::int=ANY(pg_blocking_pids(pid))) waiting", [pid])).rows[0].waiting;
        if (waiting) break;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true, "the authenticated update must reach the company lock");
      if (change === "revoke") await blocker.query("UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2", [f.company, editor]);
      else await blocker.query("UPDATE company_users SET role='read_only' WHERE company_id=$1 AND user_id=$2", [f.company, editor]);
      await blocker.query("COMMIT");
      const response = await pending;
      assert.equal(response.status, 403, response.body);
      assert.equal((await admin.query("SELECT name FROM companies WHERE id=$1", [f.company])).rows[0].name, "Before concurrent change");
      assert.equal((await activeOwners(f.company)).length, 1);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      if (pending) await pending;
    }
  }
});

const sensitiveRequest = (company: string, actor: string, action: SensitiveAction) => ({
  company_id: company, actor_id: actor, resource_company_id: company, resource_id: company, action,
});
const sensitiveRun = (action: SensitiveAction) => action.startsWith("payroll.") ? withPayrollAccess : withPersonalTaxAccess;
const sensitiveAudit = async (company: string) => (await pool.query(
  "SELECT action,outcome,target_type,target_id,actor_type,actor_id,capability,context,journal_id,posting_effect_id FROM public.accounting_audit_events WHERE company_id=$1 ORDER BY created_at,id", [company])).rows;
const deniedSensitive = (error: unknown) => error instanceof SensitiveAccessError && error.code === "SENSITIVE_ACCESS_DENIED";

test("specialized role assignment uses verified identities and owner-only membership control without bookkeeping escalation", async () => {
  const f = await fixture(), actor = `synthetic-specialist-${randomUUID()}`;
  identities.add(actor);
  assert.equal((await request(`/${f.company}/members`, "POST", { user_id: actor, role: "payroll_preparer" }, f.owner)).status, 201);
  assert.equal((await request(`/${f.company}/members/${actor}`, "PUT", { role: "personal_tax_submitter" }, actor)).status, 403);
  assert.equal((await request(`/${f.company}`, "PUT", { name: "Unexpected bookkeeping write" }, actor)).status, 403);
  assert.equal((await request(`/${f.company}/members/${actor}`, "PUT", { role: "personal_tax_submitter" }, f.owner)).status, 200);
  assert.equal((await request(`/${f.company}/members/${f.owner}`, "PUT", { role: "payroll_approver" }, f.owner)).status, 409);
  assert.deepEqual((await pool.query('SELECT role FROM company_users WHERE company_id=$1 AND user_id=$2', [f.company, actor])).rows, [{ role: "personal_tax_submitter" }]);
  const audit = await sensitiveAudit(f.company); assert.equal(audit.length, 2);
  assert.deepEqual(audit[1].context, { contract: 'sensitive-membership.v1', operation: 'role_change',
    previous_role: 'payroll_preparer', next_role: 'personal_tax_submitter', previous_active: true, next_active: true });
});

test("ordinary bookkeeping and invalid memberships cannot invoke sensitive read/export or change callbacks", async () => {
  const f = await fixture(), other = await fixture(); let calls = 0;
  const operation = async () => { calls++; return { salary: "synthetic-private-salary", identifier: "synthetic-private-id", bank: "synthetic-private-bank" }; };
  for (const role of ["admin", "accountant", "staff", "member", "read_only", "unknown", null]) {
    const actor = `synthetic-bookkeeping-${randomUUID()}`; await addMember(f.company, actor, role);
    for (const action of SENSITIVE_ACTIONS) await assert.rejects(() => sensitiveRun(action)(sensitiveRequest(f.company, actor, action), operation), deniedSensitive);
  }
  for (const active of [false, null]) {
    const actor = `synthetic-inactive-${randomUUID()}`; await addMember(f.company, actor, "payroll_preparer", active);
    await assert.rejects(() => withPayrollAccess(sensitiveRequest(f.company, actor, "payroll.read"), operation), deniedSensitive);
  }
  for (const [role, action] of [["payroll_reader", "payroll.export"], ["payroll_preparer", "payroll.approve"],
    ["payroll_approver", "payroll.prepare"], ["personal_tax_preparer", "personal_tax.submit"],
    ["personal_tax_submitter", "personal_tax.prepare"], ["payroll_preparer", "personal_tax.read"],
    ["personal_tax_preparer", "payroll.read"]] as const) {
    const actor = `synthetic-wrong-right-${randomUUID()}`; await addMember(f.company, actor, role);
    await assert.rejects(() => sensitiveRun(action)(sensitiveRequest(f.company, actor, action), operation), deniedSensitive);
  }
  await assert.rejects(() => withPayrollAccess(sensitiveRequest(f.company, other.owner, "payroll.read"), operation), deniedSensitive);
  await assert.rejects(() => withPayrollAccess({ ...sensitiveRequest(f.company, f.owner, "payroll.read"), resource_company_id: other.company }, operation), deniedSensitive);
  const ambiguous = `synthetic-ambiguous-${randomUUID()}`;
  await addMember(f.company, ambiguous, "payroll_preparer", true); await addMember(f.company, ambiguous, "payroll_reader", false);
  await assert.rejects(() => withPayrollAccess(sensitiveRequest(f.company, ambiguous, "payroll.read"), operation), deniedSensitive);
  assert.equal(calls, 0); assert.deepEqual(await sensitiveAudit(f.company), []);
});

test("allowed sensitive reads, exports and local changes return only after redacted actor/company audit commits", async () => {
  const f = await fixture(), actor = `synthetic-sensitive-${randomUUID()}`;
  await addMember(f.company, actor, "payroll_reader");
  const cases: Array<[string, SensitiveAction]> = [["payroll_reader", "payroll.read"], ["payroll_preparer", "payroll.export"],
    ["payroll_preparer", "payroll.prepare"], ["payroll_approver", "payroll.approve"],
    ["personal_tax_preparer", "personal_tax.read"], ["personal_tax_preparer", "personal_tax.export"],
    ["personal_tax_preparer", "personal_tax.prepare"], ["personal_tax_submitter", "personal_tax.submit"]];
  const privateResult = { salary: "synthetic-private-salary", identifier: "synthetic-private-id", bank: "synthetic-private-bank" };
  for (const [role, action] of cases) {
    await admin.query("UPDATE company_users SET role=$3 WHERE company_id=$1 AND user_id=$2", [f.company, actor, role]);
    const result = await sensitiveRun(action)(sensitiveRequest(f.company, actor, action), async context => {
      assert.equal(Object.isFrozen(context), true); assert.equal(context.companyId, f.company); assert.equal(context.actorId, actor);
      assert.equal(context.resourceId, f.company); assert.equal(context.role, role); assert.equal(context.action, action);
      // Synthetic fixture read/change through the same transaction; no absent HR schema is simulated as a product route.
      const row = (await context.query('SELECT id FROM public.companies WHERE id=$1', [context.companyId])).rows[0];
      assert.equal(row.id, f.company);
      if (action.endsWith(".prepare")) await context.query("UPDATE public.companies SET name='Synthetic sensitive transaction' WHERE id=$1", [context.companyId]);
      return privateResult;
    });
    assert.deepEqual(result, privateResult);
    const audit = (await sensitiveAudit(f.company)).find(row => row.capability === action)!;
    assert.ok(audit); assert.equal(audit.actor_id, actor); assert.equal(audit.target_id, f.company);
    assert.equal(audit.action, "sensitive_access"); assert.equal(audit.outcome, "allowed"); assert.equal(audit.actor_type, "user");
    assert.equal(audit.target_type, action.startsWith("payroll.") ? "payroll_resource" : "personal_tax_resource");
    assert.deepEqual(audit.context, { contract: "sensitive-access.v1", role });
    assert.equal(audit.journal_id, null); assert.equal(audit.posting_effect_id, null);
  }
  const audits = await sensitiveAudit(f.company); assert.equal(audits.length, cases.length);
  for (const value of Object.values(privateResult)) assert.equal(JSON.stringify(audits).includes(value), false);
  assert.equal((await pool.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1', [f.company])).rows[0].n, 0);
  for (const sql of ["UPDATE public.accounting_audit_events SET actor_id=actor_id", "DELETE FROM public.accounting_audit_events", "TRUNCATE public.accounting_audit_events"])
    await assert.rejects(() => pool.query(sql), error => (error as any).code === "42501");
});

test("audit insertion failure rolls back local sensitive changes and cannot disclose callback results or diagnostics", async () => {
  const f = await fixture(); let called = false, disclosed = false;
  await admin.query(`CREATE FUNCTION public.synthetic_sensitive_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.company_id='${f.company}'::uuid THEN RAISE EXCEPTION 'synthetic-private-audit-diagnostic'; END IF; RETURN NEW; END $$`);
  await admin.query('CREATE TRIGGER synthetic_sensitive_audit_failure BEFORE INSERT ON public.accounting_audit_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_sensitive_audit_failure()');
  try {
    const operation = withPayrollAccess(sensitiveRequest(f.company, f.owner, "payroll.prepare"), async context => {
      called = true; await context.query("UPDATE public.companies SET name='Sensitive uncommitted change' WHERE id=$1", [context.companyId]);
      return "synthetic-private-result";
    }).then(value => { disclosed = true; return value; });
    await assert.rejects(() => operation, error => error instanceof SensitiveAccessError && error.code === 'SENSITIVE_OPERATION_UNAVAILABLE' && !JSON.stringify(error).includes('private'));
    assert.equal(called, true); assert.equal(disclosed, false);
    assert.equal((await pool.query('SELECT name FROM companies WHERE id=$1', [f.company])).rows[0].name, 'Synthetic security fixture');
    assert.deepEqual(await sensitiveAudit(f.company), []);
  } finally {
    await admin.query('DROP TRIGGER synthetic_sensitive_audit_failure ON public.accounting_audit_events');
    await admin.query('DROP FUNCTION public.synthetic_sensitive_audit_failure()');
  }
});

test("sensitive authorization observes committed revocation and demotion after waiting for the company lock", async () => {
  for (const change of ['revoke', 'demote']) {
    const f = await fixture(), actor = `synthetic-revoked-${randomUUID()}`; await addMember(f.company, actor, 'payroll_preparer');
    const blocker = await admin.connect(); let calls = 0; let pending: Promise<unknown> | undefined;
    try {
      await blocker.query('BEGIN'); const { rows: [{ pid }] } = await blocker.query('SELECT pg_backend_pid() pid');
      await blocker.query('SELECT id FROM companies WHERE id=$1 FOR UPDATE', [f.company]);
      pending = withPayrollAccess(sensitiveRequest(f.company, actor, 'payroll.export'), async () => { calls++; return 'synthetic-private-export'; }).catch(error => error);
      const deadline = Date.now() + 5000; let waiting = false;
      while (Date.now() < deadline) {
        waiting = (await admin.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='ledgerly_api' AND $1::int=ANY(pg_blocking_pids(pid))) waiting", [pid])).rows[0].waiting;
        if (waiting) break; await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true);
      if (change === 'revoke') await blocker.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2', [f.company, actor]);
      else await blocker.query("UPDATE company_users SET role='accountant' WHERE company_id=$1 AND user_id=$2", [f.company, actor]);
      await blocker.query('COMMIT'); assert.equal(deniedSensitive(await pending), true); assert.equal(calls, 0);
      assert.deepEqual(await sensitiveAudit(f.company), []);
    } finally { await blocker.query('ROLLBACK'); blocker.release(); if (pending) await pending; }
  }
});

test("missing audit guard or column-only UPDATE privilege refuses sensitive access before any callback", async () => {
  const f = await fixture(); let calls = 0;
  const run = () => withPayrollAccess(sensitiveRequest(f.company, f.owner, 'payroll.read'), async () => { calls++; return 'synthetic-private'; });
  await admin.query('ALTER TABLE public.accounting_audit_events DISABLE TRIGGER ledgerly_accounting_audit_events_guard');
  try { await assert.rejects(run, /SENSITIVE_OPERATION_UNAVAILABLE/); }
  finally { await admin.query('ALTER TABLE public.accounting_audit_events ENABLE ALWAYS TRIGGER ledgerly_accounting_audit_events_guard'); }
  await admin.query('GRANT UPDATE(actor_id) ON public.accounting_audit_events TO ledgerly_api');
  try {
    assert.equal((await pool.query("SELECT has_table_privilege(current_user,'public.accounting_audit_events','UPDATE') p")).rows[0].p, false);
    await assert.rejects(run, /SENSITIVE_OPERATION_UNAVAILABLE/);
  } finally { await admin.query('REVOKE UPDATE(actor_id) ON public.accounting_audit_events FROM ledgerly_api'); }
  assert.equal(calls, 0); assert.deepEqual(await sensitiveAudit(f.company), []);
  console.log('SENSITIVE_ACCESS_ACCEPTANCE', JSON.stringify({ currentMembership: true, distinctRights: true, auditAtomicity: true, revokedBeforeCallback: true, protectedAuditRequired: true, nativeRecordRoutesPending: true }));
});

test("default canonical privileges deny owner and self deletion without membership, company or audit changes", async () => {
  await assertDefaultDeletePrivileges();
  for (const role of ['payroll_reader', 'member']) {
    const f = await fixture(), target = `synthetic-default-delete-${randomUUID()}`;
    await addMember(f.company, target, role);
    const snapshot = async () => ({
      company: (await pool.query('SELECT * FROM companies WHERE id=$1', [f.company])).rows,
      members: (await pool.query('SELECT * FROM company_users WHERE company_id=$1 ORDER BY id', [f.company])).rows,
      audit: await sensitiveAudit(f.company),
    });
    const baseline = await snapshot();
    for (const [path, actor] of [[`/${f.company}/members/${target}`, f.owner],
      [`/${f.company}/members/${target}`, target], [`/${f.company}`, f.owner]]) {
      const response = await request(path, 'DELETE', undefined, actor);
      assert.equal(response.status, 500, response.body);
      assert.deepEqual(JSON.parse(response.body), { error: 'Unable to complete this request. Please try again.' });
      assert.deepEqual(await snapshot(), baseline);
      await assertDefaultDeletePrivileges();
    }
  }
});

test("disposable delete privilege fixture restores default permissions even when its operation throws", async () => {
  const baseline = await assertDefaultDeletePrivileges();
  await assert.rejects(() => withDisposableDeletePrivileges(['companies', 'company_users'], async () => {
    throw new Error('synthetic-delete-fixture-interruption');
  }), /synthetic-delete-fixture-interruption/);
  assert.equal(deleteGrantScopeActive, false);
  assert.deepEqual(await assertDefaultDeletePrivileges(), baseline);
});

test("specialised grants and transitions redact target PII; removal is conditional on disposable DELETE grant", async () => {
  const f = await fixture();
  for (const role of ['payroll_reader', 'payroll_preparer', 'payroll_approver', 'personal_tax_preparer', 'personal_tax_submitter']) {
    const target = `synthetic-private-target-${randomUUID()}`; identities.add(target);
    const added = await request(`/${f.company}/members`, 'POST', { user_id: target, role, private_note: 'synthetic-private-note' }, f.owner);
    assert.equal(added.status, 201, added.body); const member = JSON.parse(added.body);
    assert.equal((await request(`/${f.company}/members/${target}`, 'PUT', { role: 'accountant' }, f.owner)).status, 200);
    assert.equal((await request(`/${f.company}/members/${target}`, 'PUT', { role }, f.owner)).status, 200);
    assert.equal((await withDisposableDeletePrivileges(['company_users'], () =>
      request(`/${f.company}/members/${target}`, 'DELETE', undefined, f.owner))).status, 200);
    const audit = (await sensitiveAudit(f.company)).filter(row => row.target_id === member.id);
    assert.equal(audit.length, 4);
    assert.deepEqual(audit.map(row => row.context), [
      { contract: 'sensitive-membership.v1', operation: 'member_add', previous_role: null, next_role: role, previous_active: null, next_active: true },
      { contract: 'sensitive-membership.v1', operation: 'role_change', previous_role: role, next_role: 'accountant', previous_active: true, next_active: true },
      { contract: 'sensitive-membership.v1', operation: 'role_change', previous_role: 'accountant', next_role: role, previous_active: true, next_active: true },
      { contract: 'sensitive-membership.v1', operation: 'member_remove', previous_role: role, next_role: null, previous_active: true, next_active: null },
    ]);
    for (const row of audit) {
      assert.equal(row.actor_id, f.owner); assert.equal(row.action, 'sensitive_membership_change');
      assert.equal(row.outcome, 'allowed'); assert.equal(row.target_type, 'company_membership');
      assert.equal(row.actor_type, 'user'); assert.equal(row.capability, 'company.membership.change');
      assert.equal(row.journal_id, null); assert.equal(row.posting_effect_id, null);
    }
    assert.equal(JSON.stringify(audit).includes(target), false);
    assert.equal(JSON.stringify(audit).includes('synthetic-private-note'), false);
  }
  assert.equal((await pool.query('SELECT count(*)::int n FROM canonical_journal_entries WHERE company_id=$1', [f.company])).rows[0].n, 0);
});

test("specialised invitation and conditional disposable-grant self/company deletion retain redacted audit", async () => {
  const f = await fixture(), target = `synthetic-invitee-${randomUUID()}`, email = `synthetic-${randomUUID()}@example.test`;
  emailIdentities.set(email, target);
  const invited = await request(`/${f.company}/invite`, 'POST', { email, role: 'personal_tax_preparer' }, f.owner);
  assert.equal(invited.status, 201, invited.body); const member = JSON.parse(invited.body).member;
  assert.equal((await withDisposableDeletePrivileges(['company_users'], () =>
    request(`/${f.company}/members/${target}`, 'DELETE', undefined, target))).status, 200);
  let events = await sensitiveAudit(f.company);
  assert.deepEqual(events.map(row => row.context.operation), ['member_invite', 'member_remove']);
  assert.deepEqual(events.map(row => row.target_id), [member.id, member.id]);
  assert.deepEqual(events.map(row => row.actor_id), [f.owner, target]);
  assert.equal(JSON.stringify(events).includes(email), false);
  const active = `synthetic-delete-${randomUUID()}`, inactive = `synthetic-inactive-${randomUUID()}`;
  await addMember(f.company, active, 'payroll_preparer'); await addMember(f.company, inactive, 'personal_tax_submitter', false);
  await addMember(f.company, `synthetic-bookkeeper-${randomUUID()}`, 'accountant');
  const removedIds = (await pool.query("SELECT id FROM company_users WHERE company_id=$1 AND role IN ('payroll_preparer','personal_tax_submitter') ORDER BY id", [f.company])).rows.map(row => row.id);
  assert.equal((await withDisposableDeletePrivileges(['company_users', 'companies'], () =>
    request(`/${f.company}`, 'DELETE', undefined, f.owner))).status, 200);
  assert.equal((await pool.query('SELECT id FROM companies WHERE id=$1', [f.company])).rowCount, 0);
  assert.equal((await pool.query('SELECT id FROM company_users WHERE company_id=$1', [f.company])).rowCount, 0);
  events = (await sensitiveAudit(f.company)).filter(row => row.context.operation === 'company_delete');
  assert.deepEqual(events.map(row => row.target_id).sort(), removedIds);
  assert.deepEqual(events.map(row => row.context.previous_active).sort(), [false, true]);
  assert.ok(events.every(row => row.actor_id === f.owner && row.context.next_role === null && row.context.next_active === null));
  assert.equal(JSON.stringify(events).includes(active), false); assert.equal(JSON.stringify(events).includes(inactive), false);
});

test("same-role, denied and bookkeeping-only membership paths produce no sensitive audit or new audit dependency", async () => {
  const f = await fixture(), other = await fixture(), specialist = `synthetic-specialist-${randomUUID()}`, ordinary = `synthetic-ordinary-${randomUUID()}`;
  await addMember(f.company, specialist, 'payroll_reader'); identities.add(ordinary);
  // A broken sensitive-audit prerequisite must not change ordinary bookkeeping permissions.
  await admin.query('ALTER TABLE public.accounting_audit_events DISABLE TRIGGER ledgerly_accounting_audit_events_guard');
  try {
    assert.equal((await request(`/${f.company}/members/${specialist}`, 'PUT', { role: 'payroll_reader' }, f.owner)).status, 200);
    for (const actor of [specialist, other.owner]) {
      assert.equal((await request(`/${f.company}/members/${specialist}`, 'PUT', { role: 'payroll_preparer' }, actor)).status, 403);
      assert.equal((await request(`/${f.company}/members`, 'POST', { user_id: ordinary, role: 'payroll_preparer' }, actor)).status, 403);
      assert.equal((await request(`/${f.company}`, 'DELETE', undefined, actor)).status, 403);
    }
    assert.equal((await request(`/${f.company}/members`, 'POST', { user_id: specialist, role: 'payroll_reader' }, f.owner)).status, 409);
    assert.equal((await request(`/${f.company}/members/${f.owner}`, 'PUT', { role: 'payroll_reader' }, f.owner)).status, 409);
    assert.equal((await request(`/${f.company}/members`, 'POST', { user_id: ordinary, role: 'accountant' }, f.owner)).status, 201);
    assert.equal((await request(`/${f.company}`, 'PUT', { name: 'Ordinary company edit' }, ordinary)).status, 200);
    assert.equal((await request(`/${f.company}/members/${ordinary}`, 'PUT', { role: 'member' }, f.owner)).status, 200);
    assert.equal((await withDisposableDeletePrivileges(['company_users'], () =>
      request(`/${f.company}/members/${ordinary}`, 'DELETE', undefined, ordinary))).status, 200);
    assert.equal((await withDisposableDeletePrivileges(['company_users', 'companies'], () =>
      request(`/${other.company}`, 'DELETE', undefined, other.owner))).status, 200);
    assert.deepEqual(await sensitiveAudit(f.company), []); assert.deepEqual(await sensitiveAudit(other.company), []);
  } finally { await admin.query('ALTER TABLE public.accounting_audit_events ENABLE ALWAYS TRIGGER ledgerly_accounting_audit_events_guard'); }
});

test("audit faults roll back specialised mutations, with DELETE granted only for conditional removal requests", async () => {
  for (const failure of ['exception', 'skip']) {
    await admin.query(`CREATE FUNCTION public.synthetic_membership_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action='sensitive_membership_change' THEN ${failure === 'skip' ? 'RETURN NULL;' : "RAISE EXCEPTION 'synthetic-private-membership-diagnostic';"} END IF; RETURN NEW; END $$`);
    await admin.query('CREATE TRIGGER synthetic_membership_audit_failure BEFORE INSERT ON public.accounting_audit_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_membership_audit_failure()');
    try {
      for (const operation of ['add', 'invite', 'change', 'remove', 'self_remove', 'company_delete']) {
        const f = await fixture(), target = `synthetic-failure-target-${randomUUID()}`, email = `synthetic-${randomUUID()}@example.test`;
        identities.add(target); emailIdentities.set(email, target);
        if (operation === 'change') await addMember(f.company, target, 'member');
        if (['remove', 'self_remove', 'company_delete'].includes(operation)) await addMember(f.company, target, 'payroll_reader');
        const snapshot = async () => ({
          company: (await pool.query('SELECT * FROM companies WHERE id=$1', [f.company])).rows,
          members: (await pool.query('SELECT * FROM company_users WHERE company_id=$1 ORDER BY id', [f.company])).rows,
        });
        const before = await snapshot();
        const mutation = () => operation === 'add' ? request(`/${f.company}/members`, 'POST', { user_id: target, role: 'payroll_reader' }, f.owner)
          : operation === 'invite' ? request(`/${f.company}/invite`, 'POST', { email, role: 'personal_tax_preparer' }, f.owner)
          : operation === 'change' ? request(`/${f.company}/members/${target}`, 'PUT', { role: 'payroll_preparer' }, f.owner)
          : operation === 'company_delete' ? request(`/${f.company}`, 'DELETE', undefined, f.owner)
          : request(`/${f.company}/members/${target}`, 'DELETE', undefined, operation === 'self_remove' ? target : f.owner);
        const response = ['remove', 'self_remove', 'company_delete'].includes(operation)
          ? await withDisposableDeletePrivileges(operation === 'company_delete' ? ['company_users', 'companies'] : ['company_users'], mutation)
          : await mutation();
        assert.equal(response.status, 503, `${failure}/${operation}: ${response.body}`);
        assert.equal(response.body.includes('synthetic-private'), false); assert.equal(response.body.includes(email), false);
        assert.deepEqual(await snapshot(), before, `${failure}/${operation} must roll back`);
        assert.deepEqual(await sensitiveAudit(f.company), []);
      }
      assert.equal(JSON.stringify(logs).includes('synthetic-private-membership-diagnostic'), false);
    } finally {
      await admin.query('DROP TRIGGER synthetic_membership_audit_failure ON public.accounting_audit_events');
      await admin.query('DROP FUNCTION public.synthetic_membership_audit_failure()');
    }
  }
});

test("unprotected audit storage blocks specialised grants atomically", async () => {
  const f = await fixture(), target = `synthetic-unprotected-${randomUUID()}`; identities.add(target);
  const run = () => request(`/${f.company}/members`, 'POST', { user_id: target, role: 'payroll_preparer' }, f.owner);
  await admin.query('ALTER TABLE public.accounting_audit_events DISABLE TRIGGER ledgerly_accounting_audit_events_guard');
  try { assert.equal((await run()).status, 503); }
  finally { await admin.query('ALTER TABLE public.accounting_audit_events ENABLE ALWAYS TRIGGER ledgerly_accounting_audit_events_guard'); }
  await admin.query('GRANT UPDATE(actor_id) ON public.accounting_audit_events TO ledgerly_api');
  try { assert.equal((await run()).status, 503); }
  finally { await admin.query('REVOKE UPDATE(actor_id) ON public.accounting_audit_events FROM ledgerly_api'); }
  assert.equal((await pool.query('SELECT id FROM company_users WHERE company_id=$1 AND user_id=$2', [f.company, target])).rowCount, 0);
  assert.deepEqual(await sensitiveAudit(f.company), []);
});

test("conditional disposable-grant company deletion restores memberships and audits when silently skipped", async () => {
  const f = await fixture(), target = `synthetic-delete-skip-${randomUUID()}`;
  await addMember(f.company, target, 'payroll_preparer');
  const before = (await pool.query('SELECT * FROM company_users WHERE company_id=$1 ORDER BY id', [f.company])).rows;
  await admin.query(`CREATE FUNCTION public.synthetic_company_delete_skip() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF OLD.id='${f.company}'::uuid THEN RETURN NULL; END IF; RETURN OLD; END $$`);
  await admin.query('CREATE TRIGGER synthetic_company_delete_skip BEFORE DELETE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.synthetic_company_delete_skip()');
  try {
    assert.equal((await withDisposableDeletePrivileges(['company_users', 'companies'], () =>
      request(`/${f.company.toUpperCase()}`, 'DELETE', undefined, f.owner))).status, 503);
    assert.deepEqual((await pool.query('SELECT * FROM company_users WHERE company_id=$1 ORDER BY id', [f.company])).rows, before);
    assert.equal((await pool.query('SELECT id FROM companies WHERE id=$1', [f.company])).rowCount, 1);
    assert.deepEqual(await sensitiveAudit(f.company), []);
  } finally {
    await admin.query('DROP TRIGGER synthetic_company_delete_skip ON public.companies');
    await admin.query('DROP FUNCTION public.synthetic_company_delete_skip()');
  }
  assert.equal((await withDisposableDeletePrivileges(['company_users', 'companies'], () =>
    request(`/${f.company.toUpperCase()}`, 'DELETE', undefined, f.owner))).status, 200);
  assert.equal((await sensitiveAudit(f.company)).length, 1);
});

test("specialised grants recheck owner authority after a concurrent revocation wins the company lock", async () => {
  const f = await fixture(), target = `synthetic-delayed-grant-${randomUUID()}`; identities.add(target);
  const blocker = await admin.connect(); let pending: ReturnType<typeof request> | undefined;
  try {
    await blocker.query('BEGIN'); const { rows: [{ pid }] } = await blocker.query('SELECT pg_backend_pid() pid');
    await blocker.query('SELECT id FROM companies WHERE id=$1 FOR UPDATE', [f.company]);
    pending = request(`/${f.company}/members`, 'POST', { user_id: target, role: 'payroll_preparer' }, f.owner);
    const deadline = Date.now() + 5000; let waiting = false;
    while (Date.now() < deadline) {
      waiting = (await admin.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='ledgerly_api' AND $1::int=ANY(pg_blocking_pids(pid))) waiting", [pid])).rows[0].waiting;
      if (waiting) break; await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(waiting, true);
    await blocker.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2', [f.company, f.owner]);
    await blocker.query('COMMIT'); assert.equal((await pending).status, 403);
    assert.equal((await pool.query('SELECT id FROM company_users WHERE company_id=$1 AND user_id=$2', [f.company, target])).rowCount, 0);
    assert.deepEqual(await sensitiveAudit(f.company), []);
  } finally { await blocker.query('ROLLBACK'); blocker.release(); if (pending) await pending; }
});

test("silently skipped sensitive read audit cannot disclose results or commit local writes", async () => {
  const f = await fixture(); let disclosed = false;
  await admin.query(`CREATE FUNCTION public.synthetic_sensitive_audit_skip() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.company_id='${f.company}'::uuid THEN RETURN NULL; END IF; RETURN NEW; END $$`);
  await admin.query('CREATE TRIGGER synthetic_sensitive_audit_skip BEFORE INSERT ON public.accounting_audit_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_sensitive_audit_skip()');
  try {
    await assert.rejects(() => withPayrollAccess(sensitiveRequest(f.company, f.owner, 'payroll.read'), async context => {
      await context.query("UPDATE public.companies SET name='Uncommitted private change' WHERE id=$1", [f.company]);
      return 'synthetic-private-result';
    }).then(result => { disclosed = true; return result; }), /SENSITIVE_OPERATION_UNAVAILABLE/);
    assert.equal(disclosed, false);
    assert.equal((await pool.query('SELECT name FROM companies WHERE id=$1', [f.company])).rows[0].name, 'Synthetic security fixture');
    assert.deepEqual(await sensitiveAudit(f.company), []);
  } finally {
    await admin.query('DROP TRIGGER synthetic_sensitive_audit_skip ON public.accounting_audit_events');
    await admin.query('DROP FUNCTION public.synthetic_sensitive_audit_skip()');
  }
  console.log('SENSITIVE_READ_AUDIT_SKIP_ACCEPTANCE', JSON.stringify({ scenario: 'silently-skipped-read-audit',
    resultNotDisclosed: true, mutationRolledBack: true }));
});

const historyPath = (company: string) => `/${company}/specialist-access-history`;
const historyReceipts = async (company: string) => (await pool.query(
  "SELECT actor_id,target_id,capability,context FROM public.accounting_audit_events WHERE company_id=$1 AND action='sensitive_membership_history_read' ORDER BY created_at,id", [company])).rows;
const historyKeys = ['id', 'occurred_at', 'membership_id', 'operation', 'previous_role', 'next_role', 'previous_active', 'next_active'].sort();

test("owner history reads real grants, invitations, transitions and removed memberships with an atomic redacted read receipt", async () => {
  const f = await fixture(), other = await fixture(), target = `synthetic-private-target-${randomUUID()}`;
  const invitee = `synthetic-private-invitee-${randomUUID()}`, email = `synthetic-${randomUUID()}@example.test`;
  identities.add(target); emailIdentities.set(email, invitee);
  const added = await request(`/${f.company}/members`, 'POST', { user_id: target, role: 'payroll_reader' }, f.owner);
  assert.equal(added.status, 201); const membershipId = JSON.parse(added.body).id;
  const invited = await request(`/${f.company}/invite`, 'POST', { email, role: 'personal_tax_preparer' }, f.owner);
  assert.equal(invited.status, 201); const invitedMembershipId = JSON.parse(invited.body).member.id;
  assert.equal((await request(`/${f.company}/members/${target}`, 'PUT', { role: 'payroll_preparer' }, f.owner)).status, 200);
  // Existing route deletion is conditional on explicit disposable-only permissions.
  assert.equal((await withDisposableDeletePrivileges(['company_users'], () =>
    request(`/${f.company}/members/${target}`, 'DELETE', undefined, f.owner))).status, 200);
  assert.equal((await request(`/${other.company}/members`, 'POST', { user_id: target, role: 'payroll_reader' }, other.owner)).status, 201);
  const response = await request(historyPath(f.company), 'GET', undefined, f.owner);
  assert.equal(response.status, 200, response.body); assert.equal(response.cacheControl, 'no-store');
  const history = JSON.parse(response.body);
  assert.deepEqual(Object.keys(history).sort(), ['events', 'has_more', 'limit']);
  assert.equal(history.limit, 50); assert.equal(history.has_more, false); assert.equal(history.events.length, 4);
  assert.deepEqual(history.events.map((event: any) => event.operation), ['member_remove', 'role_change', 'member_invite', 'member_add']);
  assert.deepEqual(history.events.map((event: any) => event.membership_id), [membershipId, membershipId, invitedMembershipId, membershipId]);
  assert.deepEqual(history.events.map((event: any) => [event.previous_role, event.next_role]),
    [['payroll_preparer', null], ['payroll_reader', 'payroll_preparer'], [null, 'personal_tax_preparer'], [null, 'payroll_reader']]);
  for (const event of history.events) assert.deepEqual(Object.keys(event).sort(), historyKeys);
  for (const secret of [target, invitee, email, f.owner, other.owner, other.company]) assert.equal(response.body.includes(secret), false);
  assert.equal((await pool.query('SELECT id FROM company_users WHERE id=$1', [membershipId])).rowCount, 0);
  assert.deepEqual(await historyReceipts(f.company), [{ actor_id: f.owner, target_id: f.company,
    capability: 'company.membership.history.read', context: { contract: 'sensitive-membership-history.v1', limit: 50, returned_count: 4, has_more: false } }]);
  assert.equal((await request(historyPath(f.company), 'GET', undefined, f.owner)).body, response.body);
  assert.equal((await historyReceipts(f.company)).length, 2);
});

test("empty history reads are audited without recursively including their own receipts", async () => {
  const f = await fixture();
  for (let i = 1; i <= 2; i++) {
    const response = await request(historyPath(f.company.toUpperCase()), 'GET', undefined, f.owner);
    assert.equal(response.status, 200); assert.equal(response.cacheControl, 'no-store');
    assert.deepEqual(JSON.parse(response.body), { events: [], limit: 50, has_more: false });
    const receipts = await historyReceipts(f.company); assert.equal(receipts.length, i);
    assert.ok(receipts.every(row => row.actor_id === f.owner && row.context.returned_count === 0 && row.context.has_more === false));
  }
});

test("history denies unauthenticated, nonowner, foreign, inactive and ambiguous callers without any read receipt", async () => {
  const f = await fixture(), other = await fixture(); const actors = [other.owner];
  for (const role of ['admin', 'accountant', 'staff', 'member', 'read_only', 'payroll_reader', 'payroll_preparer',
    'payroll_approver', 'personal_tax_preparer', 'personal_tax_submitter', 'unknown', null]) {
    const actor = `synthetic-history-denied-${randomUUID()}`; await addMember(f.company, actor, role); actors.push(actor);
  }
  for (const active of [false, null]) {
    const actor = `synthetic-history-inactive-${randomUUID()}`; await addMember(f.company, actor, 'owner', active); actors.push(actor);
  }
  const ambiguous = `synthetic-history-ambiguous-${randomUUID()}`;
  await addMember(f.company, ambiguous, 'owner', true); await addMember(f.company, ambiguous, 'payroll_reader', false); actors.push(ambiguous);
  const unauthenticated = await request(historyPath(f.company));
  assert.equal(unauthenticated.status, 401); assert.equal(unauthenticated.cacheControl, 'no-store');
  for (const actor of actors) {
    const response = await request(historyPath(f.company), 'GET', undefined, actor);
    assert.equal(response.status, 403); assert.equal(response.cacheControl, 'no-store');
    assert.equal(response.body.includes('events'), false);
  }
  for (const suffix of [`?company_id=${other.company}`, '?role=owner', '?limit=100000', '?offset=0']) {
    const response = await request(historyPath(f.company) + suffix, 'GET', undefined, f.owner);
    assert.equal(response.status, 400); assert.equal(response.cacheControl, 'no-store');
  }
  const foreign = await fetch(base + historyPath(other.company), { headers: { 'x-test-actor': f.owner, 'x-company-id': f.company, 'x-role': 'owner' } });
  assert.equal(foreign.status, 403); assert.equal(foreign.headers.get('cache-control'), 'no-store'); await foreign.text();
  assert.equal((await request(historyPath(randomUUID()), 'GET', undefined, f.owner)).status, 403);
  const invalid = await request(historyPath('invalid-company'), 'GET', undefined, f.owner);
  assert.equal(invalid.status, 400); assert.equal(invalid.cacheControl, 'no-store');
  assert.deepEqual(await historyReceipts(f.company), []); assert.deepEqual(await historyReceipts(other.company), []);
});

test("history rechecks current owner authority after waiting for committed revocation or demotion", async () => {
  for (const change of ['revoke', 'demote']) {
    const f = await fixture(), blocker = await admin.connect(); let pending: ReturnType<typeof request> | undefined;
    try {
      await blocker.query('BEGIN'); const { rows: [{ pid }] } = await blocker.query('SELECT pg_backend_pid() pid');
      await blocker.query('SELECT id FROM companies WHERE id=$1 FOR UPDATE', [f.company]);
      pending = request(historyPath(f.company), 'GET', undefined, f.owner);
      const deadline = Date.now() + 5000; let waiting = false;
      while (Date.now() < deadline) {
        waiting = (await admin.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='ledgerly_api' AND $1::int=ANY(pg_blocking_pids(pid))) waiting", [pid])).rows[0].waiting;
        if (waiting) break; await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true);
      if (change === 'revoke') await blocker.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2', [f.company, f.owner]);
      else await blocker.query("UPDATE company_users SET role='accountant' WHERE company_id=$1 AND user_id=$2", [f.company, f.owner]);
      await blocker.query('COMMIT'); const response = await pending;
      assert.equal(response.status, 403); assert.equal(response.cacheControl, 'no-store');
      assert.deepEqual(await historyReceipts(f.company), []);
    } finally { await blocker.query('ROLLBACK'); blocker.release(); if (pending) await pending; }
  }
});

test("history audit exception or silent skip prevents empty or populated response disclosure and masks diagnostics", async () => {
  for (const failure of ['exception', 'skip']) {
    await admin.query(`CREATE FUNCTION public.synthetic_history_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action='sensitive_membership_history_read' THEN ${failure === 'skip' ? 'RETURN NULL;' : "RAISE EXCEPTION 'synthetic-private-history-diagnostic';"} END IF; RETURN NEW; END $$`);
    await admin.query('CREATE TRIGGER synthetic_history_audit_failure BEFORE INSERT ON public.accounting_audit_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_history_audit_failure()');
    try {
      for (const populated of [false, true]) {
        const f = await fixture(), target = `synthetic-history-failure-${randomUUID()}`; identities.add(target);
        if (populated) assert.equal((await request(`/${f.company}/members`, 'POST', { user_id: target, role: 'payroll_reader' }, f.owner)).status, 201);
        const before = await sensitiveAudit(f.company);
        const response = await request(historyPath(f.company), 'GET', undefined, f.owner);
        assert.equal(response.status, 503); assert.equal(response.cacheControl, 'no-store');
        for (const secret of ['events', target, 'synthetic-private-history-diagnostic']) assert.equal(response.body.includes(secret), false);
        assert.deepEqual(await sensitiveAudit(f.company), before); assert.deepEqual(await historyReceipts(f.company), []);
      }
      assert.equal(JSON.stringify(logs).includes('synthetic-private-history-diagnostic'), false);
    } finally {
      await admin.query('DROP TRIGGER synthetic_history_audit_failure ON public.accounting_audit_events');
      await admin.query('DROP FUNCTION public.synthetic_history_audit_failure()');
    }
  }
});

test("history requires protected audit storage before disclosure or receipt insertion", async () => {
  const f = await fixture();
  await admin.query('ALTER TABLE public.accounting_audit_events DISABLE TRIGGER ledgerly_accounting_audit_events_guard');
  try { assert.equal((await request(historyPath(f.company), 'GET', undefined, f.owner)).status, 503); }
  finally { await admin.query('ALTER TABLE public.accounting_audit_events ENABLE ALWAYS TRIGGER ledgerly_accounting_audit_events_guard'); }
  await admin.query('GRANT UPDATE(actor_id) ON public.accounting_audit_events TO ledgerly_api');
  try { assert.equal((await request(historyPath(f.company), 'GET', undefined, f.owner)).status, 503); }
  finally { await admin.query('REVOKE UPDATE(actor_id) ON public.accounting_audit_events FROM ledgerly_api'); }
  assert.deepEqual(await historyReceipts(f.company), []);
});

const historicalContext = () => ({ contract: 'sensitive-membership.v1', operation: 'member_add',
  previous_role: null, next_role: 'payroll_reader', previous_active: null, next_active: true });
async function seedHistoricalEvent(company: string, id: string, target: string, context: unknown, timestamp = '2030-01-01T00:00:00.000001Z') {
  await admin.query(`INSERT INTO public.accounting_audit_events
    (id,company_id,action,outcome,target_type,target_id,actor_type,actor_id,capability,context,created_at)
    VALUES($1,$2,'sensitive_membership_change','allowed','company_membership',$3,'user','synthetic-private-actor@example.test',
      'company.membership.change',$4::jsonb,$5::timestamptz)`, [id, company, target, JSON.stringify(context), timestamp]);
}

test("history is bounded and deterministically ordered with exact timestamps while discarding arbitrary historical fields", async () => {
  const f = await fixture(), other = await fixture(), expected: Array<{ id: string; at: string }> = [];
  for (let i = 0; i < 55; i++) {
    const id = randomUUID(), at = i === 0 ? '2030-01-01T00:00:00.000003Z' : i === 1 ? '2030-01-01T00:00:00.000002Z' : '2030-01-01T00:00:00.000001Z';
    expected.push({ id, at });
    await seedHistoricalEvent(f.company, id, randomUUID(), { ...historicalContext(), next_active: null,
      target_user_id: 'synthetic-private-target-id', email: 'synthetic-private-email@example.test', salary: 'synthetic-private-99999', nested: { secret: 'synthetic-private-context' } }, at);
  }
  await seedHistoricalEvent(other.company, randomUUID(), randomUUID(), historicalContext(), '2031-01-01T00:00:00.000001Z');
  expected.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  const response = await request(historyPath(f.company), 'GET', undefined, f.owner);
  assert.equal(response.status, 200, response.body); assert.equal(response.cacheControl, 'no-store');
  const history = JSON.parse(response.body);
  assert.equal(history.events.length, 50); assert.equal(history.limit, 50); assert.equal(history.has_more, true);
  assert.deepEqual(history.events.map((event: any) => ({ id: event.id, at: event.occurred_at })), expected.slice(0, 50));
  for (const event of history.events) { assert.deepEqual(Object.keys(event).sort(), historyKeys); assert.equal(event.next_active, null); }
  assert.equal(response.body.includes('synthetic-private'), false);
  assert.ok(Buffer.byteLength(response.body) < 20000);
  assert.equal((await request(historyPath(f.company), 'GET', undefined, f.owner)).body, response.body);
  assert.deepEqual((await historyReceipts(f.company)).map(row => row.context), [1, 2].map(() =>
    ({ contract: 'sensitive-membership-history.v1', limit: 50, returned_count: 50, has_more: true })));
});

test("malformed projected historical metadata fails closed without a successful read receipt or payload", async () => {
  const missing = historicalContext() as Record<string, unknown>; delete missing.previous_role;
  const cases = [missing, { ...historicalContext(), operation: 'synthetic-private-operation' },
    { ...historicalContext(), next_role: 'synthetic-private-role' }, { ...historicalContext(), previous_role: 'owner' },
    { ...historicalContext(), operation: 'role_change' }, { ...historicalContext(), next_active: 'synthetic-private-active' },
    { ...historicalContext(), contract: 'unknown-contract' }];
  for (const context of cases) {
    const f = await fixture(); await seedHistoricalEvent(f.company, randomUUID(), randomUUID(), context);
    const response = await request(historyPath(f.company), 'GET', undefined, f.owner);
    assert.equal(response.status, 503); assert.equal(response.cacheControl, 'no-store');
    assert.equal(response.body.includes('events'), false); assert.equal(response.body.includes('synthetic-private'), false);
    assert.deepEqual(await historyReceipts(f.company), []);
  }
  const f = await fixture(); await seedHistoricalEvent(f.company, randomUUID(), 'synthetic-private-membership@example.test', historicalContext());
  const response = await request(historyPath(f.company), 'GET', undefined, f.owner);
  assert.equal(response.status, 503); assert.equal(response.body.includes('synthetic-private'), false); assert.deepEqual(await historyReceipts(f.company), []);
});

const payRecordPath = (company: string, id: string) => `/${company}/payroll-pay-records/${id}`;
async function payRecordFixture(amount = '4800000', employee = randomUUID()) {
  const f = await fixture(), id = randomUUID();
  await admin.query(`INSERT INTO public.employee_pay_records(company_id,id,employee_id,effective_from,annual_salary_pence)
    VALUES($1,$2,$3,'2026-04-06',$4::bigint)`, [f.company, id, employee, amount]);
  return { ...f, id, employee, amount };
}
const payReadAudits = async (company: string) => (await sensitiveAudit(company)).filter(row => row.action === 'sensitive_access' && row.capability === 'payroll.read');

test("native pay reads select and audit exact salary fields by current payroll role", async () => {
  const f = await payRecordFixture('4800000', '00000000-0000-0000-0000-000000000001');
  for (const role of ['owner', 'payroll_preparer', 'payroll_reader', 'payroll_approver']) {
    const actor = role === 'owner' ? f.owner : `synthetic-pay-role-${randomUUID()}`;
    if (role !== 'owner') {
      identities.add(actor);
      assert.equal((await request(`/${f.company}/members`, 'POST', { user_id: actor, role }, f.owner)).status, 201);
    }
    const response = await request(payRecordPath(f.company.toUpperCase(), f.id.toUpperCase()), 'GET', undefined, actor);
    assert.equal(response.status, 200, response.body); assert.equal(response.cacheControl, 'no-store');
    const expected = { id: f.id, effective_from: '2026-04-06', annual_salary_pence: f.amount, currency: 'GBP',
      ...(['owner', 'payroll_preparer'].includes(role) ? { employee_id: f.employee } : {}) };
    assert.deepEqual(JSON.parse(response.body), expected);
    if (['payroll_reader', 'payroll_approver'].includes(role)) assert.equal(response.body.includes(f.employee), false);
    const audit = (await payReadAudits(f.company)).find(row => row.actor_id === actor)!;
    assert.deepEqual(audit, { action: 'sensitive_access', outcome: 'allowed', target_type: 'payroll_resource',
      target_id: f.id, actor_type: 'user', actor_id: actor, capability: 'payroll.read',
      context: { contract: 'sensitive-access.v1', role }, journal_id: null, posting_effect_id: null });
  }
  assert.equal((await payReadAudits(f.company)).length, 4);
  for (const sql of ['INSERT INTO public.employee_pay_records SELECT * FROM public.employee_pay_records WHERE false',
    'UPDATE public.employee_pay_records SET annual_salary_pence=annual_salary_pence WHERE false',
    'DELETE FROM public.employee_pay_records WHERE false', 'TRUNCATE public.employee_pay_records']) {
    await assert.rejects(() => pool.query(sql), (error: any) => error.code === '42501');
  }
});

test("native pay reads preserve zero and bigint amounts beyond safe JavaScript integer precision", async () => {
  for (const amount of ['0', '9007199254740993', '9223372036854775807']) {
    const f = await payRecordFixture(amount);
    const response = await request(payRecordPath(f.company, f.id), 'GET', undefined, f.owner);
    assert.equal(response.status, 200, response.body);
    assert.equal(JSON.parse(response.body).annual_salary_pence, amount);
    assert.equal(typeof JSON.parse(response.body).annual_salary_pence, 'string');
    assert.equal(JSON.stringify(await payReadAudits(f.company)).includes(`"annual_salary_pence"`), false);
  }
});

test("pay storage rejects negative salary and duplicate employee effective dates while nil path UUID is unsupported", async () => {
  const f = await payRecordFixture();
  await assert.rejects(() => admin.query(`INSERT INTO public.employee_pay_records
    (company_id,id,employee_id,effective_from,annual_salary_pence) VALUES($1,$2,$3,'2026-04-06',-1)`,
    [f.company, randomUUID(), randomUUID()]), (error: any) => error.code === '23514');
  await assert.rejects(() => admin.query(`INSERT INTO public.employee_pay_records
    (company_id,id,employee_id,effective_from,annual_salary_pence) VALUES($1,$2,$3,'2026-04-06',10)`,
    [f.company, randomUUID(), f.employee]), (error: any) => error.code === '23505');
  await assert.rejects(() => admin.query(`INSERT INTO public.employee_pay_records
    (company_id,id,employee_id,effective_from,annual_salary_pence) VALUES($1,$2,$3,'2026-04-06',10)`,
    [f.company, '00000000-0000-0000-0000-000000000000', randomUUID()]), (error: any) => error.code === '23514');
  const response = await request(payRecordPath(f.company, '00000000-0000-0000-0000-000000000000'), 'GET', undefined, f.owner);
  assert.equal(response.status, 400); assert.equal(response.cacheControl, 'no-store');
  assert.deepEqual(await payReadAudits(f.company), []);
});

test("native pay records deny ordinary, personal-tax, inactive, ambiguous and foreign access without disclosure or audit", async () => {
  const f = await payRecordFixture(), other = await payRecordFixture('7654321'), actors = [other.owner];
  for (const role of ['admin', 'accountant', 'staff', 'member', 'read_only', 'personal_tax_preparer', 'personal_tax_submitter', 'unknown', null]) {
    const actor = `synthetic-denied-pay-${randomUUID()}`; await addMember(f.company, actor, role); actors.push(actor);
  }
  for (const active of [false, null]) {
    const actor = `synthetic-inactive-pay-${randomUUID()}`; await addMember(f.company, actor, 'payroll_preparer', active); actors.push(actor);
  }
  const ambiguous = `synthetic-ambiguous-pay-${randomUUID()}`;
  await addMember(f.company, ambiguous, 'payroll_preparer'); await addMember(f.company, ambiguous, 'payroll_reader', false); actors.push(ambiguous);
  const anonymous = await request(payRecordPath(f.company, f.id));
  assert.equal(anonymous.status, 401); assert.equal(anonymous.cacheControl, 'no-store');
  for (const actor of actors) {
    const response = await request(payRecordPath(f.company, f.id), 'GET', undefined, actor);
    assert.equal(response.status, 403); assert.equal(response.cacheControl, 'no-store');
    for (const value of [f.amount, f.employee, 'annual_salary_pence']) assert.equal(response.body.includes(value), false);
  }
  for (const [company, id] of [[f.company, other.id], [other.company, f.id], [f.company, randomUUID()]]) {
    const response = await request(payRecordPath(company!, id!), 'GET', undefined, f.owner);
    assert.equal(response.status, 403); assert.equal(response.cacheControl, 'no-store');
    assert.equal(response.body.includes(other.amount), false);
  }
  assert.deepEqual(await payReadAudits(f.company), []); assert.deepEqual(await payReadAudits(other.company), []);
});

test("pay read paths reject overrides and expose no collections, legacy exports or mutation endpoints", async () => {
  const f = await payRecordFixture();
  for (const suffix of ['?role=owner', '?fields=employee_id', '?action=payroll.export', `?company_id=${randomUUID()}`]) {
    const response = await request(payRecordPath(f.company, f.id) + suffix, 'GET', undefined, f.owner);
    assert.equal(response.status, 400); assert.equal(response.cacheControl, 'no-store');
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await request(payRecordPath(f.company, f.id), method, { annual_salary_pence: '1', employee_id: randomUUID() }, f.owner);
    assert.equal(response.status, 404); assert.equal(response.cacheControl, 'no-store');
  }
  for (const path of [`/${f.company}/payroll-pay-records`, payRecordPath(f.company, f.id) + '/export']) {
    const response = await request(path, 'GET', undefined, f.owner);
    assert.equal(response.status, 404); assert.equal(response.cacheControl, 'no-store');
  }
  assert.equal((await pool.query('SELECT annual_salary_pence::text amount FROM public.employee_pay_records WHERE company_id=$1 AND id=$2', [f.company, f.id])).rows[0].amount, f.amount);
  assert.deepEqual(await payReadAudits(f.company), []);
});

test("pay read role projection observes revocation, lost access and lost employee-reference access after the company lock", async () => {
  for (const nextRole of ['inactive', 'accountant', 'payroll_reader']) {
    const f = await payRecordFixture(), actor = `synthetic-pay-race-${randomUUID()}`;
    await addMember(f.company, actor, 'payroll_preparer');
    const blocker = await admin.connect(); let pending: ReturnType<typeof request> | undefined;
    try {
      await blocker.query('BEGIN'); const { rows: [{ pid }] } = await blocker.query('SELECT pg_backend_pid() pid');
      await blocker.query('SELECT id FROM companies WHERE id=$1 FOR UPDATE', [f.company]);
      pending = request(payRecordPath(f.company, f.id), 'GET', undefined, actor);
      const deadline = Date.now() + 5000; let waiting = false;
      while (Date.now() < deadline) {
        waiting = (await admin.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='ledgerly_api' AND $1::int=ANY(pg_blocking_pids(pid))) waiting", [pid])).rows[0].waiting;
        if (waiting) break; await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true);
      if (nextRole === 'inactive') await blocker.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2', [f.company, actor]);
      else await blocker.query('UPDATE company_users SET role=$3 WHERE company_id=$1 AND user_id=$2', [f.company, actor, nextRole]);
      await blocker.query('COMMIT'); const response = await pending;
      assert.equal(response.cacheControl, 'no-store');
      if (nextRole === 'payroll_reader') {
        assert.equal(response.status, 200); assert.equal(response.body.includes(f.employee), false);
        assert.equal(JSON.parse(response.body).annual_salary_pence, f.amount);
        assert.deepEqual((await payReadAudits(f.company)).map(row => row.context.role), ['payroll_reader']);
      } else { assert.equal(response.status, 403); assert.deepEqual(await payReadAudits(f.company), []); }
    } finally { await blocker.query('ROLLBACK'); blocker.release(); if (pending) await pending; }
  }
});

test("pay read audit exception or skipped receipt prevents disclosure and preserves persisted records", async () => {
  for (const failure of ['exception', 'skip']) {
    const f = await payRecordFixture(), before = await sensitiveAudit(f.company);
    await admin.query(`CREATE FUNCTION public.synthetic_pay_read_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.company_id='${f.company}'::uuid AND NEW.action='sensitive_access' THEN ${failure === 'skip' ? 'RETURN NULL;' : "RAISE EXCEPTION 'synthetic-private-pay-diagnostic';"} END IF; RETURN NEW; END $$`);
    await admin.query('CREATE TRIGGER synthetic_pay_read_audit_failure BEFORE INSERT ON public.accounting_audit_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_pay_read_audit_failure()');
    try {
      const response = await request(payRecordPath(f.company, f.id), 'GET', undefined, f.owner);
      assert.equal(response.status, 503); assert.equal(response.cacheControl, 'no-store');
      for (const secret of [f.amount, f.employee, 'annual_salary_pence', 'synthetic-private-pay-diagnostic']) assert.equal(response.body.includes(secret), false);
      assert.deepEqual(await sensitiveAudit(f.company), before);
      assert.equal((await pool.query('SELECT annual_salary_pence::text amount FROM public.employee_pay_records WHERE company_id=$1 AND id=$2', [f.company, f.id])).rows[0].amount, f.amount);
      assert.equal(JSON.stringify(logs).includes('synthetic-private-pay-diagnostic'), false);
    } finally {
      await admin.query('DROP TRIGGER synthetic_pay_read_audit_failure ON public.accounting_audit_events');
      await admin.query('DROP FUNCTION public.synthetic_pay_read_audit_failure()');
    }
  }
});

test("pay read refuses missing storage, column-only mutations and unprotected audit without a receipt", async () => {
  const f = await payRecordFixture();
  const denied = async () => {
    const response = await request(payRecordPath(f.company, f.id), 'GET', undefined, f.owner);
    assert.equal(response.status, 503); assert.equal(response.cacheControl, 'no-store');
    assert.equal(response.body.includes(f.amount), false); assert.deepEqual(await payReadAudits(f.company), []);
  };
  await admin.query('ALTER TABLE public.employee_pay_records RENAME TO synthetic_missing_pay_records');
  try { await denied(); }
  finally { await admin.query('ALTER TABLE public.synthetic_missing_pay_records RENAME TO employee_pay_records'); }
  for (const privilege of ['INSERT', 'UPDATE']) {
    await admin.query(`GRANT ${privilege}(employee_id) ON public.employee_pay_records TO ledgerly_api`);
    try {
      assert.equal((await pool.query("SELECT has_table_privilege(current_user,'public.employee_pay_records',$1) allowed", [privilege])).rows[0].allowed, false);
      await denied();
    } finally { await admin.query(`REVOKE ${privilege}(employee_id) ON public.employee_pay_records FROM ledgerly_api`); }
  }
  await admin.query('ALTER TABLE public.accounting_audit_events DISABLE TRIGGER ledgerly_accounting_audit_events_guard');
  try { await denied(); }
  finally { await admin.query('ALTER TABLE public.accounting_audit_events ENABLE ALWAYS TRIGGER ledgerly_accounting_audit_events_guard'); }
  const response = await request(payRecordPath(f.company, f.id), 'GET', undefined, f.owner);
  assert.equal(response.status, 200); assert.equal((await payReadAudits(f.company)).length, 1);
});

const payCreatePath = (company: string) => `/${company}/payroll-pay-records`;
const payIntent = () => ({ id: randomUUID(), employee_id: randomUUID(), effective_from: '2026-04-06', annual_salary_pence: '4800000' });
const payCreationAudits = async (company: string) => (await sensitiveAudit(company)).filter(row => row.action === 'employee_pay_record_create');
const payPrepareAudits = async (company: string) => (await sensitiveAudit(company)).filter(row => row.action === 'sensitive_access' && row.capability === 'payroll.prepare');
const storedPay = async (company: string) => (await pool.query(`SELECT id,employee_id,to_char(effective_from,'YYYY-MM-DD') effective_from,
  annual_salary_pence::text annual_salary_pence FROM public.employee_pay_records WHERE company_id=$1 ORDER BY id`, [company])).rows;
const directPayCreate = async (company: string, actor: string, body: ReturnType<typeof payIntent>) => (await pool.query(
  'SELECT public.ledgerly_create_employee_pay_record($1::uuid,$2::text,$3::uuid,$4::uuid,$5::date,$6::bigint) status',
  [company, actor, body.id, body.employee_id, body.effective_from, body.annual_salary_pence])).rows[0].status;

test("owner and verified payroll preparer create dated pay through normal HTTP then read exact persisted fields", async () => {
  for (const role of ['owner', 'payroll_preparer']) {
    const f = await fixture(), body = payIntent(), actor = role === 'owner' ? f.owner : `synthetic-pay-create-${randomUUID()}`;
    if (role !== 'owner') {
      identities.add(actor);
      assert.equal((await request(`/${f.company}/members`, 'POST', { user_id: actor, role }, f.owner)).status, 201);
    }
    const created = await request(payCreatePath(f.company), 'POST', body, actor);
    assert.equal(created.status, 201, created.body); assert.equal(created.cacheControl, 'no-store');
    assert.deepEqual(JSON.parse(created.body), { id: body.id, status: 'created' });
    assert.deepEqual(await storedPay(f.company), [body]);
    assert.deepEqual(await payCreationAudits(f.company), [{ action: 'employee_pay_record_create', outcome: 'allowed',
      target_type: 'employee_pay_record', target_id: body.id, actor_type: 'user', actor_id: actor, capability: 'payroll.prepare',
      context: { contract: 'employee-pay-create.v1', role }, journal_id: null, posting_effect_id: null }]);
    assert.deepEqual(await payPrepareAudits(f.company), [{ action: 'sensitive_access', outcome: 'allowed',
      target_type: 'payroll_resource', target_id: body.id, actor_type: 'user', actor_id: actor, capability: 'payroll.prepare',
      context: { contract: 'sensitive-access.v1', role }, journal_id: null, posting_effect_id: null }]);
    const read = await request(payRecordPath(f.company, body.id), 'GET', undefined, actor);
    assert.equal(read.status, 200); assert.deepEqual(JSON.parse(read.body), { ...body, currency: 'GBP' });
    await assert.rejects(() => pool.query('INSERT INTO public.employee_pay_records SELECT * FROM public.employee_pay_records WHERE false'),
      (error: any) => error.code === '42501');
  }
});

test("pay creation replays identical current-authority intent and appends later dates without overwriting earlier pay", async () => {
  const f = await fixture(), body = { ...payIntent(), annual_salary_pence: '9007199254740993' }, preparer = `synthetic-replay-${randomUUID()}`;
  await addMember(f.company, preparer, 'payroll_preparer');
  assert.equal((await request(payCreatePath(f.company), 'POST', body, f.owner)).status, 201);
  for (const actor of [f.owner, preparer]) {
    const response = await request(payCreatePath(f.company.toUpperCase()), 'POST', { ...body, id: body.id.toUpperCase(), employee_id: body.employee_id.toUpperCase() }, actor);
    assert.equal(response.status, 200); assert.deepEqual(JSON.parse(response.body), { id: body.id, status: 'replayed' });
  }
  assert.deepEqual(await storedPay(f.company), [body]); assert.equal((await payCreationAudits(f.company)).length, 1);
  assert.equal((await payPrepareAudits(f.company)).length, 3);
  const later = { ...body, id: randomUUID(), effective_from: '2026-05-06', annual_salary_pence: '5000000' };
  assert.equal((await request(payCreatePath(f.company), 'POST', later, preparer)).status, 201);
  assert.deepEqual(await storedPay(f.company), [body, later].sort((a, b) => a.id.localeCompare(b.id)));
  assert.equal((await payCreationAudits(f.company)).length, 2);
});

test("changed pay intent and company employee/date collisions return fixed conflict without writes or extra receipts", async () => {
  const f = await fixture(), body = payIntent();
  assert.equal((await request(payCreatePath(f.company), 'POST', body, f.owner)).status, 201);
  const before = await sensitiveAudit(f.company);
  for (const changed of [{ ...body, employee_id: randomUUID() }, { ...body, effective_from: '2026-05-06' },
    { ...body, annual_salary_pence: '4800001' }, { ...body, id: randomUUID() }]) {
    const response = await request(payCreatePath(f.company), 'POST', changed, f.owner);
    assert.equal(response.status, 409); assert.equal(response.cacheControl, 'no-store');
    assert.deepEqual(JSON.parse(response.body), { error: 'This request conflicts with an existing record.', code: 'SENSITIVE_REQUEST_CONFLICT' });
    assert.deepEqual(await storedPay(f.company), [body]); assert.deepEqual(await sensitiveAudit(f.company), before);
  }
});

test("administrator-seeded pay cannot be claimed as a replay even with a forged matching creation audit", async () => {
  const f = await payRecordFixture(), body = { id: f.id, employee_id: f.employee, effective_from: '2026-04-06', annual_salary_pence: f.amount };
  assert.equal((await request(payCreatePath(f.company), 'POST', body, f.owner)).status, 409);
  await pool.query(`INSERT INTO public.accounting_audit_events
    (id,company_id,action,outcome,target_type,target_id,actor_type,actor_id,capability,context)
    VALUES($1,$2,'employee_pay_record_create','allowed','employee_pay_record',$3,'user',$4,'payroll.prepare',$5::jsonb)`,
  [randomUUID(), f.company, f.id, f.owner, JSON.stringify({ contract: 'employee-pay-create.v1', role: 'owner' })]);
  const before = await sensitiveAudit(f.company);
  assert.equal(await directPayCreate(f.company, f.owner, body), 'conflict');
  assert.equal((await request(payCreatePath(f.company), 'POST', body, f.owner)).status, 409);
  assert.deepEqual(await storedPay(f.company), [body]); assert.deepEqual(await sensitiveAudit(f.company), before);
  assert.deepEqual(await payPrepareAudits(f.company), []);
});

test("pay command identities and employee effective dates are independent across companies", async () => {
  const f = await fixture(), other = await fixture(), body = payIntent(), otherBody = { ...body, annual_salary_pence: '7654321' };
  assert.equal((await request(payCreatePath(f.company), 'POST', body, f.owner)).status, 201);
  assert.equal((await request(payCreatePath(other.company), 'POST', otherBody, other.owner)).status, 201);
  assert.equal((await request(payCreatePath(other.company), 'POST', otherBody, f.owner)).status, 403);
  assert.deepEqual(await storedPay(f.company), [body]); assert.deepEqual(await storedPay(other.company), [otherBody]);
  assert.equal((await payCreationAudits(f.company)).length, 1); assert.equal((await payCreationAudits(other.company)).length, 1);
});

test("concurrent duplicate pay creation has one effect and competing date keys have one winner", async () => {
  const f = await fixture(), body = payIntent();
  const same = await Promise.all([1, 2].map(() => request(payCreatePath(f.company), 'POST', body, f.owner)));
  assert.deepEqual(same.map(response => response.status).sort(), [200, 201]);
  assert.deepEqual(await storedPay(f.company), [body]); assert.equal((await payCreationAudits(f.company)).length, 1);
  assert.equal((await payPrepareAudits(f.company)).length, 2);
  const other = await fixture(), first = payIntent(), second = { ...first, id: randomUUID(), annual_salary_pence: '4800001' };
  const competing = await Promise.all([first, second].map(intent => request(payCreatePath(other.company), 'POST', intent, other.owner)));
  assert.deepEqual(competing.map(response => response.status).sort(), [201, 409]);
  const winner = competing[0]!.status === 201 ? first : second;
  assert.deepEqual(await storedPay(other.company), [winner]); assert.equal((await payCreationAudits(other.company)).length, 1);
  assert.equal((await payPrepareAudits(other.company)).length, 1);
});

test("pay creation denies ordinary, read, approval, personal-tax and invalid memberships in HTTP and the direct function", async () => {
  const f = await fixture(), other = await fixture(), body = payIntent(), actors = [other.owner];
  for (const role of ['admin', 'accountant', 'staff', 'member', 'read_only', 'payroll_reader', 'payroll_approver',
    'personal_tax_preparer', 'personal_tax_submitter', 'unknown', null]) {
    const actor = `synthetic-denied-create-${randomUUID()}`; await addMember(f.company, actor, role); actors.push(actor);
  }
  for (const active of [false, null]) {
    const actor = `synthetic-inactive-create-${randomUUID()}`; await addMember(f.company, actor, 'owner', active); actors.push(actor);
  }
  const ambiguous = `synthetic-ambiguous-create-${randomUUID()}`;
  await addMember(f.company, ambiguous, 'payroll_preparer'); await addMember(f.company, ambiguous, 'owner', false); actors.push(ambiguous);
  const anonymous = await request(payCreatePath(f.company), 'POST', body);
  assert.equal(anonymous.status, 401); assert.equal(anonymous.cacheControl, 'no-store');
  for (const actor of actors) {
    const response = await request(payCreatePath(f.company), 'POST', body, actor);
    assert.equal(response.status, 403); assert.equal(response.cacheControl, 'no-store');
    assert.equal(await directPayCreate(f.company, actor, body), 'denied');
  }
  for (const malformed of [{ ...body, currency: 'GBP' }, { ...body, role: 'owner' }, { ...body, company_id: other.company }, { ...body, created_by_pay_command: true },
    { ...body, annual_salary_pence: 4800000 }, { ...body, effective_from: '2026-02-29' }]) {
    assert.equal((await request(payCreatePath(f.company), 'POST', malformed, f.owner)).status, 400);
  }
  assert.equal((await request(payCreatePath(f.company) + '?role=owner', 'POST', body, f.owner)).status, 400);
  assert.deepEqual(await storedPay(f.company), []); assert.deepEqual(await sensitiveAudit(f.company), []);
});

test("pay creation and replay recheck revocation or demotion after the company lock", async () => {
  for (const replay of [false, true]) for (const next of ['inactive', 'payroll_reader']) {
    const f = await fixture(), actor = `synthetic-create-race-${randomUUID()}`, body = payIntent();
    await addMember(f.company, actor, 'payroll_preparer');
    if (replay) assert.equal((await request(payCreatePath(f.company), 'POST', body, actor)).status, 201);
    const before = await sensitiveAudit(f.company), blocker = await admin.connect(); let pending: ReturnType<typeof request> | undefined;
    try {
      await blocker.query('BEGIN'); const { rows: [{ pid }] } = await blocker.query('SELECT pg_backend_pid() pid');
      await blocker.query('SELECT id FROM companies WHERE id=$1 FOR UPDATE', [f.company]);
      pending = request(payCreatePath(f.company), 'POST', body, actor);
      const deadline = Date.now() + 5000; let waiting = false;
      while (Date.now() < deadline) {
        waiting = (await admin.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='ledgerly_api' AND $1::int=ANY(pg_blocking_pids(pid))) waiting", [pid])).rows[0].waiting;
        if (waiting) break; await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true);
      if (next === 'inactive') await blocker.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2', [f.company, actor]);
      else await blocker.query("UPDATE company_users SET role='payroll_reader' WHERE company_id=$1 AND user_id=$2", [f.company, actor]);
      await blocker.query('COMMIT'); assert.equal((await pending).status, 403);
      assert.deepEqual(await storedPay(f.company), replay ? [body] : []); assert.deepEqual(await sensitiveAudit(f.company), before);
    } finally { await blocker.query('ROLLBACK'); blocker.release(); if (pending) await pending; }
  }
});

test("direct pay command retains its own creation audit and refuses unprotected audit storage", async () => {
  const f = await fixture(), body = payIntent();
  await admin.query('ALTER TABLE public.accounting_audit_events DISABLE TRIGGER ledgerly_accounting_audit_events_guard');
  try {
    await assert.rejects(() => directPayCreate(f.company, f.owner, body));
    assert.equal((await request(payCreatePath(f.company), 'POST', body, f.owner)).status, 503);
    assert.deepEqual(await storedPay(f.company), []); assert.deepEqual(await sensitiveAudit(f.company), []);
  } finally { await admin.query('ALTER TABLE public.accounting_audit_events ENABLE ALWAYS TRIGGER ledgerly_accounting_audit_events_guard'); }
  assert.equal(await directPayCreate(f.company, f.owner, body), 'created');
  assert.deepEqual(await storedPay(f.company), [body]); assert.equal((await payCreationAudits(f.company)).length, 1);
  assert.deepEqual(await payPrepareAudits(f.company), []);
  assert.equal((await request(payCreatePath(f.company), 'POST', body, f.owner)).status, 200);
  assert.equal((await payCreationAudits(f.company)).length, 1); assert.equal((await payPrepareAudits(f.company)).length, 1);
});

test("creation or prepare audit faults roll back direct and wrapped pay creation, including skipped inserts", async () => {
  for (const action of ['employee_pay_record_create', 'sensitive_access']) for (const failure of ['exception', 'skip']) {
    const f = await fixture(), body = payIntent();
    await admin.query(`CREATE FUNCTION public.synthetic_pay_create_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.company_id='${f.company}'::uuid AND NEW.action='${action}' THEN ${failure === 'skip' ? 'RETURN NULL;' : "RAISE EXCEPTION 'synthetic-private-create-diagnostic';"} END IF; RETURN NEW; END $$`);
    await admin.query('CREATE TRIGGER synthetic_pay_create_audit_failure BEFORE INSERT ON public.accounting_audit_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_pay_create_audit_failure()');
    try {
      if (action === 'employee_pay_record_create') {
        await assert.rejects(() => directPayCreate(f.company, f.owner, body));
        assert.deepEqual(await storedPay(f.company), []); assert.deepEqual(await sensitiveAudit(f.company), []);
      }
      const response = await request(payCreatePath(f.company), 'POST', body, f.owner);
      assert.equal(response.status, 503); assert.equal(response.cacheControl, 'no-store');
      assert.equal(response.body.includes('synthetic-private-create-diagnostic'), false);
      assert.deepEqual(await storedPay(f.company), []); assert.deepEqual(await sensitiveAudit(f.company), []);
      assert.equal(JSON.stringify(logs).includes('synthetic-private-create-diagnostic'), false);
    } finally {
      await admin.query('DROP TRIGGER synthetic_pay_create_audit_failure ON public.accounting_audit_events');
      await admin.query('DROP FUNCTION public.synthetic_pay_create_audit_failure()');
    }
    assert.equal((await request(payCreatePath(f.company), 'POST', body, f.owner)).status, 201);
    assert.equal((await payCreationAudits(f.company)).length, 1); assert.equal((await payPrepareAudits(f.company)).length, 1);
  }
});

test("failed replay audit leaves the original pay record and creation receipt intact", async () => {
  const f = await fixture(), body = payIntent();
  assert.equal((await request(payCreatePath(f.company), 'POST', body, f.owner)).status, 201);
  const before = await sensitiveAudit(f.company);
  await admin.query(`CREATE FUNCTION public.synthetic_pay_replay_audit_skip() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.company_id='${f.company}'::uuid AND NEW.action='sensitive_access' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
  await admin.query('CREATE TRIGGER synthetic_pay_replay_audit_skip BEFORE INSERT ON public.accounting_audit_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_pay_replay_audit_skip()');
  try {
    assert.equal((await request(payCreatePath(f.company), 'POST', body, f.owner)).status, 503);
    assert.deepEqual(await storedPay(f.company), [body]); assert.deepEqual(await sensitiveAudit(f.company), before);
  } finally {
    await admin.query('DROP TRIGGER synthetic_pay_replay_audit_skip ON public.accounting_audit_events');
    await admin.query('DROP FUNCTION public.synthetic_pay_replay_audit_skip()');
  }
  assert.equal((await request(payCreatePath(f.company), 'POST', body, f.owner)).status, 200);
  assert.equal((await payCreationAudits(f.company)).length, 1); assert.equal((await payPrepareAudits(f.company)).length, 2);
});

test("pay creation fails closed on unsafe function grants and unknown or null command status", async () => {
  const f = await fixture(), body = payIntent();
  const signature = 'public.ledgerly_create_employee_pay_record(uuid,text,uuid,uuid,date,bigint)';
  await admin.query(`GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC`);
  try { assert.equal((await request(payCreatePath(f.company), 'POST', body, f.owner)).status, 503); }
  finally { await admin.query(`REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC`); }
  const definition = (await admin.query('SELECT pg_get_functiondef($1::regprocedure) definition', [signature])).rows[0].definition;
  try {
    for (const value of ['NULL', "'unexpected-status'"]) {
      await admin.query(`CREATE OR REPLACE FUNCTION public.ledgerly_create_employee_pay_record(c uuid,a text,r uuid,e uuid,d date,p bigint)
        RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN RETURN ${value}; END $$`);
      const response = await request(payCreatePath(f.company), 'POST', body, f.owner);
      assert.equal(response.status, 503); assert.equal(response.cacheControl, 'no-store');
      assert.deepEqual(await storedPay(f.company), []); assert.deepEqual(await sensitiveAudit(f.company), []);
    }
  } finally { await admin.query(definition); }
  assert.equal((await request(payCreatePath(f.company), 'POST', body, f.owner)).status, 201);
});

async function runPayrollBrowser(entry: 'browserAcceptance.jsx' | 'historyBrowserAcceptance.jsx' | 'taxBrowserAcceptance.jsx', fixtureData: Record<string,string>) {
  const dir = mkdtempSync(path.join(path.dirname(socket), 'pay-ui-'));
  let browser: ReturnType<typeof spawn> | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const frontend = path.resolve('artifacts/ledgerly/src'), bundle = path.join(dir,'pay-ui.js');
    execFileSync('pnpm', ['--filter','@workspace/api-server','exec','esbuild',
      path.join(frontend,'features/payroll/payRecords',entry),'--bundle','--platform=browser','--format=iife',
      '--alias:@clerk/react='+path.join(frontend,'features/payroll/payRecords/specialistBrowserIdentity.mjs'),
      '--jsx=automatic','--alias:@='+frontend,'--define:import.meta.env.BASE_URL="/"','--outfile='+bundle], {stdio:'pipe'});
    payBrowserScript = readFileSync(bundle,'utf8');
    payBrowserPage = '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script>window.syntheticPayFixture=' +
      JSON.stringify(fixtureData) + '</script><script src="/pay-ui-bundle"></script></body></html>';
    const outcome = new Promise<{ok: boolean; stage?: string}>((resolve,reject) => {
      reportPayBrowser = resolve;
      timer = setTimeout(() => reject(Error('Timed out waiting for payroll browser')),45000);
      browser = spawn('chromium',['--headless','--no-first-run','--disable-gpu','--disable-background-networking',
        '--disable-component-update','--disable-sync','--user-data-dir='+path.join(dir,'profile'),base+'/pay-ui-fixture'],{stdio:'ignore'});
      browser.once('error',reject);
      browser.once('exit',() => reject(Error('Payroll browser exited before completion')));
    });
    const result = await outcome;
    assert.equal(result.ok,true,result.stage);
  } finally {
    reportPayBrowser = undefined; payBrowserPage = ''; payBrowserScript = '';
    clearTimeout(timer);
    if (browser && browser.exitCode === null && browser.signalCode === null && browser.pid) {
      const stopped = new Promise(resolve => browser!.once('exit',resolve));
      browser.kill('SIGKILL'); await stopped;
    }
    rmSync(dir,{recursive:true,force:true});
  }
}

test("Chromium payroll screen preserves salary workflows and restricts employee bank details across role changes", async () => {
  const f = await fixture(), other = await fixture(), employee = randomUUID(), reader = 'synthetic-pay-reader-' + randomUUID();
  await addMember(f.company, reader, 'payroll_reader');
  await addMember(other.company, reader, 'payroll_reader');
  const approver = 'synthetic-pay-approver-' + randomUUID();
  await addMember(f.company, approver, 'payroll_approver');
  await admin.query('INSERT INTO public.employee_bank_details(company_id,employee_id,account_number) VALUES($1,$2,$3)',
    [f.company, employee, '00123456']);
  await addMember(other.company, f.owner, 'owner');
  await runPayrollBrowser('browserAcceptance.jsx', {company:f.company, other:other.company, owner:f.owner, reader, employee, approver});
  const bankReads = (await sensitiveAudit(f.company)).filter(row => row.capability === 'payroll.bank.read');
  assert.deepEqual(bankReads.map(row => [row.actor_id, row.target_id]), [[f.owner,employee],[approver,employee],[approver,employee],[f.owner,employee]]);
  assert.equal((await storedPay(f.company)).length,1);
  assert.deepEqual((await storedPay(other.company)),[]);
  assert.equal((await payCreationAudits(f.company)).length,1);
  assert.equal((await payPrepareAudits(f.company)).length,2);
  const exports = (await sensitiveAudit(f.company)).filter(row => row.capability === 'payroll.export');
  assert.deepEqual(exports.map(row => [row.actor_id,row.target_id]), Array(2).fill([f.owner,(await storedPay(f.company))[0].id]));
  assert.ok((await payReadAudits(f.company)).some(row => row.actor_id === reader));
});

test("Chromium owner history audits explicit reads and discards prior company data after refresh, switch and denial", async () => {
  const f = await fixture(), other = await fixture(), target = 'synthetic-history-' + randomUUID();
  identities.add(target);
  const added = await request('/' + f.company + '/members', 'POST', {user_id: target, role:'payroll_reader'}, f.owner);
  assert.equal(added.status,201);
  assert.equal((await request('/' + f.company + '/members/' + target, 'PUT', {role:'personal_tax_preparer'}, f.owner)).status,200);
  await addMember(other.company, f.owner, 'owner');
  await runPayrollBrowser('historyBrowserAcceptance.jsx', {sessionActor:f.owner,company:f.company, other:other.company, owner:f.owner,
    membership:JSON.parse(added.body).id, reader:target});
  const receipts = await historyReceipts(f.company);
  assert.deepEqual(receipts.map(row => [row.actor_id, row.context.returned_count]), [[f.owner,2],[f.owner,2]]);
  assert.deepEqual((await historyReceipts(other.company)).map(row => [row.actor_id,row.context.returned_count]), [[f.owner,0]]);
});

const taxPreparationPath = (company: string, id: string) => `/${company}/personal-tax-preparations/${id}`;
const taxReadAudits = async (company: string) => (await sensitiveAudit(company)).filter(row => row.action === 'sensitive_access' && row.capability === 'personal_tax.read');
async function taxPreparationFixture(amount = '4800000', year = 2026, id = randomUUID()) {
  const f = await fixture(), taxpayer = '00000000-0000-0000-0000-000000000001';
  await admin.query(`INSERT INTO public.personal_tax_preparations(company_id,id,taxpayer_id,tax_year_start,employment_income_pence)
    VALUES($1,$2,$3,$4,$5)`, [f.company, id, taxpayer, year, amount]);
  return { ...f, id, taxpayer, year, amount };
}
const taxFields = (f: Awaited<ReturnType<typeof taxPreparationFixture>>) => ({ id: f.id, tax_year_start: f.year, employment_income_pence: f.amount, currency: 'GBP' });
const taxDeniedBody = { error: 'Unable to complete this request. Please try again.', code: 'SENSITIVE_ACCESS_DENIED' };

test("native tax preparation reads exact role-scoped fields and preserves an owner/submitter fixture for populated restore", async () => {
  const f = await taxPreparationFixture();
  for (const role of ['owner', 'personal_tax_preparer', 'personal_tax_submitter']) {
    const actor = role === 'owner' ? f.owner : `synthetic-tax-role-${randomUUID()}`;
    if (role !== 'owner') {
      identities.add(actor);
      assert.equal((await request(`/${f.company}/members`, 'POST', { user_id: actor, role }, f.owner)).status, 201);
    }
    const response = await request(taxPreparationPath(f.company.toUpperCase(), f.id.toUpperCase()), 'GET', undefined, actor);
    assert.equal(response.status, 200, response.body); assert.equal(response.cacheControl, 'no-store');
    assert.deepEqual(JSON.parse(response.body), { ...taxFields(f), ...(role === 'personal_tax_submitter' ? {} : { taxpayer_id: f.taxpayer }) });
    const audit = (await taxReadAudits(f.company)).find(row => row.actor_id === actor);
    assert.deepEqual(audit, { action: 'sensitive_access', outcome: 'allowed', target_type: 'personal_tax_resource', target_id: f.id,
      actor_type: 'user', actor_id: actor, capability: 'personal_tax.read', context: { contract: 'sensitive-access.v1', role }, journal_id: null, posting_effect_id: null });
  }
  assert.equal((await taxReadAudits(f.company)).length, 3);
  for (const sql of ['INSERT INTO public.personal_tax_preparations SELECT * FROM public.personal_tax_preparations WHERE false',
    'UPDATE public.personal_tax_preparations SET employment_income_pence=employment_income_pence WHERE false',
    'DELETE FROM public.personal_tax_preparations WHERE false', 'TRUNCATE public.personal_tax_preparations']) {
    await assert.rejects(() => pool.query(sql), (error: any) => error.code === '42501');
  }
  // Kept intentionally: encrypted restore independently verifies both live role projections on this input.
});

test("tax submitter SQL excludes the internal taxpayer column rather than selecting then hiding it", async () => {
  const f = await taxPreparationFixture(), submitter = `synthetic-tax-submit-${randomUUID()}`;
  await addMember(f.company, submitter, 'personal_tax_submitter');
  await admin.query('ALTER TABLE public.personal_tax_preparations RENAME COLUMN taxpayer_id TO synthetic_taxpayer_hidden');
  try {
    const response = await request(taxPreparationPath(f.company, f.id), 'GET', undefined, submitter);
    assert.equal(response.status, 200); assert.deepEqual(JSON.parse(response.body), taxFields(f));
    assert.equal((await request(taxPreparationPath(f.company, f.id), 'GET', undefined, f.owner)).status, 503);
    assert.deepEqual((await taxReadAudits(f.company)).map(row => row.actor_id), [submitter]);
  } finally { await admin.query('ALTER TABLE public.personal_tax_preparations RENAME COLUMN synthetic_taxpayer_hidden TO taxpayer_id'); }
});

test("tax record IDs and taxpayer-year keys are company scoped even with equal IDs and different current actor roles", async () => {
  const f = await taxPreparationFixture(), other = await taxPreparationFixture('7654321', 2026, f.id);
  await addMember(other.company, f.owner, 'personal_tax_submitter');
  const first = await request(taxPreparationPath(f.company, f.id), 'GET', undefined, f.owner);
  const second = await request(taxPreparationPath(other.company, f.id), 'GET', undefined, f.owner);
  assert.deepEqual(JSON.parse(first.body), { ...taxFields(f), taxpayer_id: f.taxpayer });
  assert.deepEqual(JSON.parse(second.body), taxFields(other));
  for (const [company, id, actor] of [[f.company, f.id, other.owner], [other.company, randomUUID(), f.owner], [randomUUID(), f.id, f.owner]]) {
    const response = await request(taxPreparationPath(company!, id!), 'GET', undefined, actor!);
    assert.equal(response.status, 403); assert.deepEqual(JSON.parse(response.body), taxDeniedBody);
  }
  assert.equal((await taxReadAudits(f.company)).length, 1); assert.equal((await taxReadAudits(other.company)).length, 1);
});

test("personal tax records deny bookkeeping, payroll, inactive, ambiguous, unknown and foreign memberships", async () => {
  const f = await taxPreparationFixture(), other = await fixture(), actors = [other.owner];
  for (const role of ['admin', 'accountant', 'staff', 'member', 'read_only', 'payroll_reader', 'payroll_preparer', 'payroll_approver', 'unknown', null]) {
    const actor = `synthetic-denied-tax-${randomUUID()}`; await addMember(f.company, actor, role); actors.push(actor);
  }
  for (const active of [false, null]) {
    const actor = `synthetic-inactive-tax-${randomUUID()}`; await addMember(f.company, actor, 'personal_tax_preparer', active); actors.push(actor);
  }
  const ambiguous = `synthetic-ambiguous-tax-${randomUUID()}`;
  await addMember(f.company, ambiguous, 'personal_tax_preparer'); await addMember(f.company, ambiguous, 'personal_tax_submitter', false); actors.push(ambiguous);
  const anonymous = await request(taxPreparationPath(f.company, f.id));
  assert.equal(anonymous.status, 401); assert.equal(anonymous.cacheControl, 'no-store');
  for (const actor of actors) {
    const response = await request(taxPreparationPath(f.company, f.id), 'GET', undefined, actor);
    assert.equal(response.status, 403); assert.equal(response.cacheControl, 'no-store'); assert.deepEqual(JSON.parse(response.body), taxDeniedBody);
  }
  assert.deepEqual(await taxReadAudits(f.company), []);
});

test("personal tax read paths reject malformed IDs and overrides and expose no list, record mutation, legacy export or submit endpoints", async () => {
  const f = await taxPreparationFixture();
  for (const suffix of ['?role=owner', '?fields=taxpayer_id', '?action=personal_tax.submit', `?company_id=${randomUUID()}`, '?tax_year_start=2027']) {
    const response = await request(taxPreparationPath(f.company, f.id) + suffix, 'GET', undefined, f.owner);
    assert.equal(response.status, 400); assert.equal(response.cacheControl, 'no-store');
  }
  for (const [company, id] of [['invalid', f.id], [f.company, 'not-a-record'], [f.company, '00000000-0000-0000-0000-000000000000']]) {
    const response = await request(taxPreparationPath(company!, id!), 'GET', undefined, f.owner);
    assert.equal(response.status, 400); assert.equal(response.cacheControl, 'no-store');
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await request(taxPreparationPath(f.company, f.id), method, { employment_income_pence: '1', taxpayer_id: randomUUID() }, f.owner);
    assert.equal(response.status, 404); assert.equal(response.cacheControl, 'no-store');
  }
  for (const [path, method] of [[`/${f.company}/personal-tax-preparations`, 'GET'],
    [taxPreparationPath(f.company, f.id) + '/export', 'GET'], [taxPreparationPath(f.company, f.id) + '/submit', 'POST']]) {
    const response = await request(path!, method, undefined, f.owner); assert.equal(response.status, 404); assert.equal(response.cacheControl, 'no-store');
  }
  assert.deepEqual(await taxReadAudits(f.company), []);
  assert.equal((await pool.query('SELECT employment_income_pence::text amount FROM public.personal_tax_preparations WHERE company_id=$1 AND id=$2', [f.company, f.id])).rows[0].amount, f.amount);
});

test("tax draft inputs preserve exact bigint and storage-year bounds without claiming calculation support", async () => {
  for (const [amount, year] of [['0', 1], ['9007199254740993', 2026], ['9223372036854775807', 9998]] as const) {
    const f = await taxPreparationFixture(amount, year);
    const response = await request(taxPreparationPath(f.company, f.id), 'GET', undefined, f.owner);
    assert.equal(response.status, 200); assert.deepEqual(JSON.parse(response.body), { ...taxFields(f), taxpayer_id: f.taxpayer });
    assert.deepEqual((await taxReadAudits(f.company)).map(row => row.context), [{ contract: 'sensitive-access.v1', role: 'owner' }]);
  }
  const f = await taxPreparationFixture();
  const insert = (id: string, taxpayer: string | null, year: number, amount: string) => admin.query(`INSERT INTO public.personal_tax_preparations
    (company_id,id,taxpayer_id,tax_year_start,employment_income_pence) VALUES($1,$2,$3,$4,$5)`, [f.company, id, taxpayer, year, amount]);
  for (const [year, amount] of [[0, '1'], [9999, '1'], [2026, '-1']] as const)
    await assert.rejects(() => insert(randomUUID(), randomUUID(), year, amount), (error: any) => error.code === '23514');
  await assert.rejects(() => insert(randomUUID(), f.taxpayer, f.year, '1'), (error: any) => error.code === '23505');
  await assert.rejects(() => insert(f.id, randomUUID(), f.year, '1'), (error: any) => error.code === '23505');
  await assert.rejects(() => insert('00000000-0000-0000-0000-000000000000', randomUUID(), f.year, '1'), (error: any) => error.code === '23514');
  await assert.rejects(() => insert(randomUUID(), null, f.year, '1'), (error: any) => error.code === '23502');
  await assert.rejects(() => insert(randomUUID(), randomUUID(), f.year, '9223372036854775808'), (error: any) => error.code === '22003');
  assert.deepEqual(await taxReadAudits(f.company), []);
});

test("tax reads recheck revocation, bookkeeping demotion and loss of taxpayer-reference visibility after the company lock", async () => {
  for (const nextRole of ['inactive', 'accountant', 'personal_tax_submitter']) {
    const f = await taxPreparationFixture(), actor = `synthetic-tax-race-${randomUUID()}`;
    await addMember(f.company, actor, 'personal_tax_preparer');
    const blocker = await admin.connect(); let pending: ReturnType<typeof request> | undefined;
    try {
      await blocker.query('BEGIN'); const { rows: [{ pid }] } = await blocker.query('SELECT pg_backend_pid() pid');
      await blocker.query('SELECT id FROM public.companies WHERE id=$1 FOR UPDATE', [f.company]);
      pending = request(taxPreparationPath(f.company, f.id), 'GET', undefined, actor);
      const deadline = Date.now() + 5000; let waiting = false;
      while (Date.now() < deadline) {
        waiting = (await admin.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='ledgerly_api' AND $1::int=ANY(pg_blocking_pids(pid))) waiting", [pid])).rows[0].waiting;
        if (waiting) break; await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true);
      if (nextRole === 'inactive') await blocker.query('UPDATE public.company_users SET is_active=false WHERE company_id=$1 AND user_id=$2', [f.company, actor]);
      else await blocker.query('UPDATE public.company_users SET role=$3 WHERE company_id=$1 AND user_id=$2', [f.company, actor, nextRole]);
      await blocker.query('COMMIT'); const response = await pending; assert.equal(response.cacheControl, 'no-store');
      if (nextRole === 'personal_tax_submitter') {
        assert.equal(response.status, 200); assert.deepEqual(JSON.parse(response.body), taxFields(f));
        assert.deepEqual((await taxReadAudits(f.company)).map(row => row.context.role), ['personal_tax_submitter']);
      } else { assert.equal(response.status, 403); assert.deepEqual(JSON.parse(response.body), taxDeniedBody); assert.deepEqual(await taxReadAudits(f.company), []); }
    } finally { await blocker.query('ROLLBACK'); blocker.release(); if (pending) await pending; }
  }
});

test("tax read audit exception or skipped receipt prevents disclosure and leaves no successful read receipt", async () => {
  for (const failure of ['exception', 'skip']) {
    const f = await taxPreparationFixture(), before = await sensitiveAudit(f.company);
    await admin.query(`CREATE FUNCTION public.synthetic_tax_read_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.company_id='${f.company}'::uuid AND NEW.action='sensitive_access' THEN ${failure === 'skip' ? 'RETURN NULL;' : "RAISE EXCEPTION 'synthetic-private-tax-diagnostic';"} END IF; RETURN NEW; END $$`);
    await admin.query('CREATE TRIGGER synthetic_tax_read_audit_failure BEFORE INSERT ON public.accounting_audit_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_tax_read_audit_failure()');
    try {
      const response = await request(taxPreparationPath(f.company, f.id), 'GET', undefined, f.owner);
      assert.equal(response.status, 503); assert.equal(response.cacheControl, 'no-store');
      assert.deepEqual(JSON.parse(response.body), { error: 'Unable to complete this request. Please try again.', code: 'SENSITIVE_OPERATION_UNAVAILABLE' });
      assert.deepEqual(await sensitiveAudit(f.company), before);
      assert.equal((await pool.query('SELECT employment_income_pence::text amount FROM public.personal_tax_preparations WHERE company_id=$1 AND id=$2', [f.company, f.id])).rows[0].amount, f.amount);
      assert.equal(JSON.stringify(logs).includes('synthetic-private-tax-diagnostic'), false);
    } finally {
      await admin.query('DROP TRIGGER synthetic_tax_read_audit_failure ON public.accounting_audit_events');
      await admin.query('DROP FUNCTION public.synthetic_tax_read_audit_failure()');
    }
  }
});

test("tax reads refuse absent storage, column-only mutation grants and unprotected audit then recover after restoration", async () => {
  const f = await taxPreparationFixture();
  const unavailable = async () => {
    const response = await request(taxPreparationPath(f.company, f.id), 'GET', undefined, f.owner);
    assert.equal(response.status, 503); assert.equal(response.cacheControl, 'no-store');
    assert.deepEqual(JSON.parse(response.body), { error: 'Unable to complete this request. Please try again.', code: 'SENSITIVE_OPERATION_UNAVAILABLE' });
    assert.deepEqual(await taxReadAudits(f.company), []);
  };
  await admin.query('ALTER TABLE public.personal_tax_preparations RENAME TO synthetic_missing_tax_preparations');
  try { await unavailable(); }
  finally { await admin.query('ALTER TABLE public.synthetic_missing_tax_preparations RENAME TO personal_tax_preparations'); }
  for (const privilege of ['INSERT', 'UPDATE']) {
    await admin.query(`GRANT ${privilege}(taxpayer_id) ON public.personal_tax_preparations TO ledgerly_api`);
    try {
      assert.equal((await pool.query("SELECT has_table_privilege(current_user,'public.personal_tax_preparations',$1) allowed", [privilege])).rows[0].allowed, false);
      await unavailable();
    } finally { await admin.query(`REVOKE ${privilege}(taxpayer_id) ON public.personal_tax_preparations FROM ledgerly_api`); }
  }
  await admin.query('ALTER TABLE public.accounting_audit_events DISABLE TRIGGER ledgerly_accounting_audit_events_guard');
  try { await unavailable(); }
  finally { await admin.query('ALTER TABLE public.accounting_audit_events ENABLE ALWAYS TRIGGER ledgerly_accounting_audit_events_guard'); }
  const response = await request(taxPreparationPath(f.company, f.id), 'GET', undefined, f.owner);
  assert.equal(response.status, 200); assert.equal((await taxReadAudits(f.company)).length, 1);
});

const taxCreatePath = (company: string) => `/${company}/personal-tax-preparations`;
const taxIntent = () => ({ id: randomUUID(), taxpayer_id: randomUUID(), tax_year_start: 2026, employment_income_pence: '4800000' });
const taxCreationAudits = async (company: string) => (await sensitiveAudit(company)).filter(row => row.action === 'personal_tax_preparation_create');
const taxPrepareAudits = async (company: string) => (await sensitiveAudit(company)).filter(row => row.action === 'sensitive_access' && row.capability === 'personal_tax.prepare');
const storedTaxInputs = async (company: string) => (await pool.query(`SELECT id,taxpayer_id,tax_year_start,
  employment_income_pence::text employment_income_pence FROM public.personal_tax_preparations WHERE company_id=$1 ORDER BY id`, [company])).rows;
const directTaxCreate = async (company: string, actor: string, body: PersonalTaxPreparationCreation) => (await pool.query(
  'SELECT public.ledgerly_create_personal_tax_preparation($1::uuid,$2::text,$3::uuid,$4::uuid,$5::integer,$6::bigint) status',
  [company, actor, body.id, body.taxpayer_id, body.tax_year_start, body.employment_income_pence])).rows[0].status;

test("owner and verified personal tax preparer create annual tax input through normal HTTP then read exact persisted fields", async () => {
  for (const role of ['owner', 'personal_tax_preparer']) {
    const f = await fixture(), body = taxIntent(), actor = role === 'owner' ? f.owner : `synthetic-tax-create-${randomUUID()}`;
    if (role !== 'owner') {
      identities.add(actor);
      assert.equal((await request(`/${f.company}/members`, 'POST', { user_id: actor, role }, f.owner)).status, 201);
    }
    const created = await request(taxCreatePath(f.company), 'POST', body, actor);
    assert.equal(created.status, 201, created.body); assert.equal(created.cacheControl, 'no-store');
    assert.deepEqual(JSON.parse(created.body), { id: body.id, status: 'created' });
    assert.deepEqual(await storedTaxInputs(f.company), [body]);
    assert.deepEqual(await taxCreationAudits(f.company), [{ action: 'personal_tax_preparation_create', outcome: 'allowed',
      target_type: 'personal_tax_preparation', target_id: body.id, actor_type: 'user', actor_id: actor, capability: 'personal_tax.prepare',
      context: { contract: 'personal-tax-create.v1', role }, journal_id: null, posting_effect_id: null }]);
    assert.deepEqual(await taxPrepareAudits(f.company), [{ action: 'sensitive_access', outcome: 'allowed',
      target_type: 'personal_tax_resource', target_id: body.id, actor_type: 'user', actor_id: actor, capability: 'personal_tax.prepare',
      context: { contract: 'sensitive-access.v1', role }, journal_id: null, posting_effect_id: null }]);
    const read = await request(taxPreparationPath(f.company, body.id), 'GET', undefined, actor);
    assert.equal(read.status, 200); assert.deepEqual(JSON.parse(read.body), { ...body, currency: 'GBP' });
    await assert.rejects(() => pool.query('INSERT INTO public.personal_tax_preparations SELECT * FROM public.personal_tax_preparations WHERE false'),
      (error: any) => error.code === '42501');
  }
});

test("tax creation replays identical current-authority intent and appends later years without overwriting earlier input", async () => {
  const f = await fixture(), body = { ...taxIntent(), employment_income_pence: '9007199254740993' }, preparer = `synthetic-replay-${randomUUID()}`;
  await addMember(f.company, preparer, 'personal_tax_preparer');
  assert.equal((await request(taxCreatePath(f.company), 'POST', body, f.owner)).status, 201);
  for (const actor of [f.owner, preparer]) {
    const response = await request(taxCreatePath(f.company.toUpperCase()), 'POST', { ...body, id: body.id.toUpperCase(), taxpayer_id: body.taxpayer_id.toUpperCase() }, actor);
    assert.equal(response.status, 200); assert.deepEqual(JSON.parse(response.body), { id: body.id, status: 'replayed' });
  }
  assert.deepEqual(await storedTaxInputs(f.company), [body]); assert.equal((await taxCreationAudits(f.company)).length, 1);
  assert.equal((await taxPrepareAudits(f.company)).length, 3);
  const later = { ...body, id: randomUUID(), tax_year_start: 2027, employment_income_pence: '5000000' };
  assert.equal((await request(taxCreatePath(f.company), 'POST', later, preparer)).status, 201);
  assert.deepEqual(await storedTaxInputs(f.company), [body, later].sort((a, b) => a.id.localeCompare(b.id)));
  assert.equal((await taxCreationAudits(f.company)).length, 2);
});

test("tax creation preserves zero, bigint maximum and valid native taxpayer UUID at storage-year boundaries", async () => {
  for (const [year, amount] of [[1, '0'], [9998, '9223372036854775807']] as const) {
    const f = await fixture(), body = { ...taxIntent(), taxpayer_id: '00000000-0000-0000-0000-000000000001', tax_year_start: year, employment_income_pence: amount };
    const response = await request(taxCreatePath(f.company), 'POST', body, f.owner);
    assert.equal(response.status, 201); assert.deepEqual(await storedTaxInputs(f.company), [body]);
    const read = await request(taxPreparationPath(f.company, body.id), 'GET', undefined, f.owner);
    assert.equal(read.status, 200); assert.deepEqual(JSON.parse(read.body), { ...body, currency: 'GBP' });
    assert.deepEqual((await taxCreationAudits(f.company)).map(row => row.context), [{ contract: 'personal-tax-create.v1', role: 'owner' }]);
  }
});

test("changed tax intent and company taxpayer/year collisions return fixed conflict without writes or extra receipts", async () => {
  const f = await fixture(), body = taxIntent();
  assert.equal((await request(taxCreatePath(f.company), 'POST', body, f.owner)).status, 201);
  const before = await sensitiveAudit(f.company);
  for (const changed of [{ ...body, taxpayer_id: randomUUID() }, { ...body, tax_year_start: 2027 },
    { ...body, employment_income_pence: '4800001' }, { ...body, id: randomUUID() }]) {
    const response = await request(taxCreatePath(f.company), 'POST', changed, f.owner);
    assert.equal(response.status, 409); assert.equal(response.cacheControl, 'no-store');
    assert.deepEqual(JSON.parse(response.body), { error: 'This request conflicts with an existing record.', code: 'SENSITIVE_REQUEST_CONFLICT' });
    assert.deepEqual(await storedTaxInputs(f.company), [body]); assert.deepEqual(await sensitiveAudit(f.company), before);
  }
});

test("administrator-seeded tax input cannot be claimed as a replay even with a forged matching creation audit", async () => {
  const f = await taxPreparationFixture(), body = { id: f.id, taxpayer_id: f.taxpayer, tax_year_start: 2026, employment_income_pence: f.amount };
  assert.equal((await request(taxCreatePath(f.company), 'POST', body, f.owner)).status, 409);
  await pool.query(`INSERT INTO public.accounting_audit_events
    (id,company_id,action,outcome,target_type,target_id,actor_type,actor_id,capability,context)
    VALUES($1,$2,'personal_tax_preparation_create','allowed','personal_tax_preparation',$3,'user',$4,'personal_tax.prepare',$5::jsonb)`,
  [randomUUID(), f.company, f.id, f.owner, JSON.stringify({ contract: 'personal-tax-create.v1', role: 'owner' })]);
  const before = await sensitiveAudit(f.company);
  assert.equal(await directTaxCreate(f.company, f.owner, body), 'conflict');
  assert.equal((await request(taxCreatePath(f.company), 'POST', body, f.owner)).status, 409);
  assert.deepEqual(await storedTaxInputs(f.company), [body]); assert.deepEqual(await sensitiveAudit(f.company), before);
  assert.deepEqual(await taxPrepareAudits(f.company), []);
});

test("tax command identities and taxpayer years are independent across companies", async () => {
  const f = await fixture(), other = await fixture(), body = taxIntent(), otherBody = { ...body, employment_income_pence: '7654321' };
  assert.equal((await request(taxCreatePath(f.company), 'POST', body, f.owner)).status, 201);
  assert.equal((await request(taxCreatePath(other.company), 'POST', otherBody, other.owner)).status, 201);
  assert.equal((await request(taxCreatePath(other.company), 'POST', otherBody, f.owner)).status, 403);
  assert.deepEqual(await storedTaxInputs(f.company), [body]); assert.deepEqual(await storedTaxInputs(other.company), [otherBody]);
  assert.equal((await taxCreationAudits(f.company)).length, 1); assert.equal((await taxCreationAudits(other.company)).length, 1);
});

test("concurrent duplicate tax creation has one effect and competing year keys have one winner", async () => {
  const f = await fixture(), body = taxIntent();
  const same = await Promise.all([1, 2].map(() => request(taxCreatePath(f.company), 'POST', body, f.owner)));
  assert.deepEqual(same.map(response => response.status).sort(), [200, 201]);
  assert.deepEqual(await storedTaxInputs(f.company), [body]); assert.equal((await taxCreationAudits(f.company)).length, 1);
  assert.equal((await taxPrepareAudits(f.company)).length, 2);
  const other = await fixture(), first = taxIntent(), second = { ...first, id: randomUUID(), employment_income_pence: '4800001' };
  const competing = await Promise.all([first, second].map(intent => request(taxCreatePath(other.company), 'POST', intent, other.owner)));
  assert.deepEqual(competing.map(response => response.status).sort(), [201, 409]);
  const winner = competing[0]!.status === 201 ? first : second;
  assert.deepEqual(await storedTaxInputs(other.company), [winner]); assert.equal((await taxCreationAudits(other.company)).length, 1);
  assert.equal((await taxPrepareAudits(other.company)).length, 1);
});

test("tax creation denies bookkeeping, payroll, submitter and invalid memberships in HTTP and the direct function", async () => {
  const f = await fixture(), other = await fixture(), body = taxIntent(), actors = [other.owner];
  for (const role of ['admin', 'accountant', 'staff', 'member', 'read_only', 'payroll_reader', 'payroll_preparer', 'payroll_approver',
    'personal_tax_submitter', 'unknown', null]) {
    const actor = `synthetic-denied-create-${randomUUID()}`; await addMember(f.company, actor, role); actors.push(actor);
  }
  for (const active of [false, null]) {
    const actor = `synthetic-inactive-create-${randomUUID()}`; await addMember(f.company, actor, 'owner', active); actors.push(actor);
  }
  const ambiguous = `synthetic-ambiguous-create-${randomUUID()}`;
  await addMember(f.company, ambiguous, 'personal_tax_preparer'); await addMember(f.company, ambiguous, 'owner', false); actors.push(ambiguous);
  const anonymous = await request(taxCreatePath(f.company), 'POST', body);
  assert.equal(anonymous.status, 401); assert.equal(anonymous.cacheControl, 'no-store');
  for (const actor of actors) {
    const response = await request(taxCreatePath(f.company), 'POST', body, actor);
    assert.equal(response.status, 403); assert.equal(response.cacheControl, 'no-store');
    assert.equal(await directTaxCreate(f.company, actor, body), 'denied');
  }
  for (const invalid of [{ ...body, tax_year_start: 0 }, { ...body, tax_year_start: 9999 }, { ...body, employment_income_pence: '-1' },
    { ...body, id: '00000000-0000-0000-0000-000000000000' as ReturnType<typeof randomUUID> }])
    assert.equal(await directTaxCreate(f.company, f.owner, invalid), 'denied');
  for (const malformed of [{ ...body, currency: 'GBP' }, { ...body, role: 'owner' }, { ...body, company_id: other.company }, { ...body, created_by_tax_command: true },
    { ...body, employment_income_pence: 4800000 }, { ...body, tax_year_start: '2026' }]) {
    assert.equal((await request(taxCreatePath(f.company), 'POST', malformed, f.owner)).status, 400);
  }
  assert.equal((await request(taxCreatePath(f.company) + '?role=owner', 'POST', body, f.owner)).status, 400);
  assert.deepEqual(await storedTaxInputs(f.company), []); assert.deepEqual(await sensitiveAudit(f.company), []);
});

test("tax creation and replay recheck revocation or demotion after the company lock", async () => {
  for (const replay of [false, true]) for (const next of ['inactive', 'personal_tax_submitter']) {
    const f = await fixture(), actor = `synthetic-create-race-${randomUUID()}`, body = taxIntent();
    await addMember(f.company, actor, 'personal_tax_preparer');
    if (replay) assert.equal((await request(taxCreatePath(f.company), 'POST', body, actor)).status, 201);
    const before = await sensitiveAudit(f.company), blocker = await admin.connect(); let pending: ReturnType<typeof request> | undefined;
    try {
      await blocker.query('BEGIN'); const { rows: [{ pid }] } = await blocker.query('SELECT pg_backend_pid() pid');
      await blocker.query('SELECT id FROM public.companies WHERE id=$1 FOR UPDATE', [f.company]);
      pending = request(taxCreatePath(f.company), 'POST', body, actor);
      const deadline = Date.now() + 5000; let waiting = false;
      while (Date.now() < deadline) {
        waiting = (await admin.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='ledgerly_api' AND $1::int=ANY(pg_blocking_pids(pid))) waiting", [pid])).rows[0].waiting;
        if (waiting) break; await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true);
      if (next === 'inactive') await blocker.query('UPDATE public.company_users SET is_active=false WHERE company_id=$1 AND user_id=$2', [f.company, actor]);
      else await blocker.query("UPDATE public.company_users SET role='personal_tax_submitter' WHERE company_id=$1 AND user_id=$2", [f.company, actor]);
      await blocker.query('COMMIT'); assert.equal((await pending).status, 403);
      assert.deepEqual(await storedTaxInputs(f.company), replay ? [body] : []); assert.deepEqual(await sensitiveAudit(f.company), before);
    } finally { await blocker.query('ROLLBACK'); blocker.release(); if (pending) await pending; }
  }
});

test("direct tax command retains its own creation audit and refuses unprotected audit storage", async () => {
  const f = await fixture(), body = taxIntent();
  await admin.query('ALTER TABLE public.accounting_audit_events DISABLE TRIGGER ledgerly_accounting_audit_events_guard');
  try {
    await assert.rejects(() => directTaxCreate(f.company, f.owner, body));
    assert.equal((await request(taxCreatePath(f.company), 'POST', body, f.owner)).status, 503);
    assert.deepEqual(await storedTaxInputs(f.company), []); assert.deepEqual(await sensitiveAudit(f.company), []);
  } finally { await admin.query('ALTER TABLE public.accounting_audit_events ENABLE ALWAYS TRIGGER ledgerly_accounting_audit_events_guard'); }
  assert.equal(await directTaxCreate(f.company, f.owner, body), 'created');
  assert.deepEqual(await storedTaxInputs(f.company), [body]); assert.equal((await taxCreationAudits(f.company)).length, 1);
  assert.deepEqual(await taxPrepareAudits(f.company), []);
  assert.equal((await request(taxCreatePath(f.company), 'POST', body, f.owner)).status, 200);
  assert.equal((await taxCreationAudits(f.company)).length, 1); assert.equal((await taxPrepareAudits(f.company)).length, 1);
  const before = await sensitiveAudit(f.company);
  await admin.query('ALTER TABLE public.accounting_audit_events DISABLE TRIGGER ledgerly_accounting_audit_events_guard');
  try {
    await assert.rejects(() => directTaxCreate(f.company, f.owner, body));
    assert.equal((await request(taxCreatePath(f.company), 'POST', body, f.owner)).status, 503);
    assert.deepEqual(await storedTaxInputs(f.company), [body]); assert.deepEqual(await sensitiveAudit(f.company), before);
  } finally { await admin.query('ALTER TABLE public.accounting_audit_events ENABLE ALWAYS TRIGGER ledgerly_accounting_audit_events_guard'); }
});

test("creation or prepare audit faults roll back direct and wrapped tax creation, including skipped inserts", async () => {
  for (const action of ['personal_tax_preparation_create', 'sensitive_access']) for (const failure of ['exception', 'skip']) {
    const f = await fixture(), body = taxIntent();
    await admin.query(`CREATE FUNCTION public.synthetic_tax_create_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.company_id='${f.company}'::uuid AND NEW.action='${action}' THEN ${failure === 'skip' ? 'RETURN NULL;' : "RAISE EXCEPTION 'synthetic-private-tax-create-diagnostic';"} END IF; RETURN NEW; END $$`);
    await admin.query('CREATE TRIGGER synthetic_tax_create_audit_failure BEFORE INSERT ON public.accounting_audit_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_tax_create_audit_failure()');
    try {
      if (action === 'personal_tax_preparation_create') {
        await assert.rejects(() => directTaxCreate(f.company, f.owner, body));
        assert.deepEqual(await storedTaxInputs(f.company), []); assert.deepEqual(await sensitiveAudit(f.company), []);
      }
      const response = await request(taxCreatePath(f.company), 'POST', body, f.owner);
      assert.equal(response.status, 503); assert.equal(response.cacheControl, 'no-store');
      assert.equal(response.body.includes('synthetic-private-tax-create-diagnostic'), false);
      assert.deepEqual(await storedTaxInputs(f.company), []); assert.deepEqual(await sensitiveAudit(f.company), []);
      assert.equal(JSON.stringify(logs).includes('synthetic-private-tax-create-diagnostic'), false);
    } finally {
      await admin.query('DROP TRIGGER synthetic_tax_create_audit_failure ON public.accounting_audit_events');
      await admin.query('DROP FUNCTION public.synthetic_tax_create_audit_failure()');
    }
    assert.equal((await request(taxCreatePath(f.company), 'POST', body, f.owner)).status, 201);
    assert.equal((await taxCreationAudits(f.company)).length, 1); assert.equal((await taxPrepareAudits(f.company)).length, 1);
  }
});

test("failed replay audit leaves the original tax input and creation receipt intact", async () => {
  const f = await fixture(), body = taxIntent();
  assert.equal((await request(taxCreatePath(f.company), 'POST', body, f.owner)).status, 201);
  const before = await sensitiveAudit(f.company);
  await admin.query(`CREATE FUNCTION public.synthetic_tax_replay_audit_skip() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.company_id='${f.company}'::uuid AND NEW.action='sensitive_access' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
  await admin.query('CREATE TRIGGER synthetic_tax_replay_audit_skip BEFORE INSERT ON public.accounting_audit_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_tax_replay_audit_skip()');
  try {
    assert.equal((await request(taxCreatePath(f.company), 'POST', body, f.owner)).status, 503);
    assert.deepEqual(await storedTaxInputs(f.company), [body]); assert.deepEqual(await sensitiveAudit(f.company), before);
  } finally {
    await admin.query('DROP TRIGGER synthetic_tax_replay_audit_skip ON public.accounting_audit_events');
    await admin.query('DROP FUNCTION public.synthetic_tax_replay_audit_skip()');
  }
  assert.equal((await request(taxCreatePath(f.company), 'POST', body, f.owner)).status, 200);
  assert.equal((await taxCreationAudits(f.company)).length, 1); assert.equal((await taxPrepareAudits(f.company)).length, 2);
});

test("tax creation fails closed on unsafe function grants and unknown or null command status", async () => {
  const f = await fixture(), body = taxIntent();
  const signature = 'public.ledgerly_create_personal_tax_preparation(uuid,text,uuid,uuid,integer,bigint)';
  await admin.query(`GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC`);
  try { assert.equal((await request(taxCreatePath(f.company), 'POST', body, f.owner)).status, 503); }
  finally { await admin.query(`REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC`); }
  const definition = (await admin.query('SELECT pg_get_functiondef($1::regprocedure) definition', [signature])).rows[0].definition;
  try {
    for (const value of ['NULL', "'unexpected-status'"]) {
      await admin.query(`CREATE OR REPLACE FUNCTION public.ledgerly_create_personal_tax_preparation(c uuid,a text,r uuid,t uuid,y integer,p bigint)
        RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN RETURN ${value}; END $$`);
      const response = await request(taxCreatePath(f.company), 'POST', body, f.owner);
      assert.equal(response.status, 503); assert.equal(response.cacheControl, 'no-store');
      assert.deepEqual(await storedTaxInputs(f.company), []); assert.deepEqual(await sensitiveAudit(f.company), []);
    }
  } finally { await admin.query(definition); }
  assert.equal((await request(taxCreatePath(f.company), 'POST', body, f.owner)).status, 201);
});

test("Chromium personal tax entry retries a committed input, downloads its audited CSV and limits submitter readback", async () => {
  const f = await fixture(), other = await fixture(), taxpayer = randomUUID();
  const preparer = 'synthetic-tax-preparer-' + randomUUID(), submitter = 'synthetic-tax-submitter-' + randomUUID();
  await addMember(f.company, preparer, 'personal_tax_preparer');
  await addMember(f.company, submitter, 'personal_tax_submitter');
  await addMember(other.company, submitter, 'personal_tax_submitter');
  await addMember(other.company, preparer, 'personal_tax_preparer');
  await runPayrollBrowser('taxBrowserAcceptance.jsx', {company:f.company, other:other.company, preparer, submitter, taxpayer});
  const rows = await storedTaxInputs(f.company);
  assert.equal(rows.length, 1);
  assert.ok(rows[0].taxpayer_id === taxpayer && rows[0].employment_income_pence === '4525075' && rows[0].tax_year_start === 2026);
  assert.deepEqual(await storedTaxInputs(other.company), []);
  assert.equal((await taxCreationAudits(f.company)).length, 1);
  assert.equal((await taxPrepareAudits(f.company)).length, 2);
  const exports = (await sensitiveAudit(f.company)).filter(row => row.capability === 'personal_tax.export');
  assert.deepEqual(exports.map(row => row.actor_id), [preparer, preparer]);
  assert.ok((await taxReadAudits(f.company)).some(row => row.actor_id === submitter));
});

const taxExportPath = (company: string, id: string) => `${taxPreparationPath(company, id)}/export.csv`;
const taxExportAudits = async (company: string) => (await sensitiveAudit(company)).filter(row => row.action === 'sensitive_access' && row.capability === 'personal_tax.export');
const expectedTaxCsv = (year: number, amount: string) => `tax_year_start,employment_income_pence,currency\r\n${year},${amount},GBP\r\n`;
async function taxExportRequest(path: string, actor?: string, method = 'GET', headers: Record<string, string> = {}) {
  const response = await fetch(base + path, { method, headers: { ...(actor ? { 'x-test-actor': actor } : {}), ...headers } });
  return { status: response.status, body: await response.text(), headers: response.headers };
}
function assertNoTaxAttachment(response: Awaited<ReturnType<typeof taxExportRequest>>) {
  assert.equal(response.headers.get('cache-control'), 'no-store');
  for (const key of ['content-disposition', 'x-personal-tax-company', 'x-personal-tax-record']) assert.equal(response.headers.get(key), null);
}

test('native tax CSV export uses its own permission and exact fixed fields, then commits a redacted export receipt', async () => {
  for (const [year, amount] of [[1, '0'], [2026, '9007199254740993'], [9998, '9223372036854775807']] as const) {
    const f = await taxPreparationFixture(amount, year), preparer = 'synthetic-export-preparer-' + randomUUID();
    identities.add(preparer);
    assert.equal((await request(`/${f.company}/members`, 'POST', { user_id: preparer, role: 'personal_tax_preparer' }, f.owner)).status, 201);
    for (const [actor, role] of [[f.owner, 'owner'], [preparer, 'personal_tax_preparer']] as const) {
      const response = await taxExportRequest(taxExportPath(f.company.toUpperCase(), f.id.toUpperCase()), actor);
      assert.equal(response.status, 200); assert.equal(response.body, expectedTaxCsv(year, amount));
      assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
      assert.equal(response.headers.get('content-disposition'), 'attachment; filename="personal-tax-input.csv"');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('x-personal-tax-company'), f.company); assert.equal(response.headers.get('x-personal-tax-record'), f.id);
      assert.equal(response.headers.get('content-length'), String(Buffer.byteLength(response.body)));
      assert.equal(response.headers.get('etag'), null);
      assert.deepEqual((await taxExportAudits(f.company)).find(row => row.actor_id === actor), {
        action: 'sensitive_access', outcome: 'allowed', target_type: 'personal_tax_resource', target_id: f.id,
        actor_type: 'user', actor_id: actor, capability: 'personal_tax.export', context: { contract: 'sensitive-access.v1', role }, journal_id: null, posting_effect_id: null,
      });
    }
    assert.equal((await taxExportAudits(f.company)).length, 2); assert.deepEqual(await taxReadAudits(f.company), []);
  }
});

test('tax export excludes taxpayer at SQL and scopes equal record IDs to the currently authorised company', async () => {
  const f = await taxPreparationFixture(), other = await taxPreparationFixture('7654321', 2025, f.id);
  await addMember(other.company, f.owner, 'personal_tax_preparer');
  await admin.query('ALTER TABLE public.personal_tax_preparations RENAME COLUMN taxpayer_id TO synthetic_export_taxpayer_hidden');
  try {
    for (const current of [f, other]) {
      const response = await taxExportRequest(taxExportPath(current.company, current.id), f.owner);
      assert.equal(response.status, 200); assert.equal(response.body, expectedTaxCsv(current.year, current.amount));
    }
  } finally { await admin.query('ALTER TABLE public.personal_tax_preparations RENAME COLUMN synthetic_export_taxpayer_hidden TO taxpayer_id'); }
  for (const [company, id, actor] of [[f.company, f.id, other.owner], [other.company, randomUUID(), f.owner], [randomUUID(), f.id, f.owner]]) {
    const response = await taxExportRequest(taxExportPath(company!, id!), actor!);
    assert.equal(response.status, 403); assertNoTaxAttachment(response); assert.deepEqual(JSON.parse(response.body), taxDeniedBody);
  }
  assert.equal((await taxExportAudits(f.company)).length, 1); assert.equal((await taxExportAudits(other.company)).length, 1);
});

test('tax submitters cannot export; bookkeeping, payroll, inactive, unknown, ambiguous and unauthenticated export requests disclose nothing', async () => {
  const f = await taxPreparationFixture(), other = await fixture(), actors = [other.owner];
  for (const role of ['personal_tax_submitter', 'admin', 'accountant', 'staff', 'member', 'read_only', 'payroll_reader', 'payroll_preparer', 'payroll_approver', 'unknown', null]) {
    const actor = 'synthetic-export-denied-' + randomUUID(); await addMember(f.company, actor, role); actors.push(actor);
    if (role === 'personal_tax_submitter') assert.equal((await request(taxPreparationPath(f.company, f.id), 'GET', undefined, actor)).status, 200);
  }
  for (const active of [false, null]) {
    const actor = 'synthetic-export-inactive-' + randomUUID(); await addMember(f.company, actor, 'personal_tax_preparer', active); actors.push(actor);
  }
  const ambiguous = 'synthetic-export-ambiguous-' + randomUUID();
  await addMember(f.company, ambiguous, 'personal_tax_preparer'); await addMember(f.company, ambiguous, 'owner', false); actors.push(ambiguous);
  const anonymous = await taxExportRequest(taxExportPath(f.company, f.id));
  assert.equal(anonymous.status, 401); assertNoTaxAttachment(anonymous);
  for (const actor of actors) {
    const response = await taxExportRequest(taxExportPath(f.company, f.id), actor);
    assert.equal(response.status, 403); assertNoTaxAttachment(response); assert.deepEqual(JSON.parse(response.body), taxDeniedBody);
  }
  assert.deepEqual(await taxExportAudits(f.company), []);
});

test('tax export rejects HEAD and overrides without receipts; conditional GET still returns a fresh audited CSV', async () => {
  const f = await taxPreparationFixture();
  const head = await taxExportRequest(taxExportPath(f.company, f.id), f.owner, 'HEAD');
  assert.equal(head.status, 405); assert.equal(head.body, ''); assert.equal(head.headers.get('allow'), 'GET'); assertNoTaxAttachment(head);
  for (const suffix of ['?role=owner', '?fields=taxpayer_id', '?action=personal_tax.read', `?company_id=${randomUUID()}`]) {
    const response = await taxExportRequest(taxExportPath(f.company, f.id) + suffix, f.owner);
    assert.equal(response.status, 400); assertNoTaxAttachment(response);
    assert.deepEqual(JSON.parse(response.body), { error: 'Unable to complete this request. Please try again.', code: 'SENSITIVE_REQUEST_INVALID' });
  }
  for (const [company, id] of [['not-a-company', f.id], [f.company, 'not-a-record'], [f.company, '00000000-0000-0000-0000-000000000000']]) {
    const response = await taxExportRequest(taxExportPath(company!, id!), f.owner);
    assert.equal(response.status, 400); assertNoTaxAttachment(response);
  }
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const response = await taxExportRequest(taxExportPath(f.company, f.id), f.owner, method);
    assert.equal(response.status, 404); assertNoTaxAttachment(response);
  }
  assert.deepEqual(await taxExportAudits(f.company), []);
  const response = await taxExportRequest(taxExportPath(f.company, f.id), f.owner, 'GET', { 'if-none-match': '*', 'if-modified-since': 'Thu, 01 Jan 2099 00:00:00 GMT' });
  assert.equal(response.status, 200); assert.equal(response.body, expectedTaxCsv(f.year, f.amount)); assert.equal(response.headers.get('etag'), null);
  assert.equal((await taxExportAudits(f.company)).length, 1);
});

test('tax export rechecks revocation and demotion to read-only submitter after acquiring the company lock', async () => {
  for (const next of ['inactive', 'personal_tax_submitter']) {
    const f = await taxPreparationFixture(), actor = 'synthetic-export-race-' + randomUUID(); await addMember(f.company, actor, 'personal_tax_preparer');
    const blocker = await admin.connect(); let pending: ReturnType<typeof taxExportRequest> | undefined;
    try {
      await blocker.query('BEGIN'); const { rows: [{ pid }] } = await blocker.query('SELECT pg_backend_pid() pid');
      await blocker.query('SELECT id FROM public.companies WHERE id=$1 FOR UPDATE', [f.company]);
      pending = taxExportRequest(taxExportPath(f.company, f.id), actor);
      const deadline = Date.now() + 5000; let waiting = false;
      while (Date.now() < deadline) {
        waiting = (await admin.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='ledgerly_api' AND $1::int=ANY(pg_blocking_pids(pid))) waiting", [pid])).rows[0].waiting;
        if (waiting) break; await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true);
      if (next === 'inactive') await blocker.query('UPDATE public.company_users SET is_active=false WHERE company_id=$1 AND user_id=$2', [f.company, actor]);
      else await blocker.query("UPDATE public.company_users SET role='personal_tax_submitter' WHERE company_id=$1 AND user_id=$2", [f.company, actor]);
      await blocker.query('COMMIT'); const response = await pending;
      assert.equal(response.status, 403); assertNoTaxAttachment(response); assert.deepEqual(JSON.parse(response.body), taxDeniedBody);
      assert.deepEqual(await taxExportAudits(f.company), []);
    } finally { await blocker.query('ROLLBACK'); blocker.release(); if (pending) await pending; }
  }
});

test('tax export audit exceptions and silent receipt suppression prevent CSV and success evidence', async () => {
  for (const failure of ['exception', 'skip']) {
    const f = await taxPreparationFixture(), before = await sensitiveAudit(f.company);
    await admin.query(`CREATE FUNCTION public.synthetic_tax_export_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.company_id='${f.company}'::uuid AND NEW.capability='personal_tax.export' THEN ${failure === 'skip' ? 'RETURN NULL;' : "RAISE EXCEPTION 'synthetic-private-export-diagnostic';"} END IF; RETURN NEW; END $$`);
    await admin.query('CREATE TRIGGER synthetic_tax_export_audit_failure BEFORE INSERT ON public.accounting_audit_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_tax_export_audit_failure()');
    try {
      const response = await taxExportRequest(taxExportPath(f.company, f.id), f.owner);
      assert.equal(response.status, 503); assertNoTaxAttachment(response);
      assert.deepEqual(JSON.parse(response.body), { error: 'Unable to complete this request. Please try again.', code: 'SENSITIVE_OPERATION_UNAVAILABLE' });
      assert.deepEqual(await sensitiveAudit(f.company), before); assert.equal(JSON.stringify(logs).includes('synthetic-private-export-diagnostic'), false);
    } finally {
      await admin.query('DROP TRIGGER synthetic_tax_export_audit_failure ON public.accounting_audit_events');
      await admin.query('DROP FUNCTION public.synthetic_tax_export_audit_failure()');
    }
  }
});

test('tax export refuses unsafe record storage and unprotected audit before disclosure then recovers', async () => {
  const f = await taxPreparationFixture();
  const unavailable = async () => {
    const response = await taxExportRequest(taxExportPath(f.company, f.id), f.owner);
    assert.equal(response.status, 503); assertNoTaxAttachment(response);
    assert.deepEqual(JSON.parse(response.body), { error: 'Unable to complete this request. Please try again.', code: 'SENSITIVE_OPERATION_UNAVAILABLE' });
    assert.deepEqual(await taxExportAudits(f.company), []);
  };
  await admin.query('GRANT UPDATE(employment_income_pence) ON public.personal_tax_preparations TO ledgerly_api');
  try { await unavailable(); } finally { await admin.query('REVOKE UPDATE(employment_income_pence) ON public.personal_tax_preparations FROM ledgerly_api'); }
  await admin.query('ALTER TABLE public.accounting_audit_events DISABLE TRIGGER ledgerly_accounting_audit_events_guard');
  try { await unavailable(); } finally { await admin.query('ALTER TABLE public.accounting_audit_events ENABLE ALWAYS TRIGGER ledgerly_accounting_audit_events_guard'); }
  const response = await taxExportRequest(taxExportPath(f.company, f.id), f.owner);
  assert.equal(response.status, 200); assert.equal(response.body, expectedTaxCsv(f.year, f.amount)); assert.equal((await taxExportAudits(f.company)).length, 1);
});


const payExportDeniedBody = { error: 'Unable to complete this request. Please try again.', code: 'SENSITIVE_ACCESS_DENIED' };
async function payExportFixture(amount = '4800000', date = '2026-04-06', id = randomUUID()) {
  const f = await fixture(), employee = '00000000-0000-0000-0000-000000000001';
  await admin.query(`INSERT INTO public.employee_pay_records(company_id,id,employee_id,effective_from,annual_salary_pence)
    VALUES($1,$2,$3,$4,$5)`, [f.company, id, employee, date, amount]);
  return { ...f, id, employee, date, amount };
}
const payExportPath = (company: string, id: string) => `${payRecordPath(company, id)}/export.csv`;
const payExportAudits = async (company: string) => (await sensitiveAudit(company)).filter(row => row.action === 'sensitive_access' && row.capability === 'payroll.export');
const expectedPayCsv = (date: string, amount: string) => `effective_from,annual_salary_pence,currency\r\n${date},${amount},GBP\r\n`;
async function payExportRequest(path: string, actor?: string, method = 'GET', headers: Record<string, string> = {}) {
  const response = await fetch(base + path, { method, headers: { ...(actor ? { 'x-test-actor': actor } : {}), ...headers } });
  return { status: response.status, body: await response.text(), headers: response.headers };
}
function assertNoPayAttachment(response: Awaited<ReturnType<typeof payExportRequest>>) {
  assert.equal(response.headers.get('cache-control'), 'no-store');
  for (const key of ['content-disposition', 'x-payroll-company', 'x-payroll-record']) assert.equal(response.headers.get(key), null);
}

test('native pay CSV export uses its own permission and exact fixed fields, then commits a redacted export receipt', async () => {
  for (const [date, amount] of [['0001-01-01', '0'], ['2024-02-29', '9007199254740993'], ['9999-12-31', '9223372036854775807']] as const) {
    const f = await payExportFixture(amount, date), preparer = 'synthetic-export-preparer-' + randomUUID();
    identities.add(preparer);
    assert.equal((await request(`/${f.company}/members`, 'POST', { user_id: preparer, role: 'payroll_preparer' }, f.owner)).status, 201);
    for (const [actor, role] of [[f.owner, 'owner'], [preparer, 'payroll_preparer']] as const) {
      const response = await payExportRequest(payExportPath(f.company.toUpperCase(), f.id.toUpperCase()), actor);
      assert.equal(response.status, 200); assert.equal(response.body, expectedPayCsv(date, amount));
      assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
      assert.equal(response.headers.get('content-disposition'), 'attachment; filename="payroll-pay-record.csv"');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('x-payroll-company'), f.company); assert.equal(response.headers.get('x-payroll-record'), f.id);
      assert.equal(response.headers.get('content-length'), String(Buffer.byteLength(response.body)));
      assert.equal(response.headers.get('etag'), null);
      assert.deepEqual((await payExportAudits(f.company)).find(row => row.actor_id === actor), {
        action: 'sensitive_access', outcome: 'allowed', target_type: 'payroll_resource', target_id: f.id,
        actor_type: 'user', actor_id: actor, capability: 'payroll.export', context: { contract: 'sensitive-access.v1', role }, journal_id: null, posting_effect_id: null,
      });
    }
    assert.equal((await payExportAudits(f.company)).length, 2); assert.deepEqual(await payReadAudits(f.company), []);
  }
});

test('pay export excludes employee at SQL and scopes equal record IDs to the currently authorised company', async () => {
  const f = await payExportFixture(), other = await payExportFixture('7654321', '2025-04-06', f.id);
  await addMember(other.company, f.owner, 'payroll_preparer');
  await admin.query('ALTER TABLE public.employee_pay_records RENAME COLUMN employee_id TO synthetic_export_employee_hidden');
  try {
    for (const current of [f, other]) {
      const response = await payExportRequest(payExportPath(current.company, current.id), f.owner);
      assert.equal(response.status, 200); assert.equal(response.body, expectedPayCsv(current.date, current.amount));
    }
  } finally { await admin.query('ALTER TABLE public.employee_pay_records RENAME COLUMN synthetic_export_employee_hidden TO employee_id'); }
  for (const [company, id, actor] of [[f.company, f.id, other.owner], [other.company, randomUUID(), f.owner], [randomUUID(), f.id, f.owner]]) {
    const response = await payExportRequest(payExportPath(company!, id!), actor!);
    assert.equal(response.status, 403); assertNoPayAttachment(response); assert.deepEqual(JSON.parse(response.body), payExportDeniedBody);
  }
  assert.equal((await payExportAudits(f.company)).length, 1); assert.equal((await payExportAudits(other.company)).length, 1);
});

test('payroll readers/approvers cannot export; bookkeeping, personal-tax, inactive, unknown, ambiguous and unauthenticated export requests disclose nothing', async () => {
  const f = await payExportFixture(), other = await fixture(), actors = [other.owner];
  for (const role of ['payroll_reader', 'payroll_approver', 'admin', 'accountant', 'staff', 'member', 'read_only', 'personal_tax_preparer', 'personal_tax_submitter', 'unknown', null]) {
    const actor = 'synthetic-export-denied-' + randomUUID(); await addMember(f.company, actor, role); actors.push(actor);
    if (role === 'payroll_reader' || role === 'payroll_approver') assert.equal((await request(payRecordPath(f.company, f.id), 'GET', undefined, actor)).status, 200);
  }
  for (const active of [false, null]) {
    const actor = 'synthetic-export-inactive-' + randomUUID(); await addMember(f.company, actor, 'payroll_preparer', active); actors.push(actor);
  }
  const ambiguous = 'synthetic-export-ambiguous-' + randomUUID();
  await addMember(f.company, ambiguous, 'payroll_preparer'); await addMember(f.company, ambiguous, 'owner', false); actors.push(ambiguous);
  const anonymous = await payExportRequest(payExportPath(f.company, f.id));
  assert.equal(anonymous.status, 401); assertNoPayAttachment(anonymous);
  for (const actor of actors) {
    const response = await payExportRequest(payExportPath(f.company, f.id), actor);
    assert.equal(response.status, 403); assertNoPayAttachment(response); assert.deepEqual(JSON.parse(response.body), payExportDeniedBody);
  }
  assert.deepEqual(await payExportAudits(f.company), []);
});

test('pay export rejects HEAD and overrides without receipts; conditional GET still returns a fresh audited CSV', async () => {
  const f = await payExportFixture();
  const head = await payExportRequest(payExportPath(f.company, f.id), f.owner, 'HEAD');
  assert.equal(head.status, 405); assert.equal(head.body, ''); assert.equal(head.headers.get('allow'), 'GET'); assertNoPayAttachment(head);
  for (const suffix of ['?role=owner', '?fields=employee_id', '?action=payroll.read', `?company_id=${randomUUID()}`]) {
    const response = await payExportRequest(payExportPath(f.company, f.id) + suffix, f.owner);
    assert.equal(response.status, 400); assertNoPayAttachment(response);
    assert.deepEqual(JSON.parse(response.body), { error: 'Unable to complete this request. Please try again.', code: 'SENSITIVE_REQUEST_INVALID' });
  }
  for (const [company, id] of [['not-a-company', f.id], [f.company, 'not-a-record'], [f.company, '00000000-0000-0000-0000-000000000000']]) {
    const response = await payExportRequest(payExportPath(company!, id!), f.owner);
    assert.equal(response.status, 400); assertNoPayAttachment(response);
  }
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const response = await payExportRequest(payExportPath(f.company, f.id), f.owner, method);
    assert.equal(response.status, 404); assertNoPayAttachment(response);
  }
  assert.deepEqual(await payExportAudits(f.company), []);
  const response = await payExportRequest(payExportPath(f.company, f.id), f.owner, 'GET', { 'if-none-match': '*', 'if-modified-since': 'Thu, 01 Jan 2099 00:00:00 GMT' });
  assert.equal(response.status, 200); assert.equal(response.body, expectedPayCsv(f.date, f.amount)); assert.equal(response.headers.get('etag'), null);
  assert.equal((await payExportAudits(f.company)).length, 1);
});

test('pay export rechecks revocation and demotion to reader or approver after acquiring the company lock', async () => {
  for (const next of ['inactive', 'payroll_reader', 'payroll_approver']) {
    const f = await payExportFixture(), actor = 'synthetic-export-race-' + randomUUID(); await addMember(f.company, actor, 'payroll_preparer');
    const blocker = await admin.connect(); let pending: ReturnType<typeof payExportRequest> | undefined;
    try {
      await blocker.query('BEGIN'); const { rows: [{ pid }] } = await blocker.query('SELECT pg_backend_pid() pid');
      await blocker.query('SELECT id FROM public.companies WHERE id=$1 FOR UPDATE', [f.company]);
      pending = payExportRequest(payExportPath(f.company, f.id), actor);
      const deadline = Date.now() + 5000; let waiting = false;
      while (Date.now() < deadline) {
        waiting = (await admin.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='ledgerly_api' AND $1::int=ANY(pg_blocking_pids(pid))) waiting", [pid])).rows[0].waiting;
        if (waiting) break; await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true);
      if (next === 'inactive') await blocker.query('UPDATE public.company_users SET is_active=false WHERE company_id=$1 AND user_id=$2', [f.company, actor]);
      else await blocker.query("UPDATE public.company_users SET role=$3 WHERE company_id=$1 AND user_id=$2", [f.company, actor, next]);
      await blocker.query('COMMIT'); const response = await pending;
      assert.equal(response.status, 403); assertNoPayAttachment(response); assert.deepEqual(JSON.parse(response.body), payExportDeniedBody);
      assert.deepEqual(await payExportAudits(f.company), []);
    } finally { await blocker.query('ROLLBACK'); blocker.release(); if (pending) await pending; }
  }
});

test('pay export audit exceptions and silent receipt suppression prevent CSV and success evidence', async () => {
  for (const failure of ['exception', 'skip']) {
    const f = await payExportFixture(), before = await sensitiveAudit(f.company);
    await admin.query(`CREATE FUNCTION public.synthetic_payroll_export_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.company_id='${f.company}'::uuid AND NEW.capability='payroll.export' THEN ${failure === 'skip' ? 'RETURN NULL;' : "RAISE EXCEPTION 'synthetic-private-export-diagnostic';"} END IF; RETURN NEW; END $$`);
    await admin.query('CREATE TRIGGER synthetic_payroll_export_audit_failure BEFORE INSERT ON public.accounting_audit_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_payroll_export_audit_failure()');
    try {
      const response = await payExportRequest(payExportPath(f.company, f.id), f.owner);
      assert.equal(response.status, 503); assertNoPayAttachment(response);
      assert.deepEqual(JSON.parse(response.body), { error: 'Unable to complete this request. Please try again.', code: 'SENSITIVE_OPERATION_UNAVAILABLE' });
      assert.deepEqual(await sensitiveAudit(f.company), before); assert.equal(JSON.stringify(logs).includes('synthetic-private-export-diagnostic'), false);
    } finally {
      await admin.query('DROP TRIGGER synthetic_payroll_export_audit_failure ON public.accounting_audit_events');
      await admin.query('DROP FUNCTION public.synthetic_payroll_export_audit_failure()');
    }
  }
});

test('pay export refuses unsafe record storage and unprotected audit before disclosure then recovers', async () => {
  const f = await payExportFixture();
  const unavailable = async () => {
    const response = await payExportRequest(payExportPath(f.company, f.id), f.owner);
    assert.equal(response.status, 503); assertNoPayAttachment(response);
    assert.deepEqual(JSON.parse(response.body), { error: 'Unable to complete this request. Please try again.', code: 'SENSITIVE_OPERATION_UNAVAILABLE' });
    assert.deepEqual(await payExportAudits(f.company), []);
  };
  await admin.query('GRANT UPDATE(annual_salary_pence) ON public.employee_pay_records TO ledgerly_api');
  try { await unavailable(); } finally { await admin.query('REVOKE UPDATE(annual_salary_pence) ON public.employee_pay_records FROM ledgerly_api'); }
  await admin.query('ALTER TABLE public.accounting_audit_events DISABLE TRIGGER ledgerly_accounting_audit_events_guard');
  try { await unavailable(); } finally { await admin.query('ALTER TABLE public.accounting_audit_events ENABLE ALWAYS TRIGGER ledgerly_accounting_audit_events_guard'); }
  const response = await payExportRequest(payExportPath(f.company, f.id), f.owner);
  assert.equal(response.status, 200); assert.equal(response.body, expectedPayCsv(f.date, f.amount)); assert.equal((await payExportAudits(f.company)).length, 1);
});

const bankDetailsPath = (company: string, employee: string) => `/${company}/payroll-bank-details/${employee}`;
const bankReadAudits = async (company: string) => (await sensitiveAudit(company)).filter(row => row.action === 'sensitive_access' && row.capability === 'payroll.bank.read');
const bankDeniedBody = { error: 'Unable to complete this request. Please try again.', code: 'SENSITIVE_ACCESS_DENIED' };
const bankUnavailableBody = { error: 'Unable to complete this request. Please try again.', code: 'SENSITIVE_OPERATION_UNAVAILABLE' };
async function bankDetailsFixture(account = '00123456', employee: string = randomUUID()) {
  const f = await fixture();
  await admin.query('INSERT INTO public.employee_bank_details(company_id,employee_id,account_number) VALUES($1,$2,$3)', [f.company, employee, account]);
  return { ...f, employee, account };
}
async function bankDetailsRequest(path: string, actor?: string, method = 'GET', headers: Record<string, string> = {}) {
  const response = await fetch(base + path, { method, headers: { ...(actor ? { 'x-test-actor': actor } : {}), ...headers } });
  return { status: response.status, body: await response.text(), headers: response.headers };
}

test('native bank lookup returns full digits only to owner/preparer and last four to approver with redacted distinct receipts', async () => {
  const f = await bankDetailsFixture('00123456', '00000000-0000-0000-0000-000000000001');
  for (const role of ['owner', 'payroll_preparer', 'payroll_approver']) {
    const actor = role === 'owner' ? f.owner : 'synthetic-bank-role-' + randomUUID();
    if (role !== 'owner') {
      identities.add(actor);
      assert.equal((await request(`/${f.company}/members`, 'POST', { user_id: actor, role }, f.owner)).status, 201);
    }
    const response = await bankDetailsRequest(bankDetailsPath(f.company.toUpperCase(), f.employee.toUpperCase()), actor);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('etag'), null);
    assert.deepEqual(JSON.parse(response.body), role === 'payroll_approver' ? { last_four: '3456' } : { account_number: '00123456' });
    assert.deepEqual((await bankReadAudits(f.company)).find(row => row.actor_id === actor), {
      action: 'sensitive_access', outcome: 'allowed', target_type: 'payroll_resource', target_id: f.employee,
      actor_type: 'user', actor_id: actor, capability: 'payroll.bank.read', context: { contract: 'sensitive-access.v1', role }, journal_id: null, posting_effect_id: null,
    });
  }
  assert.equal((await bankReadAudits(f.company)).length, 3); assert.deepEqual(await payReadAudits(f.company), []);
  for (const sql of ['INSERT INTO public.employee_bank_details SELECT * FROM public.employee_bank_details WHERE false',
    'UPDATE public.employee_bank_details SET account_number=account_number WHERE false', 'DELETE FROM public.employee_bank_details WHERE false', 'TRUNCATE public.employee_bank_details'])
    await assert.rejects(() => pool.query(sql), (error: any) => error.code === '42501');
  // Kept for independent populated restore to verify both full and masked projections.
});

test('bank employee UUIDs accept native variants and exact account strings retain zeros without exposing extra fields', async () => {
  for (const employee of ['00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-ffff-ffff-ffffffffffff']) {
    const f = await bankDetailsFixture('00000000', employee), approver = 'synthetic-bank-zero-' + randomUUID();
    await addMember(f.company, approver, 'payroll_approver');
    const full = await bankDetailsRequest(bankDetailsPath(f.company, employee.toUpperCase()), f.owner);
    assert.equal(full.status, 200); assert.deepEqual(JSON.parse(full.body), { account_number: '00000000' });
    const masked = await bankDetailsRequest(bankDetailsPath(f.company, employee), approver);
    assert.equal(masked.status, 200); assert.deepEqual(JSON.parse(masked.body), { last_four: '0000' });
  }
});

test('bank lookup scopes the same employee reference to its company and denies missing or foreign rows identically', async () => {
  const f = await bankDetailsFixture(), other = await bankDetailsFixture('87654321', f.employee);
  await addMember(other.company, f.owner, 'payroll_approver');
  const full = await bankDetailsRequest(bankDetailsPath(f.company, f.employee), f.owner);
  const masked = await bankDetailsRequest(bankDetailsPath(other.company, f.employee), f.owner);
  assert.equal(full.status, 200); assert.deepEqual(JSON.parse(full.body), { account_number: f.account });
  assert.equal(masked.status, 200); assert.deepEqual(JSON.parse(masked.body), { last_four: '4321' });
  for (const [company, employee, actor] of [[f.company, f.employee, other.owner], [other.company, randomUUID(), f.owner], [randomUUID(), f.employee, f.owner]]) {
    const response = await bankDetailsRequest(bankDetailsPath(company!, employee!), actor!);
    assert.equal(response.status, 403); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.deepEqual(JSON.parse(response.body), bankDeniedBody);
  }
  assert.equal((await bankReadAudits(f.company)).length, 1); assert.equal((await bankReadAudits(other.company)).length, 1);
});

test('payroll readers and all unrelated, inactive, unknown, ambiguous or unauthenticated memberships receive no bank fields or receipts', async () => {
  const f = await bankDetailsFixture(), other = await fixture(), actors = [other.owner];
  for (const role of ['payroll_reader', 'admin', 'accountant', 'staff', 'member', 'read_only', 'personal_tax_preparer', 'personal_tax_submitter', 'unknown', null]) {
    const actor = 'synthetic-bank-denied-' + randomUUID(); await addMember(f.company, actor, role); actors.push(actor);
  }
  for (const active of [false, null]) {
    const actor = 'synthetic-bank-inactive-' + randomUUID(); await addMember(f.company, actor, 'payroll_preparer', active); actors.push(actor);
  }
  const ambiguous = 'synthetic-bank-ambiguous-' + randomUUID();
  await addMember(f.company, ambiguous, 'payroll_approver'); await addMember(f.company, ambiguous, 'owner', false); actors.push(ambiguous);
  const anonymous = await bankDetailsRequest(bankDetailsPath(f.company, f.employee));
  assert.equal(anonymous.status, 401); assert.equal(anonymous.headers.get('cache-control'), 'no-store');
  for (const actor of actors) {
    const response = await bankDetailsRequest(bankDetailsPath(f.company, f.employee), actor);
    assert.equal(response.status, 403); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.deepEqual(JSON.parse(response.body), bankDeniedBody);
  }
  assert.deepEqual(await bankReadAudits(f.company), []);
});

test('bank routes reject implicit HEAD, malformed scope and overrides; no collection/export/mutation exists', async () => {
  const f = await bankDetailsFixture();
  const head = await bankDetailsRequest(bankDetailsPath(f.company, f.employee), f.owner, 'HEAD');
  assert.equal(head.status, 405); assert.equal(head.body, ''); assert.equal(head.headers.get('allow'), 'GET'); assert.equal(head.headers.get('cache-control'), 'no-store');
  for (const suffix of ['?role=owner', '?fields=account_number', '?action=payroll.read', `?company_id=${randomUUID()}`, '?masked=false']) {
    const response = await bankDetailsRequest(bankDetailsPath(f.company, f.employee) + suffix, f.owner);
    assert.equal(response.status, 400); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(JSON.parse(response.body), { error: 'Unable to complete this request. Please try again.', code: 'SENSITIVE_REQUEST_INVALID' });
  }
  for (const [company, employee] of [['not-company', f.employee], [f.company, 'not-employee'], [f.company, encodeURIComponent(f.employee + '\n')],
    ['00000000-0000-0000-0000-000000000000', f.employee]]) {
    const response = await bankDetailsRequest(bankDetailsPath(company!, employee!), f.owner);
    assert.equal(response.status, 400); assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await bankDetailsRequest(bankDetailsPath(f.company, f.employee), f.owner, method);
    assert.equal(response.status, 404); assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  for (const path of [`/${f.company}/payroll-bank-details`, bankDetailsPath(f.company, f.employee) + '/export.csv']) {
    const response = await bankDetailsRequest(path, f.owner);
    assert.equal(response.status, 404); assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.deepEqual(await bankReadAudits(f.company), []);
  const fresh = await bankDetailsRequest(bankDetailsPath(f.company, f.employee), f.owner, 'GET', { 'if-none-match': '*' });
  assert.equal(fresh.status, 200); assert.deepEqual(JSON.parse(fresh.body), { account_number: f.account }); assert.equal(fresh.headers.get('etag'), null);
  assert.equal((await bankReadAudits(f.company)).length, 1);
});

test('bank read projection rechecks preparer revocation and approver/reader demotion after the company lock', async () => {
  for (const next of ['inactive', 'payroll_reader', 'payroll_approver']) {
    const f = await bankDetailsFixture(), actor = 'synthetic-bank-race-' + randomUUID(); await addMember(f.company, actor, 'payroll_preparer');
    const blocker = await admin.connect(); let pending: ReturnType<typeof bankDetailsRequest> | undefined;
    try {
      await blocker.query('BEGIN'); const { rows: [{ pid }] } = await blocker.query('SELECT pg_backend_pid() pid');
      await blocker.query('SELECT id FROM public.companies WHERE id=$1 FOR UPDATE', [f.company]);
      pending = bankDetailsRequest(bankDetailsPath(f.company, f.employee), actor);
      const deadline = Date.now() + 5000; let waiting = false;
      while (Date.now() < deadline) {
        waiting = (await admin.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='ledgerly_api' AND $1::int=ANY(pg_blocking_pids(pid))) waiting", [pid])).rows[0].waiting;
        if (waiting) break; await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true);
      if (next === 'inactive') await blocker.query('UPDATE public.company_users SET is_active=false WHERE company_id=$1 AND user_id=$2', [f.company, actor]);
      else await blocker.query('UPDATE public.company_users SET role=$3 WHERE company_id=$1 AND user_id=$2', [f.company, actor, next]);
      await blocker.query('COMMIT'); const response = await pending; assert.equal(response.headers.get('cache-control'), 'no-store');
      if (next === 'payroll_approver') {
        assert.equal(response.status, 200); assert.deepEqual(JSON.parse(response.body), { last_four: '3456' });
        assert.deepEqual((await bankReadAudits(f.company)).map(row => row.context.role), ['payroll_approver']);
      } else {
        assert.equal(response.status, 403); assert.deepEqual(JSON.parse(response.body), bankDeniedBody); assert.deepEqual(await bankReadAudits(f.company), []);
      }
    } finally { await blocker.query('ROLLBACK'); blocker.release(); if (pending) await pending; }
  }
});

test('bank audit exceptions or silently skipped receipts prevent both full and masked disclosure with no successful read receipt', async () => {
  for (const failure of ['exception', 'skip']) {
    const f = await bankDetailsFixture(), approver = 'synthetic-bank-fault-' + randomUUID(); await addMember(f.company, approver, 'payroll_approver');
    const before = await sensitiveAudit(f.company);
    await admin.query(`CREATE FUNCTION public.synthetic_bank_read_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.company_id='${f.company}'::uuid AND NEW.capability='payroll.bank.read' THEN ${failure === 'skip' ? 'RETURN NULL;' : "RAISE EXCEPTION 'synthetic-private-bank-diagnostic';"} END IF; RETURN NEW; END $$`);
    await admin.query('CREATE TRIGGER synthetic_bank_read_audit_failure BEFORE INSERT ON public.accounting_audit_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_bank_read_audit_failure()');
    try {
      for (const actor of [f.owner, approver]) {
        const response = await bankDetailsRequest(bankDetailsPath(f.company, f.employee), actor);
        assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.deepEqual(JSON.parse(response.body), bankUnavailableBody);
        assert.deepEqual(await sensitiveAudit(f.company), before);
      }
      assert.equal(JSON.stringify(logs).includes('synthetic-private-bank-diagnostic'), false);
      assert.deepEqual((await pool.query('SELECT account_number FROM public.employee_bank_details WHERE company_id=$1 AND employee_id=$2', [f.company, f.employee])).rows, [{ account_number: f.account }]);
    } finally {
      await admin.query('DROP TRIGGER synthetic_bank_read_audit_failure ON public.accounting_audit_events');
      await admin.query('DROP FUNCTION public.synthetic_bank_read_audit_failure()');
    }
  }
});

test('bank reads refuse absent storage, column-only mutation grants and unprotected audit then recover', async () => {
  const f = await bankDetailsFixture();
  const unavailable = async () => {
    const response = await bankDetailsRequest(bankDetailsPath(f.company, f.employee), f.owner);
    assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.deepEqual(JSON.parse(response.body), bankUnavailableBody);
    assert.deepEqual(await bankReadAudits(f.company), []);
  };
  await admin.query('ALTER TABLE public.employee_bank_details RENAME TO synthetic_missing_bank_details');
  try { await unavailable(); } finally { await admin.query('ALTER TABLE public.synthetic_missing_bank_details RENAME TO employee_bank_details'); }
  for (const privilege of ['INSERT', 'UPDATE']) {
    await admin.query(`GRANT ${privilege}(account_number) ON public.employee_bank_details TO ledgerly_api`);
    try { await unavailable(); } finally { await admin.query(`REVOKE ${privilege}(account_number) ON public.employee_bank_details FROM ledgerly_api`); }
  }
  await admin.query('ALTER TABLE public.accounting_audit_events DISABLE TRIGGER ledgerly_accounting_audit_events_guard');
  try { await unavailable(); } finally { await admin.query('ALTER TABLE public.accounting_audit_events ENABLE ALWAYS TRIGGER ledgerly_accounting_audit_events_guard'); }
  const response = await bankDetailsRequest(bankDetailsPath(f.company, f.employee), f.owner);
  assert.equal(response.status, 200); assert.deepEqual(JSON.parse(response.body), { account_number: f.account }); assert.equal((await bankReadAudits(f.company)).length, 1);
});

test('bank storage enforces exactly eight ASCII digits and unique company employee while preserving native UUID values', async () => {
  const f = await bankDetailsFixture();
  for (const account of ['1234567', '123456789', '-1234567', '+1234567', '1234 678', '１２３４５６７８', '12345678\n', ' 12345678', '12345678 '])
    await assert.rejects(() => admin.query('INSERT INTO public.employee_bank_details(company_id,employee_id,account_number) VALUES($1,$2,$3)',
      [f.company, randomUUID(), account]), (error: any) => error.code === '23514');
  await assert.rejects(() => admin.query('INSERT INTO public.employee_bank_details(company_id,employee_id,account_number) VALUES($1,$2,NULL)',
    [f.company, randomUUID()]), (error: any) => error.code === '23502');
  await assert.rejects(() => admin.query('INSERT INTO public.employee_bank_details(company_id,employee_id,account_number) VALUES($1,$2,$3)',
    [f.company, f.employee, '12345678']), (error: any) => error.code === '23505');
  assert.deepEqual(await bankReadAudits(f.company), []);
});
