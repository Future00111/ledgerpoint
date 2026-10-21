import test from "node:test";
import assert from "node:assert/strict";
import { Customer, SalesInvoice } from "./entities.js";

test("native entity reads keep company filters and Clerk session cookies", async t => {
  let request;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify([]), { status: 200 });
  });

  await Customer.filter({ company_id: "company-a", status: "active" }, "-created_date", 20);
  assert.ok(request.url.startsWith("/api/entities/Customer?"));
  assert.match(request.url, /company_id=company-a/);
  assert.match(request.url, /status=active/);
  assert.equal(request.options.credentials, "include");
});

test("native generic invoice writes surface the server's protected-workflow rejection", async t => {
  let request;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    request = { url: String(url), options };
    return new Response("Use the protected invoice workflow", { status: 403 });
  });

  await assert.rejects(
    SalesInvoice.create({ company_id: "company-a", invoice_number: "INV-TEST" }),
    /Use the protected invoice workflow/,
  );
  assert.equal(request.url, "/api/entities/SalesInvoice");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.credentials, "include");
});
