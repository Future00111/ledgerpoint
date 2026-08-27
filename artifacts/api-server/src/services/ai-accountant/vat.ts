/**
 * VAT Assistant — deterministic, company-scoped VAT preparation.
 *
 * Every amount is calculated in integer pence. AI may explain these facts at
 * the route layer, but never provides arithmetic, tax treatment, or mutations.
 */
import { db } from "@workspace/db";
import {
  bankTransactionsTable,
  companiesTable,
  purchaseBillsTable,
  salesCreditNotesTable,
  salesInvoicesTable,
  supplierCreditNotesTable,
  vatAdjustmentsTable,
  vatExceptionsTable,
  vatReturnAuditsTable,
  vatReturnsTable,
  vatTaxRulesTable,
} from "@workspace/db/schema";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { VATBoxMap } from "./vatMath.js";
import { isAdjustableVATBox } from "./vatMath.js";

const toPence = (value: unknown) => Math.round(Number(value ?? 0) * 100);
const toMoney = (pence: number) => Math.round(pence) / 100;
const isoToday = () => new Date().toISOString().slice(0, 10);
const dateInPeriod = (value: string | null, start: string, end: string) => Boolean(value && value >= start && value <= end);
const activeDocument = (status: string | null) => status !== "draft" && status !== "cancelled";
const standardRates = [0, 5, 20];

type BoxMap = VATBoxMap;
type SourceType = "sales_invoice" | "sales_credit_note" | "purchase_bill" | "supplier_credit_note";

export interface VATTransactionReview {
  treatment: "source_document" | "pending_source_document" | "standard_rate_provisional" | "unusual_rate" | "unsupported_vat_setup";
  review_required: boolean;
  detail: string;
  rate: number | null;
}

/**
 * Deterministic VAT treatment for a bank-feed item before it is reconciled.
 * Bank transactions do not contribute directly to Boxes 1–9: source invoices
 * and bills do. This prevents a bank-feed VAT rate from silently changing a
 * return while still identifying unsupported setups and unusual provisional
 * rates for the review queue.
 */
export async function getVATTransactionReview(
  companyId: string,
  transaction: Pick<typeof bankTransactionsTable.$inferSelect, "vat_rate">,
  matchedRecords: Array<{ record_type: string; record_id: string; confidence: number }> = [],
): Promise<VATTransactionReview> {
  const [company] = await db.select({
    vat_scheme: companiesTable.vat_scheme,
    vat_accounting_basis: companiesTable.vat_accounting_basis,
  }).from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
  if (!company) throw new Error("Company not found");
  if ((company.vat_scheme && company.vat_scheme !== "standard") ||
    (company.vat_accounting_basis && company.vat_accounting_basis !== "invoice")) {
    return {
      treatment: "unsupported_vat_setup",
      review_required: true,
      rate: transaction.vat_rate == null ? null : Number(transaction.vat_rate),
      detail: "VAT setup is outside the currently supported standard, invoice-basis treatment; review before relying on VAT analysis.",
    };
  }
  // A credible invoice or bill is the authoritative source for VAT treatment.
  // The bank feed rate is never used to calculate Boxes 1–9.
  const invoiceIds = matchedRecords
    .filter((match) => match.record_type === "sales_invoice" && match.confidence >= 50)
    .map((match) => match.record_id);
  const billIds = matchedRecords
    .filter((match) => match.record_type === "purchase_bill" && match.confidence >= 50)
    .map((match) => match.record_id);
  if (invoiceIds.length || billIds.length) {
    const [invoices, bills] = await Promise.all([
      invoiceIds.length
        ? db.select().from(salesInvoicesTable).where(and(eq(salesInvoicesTable.company_id, companyId), inArray(salesInvoicesTable.id, invoiceIds)))
        : Promise.resolve([]),
      billIds.length
        ? db.select().from(purchaseBillsTable).where(and(eq(purchaseBillsTable.company_id, companyId), inArray(purchaseBillsTable.id, billIds)))
        : Promise.resolve([]),
    ]);
    const sources = [...invoices, ...bills];
    if (sources.length === invoiceIds.length + billIds.length) {
      const unusual = sources.some((source) => {
        const net = toPence(source.subtotal);
        const vat = toPence(source.vat_total);
        const rate = effectiveRate(net, vat);
        return net !== 0 && !standardRates.some((expected) => Math.abs(expected - rate) < 0.01);
      });
      if (unusual) {
        return {
          treatment: "unusual_rate",
          review_required: true,
          rate: null,
          detail: "A matched invoice or bill has an unusual VAT rate; confirm its source treatment before reconciliation.",
        };
      }
      return {
        treatment: "source_document",
        review_required: false,
        rate: null,
        detail: "VAT treatment was deterministically established from the matched invoice or bill. Bank-feed metadata does not change VAT return boxes.",
      };
    }
  }
  const rate = transaction.vat_rate == null || transaction.vat_rate === "" ? null : Number(transaction.vat_rate);
  if (rate == null || !Number.isFinite(rate)) {
    return {
      treatment: "pending_source_document",
      // A bank-feed entry without an explicit VAT treatment or linked source
      // document is insufficient evidence for a tax decision. It must never
      // promote an otherwise strong match into the ready-to-approve queue.
      review_required: true,
      rate: null,
      detail: "VAT is pending the linked invoice, bill, or source evidence; this bank item is not included in VAT return boxes.",
    };
  }
  if (!standardRates.some((expected) => Math.abs(expected - rate) < 0.01)) {
    return {
      treatment: "unusual_rate",
      review_required: true,
      rate,
      detail: `The provisional ${rate.toFixed(2)}% rate is outside standard UK VAT rates; confirm source evidence before reconciliation.`,
    };
  }
  return {
    treatment: "standard_rate_provisional",
    review_required: false,
    rate,
    detail: `A provisional ${rate.toFixed(2)}% rate is recorded. VAT boxes are still driven by the linked source document, not this bank feed entry.`,
  };
}

