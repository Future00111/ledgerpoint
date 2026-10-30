import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { publicErrorMessage, safeErrorLog, safeRouteErrors } from "./publicErrors";

test("safe errors retain fixed business guidance and redact database/provider/auth diagnostics", () => {
  for (const message of ["VAT rate must be between 0 and 100", "Invoice not found", "This transaction has already been reconciled", "This reminder must be approved with its current content before it can be marked as sent"]) {
    assert.equal(publicErrorMessage(new Error(message), "Try again"), message);
    assert.deepEqual(safeErrorLog(new Error(message)), { error_code: "business_rule" });
  }
  for (const secret of ["postgres://secret:password@host/db", "SELECT * FROM customers WHERE email='private@example.test'", "Authorization: Bearer private-token", "Invoice not found: private-id", "upstream response: private document"]) {
    const error = Object.assign(new Error(secret, { cause: new Error(secret) }), { query: secret, response: secret, code: secret });
    assert.equal(publicErrorMessage(error, "Try again"), "Try again");
    assert.deepEqual(safeErrorLog(error), { error_code: "unexpected_error" });
    assert.equal(JSON.stringify(safeErrorLog(error)).includes(secret), false);
  }
  for (const error of [null, undefined, "Invoice not found", { message: "Invoice not found" }]) {
    assert.equal(publicErrorMessage(error, "Try again"), "Try again");
  }
});

test("unhandled async route failures expose neither stack traces nor raw diagnostics in response or log", async () => {
  const logs: unknown[] = [];
  const app = express();
  app.use((req, _res, next) => { (req as any).log = { error: (...args: unknown[]) => logs.push(args) }; next(); });
  app.get("/failure", async () => { throw new Error("private-sql-and-credential"); });
  app.use(safeRouteErrors);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/failure`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Unable to complete this request. Please try again." });
    assert.equal(JSON.stringify(logs).includes("private-sql-and-credential"), false);
    assert.deepEqual(logs, [[{ error_code: "unexpected_error" }, "Request failed"]]);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
