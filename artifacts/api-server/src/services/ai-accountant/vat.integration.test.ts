import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import {
  companiesTable,
  companyUsersTable,
  bankTransactionsTable,
  aiDecisionAuditsTable,
  aiReconciliationResultsTable,
  vatAdjustmentsTable,
  vatExceptionsTable,
  vatReturnAuditsTable,
  vatReturnsTable,
  vatTaxRulesTable,
  salesInvoicesTable,
  bankAutomationSettingsTable,
} from "@workspace/db/schema";
import { db, pool } from "@workspace/db";
import { createApp } from "../../app.js";
import {
  approveVATReturn,
  createVATAdjustment,
  recalculateVATReturn,
} from "./vat.js";
import { applyReconciliationApproval } from "./approval.js";

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
  await db.delete(bankAutomationSettingsTable).where(inArray(bankAutomationSettingsTable.company_id, companyIds));
  await db.delete(aiDecisionAuditsTable).where(inArray(aiDecisionAuditsTable.company_id, companyIds));
  await db.delete(aiReconciliationResultsTable).where(inArray(aiReconciliationResultsTable.company_id, companyIds));
  await db.delete(bankTransactionsTable).where(inArray(bankTransactionsTable.company_id, companyIds));
  await db.delete(salesInvoicesTable).where(inArray(salesInvoicesTable.company_id, companyIds));
  await db.delete(companyUsersTable).where(inArray(companyUsersTable.company_id, companyIds));
  await db.delete(vatAdjustmentsTable).where(inArray(vatAdjustmentsTable.company_id, companyIds));
  await db.delete(vatExceptionsTable).where(inArray(vatExceptionsTable.company_id, companyIds));
  await db.delete(vatReturnAuditsTable).where(inArray(vatReturnAuditsTable.company_id, companyIds));
  await db.delete(vatTaxRulesTable).where(inArray(vatTaxRulesTable.company_id, companyIds));
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