interface VatSource {
  id: string;
  source_record_type: SourceType | "vat_adjustment";
  number: string | null;
  counterparty: string | null;
  date: string | null;
  net: number;
  vat: number;
  sign: 1 | -1;
  box_contributions: Partial<BoxMap>;
}

interface VatExceptionCandidate {
  dedupe_key: string;
  source_record_type: string | null;
  source_record_id: string | null;
  exception_type: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
}

function emptyBoxes(): BoxMap {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
}

function effectiveRate(net: number, vat: number) {
  return net === 0 ? 0 : Math.abs(vat / net) * 100;
}

function toSchemaBoxes(boxes: BoxMap) {
  return {
    box1_output_vat: toMoney(boxes[1]).toFixed(2),
    box2_acquisitions_vat: toMoney(boxes[2]).toFixed(2),
    box3_total_vat_due: toMoney(boxes[3]).toFixed(2),
    box4_input_vat: toMoney(boxes[4]).toFixed(2),
    box5_net_vat_due: toMoney(boxes[5]).toFixed(2),
    box6_total_sales: toMoney(boxes[6]).toFixed(2),
    box7_total_purchases: toMoney(boxes[7]).toFixed(2),
    box8_eu_sales: toMoney(boxes[8]).toFixed(2),
    box9_eu_purchases: toMoney(boxes[9]).toFixed(2),
  };
}

function documentExceptions(
  source: VatSource,
  lineItems: unknown,
): VatExceptionCandidate[] {
  const output: VatExceptionCandidate[] = [];
  const rate = effectiveRate(source.net, source.vat);
  const base = {
    source_record_type: source.source_record_type,
    source_record_id: source.id,
    evidence: { document_number: source.number, date: source.date, net: toMoney(source.net), vat: toMoney(source.vat), effective_rate: rate },
  };
  if (source.net !== 0 && source.vat !== 0 && !standardRates.some((allowed) => Math.abs(rate - allowed) < 0.01)) {
    output.push({
      ...base,
      dedupe_key: `vat:unusual-rate:${source.source_record_type}:${source.id}`,
      exception_type: "unusual_rate",
      severity: "medium",
      title: `Unusual ${rate.toFixed(1)}% VAT rate`,
      detail: `${source.number ?? "This document"} has an effective VAT rate outside the configured standard, reduced, or zero rates. Mixed-rate documents may be valid; confirm before the return is approved.`,
    });
  }
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    const noCodes = lineItems.every((item) => {
      const line = item as Record<string, unknown>;
      return line.vat_rate == null && line.vatRate == null && line.vat_code == null && line.vatCode == null;
    });
    if (noCodes) {
      output.push({
        ...base,
        dedupe_key: `vat:missing-treatment:${source.source_record_type}:${source.id}`,
        exception_type: "missing_treatment",
        severity: "medium",
        title: "VAT treatment is not recorded on line items",
        detail: `${source.number ?? "This document"} has line items but no VAT rate or tax code metadata. Review the treatment before relying on the return.`,
      });
    }
  }
  return output;
}

