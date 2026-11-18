import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import pg from "pg";
import { pool } from "@workspace/db";
import { createCompaniesRouter } from "../routes/companies";
import { SENSITIVE_ACTIONS, type SensitiveAction } from "./roles";
import { withPayrollAccess, SensitiveAccessError } from "../services/payroll/access/service";
import { withPersonalTaxAccess } from "../services/tax/access/service";

const socket = process.env.ACCOUNTING_FLOW_TEST_SOCKET ?? "";
if (!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]+\/socket$/.test(socket)) throw Error("Disposable socket required");
const admin = new pg.Pool({ host: socket, port: 55441, user: "w03_bootstrap", database: "ledgerly_accounting_flow_test", password: "", ssl: false, options: "" });
let server: ReturnType<ReturnType<typeof express>["listen"]>, base: string;
let identityCalls = 0;
let providerFailure = false;
const identities = new Set<string>();
const logs: unknown[] = [];
before(async () => {
  const identity = (await pool.query("SELECT current_database() db,current_user role,inet_server_addr() addr")).rows[0];
  assert.deepEqual(identity, { db: "ledgerly_accounting_flow_test", role: "ledgerly_api", addr: null });
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { (req as any).log = { error: (...args: unknown[]) => logs.push(args) }; next(); });
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
    async byEmail() { identityCalls++; throw new Error("No test is permitted to use a real email lookup"); },
  }));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end(); await admin.end();
});
async function request(path: string, method = "GET", body?: unknown, actor?: string) {
  const response = await fetch(base + path, { method, headers: {
    ...(actor ? { "x-test-actor": actor } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.text() };
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
