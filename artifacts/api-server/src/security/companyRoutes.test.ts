import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createCompaniesRouter } from "../routes/companies";

test("company endpoints reject unauthenticated requests and invalid roles before database or identity work", async () => {
  let identityCalls = 0;
  const identities = {
    async byId() { identityCalls++; throw new Error("Identity provider must not be called"); },
    async byEmail() { identityCalls++; throw new Error("Identity provider must not be called"); },
  };
  const app = express(); app.use(express.json({ strict: false }));
  app.use(createCompaniesRouter((req, res, next) => {
    if (!req.get("x-test-actor")) { res.sendStatus(401); return; }
    (req as any).userId = "synthetic-owner"; next();
  }, identities));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const paths = [
    ["/company/members", "POST", { user_id: "synthetic-user" }],
    ["/company/members/synthetic-user", "PUT", {}],
    ["/company/invite", "POST", { email: "synthetic@example.test" }],
  ] as const;
  try {
    for (const [path, method, body] of paths) {
      assert.equal((await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, role: "owner" }) })).status, 401);
      for (const role of [null, "unknown", "OWNER", "owner ", {}, ["owner"], 1]) {
        const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "x-test-actor": "synthetic-owner" }, body: JSON.stringify({ ...body, role }) });
        assert.equal(response.status, 400, `${method} ${path}: ${JSON.stringify(role)}`);
        assert.deepEqual(await response.json(), { error: "Choose a valid company role" });
      }
    }
    for (const body of [null, { name: "Synthetic", id: "injected-id" }, { name: "Synthetic", role: "owner" }, { name: " " }]) {
      const response = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json", "x-test-actor": "synthetic-owner" }, body: JSON.stringify(body) });
      assert.equal(response.status, 400);
    }
    assert.equal(identityCalls, 0);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