function addSource(boxes: BoxMap, source: VatSource) {
  for (const [box, amount] of Object.entries(source.box_contributions)) {
    boxes[Number(box)] += amount ?? 0;
  }
}

function periodBefore(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(startDate.getTime() - 86_400_000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86_400_000);
  return { start: previousStart.toISOString().slice(0, 10), end: previousEnd.toISOString().slice(0, 10) };
}

export async function getVATOverview(companyId: string, requestedStart?: string, requestedEnd?: string) {
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
  if (!company) throw new Error("Company not found");
  if (company.vat_scheme && company.vat_scheme !== "standard") {
    throw new Error("VAT Assistant calculations currently support the standard VAT scheme only. Update VAT settings before preparing a return.");
  }
  if (company.vat_accounting_basis && company.vat_accounting_basis !== "invoice") {
    throw new Error("VAT Assistant calculations currently support invoice-basis VAT only. Update VAT settings before preparing a return.");
  }
  const end = requestedEnd ?? company.vat_period_end ?? isoToday();
  const start = requestedStart ?? company.vat_period_start ?? new Date(new Date(`${end}T00:00:00Z`).getTime() - 89 * 86_400_000).toISOString().slice(0, 10);
  if (start > end) throw new Error("VAT period start must be before the period end");

  const [invoices, bills, salesCredits, supplierCredits, adjustments, taxRules] = await Promise.all([
    db.select().from(salesInvoicesTable).where(eq(salesInvoicesTable.company_id, companyId)),
    db.select().from(purchaseBillsTable).where(eq(purchaseBillsTable.company_id, companyId)),
    db.select().from(salesCreditNotesTable).where(eq(salesCreditNotesTable.company_id, companyId)),
    db.select().from(supplierCreditNotesTable).where(eq(supplierCreditNotesTable.company_id, companyId)),
    db.select().from(vatAdjustmentsTable).where(and(eq(vatAdjustmentsTable.company_id, companyId), eq(vatAdjustmentsTable.status, "approved"), eq(vatAdjustmentsTable.period_start, start), eq(vatAdjustmentsTable.period_end, end))),
    db.select().from(vatTaxRulesTable).where(and(eq(vatTaxRulesTable.company_id, companyId), eq(vatTaxRulesTable.is_active, true))),
  ]);
  const boxes = emptyBoxes();
  const sources: VatSource[] = [];
  const exceptions: VatExceptionCandidate[] = [];
  const collect = (
    rows: Array<Record<string, unknown>>,
    sourceType: SourceType,
    dateField: string,
    numberField: string,
    nameField: string,
    sign: 1 | -1,
    target: "sales" | "purchase",
  ) => {
    for (const row of rows) {
      const date = (row[dateField] as string | null) ?? null;
      if (!activeDocument(row.status as string | null) || !dateInPeriod(date, start, end)) continue;
      const net = toPence(row.subtotal);
      const vat = toPence(row.vat_total);
      const contribution: Partial<BoxMap> = target === "sales"
        ? { 1: sign * vat, 6: sign * net }
        : { 4: sign * vat, 7: sign * net };
      const source: VatSource = {
        id: row.id as string,
        source_record_type: sourceType,
        number: (row[numberField] as string | null) ?? null,
        counterparty: (row[nameField] as string | null) ?? null,
        date,
        net,
        vat,
        sign,
        box_contributions: contribution,
      };
      sources.push(source);
      addSource(boxes, source);
      // Company tax rules are advisory references until individual document lines
      // store a rule/code association. Applying one company-wide rate here would
      // incorrectly mark legitimate zero- or reduced-rate documents as errors.
      exceptions.push(...documentExceptions(source, row.line_items));
    }
  };
  collect(invoices as Array<Record<string, unknown>>, "sales_invoice", "issue_date", "invoice_number", "customer_name", 1, "sales");
  collect(salesCredits as Array<Record<string, unknown>>, "sales_credit_note", "credit_note_date", "credit_note_number", "customer_name", -1, "sales");
  collect(bills as Array<Record<string, unknown>>, "purchase_bill", "bill_date", "bill_number", "supplier_name", 1, "purchase");
  collect(supplierCredits as Array<Record<string, unknown>>, "supplier_credit_note", "credit_note_date", "credit_note_number", "supplier_name", -1, "purchase");

  for (const adjustment of adjustments) {
    const amount = toPence(adjustment.amount);
    boxes[adjustment.box_number] += amount;
    sources.push({
      id: adjustment.id, source_record_type: "vat_adjustment", number: "Manual adjustment", counterparty: null, date: adjustment.approved_at?.toISOString().slice(0, 10) ?? null, net: 0, vat: amount, sign: 1,
      box_contributions: { [adjustment.box_number]: amount },
    });
  }
  boxes[3] = boxes[1] + boxes[2];
  boxes[5] = boxes[3] - boxes[4];

  // Likely duplicates are deliberately warnings: a human determines whether two
  // documents represent distinct supplies or a duplicate entry.
  const byFingerprint = new Map<string, VatSource[]>();
  for (const source of sources.filter((entry) => entry.source_record_type !== "vat_adjustment")) {
    const fingerprint = `${source.source_record_type}:${source.number ?? ""}:${source.net}:${source.vat}`;
    const group = byFingerprint.get(fingerprint) ?? [];
    group.push(source);
    byFingerprint.set(fingerprint, group);
  }
  for (const group of byFingerprint.values()) {
    if (group.length > 1 && group[0]?.number) {
      exceptions.push({
        dedupe_key: `vat:possible-duplicate:${group.map((entry) => entry.id).sort().join(":")}`,
        source_record_type: group[0].source_record_type,
        source_record_id: group[0].id,
        exception_type: "possible_duplicate",
        severity: "medium",
        title: "Possible duplicate VAT document",
        detail: `${group.length} documents share the same number and VAT values. Confirm whether they are distinct before approving the return.`,
        evidence: { document_ids: group.map((entry) => entry.id), document_number: group[0].number },
      });
    }
  }

  const prior = periodBefore(start, end);
  const currentSales = boxes[6];
  const today = isoToday();
  const trailingStart = new Date(Date.now() - 364 * 86_400_000).toISOString().slice(0, 10);
  const trailingSales = invoices
    .filter((invoice) => activeDocument(invoice.status) && invoice.issue_date && invoice.issue_date >= trailingStart && invoice.issue_date <= today)
    .reduce((sum, invoice) => sum + toPence(invoice.subtotal), 0);
  const threshold = toPence(company.vat_registration_threshold ?? 90000);
  const days = Math.max(1, Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000) + 1);
  const annualisedSales = Math.round(currentSales * (365 / days));
  const severityPenalty = exceptions.reduce((sum, item) => sum + (item.severity === "high" ? 18 : item.severity === "medium" ? 7 : 3), 0);
  const healthScore = Math.max(0, 100 - Math.min(90, severityPenalty));
  const thresholdStatus = trailingSales >= threshold ? "over_threshold" : trailingSales >= threshold * 0.85 ? "near_threshold" : "below_threshold";

  return {
    period: { start, end, prior_start: prior.start, prior_end: prior.end },
    settings: {
      vat_registered: company.vat_registered ?? false, vat_number: company.vat_number, scheme: company.vat_scheme ?? "standard",
      frequency: company.vat_return_frequency ?? "quarterly", accounting_basis: company.vat_accounting_basis ?? "invoice",
      return_due_days: company.vat_return_due_days ?? 37, threshold: toMoney(threshold),
    },
    boxes: Object.fromEntries(Object.entries(boxes).map(([box, value]) => [box, toMoney(value)])),
    schema_boxes: toSchemaBoxes(boxes),
    sources: sources.map((source) => ({ ...source, net: toMoney(source.net), vat: toMoney(source.vat), box_contributions: Object.fromEntries(Object.entries(source.box_contributions).map(([box, amount]) => [box, toMoney(amount ?? 0)])) })),
    exceptions,
    health: {
      score: healthScore,
      band: healthScore >= 85 ? "healthy" : healthScore >= 60 ? "review" : "at_risk",
      open_exception_count: exceptions.length,
      high_risk_count: exceptions.filter((item) => item.severity === "high").length,
    },
    forecast: {
      annualised_taxable_sales: toMoney(annualisedSales),
      estimated_vat_reserve: Math.max(0, toMoney(boxes[5])),
      period_sales: toMoney(currentSales),
      comparison: { prior_period: prior, change_in_sales: null, note: "Prior-period comparison is available once a matching return or period has been prepared." },
    },
    registration_monitor: {
      taxable_sales_last_12_months: toMoney(trailingSales),
      threshold: toMoney(threshold),
      percentage_of_threshold: threshold ? Math.round((trailingSales / threshold) * 1000) / 10 : 0,
      status: thresholdStatus,
      message: thresholdStatus === "over_threshold"
        ? "Taxable sales have reached the configured registration threshold. Review your registration obligation with an adviser."
        : thresholdStatus === "near_threshold"
          ? "Taxable sales are approaching the configured registration threshold. Monitor the rolling 12-month total."
          : "Taxable sales are below the configured registration threshold.",
    },
    tax_rules: taxRules.map((rule) => ({ id: rule.id, code: rule.code, label: rule.label, rate: Number(rule.rate), treatment: rule.treatment, effective_from: rule.effective_from, effective_to: rule.effective_to, is_recoverable: rule.is_recoverable })),
  };
}