test("Rich text security integration: crafted markup remains inert data and tenant scoped", async (t) => {
  const companyA = await createTestCompany("rich-text-owner");
  const companyB = await createTestCompany("rich-text-isolation");
  const ownerA = `rich-text-owner-${randomUUID()}`;
  const ownerB = `rich-text-other-${randomUUID()}`;
  await addTestMembership(companyA.id, ownerA);
  await addTestMembership(companyB.id, ownerB);
  t.after(async () => removeTestData([companyA.id, companyB.id]));

  const payload = [
    '<img src=x onerror="globalThis.__ledgerlyXss=1">',
    '<a href="javascript:globalThis.__ledgerlyXss=2">unsafe link</a>',
    '<svg><script>globalThis.__ledgerlyXss=3</script></svg>',
    '<iframe src="javascript:globalThis.__ledgerlyXss=4"></iframe>',
    '<object data="javascript:globalThis.__ledgerlyXss=5"></object>',
    '<div><b>malformed rich text',
  ].join("\n");
  const lineItems = [{
    description: payload,
    quantity: 1,
    unit_price: 10,
    amount: 10,
    vat_rate: "20",
    vat_amount: 2,
    line_total: 12,
  }];

  const created = await api.request(ownerA, "POST", "/api/entities/SalesInvoice", {
    company_id: companyA.id,
    customer_name: "Rich text test customer",
    invoice_number: `XSS-${randomUUID()}`,
    issue_date: "2026-08-20",
    due_date: "2026-09-19",
    payment_terms: 30,
    status: "draft",
    notes: payload,
    line_items: lineItems,
    subtotal: 10,
    vat_total: 2,
    total: 12,
    balance_due: 12,
  });
  assert.equal(created.status, 201);
  const createdInvoice = created.body as unknown as Record<string, unknown>;
  assert.equal(createdInvoice["company_id"], companyA.id);
  assert.equal(createdInvoice["notes"], payload);
  assert.deepEqual(createdInvoice["line_items"], lineItems);
  const invoiceId = createdInvoice["id"] as string;
  assert.ok(invoiceId, "created invoice should have an id");

  const ownerRead = await api.request(ownerA, "GET", `/api/entities/SalesInvoice/${invoiceId}`);
  assert.equal(ownerRead.status, 200);
  const ownerInvoice = ownerRead.body as unknown as Record<string, unknown>;
  assert.equal(ownerInvoice["notes"], payload);
  assert.deepEqual(ownerInvoice["line_items"], lineItems);

  const otherTenantRead = await api.request(ownerB, "GET", `/api/entities/SalesInvoice/${invoiceId}`);
  assert.equal(otherTenantRead.status, 403);

  const crossTenantList = await api.request(ownerA, "GET", `/api/entities/SalesInvoice?company_id=${companyB.id}`);
  assert.equal(crossTenantList.status, 403);
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

test("Phase 5 HTTP integration: read-only reconciliation suggestions never persist analysis or audit rows", async (t) => {
  const company = await createTestCompany("read-only-reconciliation");
  const userId = `phase5-read-only-${randomUUID()}`;
  await addTestMembership(company.id, userId, "read_only");
  const [transaction] = await db.insert(bankTransactionsTable).values({
    company_id: company.id,
    date: "2026-08-20",
    description: "Read-only review receipt",
    reference: "RO-REVIEW-1",
    amount: "100.00",
    money_in: "100.00",
    money_out: "0.00",
    status: "review",
  }).returning();
  assert.ok(transaction, "test bank transaction should be created");
  t.after(async () => removeTestData([company.id]));

  const response = await api.request(userId, "POST", "/api/functions/suggestTransactionMatches", {
    company_id: company.id,
  });
  assert.equal(response.status, 200, "read-only users can view deterministic suggestions");

  const [analyses, audits] = await Promise.all([
    db.select().from(aiReconciliationResultsTable).where(eq(aiReconciliationResultsTable.company_id, company.id)),
    db.select().from(aiDecisionAuditsTable).where(eq(aiDecisionAuditsTable.company_id, company.id)),
  ]);
  assert.equal(analyses.length, 0, "read-only suggestion loads must not persist analysis");
  assert.equal(audits.length, 0, "read-only suggestion loads must not append audits");
});

test("Phase 5 HTTP integration: unmatched null-rate bank activity remains VAT review", async (t) => {
  const company = await createTestCompany("missing-vat-evidence");
  const userId = `phase5-owner-${randomUUID()}`;
  await addTestMembership(company.id, userId, "owner");
  await db.insert(bankTransactionsTable).values({
    company_id: company.id,
    date: "2026-08-20",
    description: "Unexplained VAT evidence receipt",
    reference: "NO-SOURCE-VAT",
    amount: "100.00",
    money_in: "100.00",
    money_out: "0.00",
    status: "review",
    vat_rate: null,
  });
  t.after(async () => removeTestData([company.id]));

  const response = await api.request(userId, "POST", "/api/functions/suggestTransactionMatches", {
    company_id: company.id,
  });
  assert.equal(response.status, 200);
  const [analysis] = await db.select().from(aiReconciliationResultsTable)
    .where(eq(aiReconciliationResultsTable.company_id, company.id));
  assert.equal(analysis?.scenario, "no_match");
  assert.equal(analysis?.vat_treatment, "pending_source_document");
  assert.equal(analysis?.vat_review_required, true);
  assert.equal(analysis?.decision_state, "VAT_REVIEW");
  assert.notEqual(analysis?.decision_state, "READY");
});

test("Phase 5 HTTP integration: an imported null-rate exact match uses invoice VAT evidence and stays ready", async (t) => {
  const company = await createTestCompany("source-vat-evidence");
  const userId = `phase5-owner-${randomUUID()}`;
  await addTestMembership(company.id, userId, "owner");
  const invoiceNumber = `INV-SOURCE-${randomUUID().slice(0, 8)}`;
  await db.insert(salesInvoicesTable).values({
    company_id: company.id,
    invoice_number: invoiceNumber,
    customer_name: "Source VAT customer",
    issue_date: "2026-08-15",
    due_date: "2026-09-15",
    subtotal: "100.00",
    vat_total: "20.00",
    total: "120.00",
    amount_paid: "0.00",
    balance_due: "120.00",
    status: "sent",
  });
  await db.insert(bankTransactionsTable).values({
    company_id: company.id,
    date: "2026-08-20",
    description: `Source VAT customer ${invoiceNumber}`,
    reference: invoiceNumber,
    amount: "120.00",
    money_in: "120.00",
    money_out: "0.00",
    status: "review",
    vat_rate: null,
  });
  t.after(async () => removeTestData([company.id]));

  const response = await api.request(userId, "POST", "/api/functions/suggestTransactionMatches", {
    company_id: company.id,
  });
  assert.equal(response.status, 200);
  const [analysis] = await db.select().from(aiReconciliationResultsTable)
    .where(eq(aiReconciliationResultsTable.company_id, company.id));
  assert.equal(analysis?.scenario, "exact");
  assert.equal(analysis?.vat_treatment, "source_document");
  assert.equal(analysis?.vat_review_required, false);
  assert.equal(analysis?.decision_state, "READY");
});

test("Phase 6 HTTP integration: batch approval applies only current high-confidence ready matches", async (t) => {
  const company = await createTestCompany("batch-approval");
  const userId = `phase6-owner-${randomUUID()}`;
  await addTestMembership(company.id, userId, "owner");
  const firstNumber = `INV-BATCH-${randomUUID().slice(0, 6)}`;
  const secondNumber = `INV-BATCH-${randomUUID().slice(0, 6)}`;
  const invoices = await db.insert(salesInvoicesTable).values([
    { company_id: company.id, invoice_number: firstNumber, customer_name: "Batch customer A", issue_date: "2026-08-01", due_date: "2026-09-01", subtotal: "100.00", vat_total: "20.00", total: "120.00", amount_paid: "0.00", balance_due: "120.00", status: "sent" },
    { company_id: company.id, invoice_number: secondNumber, customer_name: "Batch customer B", issue_date: "2026-08-01", due_date: "2026-09-01", subtotal: "50.00", vat_total: "10.00", total: "60.00", amount_paid: "0.00", balance_due: "60.00", status: "sent" },
  ]).returning();
  const transactions = await db.insert(bankTransactionsTable).values([
    { company_id: company.id, date: "2026-08-20", description: `Batch customer A ${firstNumber}`, reference: firstNumber, amount: "120.00", money_in: "120.00", money_out: "0.00", status: "review" },
    { company_id: company.id, date: "2026-08-20", description: `Batch customer B ${secondNumber}`, reference: secondNumber, amount: "60.00", money_in: "60.00", money_out: "0.00", status: "review" },
    { company_id: company.id, date: "2026-08-20", description: "Unexplained batch receipt", reference: "NO-MATCH", amount: "40.00", money_in: "40.00", money_out: "0.00", status: "review" },
  ]).returning();
  assert.equal(invoices.length, 2);
  assert.equal(transactions.length, 3);
  t.after(async () => removeTestData([company.id]));

  const analysis = await api.request(userId, "POST", "/api/functions/suggestTransactionMatches", { company_id: company.id });
  assert.equal(analysis.status, 200);
  const result = await api.request(userId, "POST", "/api/ai/reconciliation/approve-batch", {
    company_id: company.id,
    bank_transaction_ids: transactions.map((transaction) => transaction.id),
  });
  assert.equal(result.status, 200);
  const body = result.body as { approved?: unknown[]; skipped?: unknown[] };
  assert.equal(body.approved?.length, 2);
  assert.equal(body.skipped?.length, 1);
  const updated = await db.select().from(bankTransactionsTable)
    .where(eq(bankTransactionsTable.company_id, company.id));
  assert.equal(updated.filter((transaction) => transaction.status === "matched").length, 2);
  assert.equal(updated.filter((transaction) => transaction.status === "review").length, 1);
});

test("Phase 6 approval guard refuses a replaced analysis before writing accounting state", async (t) => {
  const company = await createTestCompany("stale-analysis");
  const userId = `phase6-stale-${randomUUID()}`;
  await addTestMembership(company.id, userId, "owner");
  const [invoice] = await db.insert(salesInvoicesTable).values({
    company_id: company.id, invoice_number: `INV-STALE-${randomUUID().slice(0, 6)}`, customer_name: "Stale evidence customer",
    issue_date: "2026-08-01", due_date: "2026-09-01", subtotal: "100.00", vat_total: "20.00", total: "120.00",
    amount_paid: "0.00", balance_due: "120.00", status: "sent",
  }).returning();
  const [transaction] = await db.insert(bankTransactionsTable).values({
    company_id: company.id, date: "2026-08-20", description: invoice?.invoice_number || "stale", reference: invoice?.invoice_number || "stale",
    amount: "120.00", money_in: "120.00", money_out: "0.00", status: "review",
  }).returning();
  assert.ok(invoice && transaction);
  t.after(async () => removeTestData([company.id]));

  await api.request(userId, "POST", "/api/functions/suggestTransactionMatches", { company_id: company.id });
  const [analysis] = await db.select().from(aiReconciliationResultsTable)
    .where(eq(aiReconciliationResultsTable.bank_transaction_id, transaction.id)).limit(1);
  assert.ok(analysis);
  await db.delete(aiReconciliationResultsTable).where(eq(aiReconciliationResultsTable.id, analysis.id));
  await assert.rejects(
    applyReconciliationApproval(transaction.id, [{ record_type: "sales_invoice", record_id: invoice.id }], userId, {
      expectedAnalysisId: analysis.id, minimumConfidence: 95, requireReady: true,
    }),
    /no longer current/,
  );
  const [unchanged] = await db.select().from(bankTransactionsTable).where(eq(bankTransactionsTable.id, transaction.id));
  assert.equal(unchanged?.status, "review");
});

test("VAT HTTP integration: read-only members cannot mutate the remaining VAT workspace", async (t) => {
  const company = await createTestCompany("read-only-workspace");
  const userId = `vat-read-only-${randomUUID()}`;
  const vatReturn = await createTestReturn(company.id);
  await addTestMembership(company.id, userId, "read_only");
  t.after(async () => removeTestData([company.id]));

  await db.update(vatReturnsTable).set({ status: "draft" })
    .where(eq(vatReturnsTable.id, vatReturn.id));
  const [taxRule] = await db.insert(vatTaxRulesTable).values({
    company_id: company.id,
    code: "STANDARD",
    label: "Standard rate",
    rate: "20.00",
    effective_from: period.start,
  }).returning();
  const [exception] = await db.insert(vatExceptionsTable).values({
    company_id: company.id,
    dedupe_key: `read-only-exception-${randomUUID()}`,
    period_start: period.start,
    period_end: period.end,
    exception_type: "missing_treatment",
    severity: "medium",
    title: "VAT treatment needs review",
    status: "open",
  }).returning();
  const [adjustment] = await db.insert(vatAdjustmentsTable).values({
    company_id: company.id,
    vat_return_id: vatReturn.id,
    period_start: period.start,
    period_end: period.end,
    box_number: 1,
    amount: "10.00",
    reason: "Seeded adjustment",
    status: "pending",
  }).returning();
  assert.ok(taxRule && exception && adjustment, "VAT workspace fixtures should be created");

  const ready = await api.request(userId, "POST", `/api/ai/accountant/vat/returns/${vatReturn.id}/ready`, {
    company_id: company.id,
  });
  assert.equal(ready.status, 403);
  assert.match(ready.body.error ?? "", /role does not permit this operation/);

  const [returnAfterReadyAttempt] = await db.select().from(vatReturnsTable)
    .where(eq(vatReturnsTable.id, vatReturn.id));
  assert.equal(returnAfterReadyAttempt?.status, "draft");

  await db.update(vatReturnsTable).set({ status: "approved", locked: true })
    .where(eq(vatReturnsTable.id, vatReturn.id));

  const responses = await Promise.all([
    api.request(userId, "POST", "/api/ai/accountant/vat/review/refresh", {
      company_id: company.id,
      period_start: period.start,
      period_end: period.end,
    }),
    api.request(userId, "POST", `/api/ai/accountant/vat/exceptions/${exception.id}/resolve`, {
      company_id: company.id,
      note: "Read-only exception resolution attempt",
    }),
    api.request(userId, "PUT", "/api/ai/accountant/vat/settings", {
      company_id: company.id,
      vat_number: "GB123456789",
    }),
    api.request(userId, "POST", "/api/ai/accountant/vat/tax-rules", {
      company_id: company.id,
      code: "REDUCED",
      label: "Reduced rate",
      rate: 5,
      effective_from: period.start,
    }),
    api.request(userId, "POST", "/api/ai/accountant/vat/returns", {
      company_id: company.id,
      period_start: "2026-04-01",
      period_end: "2026-06-30",
    }),
    api.request(userId, "POST", `/api/ai/accountant/vat/returns/${vatReturn.id}/revision`, {
      company_id: company.id,
    }),
    api.request(userId, "POST", `/api/ai/accountant/vat/adjustments/${adjustment.id}/approve`, {
      company_id: company.id,
    }),
  ]);

  for (const response of responses) {
    assert.equal(response.status, 403);
    assert.match(response.body.error ?? "", /role does not permit this operation/);
  }

  const [[unchangedCompany], taxRules, [unchangedException], returns, [unchangedAdjustment], audits] = await Promise.all([
    db.select().from(companiesTable).where(eq(companiesTable.id, company.id)),
    db.select().from(vatTaxRulesTable).where(eq(vatTaxRulesTable.company_id, company.id)),
    db.select().from(vatExceptionsTable).where(eq(vatExceptionsTable.id, exception.id)),
    db.select().from(vatReturnsTable).where(eq(vatReturnsTable.company_id, company.id)),
    db.select().from(vatAdjustmentsTable).where(eq(vatAdjustmentsTable.id, adjustment.id)),
    db.select().from(vatReturnAuditsTable).where(eq(vatReturnAuditsTable.company_id, company.id)),
  ]);
  assert.equal(unchangedCompany?.vat_number, null);
  assert.deepEqual(taxRules.map((rule) => rule.id), [taxRule.id]);
  assert.equal(unchangedException?.status, "open");
  assert.equal(unchangedException?.resolved_by, null);
  assert.equal(returns.length, 1);
  assert.equal(returns[0]?.id, vatReturn.id);
  assert.equal(returns[0]?.status, "approved");
  assert.equal(returns[0]?.locked, true);
  assert.equal(unchangedAdjustment?.status, "pending");
  assert.equal(unchangedAdjustment?.approved_by, null);
  assert.equal(audits.length, 0);
});

test("VAT HTTP integration: standard members retain VAT workflow write access", async (t) => {
  const company = await createTestCompany("standard-member-workflow");
  const userId = `vat-member-${randomUUID()}`;
  const vatReturn = await createTestReturn(company.id);
  await addTestMembership(company.id, userId, "member");
  t.after(async () => removeTestData([company.id]));

  await db.update(vatReturnsTable).set({ status: "draft" })
    .where(eq(vatReturnsTable.id, vatReturn.id));

  const [settings, taxRule, ready] = await Promise.all([
    api.request(userId, "PUT", "/api/ai/accountant/vat/settings", {
      company_id: company.id,
      vat_number: "GB987654321",
    }),
    api.request(userId, "POST", "/api/ai/accountant/vat/tax-rules", {
      company_id: company.id,
      code: "REDUCED",
      label: "Reduced rate",
      rate: 5,
      effective_from: period.start,
    }),
    api.request(userId, "POST", `/api/ai/accountant/vat/returns/${vatReturn.id}/ready`, {
      company_id: company.id,
    }),
  ]);

  assert.equal(settings.status, 200);
  assert.equal(taxRule.status, 200);
  assert.equal(ready.status, 200);

  const [updatedReturn] = await db.select().from(vatReturnsTable)
    .where(eq(vatReturnsTable.id, vatReturn.id));
  assert.equal(updatedReturn?.status, "ready_for_review");
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