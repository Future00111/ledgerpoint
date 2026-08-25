import test from "node:test";
import assert from "node:assert/strict";
import {
  createCompanyJobContext,
  evaluateCompanyScope,
  requireCompanyJobContext,
  resolveCompanyScope,
  type ActiveCompanyMembership,
} from "./companyScope.js";

const membership = (
  overrides: Partial<ActiveCompanyMembership> = {},
): ActiveCompanyMembership => ({
  company_id: "company-a",
  user_id: "user-a",
  role: "member",
  is_active: true,
  ...overrides,
});

test("company scope accepts an active membership for the resource company", () => {
  const result = evaluateCompanyScope({
    userId: "user-a",
    resourceCompanyId: "company-a",
    membership: membership(),
  });

  assert.deepEqual(result, {
    ok: true,
    scope: { userId: "user-a", companyId: "company-a", role: "member" },
  });
});

test("company scope fails closed when membership is revoked", () => {
  const result = evaluateCompanyScope({
    userId: "user-a",
    requestedCompanyId: "company-a",
    membership: membership({ is_active: false }),
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "inactive_or_missing_membership",
  });
});

test("company scope rejects cross-company resource access", () => {
  const result = evaluateCompanyScope({
    userId: "user-a",
    resourceCompanyId: "company-b",
    membership: membership(),
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "membership_scope_mismatch",
  });
});

test("company scope rejects caller and resource company disagreement", () => {
  const result = evaluateCompanyScope({
    userId: "user-a",
    requestedCompanyId: "company-a",
    resourceCompanyId: "company-b",
    membership: membership({ company_id: "company-b" }),
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "conflicting_company_context",
  });
});

test("company scope rejects missing authentication or company context", () => {
  assert.deepEqual(
    evaluateCompanyScope({
      userId: undefined,
      requestedCompanyId: "company-a",
      membership: membership(),
    }),
    { ok: false, reason: "missing_company_context" },
  );
  assert.deepEqual(
    evaluateCompanyScope({
      userId: "user-a",
      membership: membership(),
    }),
    { ok: false, reason: "missing_company_context" },
  );
});

test("database lookup failures fail closed", async () => {
  const result = await resolveCompanyScope(
    { userId: "user-a", requestedCompanyId: "company-a" },
    async () => {
      throw new Error("database unavailable");
    },
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "membership_lookup_failed",
  });
});

test("each authorization decision rechecks membership after revocation", async () => {
  let active = true;
  let lookupCalls = 0;
  const lookup = async (): Promise<ActiveCompanyMembership> => {
    lookupCalls += 1;
    return membership({ is_active: active });
  };

  const beforeRevocation = await resolveCompanyScope(
    { userId: "user-a", requestedCompanyId: "company-a" },
    lookup,
  );
  active = false;
  const afterRevocation = await resolveCompanyScope(
    { userId: "user-a", requestedCompanyId: "company-a" },
    lookup,
  );

  assert.equal(beforeRevocation.ok, true);
  assert.deepEqual(afterRevocation, {
    ok: false,
    reason: "inactive_or_missing_membership",
  });
  assert.equal(lookupCalls, 2);
});

test("scope resolution invokes only the membership lookup", async () => {
  let lookupCalls = 0;
  const result = await resolveCompanyScope(
    { userId: "user-a", requestedCompanyId: "company-a" },
    async () => {
      lookupCalls += 1;
      return membership();
    },
  );

  assert.equal(result.ok, true);
  assert.equal(lookupCalls, 1);
});

test("background jobs carry explicit system company context", () => {
  const context = createCompanyJobContext("company-a");
  assert.equal(requireCompanyJobContext(context), "company-a");
  assert.throws(
    () =>
      requireCompanyJobContext({
        companyId: "company-a",
        principal: { kind: "system", id: "" },
      }),
    /Invalid background job company context/,
  );
});