export async function syncVATExceptions(companyId: string, userId?: string, start?: string, end?: string) {
  const overview = await getVATOverview(companyId, start, end);
  await db.transaction(async (tx) => {
    for (const exception of overview.exceptions) {
      await tx.insert(vatExceptionsTable).values({
        company_id: companyId, dedupe_key: exception.dedupe_key, period_start: overview.period.start, period_end: overview.period.end,
        source_record_type: exception.source_record_type, source_record_id: exception.source_record_id, exception_type: exception.exception_type,
        severity: exception.severity, title: exception.title, detail: exception.detail, evidence: exception.evidence, status: "open",
      }).onConflictDoUpdate({
        target: [vatExceptionsTable.company_id, vatExceptionsTable.dedupe_key],
        set: {
          severity: exception.severity,
          title: exception.title,
          detail: exception.detail,
          evidence: exception.evidence,
          status: sql`case when ${vatExceptionsTable.evidence} is distinct from excluded.evidence then 'open' else ${vatExceptionsTable.status} end`,
          updated_at: new Date(),
        },
      });
    }
  });
  await auditVAT(companyId, null, "vat_review_refreshed", `VAT review refreshed with ${overview.exceptions.length} exception${overview.exceptions.length === 1 ? "" : "s"}.`, { period: overview.period }, userId);
  return overview;
}

