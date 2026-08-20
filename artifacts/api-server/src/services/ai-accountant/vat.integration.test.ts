import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import {
  companiesTable,
  companyUsersTable,
  vatAdjustmentsTable,
  vatReturnAuditsTable,
  vatReturnsTable,
} from "@workspace/db/schema";
import { db, pool } from "@workspace/db";
import { createApp } from "../../app.js";
import {
  approveVATReturn,
  createVATAdjustment,
  recalculateVATReturn,
} from "./vat.js";

const period = { start: "2026-01-01", end: "2026-03-31" };
const testUserHeader = "x-vat-integration-user";

async function createTestCompany(label: string) {
  const [company] = await db.insert(companiesTable).values({
    name: `VAT integration ${label} ${randomUUID()}`,
  }).returning();
  assert.ok(company, "test company should be created");
  return company;
}

async function createTestReturn(companyId: string) {
  const [vatReturn] = await db.insert(vatReturnsTable).values({
    company_id: companyId,
    period_start: period.start,
    period_end: period.end,
    status: "ready_for_review",
    locked: false,
    calculation_snapshot: { period, boxes: {}, exceptions: [] },
  }).returning();
  assert.ok(vatReturn, "test VAT return should be created");
  return vatReturn;
}

async function addTestMembership(companyId: string, userId: string, role = "owner") {
  await db.insert(companyUsersTable).values({
    company_id: companyId,
    user_id: userId,
    role,
    is_active: true,
  });
}

async function removeTestData(companyIds: string[]) {
  await db.delete(companyUsersTable).where(inArray(companyUsersTable.company_id, companyIds));
  await db.delete(vatAdjustmentsTable).where(inArray(vatAdjustmentsTable.company_id, companyIds));
  await db.delete(vatReturnAuditsTable).where(inArray(vatReturnAuditsTable.company_id, companyIds));
  await db.delete(vatReturnsTable).where(inArray(vatReturnsTable.company_id, companyIds));
  await db.delete(companiesTable).where(inArray(companiesTable.id, companyIds));
}

function authenticatedTestRequest(req: Request, _res: Response, next: NextFunction) {
  const userId = req.header(testUserHeader);
  if (!userId) {
    next();
    return;
  }

  const auth = Object.assign(
    () => ({
      userId,
      sessionClaims: { userId },
      tokenType: "session_token",
    }),
    { [Symbol.for("@clerk/express.auth")]: true },
  );
  (req as Request & { auth?: typeof auth }).auth = auth;
  next();
}

