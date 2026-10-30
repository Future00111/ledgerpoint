import test from "node:test";
import assert from "node:assert/strict";
import type { Express, Request, Response, NextFunction } from "express";
import { appErrorResponse, RejectedOriginError, safeAppErrors } from "./appErrors";

const secret = "private-token-and-document-body";
const generic = { status: 500, error_code: "unexpected_error", message: "Unable to complete this request. Please try again." };

async function serve(app: Express, run: (url: string) => Promise<void>) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}

async function trackedApp(logs: unknown[], action?: (req: Request, res: Response, next: NextFunction) => void | Promise<void>) {
  // The real app imports a fail-fast AI singleton even though these requests never
  // reach AI, Clerk or database routes. Supply only synthetic/unusable values and
  // restore the environment; no credential or external connection is needed.
  const settings = { NODE_ENV: "test", LOG_LEVEL: "silent", OPENAI_API_KEY: "synthetic-unused-in-app-error-tests",
    DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/ledgerpoint_no_database", W03_INVOICE_DEMO_MODE: undefined };
  const previous = new Map(Object.keys(settings).map(key => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    const { createApp } = await import("../app");
    return createApp({ beforeClerkMiddleware: (req, res, next) => {
      (req as any).log = { error: (...args: unknown[]) => logs.push(args) };
      return action ? action(req, res, next) : next();
    } });
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

async function expectError(response: globalThis.Response, status: number, message: string) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(await response.json(), { error: message });
}

test("outer error classification trusts only fixed origin and matching parser cases", () => {
  assert.deepEqual(appErrorResponse(new RejectedOriginError()), {
    status: 403, error_code: "origin_not_permitted", message: "Request origin is not permitted.",
  });
  for (const [type, status] of [["entity.parse.failed", 400], ["entity.too.large", 413],
    ["request.size.invalid", 400], ["request.aborted", 400], ["parameters.too.many", 413],
    ["charset.unsupported", 415], ["encoding.unsupported", 415]] as const) {
    const result = appErrorResponse(Object.assign(new Error(secret), { type, status, body: secret }));
    assert.equal(result.status, status);
    assert.ok(!JSON.stringify(result).includes(secret));
    assert.deepEqual(appErrorResponse(Object.assign(new Error(secret), { type, status: 418 })), generic);
  }
  for (const error of [null, undefined, secret, new SyntaxError(secret),
    { type: "entity.parse.failed", status: 400, message: secret },
    Object.assign(new Error(secret, { cause: new Error(secret) }), { status: 401, headers: { authorization: secret }, body: secret }),
    Object.assign(new Error(secret), { type: "__proto__", status: 400 }),
    Object.assign(new Error(secret), { type: "unknown", status: 400 })]) {
    assert.deepEqual(appErrorResponse(error), generic);
  }
});

test("actual app rejects malformed JSON before Clerk without echoing body or parser details", async () => {
  const logs: unknown[] = [];
  await serve(await trackedApp(logs), async url => {
    await expectError(await fetch(`${url}/api/companies`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: `{\"${secret}\":`,
    }), 400, "The request body is invalid.");
  });
  assert.deepEqual(logs, [[{ error_code: "invalid_body" }, "Request failed"]]);
});

test("actual app rejects oversized JSON with fixed 413 and unsupported charset with fixed 415", async () => {
  const logs: unknown[] = [];
  await serve(await trackedApp(logs), async url => {
    await expectError(await fetch(`${url}/api/companies`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: "x".repeat(10 * 1024 * 1024) }),
    }), 413, "The request body is too large.");
    await expectError(await fetch(`${url}/api/companies`, {
      method: "POST", headers: { "Content-Type": "application/json; charset=iso-8859-1" }, body: "{}",
    }), 415, "The request encoding is not supported.");
  });
  assert.deepEqual(logs, [[{ error_code: "body_too_large" }, "Request failed"],
    [{ error_code: "unsupported_encoding" }, "Request failed"]]);
});

test("actual app rejects disallowed origins without reflecting origin or granting CORS access", async () => {
  const logs: unknown[] = [];
  await serve(await trackedApp(logs), async url => {
    const response = await fetch(`${url}/api/companies`, { headers: { Origin: `https://${secret}.example.test` } });
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    await expectError(response, 403, "Request origin is not permitted.");
  });
  assert.deepEqual(logs, [[{ error_code: "origin_not_permitted" }, "Request failed"]]);
});

test("allowed credentialed CORS preflight retains its existing response", async () => {
  const logs: unknown[] = [];
  await serve(await trackedApp(logs), async url => {
    const response = await fetch(`${url}/api/companies`, {
      method: "OPTIONS", headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "POST" },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.equal(await response.text(), "");
  });
  assert.deepEqual(logs, []);
});

test("actual app catches synchronous and async middleware failures without arbitrary diagnostic logs", async () => {
  for (const asyncFailure of [false, true]) {
    const logs: unknown[] = [];
    const fail = () => { throw Object.assign(new Error(secret, { cause: new Error(secret) }), {
      query: secret, response: secret, status: 401, headers: { authorization: secret },
    }); };
    await serve(await trackedApp(logs, asyncFailure ? async () => fail() : () => fail()), async url => {
      await expectError(await fetch(`${url}/api/test`), 500, generic.message);
    });
    assert.deepEqual(logs, [[{ error_code: "unexpected_error" }, "Request failed"]]);
  }
});

test("existing draft parser response and explicitly handled business responses are preserved", async () => {
  const logs: unknown[] = [];
  await serve(await trackedApp(logs, (req, res, next) => {
    if (req.path === "/handled") { res.status(409).json({ error: { code: "REVIEW_STALE", message: "Review again." } }); return; }
    next();
  }), async url => {
    const draft = await fetch(`${url}/api/companies/id/financial-drafts/invoices`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{",
    });
    assert.equal(draft.status, 400);
    const body = await draft.json();
    assert.ok(typeof body === "object" && body !== null && "error" in body);
    const error = body.error;
    assert.ok(typeof error === "object" && error !== null && "code" in error &&
      "message" in error && "request_id" in error);
    assert.equal(error.code, "MALFORMED_JSON");
    assert.equal(error.message, "Invalid draft request.");
    assert.equal(typeof error.request_id, "string");
    const handled = await fetch(`${url}/handled`);
    assert.equal(handled.status, 409);
    assert.deepEqual(await handled.json(), { error: { code: "REVIEW_STALE", message: "Review again." } });
  });
  assert.deepEqual(logs, []);
});

test("an already-started response closes without headers, body, or raw errors reaching the default handler", () => {
  const logs: unknown[] = [];
  let closed = false;
  safeAppErrors(new Error(secret), { log: { error: (...args: unknown[]) => logs.push(args) } } as any,
    { headersSent: true, destroy: () => { closed = true; } } as any,
    () => assert.fail("the raw error must not reach the default handler"));
  assert.equal(closed, true);
  assert.deepEqual(logs, [[{ error_code: "unexpected_error" }, "Request failed"]]);
});
