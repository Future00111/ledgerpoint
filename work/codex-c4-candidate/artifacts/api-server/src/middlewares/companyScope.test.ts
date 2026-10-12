import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createCompanyJobContext,
  evaluateCompanyScope,
  requireCompanyJobContext,
  resolveActiveMembership,
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

test("company scope rejects malformed context even when resource context exists", () => {
  assert.deepEqual(
    evaluateCompanyScope({
      userId: "user-a",
      requestedCompanyId: null,
      resourceCompanyId: "company-a",
      membership: membership(),
    }),
    { ok: false, reason: "invalid_company_context" },
  );
});

test("company scope allows a matching requested and resource company", async () => {
  const result = await resolveCompanyScope(
    {
      userId: "user-a",
      requestedCompanyId: "company-a",
      resourceCompanyId: "company-a",
    },
    async () => membership(),
  );

  assert.deepEqual(result, {
    ok: true,
    scope: { userId: "user-a", companyId: "company-a", role: "member" },
  });
});

test("resource-backed scope allows a missing caller company context", async () => {
  const result = await resolveCompanyScope(
    { userId: "user-a", resourceCompanyId: "company-a" },
    async () => membership(),
  );

  assert.deepEqual(result, {
    ok: true,
    scope: { userId: "user-a", companyId: "company-a", role: "member" },
  });
});

test("malformed or conflicting resource scope fails before membership lookup", async () => {
  let lookupCalls = 0;
  const lookup = async () => {
    lookupCalls += 1;
    return membership();
  };

  const malformed = await resolveCompanyScope(
    {
      userId: "user-a",
      requestedCompanyId: null,
      resourceCompanyId: "company-a",
    },
    lookup,
  );
  const conflicting = await resolveCompanyScope(
    {
      userId: "user-a",
      requestedCompanyId: "company-b",
      resourceCompanyId: "company-a",
    },
    lookup,
  );

  assert.deepEqual(malformed, { ok: false, reason: "invalid_company_context" });
  assert.deepEqual(conflicting, { ok: false, reason: "conflicting_company_context" });
  assert.equal(lookupCalls, 0);
});

test("both protected resource-backed routes invoke the conflict-aware scope guard before analysis", () => {
  const aiAccountant = readFileSync(join(process.cwd(), "src/routes/aiAccountant.ts"), "utf8");
  const reconciliationHandler = aiAccountant.slice(
    aiAccountant.indexOf('router.post("/reconciliation/analyse"'),
    aiAccountant.indexOf('// ── GET /api/ai/reconciliation/results'),
  );
  assert.match(
    reconciliationHandler,
    /requireWriteScope\(userId, res, \{\s*requestedCompanyId: company_id,\s*resourceCompanyId: txn\.company_id,\s*\}\)/,
  );
  assert.ok(
    reconciliationHandler.indexOf("if (!scope) return;") <
      reconciliationHandler.indexOf("analyseTransactions"),
  );

  const functionsRoute = readFileSync(join(process.cwd(), "src/routes/functions.ts"), "utf8");
  const suggestionsHandler = functionsRoute.slice(
    functionsRoute.indexOf('case "suggestTransactionMatches"'),
    functionsRoute.indexOf('// ── generateSalesInvoiceJournals'),
  );
  assert.match(
    suggestionsHandler,
    /requireCompanyScope\(res, \{\s*userId,\s*requestedCompanyId: argCompanyId,\s*resourceCompanyId: txn\.company_id,\s*\}\)/,
  );
  assert.ok(
    suggestionsHandler.indexOf("if (!scope) return;") <
      suggestionsHandler.indexOf("analyseTransactions"),
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

test("duplicate active memberships with the same role resolve deterministically", () => {
  const row = membership();
  assert.deepEqual(resolveActiveMembership([row, { ...row }]), row);
});

test("duplicate active memberships with conflicting roles fail closed", () => {
  assert.equal(
    resolveActiveMembership([
      membership({ role: "member" }),
      membership({ role: "owner" }),
    ]),
    null,
  );
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