// Exercise the real legacy router with only its authentication adapter replaced.
// No database/provider is configured: retired actions must stop before any side effect.
test("legacy settlement cannot mutate invoice or bill balances, regardless of role or supplied company", async () => {
  // Import-only synthetic credential satisfies the legacy provider constructor;
  // replace completion with a tripwire before exercising any HTTP request.
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-no-provider-access";
  const { createFunctionsRouter } = await import("../routes/functions");
  const { aiService } = await import("../services/ai/index");
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
  let providerCalls = 0;
  const previousComplete = aiService.complete;
  aiService.complete = async () => { providerCalls++; throw new Error("Provider must never be called"); };
  const app = express(); app.use(express.json());
  app.use(createFunctionsRouter((req, res, next) => {
    if (!req.get("x-test-actor")) { res.sendStatus(401); return; }
    (req as any).userId = req.get("x-test-actor"); next();
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  try {
    for (const actor of [undefined, "synthetic-owner", "synthetic-viewer", "synthetic-inactive", "synthetic-other-company"]) {
      for (const entity_type of ["sales_invoice", "purchase_bill", "unknown"]) {
        const response = await fetch(`http://127.0.0.1:${address.port}/updatePaymentStatus`, {
          method: "POST", headers: { "Content-Type": "application/json", ...(actor ? { "x-test-actor": actor } : {}) },
          body: JSON.stringify({ entity_type, record_id: "synthetic-record", company_id: "synthetic-other-company", amount_paid_delta: 10 }),
        });
        assert.equal(response.status, actor ? 403 : 401, `${actor}: ${entity_type}`);
        if (actor) {
          const body: unknown = await response.json();
          assert.ok(body && typeof body === "object" && "error" in body && typeof body.error === "string");
          assert.match(body.error, /protected native accounting/);
        }
      }
    }
    assert.equal(providerCalls, 0);
  } finally {
    aiService.complete = previousComplete;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

// Keep this at the HTTP boundary: a user can belong to both companies, so
// membership alone cannot make a delayed request from the old workspace safe.
test("legacy bank mutations reject contradictory or malformed caller company before membership or writes", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-no-provider-access";
  const { createFunctionsRouter } = await import("../routes/functions");
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
  const { db } = await import("@workspace/db");
  const { bankTransactionsTable, companyUsersTable } = await import("@workspace/db/schema");
  const originalSelect = db.select, originalTransaction = db.transaction;
  let membershipReads = 0, writes = 0;
  // No actual database is configured or contacted. Only the target bank record
  // and an active viewer membership may be read; all other access is a tripwire.
  db.select = (() => ({ from(table: unknown) {
    if (table === bankTransactionsTable) return { where: () => ({ limit: async () => [{ id: "bank-row", company_id: "company-a" }] }) };
    assert.equal(table, companyUsersTable);
    membershipReads++;
    return { where: async () => [{ company_id: "company-a", user_id: "synthetic-viewer", role: "read_only", is_active: true }] };
  } })) as unknown as typeof db.select;
  db.transaction = (async () => { writes++; throw new Error("Write must never be reached"); }) as typeof db.transaction;
  const app = express(); app.use(express.json());
  app.use(createFunctionsRouter((req, _res, next) => { (req as any).userId = "synthetic-viewer"; next(); }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const actions = [
    ["approveReconciliationMatches", { records: [{ record_type: "sales_invoice", record_id: "invoice" }] }],
    ["approveNonPaymentReconciliationMatch", { record_type: "ledger_account", record_id: "ledger" }],
    ["recordBankTransfer", { to_account_id: "bank-destination", amount: 10 }],
    ["updateBankTransactionClassification", { description: "Synthetic" }],
  ] as const;
  try {
    for (const [name, extra] of actions) {
      for (const company_id of ["company-b", null, "", {}, ["company-a"], 12]) {
        const beforeReads = membershipReads;
        const response = await fetch(`http://127.0.0.1:${address.port}/${name}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bank_transaction_id: "bank-row", ...extra, company_id }),
        });
        assert.equal(response.status, company_id === "company-b" ? 403 : 400, `${name}: ${JSON.stringify(company_id)}`);
        assert.equal(membershipReads, beforeReads, "invalid context must fail before membership lookup");
      }
      for (const company_id of [undefined, "company-a"]) {
        const beforeReads = membershipReads;
        const response = await fetch(`http://127.0.0.1:${address.port}/${name}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bank_transaction_id: "bank-row", ...extra, company_id }),
        });
        assert.equal(response.status, 403, `${name}: viewer cannot mutate`);
        assert.equal(membershipReads, beforeReads + 1, "omitted or matching context still checks resource membership");
      }
    }
    assert.equal(writes, 0);
  } finally {
    db.select = originalSelect; db.transaction = originalTransaction;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("generic entity reads bind explicit workspace context and recheck active membership while preserving viewer reads", async () => {
  const { createEntitiesRouter } = await import("../routes/entities");
  const { db } = await import("@workspace/db");
  const { customersTable, companiesTable, companyUsersTable } = await import("@workspace/db/schema");
  const originalSelect = db.select;
  let membershipReads = 0;
  let active = true;
  let membershipCompany = "company-a";
  let hasMembership = true;
  db.select = (() => ({ from(table: unknown) {
    if (table === customersTable) return { where: () => ({ limit: async () => [{ id: "customer", company_id: "company-a", name: "Synthetic" }] }) };
    if (table === companiesTable) return { where: () => ({ limit: async () => [{ id: "company-a", name: "Synthetic company" }] }) };
    assert.equal(table, companyUsersTable);
    return { where: async () => {
      membershipReads++;
      return hasMembership ? [{ company_id: membershipCompany, user_id: "synthetic-viewer", role: "read_only", is_active: active }] : [];
    } };
  } })) as unknown as typeof db.select;
  const app = express();
  app.use(createEntitiesRouter((req, res, next) => {
    if (!req.get("x-test-actor")) { res.sendStatus(401); return; }
    (req as any).userId = "synthetic-viewer"; next();
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const get = (path: string) => fetch(base + path, { headers: { "x-test-actor": "synthetic-viewer" } });
  try {
    for (const path of ["/Customer/customer", "/Company/company-a"]) {
      for (const query of ["", "?company_id=company-a"]) {
        const response = await get(path + query);
        assert.equal(response.status, 200, path + query);
        assert.match(await response.text(), /Synthetic/);
      }
      for (const [query, status] of [["?company_id=company-b", 403], ["?company_id=", 400], ["?company_id=company-a&company_id=company-b", 400]] as const) {
        const before = membershipReads;
        const response = await get(path + query);
        assert.equal(response.status, status, path + query);
        assert.doesNotMatch(await response.text(), /Synthetic/);
        assert.equal(membershipReads, before + 1, "context rejected before resource membership recheck");
      }
      active = false;
      assert.equal((await get(path)).status, 403, "inactive resource membership fails closed");
      active = true; membershipCompany = "company-b";
      assert.equal((await get(path)).status, 403, "foreign membership cannot read record");
      membershipCompany = "company-a"; hasMembership = false;
      assert.equal((await get(path)).status, 403, "no membership cannot read record");
      hasMembership = true;
      assert.equal((await fetch(base + path)).status, 401);
    }
  } finally {
    db.select = originalSelect;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("generic lists and deletes honor selected company without broadening malformed context", async () => {
  const { createEntitiesRouter } = await import("../routes/entities");
  const { db } = await import("@workspace/db");
  const { customersTable, companiesTable, companyUsersTable } = await import("@workspace/db/schema");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  const originalSelect = db.select, originalDelete = db.delete;
  let role = "owner", membership = true, deletes = 0, reads = 0;
  let listScope: unknown[] = [];
  db.select = (() => ({ from(table: unknown) {
    if (table === companyUsersTable) return { where: async (condition: any) => {
      if (!membership) return [];
      const params = dialect.sqlToQuery(condition).params;
      const selected = params.includes("company-a") ? "company-a" : params.includes("company-b") ? "company-b" : null;
      return (selected ? [selected] : ["company-a", "company-b"]).map(company_id => ({ company_id, user_id: "synthetic-owner", role, is_active: true }));
    } };
    assert.ok(table === customersTable || table === companiesTable);
    return {
      where: () => ({ limit: async () => [{ id: "customer", company_id: "company-a", name: "Synthetic" }] }),
      $dynamic() {
        const query = {
          where(condition: any) { listScope = dialect.sqlToQuery(condition).params; return query; },
          orderBy() { return query; },
          limit: async () => { reads++; return []; },
        };
        return query;
      },
    };
  } })) as unknown as typeof db.select;
  db.delete = (() => ({ where: async () => { deletes++; } })) as unknown as typeof db.delete;
  const app = express();
  app.use(createEntitiesRouter((req, res, next) => {
    if (!req.get("x-test-actor")) { res.sendStatus(401); return; }
    (req as any).userId = "synthetic-owner"; next();
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const request = (path: string, method = "GET") => fetch(`http://127.0.0.1:${address.port}${path}`, { method, headers: { "x-test-actor": "synthetic-owner" } });
  try {
    for (const entity of ["Company", "Customer"]) {
      assert.equal((await request(`/${entity}`)).status, 200);
      assert.deepEqual(listScope, ["company-a", "company-b"], "omission preserves authorized multi-company compatibility");
      for (const company of ["company-a", "company-b"]) {
        assert.equal((await request(`/${entity}?company_id=${company}`)).status, 200);
        assert.deepEqual(listScope, [company], "only selected company may be listed");
      }
      for (const query of ["?company_id=", "?company_id=company-a&company_id=company-b"]) {
        const before = reads;
        assert.equal((await request(`/${entity}${query}`)).status, 400);
        assert.equal(reads, before, "malformed list scope never reads entity data");
      }
      membership = false;
      assert.equal((await request(`/${entity}?company_id=company-a`)).status, 403);
      membership = true;
    }
    for (const [query, status] of [["?company_id=company-b", 403], ["?company_id=", 400], ["?company_id=company-a&company_id=company-b", 400]] as const) {
      assert.equal((await request(`/Customer/customer${query}`, "DELETE")).status, status);
      assert.equal(deletes, 0, "both-company owner cannot delete through a contradictory workspace");
    }
    role = "read_only";
    assert.equal((await request("/Customer?company_id=company-a")).status, 200);
    assert.equal((await request("/Customer/customer?company_id=company-a", "DELETE")).status, 403);
    role = "owner"; membership = false;
    assert.equal((await request("/Customer/customer", "DELETE")).status, 403);
    assert.equal(deletes, 0);
    membership = true;
    for (const query of ["", "?company_id=company-a"]) assert.equal((await request(`/Customer/customer${query}`, "DELETE")).status, 200);
    assert.equal(deletes, 2, "only valid owner paths reached the synthetic deletion adapter");
  } finally {
    db.select = originalSelect; db.delete = originalDelete;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("generic updates preserve tenant ownership and reject stale or malformed workspace context", async () => {
  const { createEntitiesRouter } = await import("../routes/entities");
  const { db } = await import("@workspace/db");
  const { customersTable, companyUsersTable } = await import("@workspace/db/schema");
  const originalSelect = db.select, originalUpdate = db.update;
  let role = "owner", active = true, membership = true;
  const updates: Record<string, unknown>[] = [];
  db.select = (() => ({ from(table: unknown) {
    if (table === customersTable) return { where: () => ({ limit: async () => [{ id: "customer", company_id: "company-a", name: "Synthetic" }] }) };
    assert.equal(table, companyUsersTable);
    return { where: async () => membership ? [{ company_id: "company-a", user_id: "synthetic-owner", role, is_active: active }] : [] };
  } })) as unknown as typeof db.select;
  db.update = (() => ({ set(data: Record<string, unknown>) {
    updates.push(data);
    return { where: () => ({ returning: async () => [{ id: "customer", company_id: "company-a", ...data }] }) };
  } })) as unknown as typeof db.update;
  const app = express(); app.use(express.json({ strict: false }));
  app.use(createEntitiesRouter((req, res, next) => {
    if (!req.get("x-test-actor")) { res.sendStatus(401); return; }
    (req as any).userId = "synthetic-owner"; next();
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const request = (path: string, body: unknown, method = "PATCH") => fetch(`http://127.0.0.1:${address.port}${path}`, {
    method, headers: { "Content-Type": "application/json", "x-test-actor": "synthetic-owner" }, body: JSON.stringify(body),
  });
  try {
    for (const method of ["PATCH", "PUT"]) {
      for (const company_id of [null, "", "company-b", [], {}, 0, false]) {
        assert.equal((await request("/Customer/customer", { company_id, name: "Changed" }, method)).status, 400);
      }
      for (const [query, status] of [["?company_id=company-b", 403], ["?company_id=", 400], ["?company_id=company-a&company_id=company-b", 400]] as const) {
        assert.equal((await request(`/Customer/customer${query}`, { company_id: "company-a", name: "Changed" }, method)).status, status);
      }
    }
    assert.equal(updates.length, 0);
    for (const company_id of [null, "", "company-b", [], {}, 0, false]) {
      const response = await request("/Customer/bulk-update", [{ id: "customer", company_id, name: "Changed" }]);
      assert.equal(response.status, 200); assert.deepEqual(await response.json(), []);
    }
    for (const query of ["?company_id=company-b", "?company_id=", "?company_id=company-a&company_id=company-b"]) {
      const response = await request(`/Customer/bulk-update${query}`, [{ id: "customer", name: "Changed" }]);
      assert.equal(response.status, 200); assert.deepEqual(await response.json(), []);
    }
    assert.equal(updates.length, 0);
    for (const state of ["viewer", "inactive", "missing"]) {
      role = state === "viewer" ? "read_only" : "owner"; active = state !== "inactive"; membership = state !== "missing";
      assert.equal((await request("/Customer/customer", { name: "Changed" })).status, 403);
      const response = await request("/Customer/bulk-update", [{ id: "customer", name: "Changed" }]);
      assert.deepEqual(await response.json(), []);
    }
    assert.equal(updates.length, 0);
    role = "owner"; active = true; membership = true;
    for (const company_id of [undefined, "company-a"]) {
      const response = await request("/Customer/customer?company_id=company-a", { company_id, name: "Changed" });
      assert.equal(response.status, 200); assert.equal(((await response.json()) as { company_id: string }).company_id, "company-a");
      assert.equal((await request("/Customer/bulk-update?company_id=company-a", [{ id: "customer", company_id, name: "Changed" }])).status, 200);
    }
    assert.equal(updates.length, 4);
    for (const update of updates) { assert.equal(Object.hasOwn(update, "company_id"), false); assert.equal(Object.hasOwn(update, "id"), false); }
  } finally {
    db.select = originalSelect; db.update = originalUpdate;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("generic creates reject malformed or contradictory company context before membership and insert", async () => {
  const { createEntitiesRouter } = await import("../routes/entities");
  const { db } = await import("@workspace/db");
  const { customersTable, companyUsersTable } = await import("@workspace/db/schema");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  const originalSelect = db.select, originalInsert = db.insert;
  let reads = 0, role = "owner", active = true, membership = true;
  const inserts: unknown[] = [];
  db.select = (() => ({ from(table: unknown) {
    assert.equal(table, companyUsersTable);
    return { where: async (condition: any) => {
      reads++;
      const params = dialect.sqlToQuery(condition).params;
      // Both companies are authorized: a mismatch must be rejected by context,
      // rather than accidentally passing because one membership exists.
      const company_id = params.includes("company-b") ? "company-b" : "company-a";
      return membership ? [{ company_id, user_id: "synthetic-owner", role, is_active: active }] : [];
    } };
  } })) as unknown as typeof db.select;
  db.insert = ((table: unknown) => {
    assert.equal(table, customersTable);
    return { values(value: unknown) {
      inserts.push(value);
      return { returning: async () => Array.isArray(value) ? value : [value] };
    } };
  }) as unknown as typeof db.insert;
  const app = express(); app.use(express.json({ strict: false }));
  app.use(createEntitiesRouter((req, res, next) => {
    if (!req.get("x-test-actor")) { res.sendStatus(401); return; }
    (req as any).userId = "synthetic-owner"; next();
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const create = (path: string, body: unknown, authenticated = true) => fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { "x-test-actor": "synthetic-owner" } : {}) }, body: JSON.stringify(body),
  });
  try {
    for (const bulk of [false, true]) {
      const path = bulk ? "/Customer/bulk" : "/Customer";
      const wrap = (record: unknown) => bulk ? [record] : record;
      const beforeReads = reads;
      for (const company_id of [undefined, null, "", "  ", [], {}, 12, false]) {
        assert.equal((await create(path, wrap({ name: "Synthetic", company_id }))).status, 400);
      }
      for (const invalid of [null, [], "value", 12, false]) {
        assert.equal((await create(path, wrap(invalid))).status, 400);
      }
      for (const [query, expected] of [["?company_id=company-b", 403], ["?company_id=", 400], ["?company_id=company-a&company_id=company-b", 400]] as const) {
        assert.equal((await create(path + query, wrap({ company_id: "company-a", name: "Synthetic" }))).status, expected);
      }
      assert.equal(reads, beforeReads, "malformed and contradictory context must not trigger membership queries");
      const beforeInserts = inserts.length;
      for (const state of ["viewer", "inactive", "missing"]) {
        role = state === "viewer" ? "read_only" : "owner";
        active = state !== "inactive"; membership = state !== "missing";
        assert.equal((await create(path, wrap({ company_id: "company-a", name: "Synthetic" }))).status, 403);
      }
      assert.equal(inserts.length, beforeInserts);
      role = "owner"; active = true; membership = true;
      for (const query of ["", "?company_id=company-a"]) {
        const record = { company_id: "company-a", name: "Synthetic" };
        const response = await create(path + query, wrap(record));
        assert.equal(response.status, 201);
        assert.deepEqual(await response.json(), wrap(record));
      }
      assert.equal((await create(path, wrap({ company_id: "company-a" }), false)).status, 401);
    }
    assert.equal((await create("/Customer/bulk", [{ company_id: "company-a" }, { company_id: "company-b" }])).status, 400);
    assert.equal((await create("/Customer/bulk", [{ company_id: "company-a" }, null])).status, 400);
    assert.equal(inserts.length, 4);
    for (const entity of ["Company", "CompanyUser", "SalesInvoice", "PurchaseBill", "SalesCreditNote", "SupplierCreditNote", "JournalEntry", "VATReturn", "ChartOfAccount"]) {
      for (const suffix of ["", "/bulk"]) {
        assert.equal((await create(`/${entity}${suffix}`, { company_id: "company-a" })).status, 403);
      }
    }
    assert.equal(inserts.length, 4, "protected workflows must never reach generic inserts");
  } finally {
    db.select = originalSelect; db.insert = originalInsert;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("legacy AI rejects malformed explicit company and mismatched membership before company data or provider access", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-no-provider-access";
  const { createFunctionsRouter } = await import("../routes/functions");
  const { aiService } = await import("../services/ai/index");
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
  const { db } = await import("@workspace/db");
  const { companyUsersTable, aiReconciliationResultsTable } = await import("@workspace/db/schema");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  const originalSelect = db.select, originalComplete = aiService.complete;
  let membershipReads = 0, companyReads = 0, providerCalls = 0;
  let membership: Record<string, unknown> | null = { company_id: "company-a", user_id: "synthetic-viewer", role: "read_only", is_active: true };
  db.select = (() => ({ from(table: unknown) {
    if (table === companyUsersTable) return { where: async () => { membershipReads++; return membership ? [membership] : []; } };
    assert.equal(table, aiReconciliationResultsTable);
    return { where(condition: any) {
      assert.deepEqual(dialect.sqlToQuery(condition).params, ["company-a", "pending"]);
      return { limit: async () => { companyReads++; return []; } };
    } };
  } })) as unknown as typeof db.select;
  aiService.complete = (async () => { providerCalls++; return { provider: "synthetic", model: "synthetic", text: "Synthetic reply" }; }) as typeof aiService.complete;
  const app = express(); app.use(express.json({ strict: false }));
  app.use(createFunctionsRouter((req, res, next) => {
    if (!req.get("x-test-actor")) { res.sendStatus(401); return; }
    (req as any).userId = "synthetic-viewer"; next();
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const request = (body: unknown, authenticated = true) => fetch(`http://127.0.0.1:${address.port}/askAI`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { "x-test-actor": "synthetic-viewer" } : {}) }, body: JSON.stringify(body),
  });
  try {
    assert.equal((await request({ prompt: "Synthetic" }, false)).status, 401);
    for (const body of [null, false, 0, "text", []]) assert.equal((await request(body)).status, 400);
    for (const company_id of [null, "", false, 0, {}, [], ["company-a"]]) {
      assert.equal((await request({ company_id, prompt: "Synthetic" })).status, 400);
    }
    assert.equal(membershipReads, 0); assert.equal(companyReads, 0); assert.equal(providerCalls, 0);
    for (const row of [null,
      { company_id: "company-a", user_id: "synthetic-viewer", role: "read_only", is_active: false },
      { company_id: "company-b", user_id: "synthetic-viewer", role: "read_only", is_active: true },
      { company_id: "company-a", user_id: "other-user", role: "read_only", is_active: true },
    ]) {
      membership = row;
      assert.equal((await request({ company_id: "company-a", prompt: "Synthetic" })).status, 403);
    }
    assert.equal(companyReads, 0); assert.equal(providerCalls, 0);
    membership = { company_id: "company-a", user_id: "synthetic-viewer", role: "read_only", is_active: true };
    assert.equal((await request({ company_id: "company-a", prompt: "Synthetic" })).status, 200);
    assert.equal(companyReads, 1); assert.equal(providerCalls, 1);
    const beforeMembershipReads = membershipReads;
    assert.equal((await request({ prompt: "General synthetic question" })).status, 200);
    assert.equal(membershipReads, beforeMembershipReads); assert.equal(companyReads, 1); assert.equal(providerCalls, 2);
  } finally {
    db.select = originalSelect; aiService.complete = originalComplete;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
