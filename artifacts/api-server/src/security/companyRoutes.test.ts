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
