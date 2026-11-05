import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { retiredChartBootstrapBoundary } from "./legacyChartBootstrapPolicy";
import { genericEntityWriteBoundary } from "./entityWritePolicy";

test("retired chart bootstrap cannot reach a data handler for any authenticated caller or body", async () => {
  const app = express();
  // Even an upstream parser allowing null/primitive JSON cannot bypass retirement.
  app.use(express.json({ strict: false }));
  let dataCalls = 0;
  app.use((req, res, next) => {
    if (!req.get("x-test-actor")) { res.sendStatus(401); return; }
    next();
  });
  app.post("/functions/:name", retiredChartBootstrapBoundary, (_req, res) => {
    dataCalls += 1;
    res.status(500).json({ error: "A retired action must not touch data" });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/functions/createDefaultAccounts`;
  try {
    const unauthenticated = await fetch(url, { method: "POST" });
    assert.equal(unauthenticated.status, 401);
    for (const actor of ["owner", "admin", "accountant", "read_only", "outsider"]) {
      for (const body of [undefined, null, {}, { company_id: "arbitrary-other-company", role: "owner" }]) {
        const response = await fetch(url, {
          method: "POST",
          headers: { "x-test-actor": actor, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        assert.equal(response.status, 410);
        const result = await response.json() as { code: string; error: string };
        assert.equal(result.code, "LEGACY_CHART_BOOTSTRAP_RETIRED");
        assert.match(result.error, /native Chart of Accounts/);
      }
    }
    assert.equal(dataCalls, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("retirement leaves unrelated functions reachable and preserves generic financial write guards", async () => {
  const app = express();
  let unrelatedCalls = 0, financialWrites = 0;
  app.post("/functions/:name", retiredChartBootstrapBoundary, (req, res) => {
    unrelatedCalls += 1;
    res.json({ name: req.params.name });
  });
  app.use("/entities/:entity", genericEntityWriteBoundary, (_req, res) => {
    financialWrites += 1;
    res.sendStatus(204);
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const name of ["getUserCompanies", "suggestTransactionMatches", "askAI", "unknownFunction"]) {
      const response = await fetch(`${base}/functions/${name}`, { method: "POST" });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { name });
    }
    for (const entity of ["ChartOfAccount", "JournalEntry", "JournalLine"]) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        const response = await fetch(`${base}/entities/${entity}`, { method });
        assert.equal(response.status, 403);
      }
    }
    assert.equal(unrelatedCalls, 4);
    assert.equal(financialWrites, 0);
    assert.equal((await fetch(`${base}/entities/JournalEntry`)).status, 204);
    assert.equal(financialWrites, 1, "Journal history reads remain available");
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
