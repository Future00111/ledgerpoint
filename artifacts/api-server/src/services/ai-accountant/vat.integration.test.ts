import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import {
  companiesTable,
  vatAdjustmentsTable,
  vatReturnAuditsTable,
  vatReturnsTable,
} from "@workspace/db/schema";
import { db, pool } from "@workspace/db";
import {
  approveVATReturn,
  createVATAdjustment,
  recalculateVATReturn,
} from "./vat.js";

const period = { start: "2026-01-01", end: "2026-03-31" };

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

async function removeTestData(companyIds: string[]) {
  await db.delete(vatAdjustmentsTable).where(inArray(vatAdjustmentsTable.company_id, companyIds));
  await db.delete(vatReturnAuditsTable).where(inArray(vatReturnAuditsTable.company_id, companyIds));
  await db.delete(vatReturnsTable).where(inArray(vatReturnsTable.company_id, companyIds));
  await db.delete(companiesTable).where(inArray(companiesTable.id, companyIds));
}

test("VAT integration: concurrent approval and recalculation preserve one locked, audited return", async (t) => {
  const company = await createTestCompany("concurrency");
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

test("VAT integration: adjustments reject cross-company returns and mismatched periods", async (t) => {
  const [firstCompany, secondCompany] = await Promise.all([
    createTestCompany("adjustment-owner"),
    createTestCompany("adjustment-requester"),
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
  await pool.end();
});