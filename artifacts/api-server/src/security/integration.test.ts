import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import pg from "pg";
import { pool } from "@workspace/db";
import { createCompaniesRouter } from "../routes/companies";

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