type VATAuditDatabase = Pick<typeof db, "insert">;

async function auditVAT(
  companyId: string,
  vatReturnId: string | null,
  eventType: string,
  description: string,
  metadata?: Record<string, unknown>,
  userId?: string,
  database: VATAuditDatabase = db,
) {
  await database.insert(vatReturnAuditsTable).values({
    company_id: companyId, vat_return_id: vatReturnId, event_type: eventType, description, metadata: metadata ?? null, user_id: userId ?? null,
  });
}

export async function createVATReturn(companyId: string, start: string, end: string, userId: string) {
  const existing = await db.select({ id: vatReturnsTable.id }).from(vatReturnsTable)
    .where(and(eq(vatReturnsTable.company_id, companyId), eq(vatReturnsTable.period_start, start), eq(vatReturnsTable.period_end, end), eq(vatReturnsTable.revision_number, 1))).limit(1);
  if (existing[0]) throw new Error("A VAT return already exists for this period. Open it to record an adjustment or create an explicit revision.");
  const overview = await syncVATExceptions(companyId, userId, start, end);
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
  const [created] = await db.insert(vatReturnsTable).values({
    company_id: companyId, period_start: start, period_end: end, vat_scheme: company?.vat_scheme ?? "standard",
    ...overview.schema_boxes, status: "draft", locked: false, calculation_snapshot: overview,
  }).returning();
  await auditVAT(companyId, created!.id, "vat_return_created", "VAT return created from the deterministic calculation engine.", { period: overview.period }, userId);
  return { vat_return: created, overview };
}

