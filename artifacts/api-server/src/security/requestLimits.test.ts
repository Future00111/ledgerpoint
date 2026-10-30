import test from "node:test";
import assert from "node:assert/strict";
import { requestAdmission, apiResponseHeaders } from "./requestLimits";

function request(middleware: ReturnType<typeof requestAdmission>, ip: string, forwarded?: string) {
  const result = { status: 200, headers: {} as Record<string, string>, body: null as unknown, next: false };
  const res = { status(value: number) { result.status = value; return this; },
    set(key: string, value: string) { result.headers[key] = value; return this; },
    json(body: unknown) { result.body = body; return this; } };
  middleware({ socket: { remoteAddress: ip }, headers: { "x-forwarded-for": forwarded } } as any, res as any, () => { result.next = true; });
  return result;
}

test("admission limits repeated requests, ignores spoofed forwarding headers and resets at boundary", () => {
  let time = 1000;
  const middleware = requestAdmission({ limit: 2, windowMs: 1000, now: () => time });
  assert.equal(request(middleware, "a").next, true);
  assert.equal(request(middleware, "a").next, true);
  const rejected = request(middleware, "a", "different-client");
  assert.equal(rejected.next, false); assert.equal(rejected.status, 429);
  assert.equal(rejected.headers["Retry-After"], "1");
  assert.equal(rejected.headers["Cache-Control"], "no-store");
  assert.equal(request(middleware, "b").next, true);
  time = 2000;
  assert.equal(request(middleware, "a").next, true);
});

test("capacity is bounded without evicting live counters; expired clients free capacity", () => {
  let time = 0;
  const middleware = requestAdmission({ limit: 1, maxClients: 1, windowMs: 1000, now: () => time });
  assert.equal(request(middleware, "a").next, true);
  assert.equal(request(middleware, "b").status, 503);
  assert.equal(request(middleware, "a").status, 429);
  time = 1000;
  assert.equal(request(middleware, "b").next, true);
});

test("invalid admission settings fail closed and API responses are never cached", () => {
  for (const value of [0, -1, Infinity, 1.5]) {
    assert.throws(() => requestAdmission({ limit: value }));
    assert.throws(() => requestAdmission({ maxClients: value }));
    assert.throws(() => requestAdmission({ windowMs: value }));
  }
  const headers: Record<string, string> = {};
  let next = false;
  apiResponseHeaders({} as any, { set(key: string, value: string) { headers[key] = value; return this; } } as any, () => { next = true; });
  assert.equal(next, true);
  assert.deepEqual(headers, { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
});