async function startAuthenticatedApi() {
  const app = createApp({ beforeClerkMiddleware: authenticatedTestRequest });
  const server = await new Promise<Server>((resolve, reject) => {
    const listeningServer = app.listen(0, "127.0.0.1", () => resolve(listeningServer));
    listeningServer.once("error", reject);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string", "test API should bind to a local port");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    async request(userId: string, method: string, path: string, body?: unknown) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          [testUserHeader]: userId,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const responseText = await response.text();
      return {
        status: response.status,
        body: response.headers.get("content-type")?.includes("application/json")
          ? JSON.parse(responseText) as { error?: string }
          : { error: responseText },
      };
    },
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

let api: Awaited<ReturnType<typeof startAuthenticatedApi>>;

test.before(async () => {
  api = await startAuthenticatedApi();
});

test("VAT HTTP integration: generic VAT return writes are denied to authenticated members", async (t) => {
  const company = await createTestCompany("generic-write-block");
  const userId = `vat-http-${randomUUID()}`;
  const vatReturn = await createTestReturn(company.id);
  await addTestMembership(company.id, userId);
  t.after(async () => removeTestData([company.id]));

  const requests = [
    api.request(userId, "POST", "/api/entities/VATReturn", { company_id: company.id }),
    api.request(userId, "PUT", `/api/entities/VATReturn/${vatReturn.id}`, { status: "approved" }),
    api.request(userId, "PATCH", `/api/entities/VATReturn/${vatReturn.id}`, { status: "approved" }),
    api.request(userId, "PATCH", "/api/entities/VATReturn/bulk-update", [{ id: vatReturn.id, status: "approved" }]),
    api.request(userId, "POST", "/api/entities/VATReturn/bulk", [{ company_id: company.id }]),
    api.request(userId, "DELETE", `/api/entities/VATReturn/${vatReturn.id}`),
  ];
  const responses = await Promise.all(requests);

  for (const response of responses) {
    assert.equal(response.status, 403);
    assert.match(response.body.error ?? "", /VAT returns are managed by the VAT Assistant workflow/);
  }

  const [unchanged] = await db.select().from(vatReturnsTable)
    .where(and(eq(vatReturnsTable.id, vatReturn.id), eq(vatReturnsTable.company_id, company.id)));
  assert.equal(unchanged?.status, "ready_for_review");
  assert.equal(unchanged?.locked, false);
});

test("VAT HTTP integration: read-only members cannot mutate protected VAT workflow data", async (t) => {
  const company = await createTestCompany("read-only-workflow");
  const userId = `vat-read-only-${randomUUID()}`;
  const vatReturn = await createTestReturn(company.id);
  await addTestMembership(company.id, userId, "read_only");
  t.after(async () => removeTestData([company.id]));

  const [approval, recalculation, adjustment] = await Promise.all([
    api.request(userId, "POST", `/api/ai/accountant/vat/returns/${vatReturn.id}/approve`, {
      company_id: company.id,
      note: "Read-only approval attempt",
    }),
    api.request(userId, "POST", `/api/ai/accountant/vat/returns/${vatReturn.id}/recalculate`, {
      company_id: company.id,
    }),
    api.request(userId, "POST", "/api/ai/accountant/vat/adjustments", {
      company_id: company.id,
      vat_return_id: vatReturn.id,
      period_start: period.start,
      period_end: period.end,
      box_number: 1,
      amount: 10,
      reason: "Read-only adjustment attempt",
    }),
  ]);

  for (const response of [approval, recalculation, adjustment]) {
    assert.equal(response.status, 403);
    assert.match(response.body.error ?? "", /role does not permit this operation/);
  }

  const [unchanged] = await db.select().from(vatReturnsTable)
    .where(and(eq(vatReturnsTable.id, vatReturn.id), eq(vatReturnsTable.company_id, company.id)));
  assert.equal(unchanged?.status, "ready_for_review");
  assert.equal(unchanged?.locked, false);

  const adjustments = await db.select().from(vatAdjustmentsTable)
    .where(eq(vatAdjustmentsTable.vat_return_id, vatReturn.id));
  assert.equal(adjustments.length, 0);

  const audits = await db.select().from(vatReturnAuditsTable)
    .where(eq(vatReturnAuditsTable.vat_return_id, vatReturn.id));
  assert.equal(audits.length, 0);
});

test("VAT HTTP integration: concurrent approval and recalculation preserve one locked, audited return", async (t) => {
  const company = await createTestCompany("concurrency");
  const vatReturn = await createTestReturn(company.id);
  const approvalUserId = `vat-approver-${randomUUID()}`;
  const calculationUserId = `vat-calculator-${randomUUID()}`;
  await Promise.all([
    addTestMembership(company.id, approvalUserId),
    addTestMembership(company.id, calculationUserId),
  ]);
  t.after(async () => removeTestData([company.id]));

  const [approval, recalculation] = await Promise.all([
    api.request(approvalUserId, "POST", `/api/ai/accountant/vat/returns/${vatReturn.id}/approve`, {
      company_id: company.id,
      note: "Approved during review",
    }),
    api.request(calculationUserId, "POST", `/api/ai/accountant/vat/returns/${vatReturn.id}/recalculate`, {
      company_id: company.id,
    }),
  ]);
  assert.equal(approval.status, 200);
  assert.ok([200, 409].includes(recalculation.status), "the concurrent recalculation should either complete before approval or report a lock conflict");
  if (recalculation.status === 409) {
    assert.match(recalculation.body.error ?? "", /locked|approved/i);
  }

  const [finalReturn] = await db.select().from(vatReturnsTable)
    .where(and(eq(vatReturnsTable.id, vatReturn.id), eq(vatReturnsTable.company_id, company.id)));
  assert.equal(finalReturn?.status, "approved");
  assert.equal(finalReturn?.locked, true);

  const lockedRecalculation = await api.request(calculationUserId, "POST", `/api/ai/accountant/vat/returns/${vatReturn.id}/recalculate`, {
    company_id: company.id,
  });
  assert.equal(lockedRecalculation.status, 409);
  assert.match(lockedRecalculation.body.error ?? "", /locked|approved/i);

  const audits = await db.select().from(vatReturnAuditsTable)
    .where(eq(vatReturnAuditsTable.vat_return_id, vatReturn.id))
    .orderBy(vatReturnAuditsTable.created_at);
  const events = audits.map((audit) => audit.event_type);
  assert.equal(events.filter((event) => event === "vat_return_approved").length, 1);
  assert.equal(events.at(-1), "vat_return_approved");
  assert.ok(audits.length >= 1, "the locked return should retain its audit history");
});

test("VAT HTTP integration: adjustments reject cross-company returns and mismatched periods", async (t) => {
  const [firstCompany, secondCompany] = await Promise.all([
    createTestCompany("adjustment-owner"),
    createTestCompany("adjustment-requester"),
  ]);
  const [firstReturn, secondReturn] = await Promise.all([
    createTestReturn(firstCompany.id),
    createTestReturn(secondCompany.id),
  ]);
  const userId = `vat-adjustment-${randomUUID()}`;
  await addTestMembership(secondCompany.id, userId);
  t.after(async () => removeTestData([firstCompany.id, secondCompany.id]));

  const crossCompany = await api.request(userId, "POST", "/api/ai/accountant/vat/adjustments", {
    company_id: secondCompany.id,
    vat_return_id: firstReturn.id,
    period_start: period.start,
    period_end: period.end,
    box_number: 1,
    amount: 10,
    reason: "Cross-company test",
  });
  const mismatchedPeriod = await api.request(userId, "POST", "/api/ai/accountant/vat/adjustments", {
    company_id: secondCompany.id,
    vat_return_id: secondReturn.id,
    period_start: "2026-04-01",
    period_end: "2026-06-30",
    box_number: 1,
    amount: 10,
    reason: "Wrong period test",
  });
  assert.equal(crossCompany.status, 400);
  assert.match(crossCompany.body.error ?? "", /VAT return not found for this company/);
  assert.equal(mismatchedPeriod.status, 400);
  assert.match(mismatchedPeriod.body.error ?? "", /VAT adjustment period must match the selected VAT return/);

  const adjustments = await db.select().from(vatAdjustmentsTable)
    .where(inArray(vatAdjustmentsTable.vat_return_id, [firstReturn.id, secondReturn.id]));
  assert.equal(adjustments.length, 0);
});

test("VAT service integration: concurrent approval and recalculation preserve one locked, audited return", async (t) => {
  const company = await createTestCompany("service-concurrency");
  const vatReturn = await createTestReturn(company.id);
  t.after(async () => removeTestData([company.id]));

  const results = await Promise.allSettled([
    approveVATReturn(company.id, vatReturn.id, "approval-reviewer", "Approved during review"),
    recalculateVATReturn(company.id, vatReturn.id, "calculation-reviewer"),
  ]);

  const [finalReturn] = await db.select().from(vatReturnsTable)
    .where(and(eq(vatReturnsTable.id, vatReturn.id), eq(vatReturnsTable.company_id, company.id)));
  assert.equal(finalReturn?.status, "approved");
  assert.equal(finalReturn?.locked, true);

  const audits = await db.select().from(vatReturnAuditsTable)
    .where(eq(vatReturnAuditsTable.vat_return_id, vatReturn.id))
    .orderBy(vatReturnAuditsTable.created_at);
  const events = audits.map((audit) => audit.event_type);
  assert.equal(events.filter((event) => event === "vat_return_approved").length, 1);
  assert.equal(events.at(-1), "vat_return_approved");
  assert.ok(results.some((result) => result.status === "fulfilled"), "at least one protected workflow operation should complete");
});

test("VAT service integration: adjustments reject cross-company returns and mismatched periods", async (t) => {
  const [firstCompany, secondCompany] = await Promise.all([
    createTestCompany("service-adjustment-owner"),
    createTestCompany("service-adjustment-requester"),
  ]);
  const vatReturn = await createTestReturn(firstCompany.id);
  t.after(async () => removeTestData([firstCompany.id, secondCompany.id]));

  await assert.rejects(
    createVATAdjustment(secondCompany.id, vatReturn.id, {
      period_start: period.start, period_end: period.end, box_number: 1, amount: 10, reason: "Cross-company test",
    }, "reviewer"),
    /VAT return not found for this company/,
  );
  await assert.rejects(
    createVATAdjustment(firstCompany.id, vatReturn.id, {
      period_start: "2026-04-01", period_end: "2026-06-30", box_number: 1, amount: 10, reason: "Wrong period test",
    }, "reviewer"),
    /VAT adjustment period must match the selected VAT return/,
  );

  const adjustments = await db.select().from(vatAdjustmentsTable)
    .where(eq(vatAdjustmentsTable.vat_return_id, vatReturn.id));
  assert.equal(adjustments.length, 0);
});

test.after(async () => {
  await api.close();
  await pool.end();
});