export async function createVATRevision(companyId: string, vatReturnId: string, userId: string) {
  const detail = await getVATReturnDetail(companyId, vatReturnId);
  if (!detail.vat_return.locked) throw new Error("Only an approved and locked VAT return can be revised.");
  const start = detail.vat_return.period_start;
  const end = detail.vat_return.period_end;
  if (!start || !end) throw new Error("VAT return period is missing");
  const periodReturns = await db.select({ revision_number: vatReturnsTable.revision_number }).from(vatReturnsTable)
    .where(and(eq(vatReturnsTable.company_id, companyId), eq(vatReturnsTable.period_start, start), eq(vatReturnsTable.period_end, end)));
  const revisionNumber = Math.max(...periodReturns.map((row) => row.revision_number ?? 1)) + 1;
  const overview = await syncVATExceptions(companyId, userId, start, end);
  const [revision] = await db.insert(vatReturnsTable).values({
    company_id: companyId, period_start: start, period_end: end, vat_scheme: detail.vat_return.vat_scheme ?? "standard",
    ...overview.schema_boxes, status: "draft", locked: false, calculation_snapshot: overview,
    revision_of_id: vatReturnId, revision_number: revisionNumber,
  }).returning();
  await auditVAT(companyId, revision!.id, "vat_return_revision_created", `VAT return revision ${revisionNumber} created from locked return ${vatReturnId}.`, { revision_of_id: vatReturnId, revision_number: revisionNumber }, userId);
  return { vat_return: revision, overview };
}

export async function getVATReturnDetail(companyId: string, vatReturnId: string) {
  const [vatReturn] = await db.select().from(vatReturnsTable).where(and(eq(vatReturnsTable.id, vatReturnId), eq(vatReturnsTable.company_id, companyId))).limit(1);
  if (!vatReturn) throw new Error("VAT return not found");
  const [audits, adjustments] = await Promise.all([
    db.select().from(vatReturnAuditsTable).where(eq(vatReturnAuditsTable.vat_return_id, vatReturnId)).orderBy(desc(vatReturnAuditsTable.created_at)),
    db.select().from(vatAdjustmentsTable).where(and(eq(vatAdjustmentsTable.vat_return_id, vatReturnId), eq(vatAdjustmentsTable.company_id, companyId))).orderBy(desc(vatAdjustmentsTable.created_at)),
  ]);
  const exceptions = await listVATExceptions(companyId, vatReturn.period_start ?? undefined, vatReturn.period_end ?? undefined);
  return { vat_return: vatReturn, overview: vatReturn.calculation_snapshot ?? await getVATOverview(companyId, vatReturn.period_start ?? undefined, vatReturn.period_end ?? undefined), audits, adjustments, exceptions };
}

export async function recalculateVATReturn(companyId: string, vatReturnId: string, userId: string) {
  const detail = await getVATReturnDetail(companyId, vatReturnId);
  if (detail.vat_return.locked) throw new Error("Approved VAT returns are locked. Create an explicit adjustment or revision instead.");
  const overview = await syncVATExceptions(companyId, userId, detail.vat_return.period_start!, detail.vat_return.period_end!);
  const updated = await db.transaction(async (tx) => {
    const [recalculated] = await tx.update(vatReturnsTable).set({ ...overview.schema_boxes, calculation_snapshot: overview, updated_at: new Date() })
      .where(and(eq(vatReturnsTable.id, vatReturnId), eq(vatReturnsTable.company_id, companyId), eq(vatReturnsTable.locked, false))).returning();
    if (!recalculated) throw new Error("The VAT return was approved and locked while it was being recalculated.");
    await auditVAT(companyId, vatReturnId, "vat_return_recalculated", "VAT return recalculated from live source records.", { period: overview.period }, userId, tx);
    return recalculated;
  });
  return { vat_return: updated, overview };
}

