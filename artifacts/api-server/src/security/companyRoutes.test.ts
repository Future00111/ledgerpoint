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