export async function markVATReturnReady(companyId: string, vatReturnId: string, userId: string) {
  const detail = await getVATReturnDetail(companyId, vatReturnId);
  if (detail.vat_return.locked) throw new Error("Approved VAT returns are locked.");
  const [updated] = await db.update(vatReturnsTable).set({ status: "ready_for_review", updated_at: new Date() })
    .where(and(eq(vatReturnsTable.id, vatReturnId), eq(vatReturnsTable.company_id, companyId), eq(vatReturnsTable.locked, false))).returning();
  if (!updated) throw new Error("The VAT return was approved and locked while it was being updated.");
  await auditVAT(companyId, vatReturnId, "vat_return_ready", "VAT return marked ready for review.", undefined, userId);
  return updated;
}

export async function approveVATReturn(companyId: string, vatReturnId: string, userId: string, note?: string) {
  const detail = await getVATReturnDetail(companyId, vatReturnId);
  if (detail.vat_return.locked) throw new Error("This VAT return has already been approved and locked.");
  const openHigh = (await listVATExceptions(companyId, detail.vat_return.period_start ?? undefined, detail.vat_return.period_end ?? undefined))
    .filter((item) => item.severity === "high" && item.status === "open");
  if (openHigh.length > 0) throw new Error("Resolve or explicitly review high-risk VAT exceptions before approving this return.");
  const now = new Date();
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(vatReturnsTable).set({
      status: "approved", locked: true, approved_by: userId, approved_at: now, locked_by: userId, locked_at: now, approval_note: note ?? null, updated_at: now,
    }).where(and(eq(vatReturnsTable.id, vatReturnId), eq(vatReturnsTable.company_id, companyId), eq(vatReturnsTable.locked, false))).returning();
    if (!updated) throw new Error("The VAT return was already locked by another review.");
    await auditVAT(companyId, vatReturnId, "vat_return_approved", "VAT return approved and locked. Ledgerly has not submitted anything to HMRC.", { note: note ?? null }, userId, tx);
    return updated;
  });
}

export async function listVATExceptions(companyId: string, start?: string, end?: string) {
  const conditions = [eq(vatExceptionsTable.company_id, companyId)];
  if (start) conditions.push(eq(vatExceptionsTable.period_start, start));
  if (end) conditions.push(eq(vatExceptionsTable.period_end, end));
  return db.select().from(vatExceptionsTable).where(and(...conditions)).orderBy(desc(vatExceptionsTable.created_at));
}

export async function resolveVATException(companyId: string, exceptionId: string, userId: string, note: string) {
  const [updated] = await db.update(vatExceptionsTable).set({ status: "resolved", resolved_by: userId, resolved_at: new Date(), resolution_note: note, updated_at: new Date() })
    .where(and(eq(vatExceptionsTable.id, exceptionId), eq(vatExceptionsTable.company_id, companyId))).returning();
  if (!updated) throw new Error("VAT exception not found");
  await auditVAT(companyId, null, "vat_exception_resolved", `VAT exception "${updated.title}" was marked reviewed.`, { exception_id: exceptionId, note }, userId);
  return updated;
}

export async function updateVATSettings(companyId: string, settings: Record<string, unknown>, userId: string) {
  const allowed = ["vat_registered", "vat_number", "vat_scheme", "vat_return_frequency", "vat_accounting_basis", "vat_period_start", "vat_period_end", "vat_return_due_days", "vat_registration_threshold", "vat_threshold_monitoring"] as const;
  const values = Object.fromEntries(allowed.filter((key) => settings[key] !== undefined).map((key) => [key, settings[key]]));
  if (Object.keys(values).length === 0) throw new Error("No VAT settings were provided");
  if (values.vat_scheme && values.vat_scheme !== "standard") throw new Error("This VAT Assistant currently supports the standard VAT scheme only.");
  if (values.vat_accounting_basis && values.vat_accounting_basis !== "invoice") throw new Error("This VAT Assistant currently supports invoice-basis VAT only.");
  const [company] = await db.update(companiesTable).set({ ...values, updated_at: new Date() }).where(eq(companiesTable.id, companyId)).returning();
  await auditVAT(companyId, null, "vat_settings_updated", "VAT settings updated.", { settings: values }, userId);
  return company;
}

export async function addVATTaxRule(companyId: string, rule: Record<string, unknown>, userId: string) {
  const code = String(rule.code ?? "").trim().toUpperCase();
  const label = String(rule.label ?? "").trim();
  const rate = Number(rule.rate);
  const effectiveFrom = String(rule.effective_from ?? "");
  if (!code || !label || !Number.isFinite(rate) || rate < 0 || rate > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw new Error("A valid code, label, rate, and effective start date are required");
  const [created] = await db.insert(vatTaxRulesTable).values({
    company_id: companyId, code, label, rate: rate.toFixed(2), treatment: String(rule.treatment ?? "standard"),
    effective_from: effectiveFrom, effective_to: rule.effective_to ? String(rule.effective_to) : null, is_recoverable: rule.is_recoverable !== false, is_active: true,
  }).returning();
  await auditVAT(companyId, null, "vat_tax_rule_created", `VAT tax rule ${code} created.`, { rule_id: created!.id }, userId);
  return created;
}

export async function createVATAdjustment(companyId: string, vatReturnId: string | null, input: { period_start: string; period_end: string; box_number: number; amount: number; reason: string }, userId: string) {
  if (!Number.isInteger(input.box_number) || !isAdjustableVATBox(input.box_number) || !Number.isFinite(input.amount) || !input.reason.trim()) throw new Error("Manual adjustments are allowed only for Boxes 1, 2, 4, 6, 7, 8, or 9. Boxes 3 and 5 are calculated automatically.");
  if (vatReturnId) {
    const [vatReturn] = await db.select({ id: vatReturnsTable.id, period_start: vatReturnsTable.period_start, period_end: vatReturnsTable.period_end })
      .from(vatReturnsTable)
      .where(and(eq(vatReturnsTable.id, vatReturnId), eq(vatReturnsTable.company_id, companyId))).limit(1);
    if (!vatReturn) throw new Error("VAT return not found for this company");
    if (vatReturn.period_start !== input.period_start || vatReturn.period_end !== input.period_end) throw new Error("VAT adjustment period must match the selected VAT return");
  }
  const [created] = await db.insert(vatAdjustmentsTable).values({
    company_id: companyId, vat_return_id: vatReturnId, period_start: input.period_start, period_end: input.period_end,
    box_number: input.box_number, amount: input.amount.toFixed(2), reason: input.reason.trim(), status: "pending", created_by: userId,
  }).returning();
  await auditVAT(companyId, vatReturnId, "vat_adjustment_created", "Manual VAT adjustment recorded for approval; no accounting record was changed.", { adjustment_id: created!.id }, userId);
  return created;
}

export async function approveVATAdjustment(companyId: string, adjustmentId: string, userId: string) {
  const [updated] = await db.update(vatAdjustmentsTable).set({ status: "approved", approved_by: userId, approved_at: new Date(), updated_at: new Date() })
    .where(and(eq(vatAdjustmentsTable.id, adjustmentId), eq(vatAdjustmentsTable.company_id, companyId), eq(vatAdjustmentsTable.status, "pending"))).returning();
  if (!updated) throw new Error("VAT adjustment is unavailable or has already been decided");
  await auditVAT(companyId, updated.vat_return_id, "vat_adjustment_approved", "Manual VAT adjustment approved. It is recorded as an explicit adjustment event.", { adjustment_id: updated.id }, userId);
  return updated;
}

export function explainVATOverview(overview: Awaited<ReturnType<typeof getVATOverview>>, question?: string) {
  const box5 = Number(overview.boxes[5] ?? 0);
  const health = overview.health;
  const direction = box5 >= 0 ? `a VAT liability of £${box5.toFixed(2)}` : `an estimated reclaim of £${Math.abs(box5).toFixed(2)}`;
  return {
    explanation: `For ${overview.period.start} to ${overview.period.end}, the deterministic VAT calculation shows ${direction}. The health score is ${health.score}/100 with ${health.open_exception_count} item${health.open_exception_count === 1 ? "" : "s"} for review. ${overview.registration_monitor.message}`,
    recommendation: health.high_risk_count > 0
      ? "Review the high-risk exceptions and their source documents before approving the return."
      : "Review the box drill-down and any flagged exceptions before approving the return.",
    scope_note: question ? "This response explains recorded VAT data only; it is not tax or legal advice." : "This is an explanation of recorded data, not tax advice.",
  };
}