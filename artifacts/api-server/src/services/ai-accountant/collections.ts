/**
 * Phase 4C customer collections service.
 *
 * Facts, risk bands and task priorities are derived deterministically from
 * invoices and reconciled receipts. AI is only used on demand to improve the
 * wording of a reminder draft; it cannot send a message or alter accounting
 * records.
 */
import { db } from "@workspace/db";
import {
  bankTransactionsTable,
  companiesTable,
  customersTable,
  salesInvoicesTable,
  workflowActivitiesTable,
} from "@workspace/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { aiService } from "../ai/index.js";
import {
  analyseCollections,
  type CollectionInvoiceAssessment,
  type CollectionPriority,
  type CollectionsAnalysis,
} from "./collectionsAnalysis.js";

export type ReminderTone = "friendly" | "professional" | "firm" | "final";

export interface CollectionTaskCandidate {
  dedupe_key: string;
  task_type: "customer_follow_up";
  priority: CollectionPriority;
  title: string;
  description: string;
  amount: number;
  confidence_score: number;
  source_record_id: string;
  source_record_type: "sales_invoice";
  recommendation: string;
  evidence: Record<string, unknown>;
  route: string;
}

export interface ReminderDraft {
  invoice_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  tone: ReminderTone;
  subject: string;
  body: string;
  source: "ai" | "template";
  provider?: string;
  model?: string;
}

const reminderTones: ReminderTone[] = ["friendly", "professional", "firm", "final"];
const isReminderTone = (value: unknown): value is ReminderTone => reminderTones.includes(value as ReminderTone);
const pence = (value: unknown) => Math.round(Number(value || 0) * 100);
const gbp = (value: unknown) => `£${(pence(value) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

export async function getCollectionsOverview(companyId: string): Promise<CollectionsAnalysis & {
  reminder_history: Record<string, typeof workflowActivitiesTable.$inferSelect[]>;
}> {
  const [invoices, customers, payments, activities] = await Promise.all([
    db.select().from(salesInvoicesTable).where(eq(salesInvoicesTable.company_id, companyId)),
    db.select().from(customersTable).where(eq(customersTable.company_id, companyId)),
    db.select().from(bankTransactionsTable).where(eq(bankTransactionsTable.company_id, companyId)),
    db.select().from(workflowActivitiesTable)
      .where(and(
        eq(workflowActivitiesTable.company_id, companyId),
        eq(workflowActivitiesTable.entity_type, "sales_invoice"),
      ))
      .orderBy(desc(workflowActivitiesTable.event_date))
      .limit(500),
  ]);
  const analysis = analyseCollections(invoices, customers, payments);
  const reminderHistory: Record<string, typeof workflowActivitiesTable.$inferSelect[]> = {};
  for (const activity of activities) {
    if (!activity.entity_id || !activity.event_type?.startsWith("reminder_")) continue;
    const current = reminderHistory[activity.entity_id] ?? [];
    current.push(activity);
    reminderHistory[activity.entity_id] = current;
  }
  return { ...analysis, reminder_history: reminderHistory };
}

/** Individual, stable AI task candidates for every currently overdue invoice. */
export async function buildCustomerFollowUpTasks(companyId: string): Promise<CollectionTaskCandidate[]> {
  const overview = await getCollectionsOverview(companyId);
  return overview.overdue_invoices.map((invoice) => ({
    dedupe_key: `customer_follow_up:${invoice.invoice_id}`,
    task_type: "customer_follow_up" as const,
    priority: invoice.priority,
    title: `${invoice.invoice_number} is ${invoice.days_overdue} days overdue`,
    description: `${gbp(invoice.balance_due)} remains outstanding from ${invoice.customer_name}. ${invoice.explanation}`,
    amount: invoice.balance_due,
    confidence_score: 100,
    source_record_id: invoice.invoice_id,
    source_record_type: "sales_invoice" as const,
    recommendation: invoice.recommended_action,
    evidence: collectionEvidence(invoice),
    route: `/invoices/${encodeURIComponent(invoice.invoice_id)}/view`,
  }));
}

function collectionEvidence(invoice: CollectionInvoiceAssessment) {
  return {
    invoice_number: invoice.invoice_number,
    customer_name: invoice.customer_name,
    invoice_date: invoice.issue_date,
    due_date: invoice.due_date,
    invoice_amount: invoice.invoice_amount,
    amount_paid: invoice.amount_paid,
    balance_due: invoice.balance_due,
    days_overdue: invoice.days_overdue,
    payment_history: invoice.payment_history,
    previous_overdue_invoices: invoice.previous_overdue_invoices,
    average_payment_delay_days: invoice.average_payment_delay_days,
    customer_outstanding: invoice.customer_outstanding,
    customer_overdue: invoice.customer_overdue,
    customer_overdue_invoice_count: invoice.customer_overdue_invoice_count,
    payment_risk: { score: invoice.risk_score, label: invoice.risk_label },
    collection_priority: { score: invoice.priority_score, label: invoice.priority },
    explanation: invoice.explanation,
  };
}

async function loadReminderContext(companyId: string, invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(salesInvoicesTable)
    .where(and(eq(salesInvoicesTable.id, invoiceId), eq(salesInvoicesTable.company_id, companyId)))
    .limit(1);
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "cancelled" || invoice.status === "paid" || pence(invoice.balance_due) <= 0) {
    throw new Error("A reminder can only be drafted for an outstanding invoice");
  }
  const [customer, company] = await Promise.all([
    invoice.customer_id
      ? db.select().from(customersTable).where(and(eq(customersTable.id, invoice.customer_id), eq(customersTable.company_id, companyId))).limit(1)
      : Promise.resolve([]),
    db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1),
  ]);
  return { invoice, customer: customer[0] ?? null, company: company[0] ?? null };
}

function templateDraft({
  invoice,
  customer,
  company,
  tone,
}: Awaited<ReturnType<typeof loadReminderContext>> & { tone: ReminderTone }): Pick<ReminderDraft, "subject" | "body"> {
  const customerName = customer?.name || invoice.customer_name || "there";
  const businessName = company?.name || "Ledgerly";
  const invoiceNumber = invoice.invoice_number || "your invoice";
  const amount = gbp(invoice.balance_due);
  const dueDate = invoice.due_date || "the due date";
  const opening = tone === "friendly"
    ? "I hope you are well."
    : tone === "firm"
      ? "We are writing about the outstanding balance below."
      : tone === "final"
        ? "This is a final reminder about the outstanding balance below."
        : "I hope you are well. This is a reminder about the outstanding balance below.";
  const request = tone === "final"
    ? "Please contact us immediately to confirm when payment will be made."
    : tone === "firm"
      ? "Please confirm when payment will be made."
      : "Could you please let us know when we can expect payment?";
  return {
    subject: `${tone === "final" ? "Final payment reminder" : "Payment reminder"} – Invoice ${invoiceNumber}`,
    body: `Hi ${customerName},\n\n${opening}\n\nInvoice ${invoiceNumber} for ${amount} was due on ${dueDate} and remains outstanding.\n\n${request}\n\nIf payment has already been made, please disregard this message.\n\nKind regards,\n${businessName}`,
  };
}

function parseDraft(value: string, fallback: Pick<ReminderDraft, "subject" | "body">, tone: ReminderTone) {
  try {
    const parsed = JSON.parse(value.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim()) as { subject?: unknown; body?: unknown; tone?: unknown };
    if (typeof parsed.subject !== "string" || typeof parsed.body !== "string") return fallback;
    const subject = parsed.subject.trim().slice(0, 180);
    const body = parsed.body.trim().slice(0, 4_000);
    if (!subject || !body || (parsed.tone && parsed.tone !== tone)) return fallback;
    return { subject, body };
  } catch {
    return fallback;
  }
}

export async function generateReminderDraft(
  companyId: string,
  invoiceId: string,
  tone: ReminderTone,
  userId: string,
): Promise<ReminderDraft> {
  if (!isReminderTone(tone)) throw new Error("Reminder tone must be friendly, professional, firm, or final");
  const context = await loadReminderContext(companyId, invoiceId);
  const fallback = templateDraft({ ...context, tone });
  let draft = fallback;
  let source: ReminderDraft["source"] = "template";
  let provider: string | undefined;
  let model: string | undefined;

  try {
    const result = await aiService.complete({
      messages: [
        {
          role: "system",
          content: "You write concise UK business payment reminders. Use ONLY the factual fields supplied. Do not invent a recipient, payment date, bank details, legal consequences, invoice details, or contact details. This is a draft for review, not an email send. Return strict JSON only: {\"subject\":\"...\",\"body\":\"...\",\"tone\":\"friendly|professional|firm|final\"}.",
        },
        {
          role: "user",
          content: JSON.stringify({
            tone,
            company_name: context.company?.name ?? null,
            customer_name: context.customer?.name ?? context.invoice.customer_name ?? null,
            invoice_number: context.invoice.invoice_number ?? null,
            due_date: context.invoice.due_date ?? null,
            outstanding_balance_gbp: Number(context.invoice.balance_due ?? 0),
          }),
        },
      ],
      maxTokens: 450,
      temperature: 0.2,
    });
    draft = parseDraft(result.text, fallback, tone);
    if (draft !== fallback) {
      source = "ai";
      provider = result.provider;
      model = result.model;
    }
  } catch {
    // A transparent, actual-data template keeps the review workflow usable if
    // an optional language provider is unavailable.
  }

  await db.insert(workflowActivitiesTable).values({
    company_id: companyId,
    entity_type: "sales_invoice",
    entity_id: invoiceId,
    event_type: "reminder_draft_generated",
    description: `A ${tone} payment reminder draft was generated for ${context.invoice.invoice_number || "an invoice"}.`,
    event_date: new Date(),
    user_id: userId,
    metadata: {
      communication_type: "email",
      tone,
      subject: draft.subject,
      message: draft.body,
      source,
      provider: provider ?? null,
      model: model ?? null,
      customer_id: context.customer?.id ?? context.invoice.customer_id ?? null,
    },
  });

  return {
    invoice_id: invoiceId,
    customer_id: context.customer?.id ?? context.invoice.customer_id ?? null,
    customer_name: context.customer?.name || context.invoice.customer_name || "Customer",
    customer_email: context.customer?.email ?? null,
    tone,
    subject: draft.subject,
    body: draft.body,
    source,
    provider,
    model,
  };
}

function validEditableMessage(subject: string, body: string) {
  return subject.trim().length > 0 && subject.length <= 180 && body.trim().length > 0 && body.length <= 4_000;
}

export async function approveReminderForEmail(
  companyId: string,
  invoiceId: string,
  tone: ReminderTone,
  subject: string,
  body: string,
  userId: string,
): Promise<{ email: string; mailto: string; approval_id: string }> {
  if (!isReminderTone(tone) || !validEditableMessage(subject, body)) {
    throw new Error("Provide a subject up to 180 characters and a message up to 4,000 characters");
  }
  const context = await loadReminderContext(companyId, invoiceId);
  const [approval] = await db.insert(workflowActivitiesTable).values({
    company_id: companyId,
    entity_type: "sales_invoice",
    entity_id: invoiceId,
    event_type: "reminder_approved",
    description: `A ${tone} payment reminder was approved for email preparation.`,
    event_date: new Date(),
    user_id: userId,
    metadata: {
      communication_type: "email",
      delivery_status: "approved_for_email_client",
      tone,
      subject: subject.trim(),
      message: body.trim(),
      customer_id: context.customer?.id ?? context.invoice.customer_id ?? null,
    },
  }).returning({ id: workflowActivitiesTable.id });
  if (!approval) throw new Error("Could not record reminder approval");
  const email = context.customer?.email ?? "";
  return {
    email,
    mailto: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(body.trim())}`,
    approval_id: approval.id,
  };
}

function sameApprovedContent(metadata: unknown, tone: ReminderTone, subject: string, body: string) {
  if (!metadata || typeof metadata !== "object") return false;
  const details = metadata as { tone?: unknown; subject?: unknown; message?: unknown };
  return details.tone === tone && details.subject === subject.trim() && details.message === body.trim();
}

export async function recordReminderSent(
  companyId: string,
  invoiceId: string,
  tone: ReminderTone,
  subject: string,
  body: string,
  approvalId: string,
  userId: string,
) {
  if (!isReminderTone(tone) || !validEditableMessage(subject, body) || !approvalId) {
    throw new Error("Provide a valid approved reminder before recording it as sent");
  }
  const context = await loadReminderContext(companyId, invoiceId);
  await db.transaction(async (tx) => {
    // Serialise the one-time consumption of this approval. The lock is held
    // until this transaction commits or rolls back, closing the gap between
    // checking history and writing the sent audit event.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${approvalId}))`);
    const [approval] = await tx
      .select()
      .from(workflowActivitiesTable)
      .where(and(
        eq(workflowActivitiesTable.id, approvalId),
        eq(workflowActivitiesTable.company_id, companyId),
        eq(workflowActivitiesTable.entity_type, "sales_invoice"),
        eq(workflowActivitiesTable.entity_id, invoiceId),
        eq(workflowActivitiesTable.event_type, "reminder_approved"),
      ))
      .limit(1);
    if (!approval || !sameApprovedContent(approval.metadata, tone, subject, body)) {
      throw new Error("This reminder must be approved with its current content before it can be marked as sent");
    }
    const previousEvents = await tx
      .select({ metadata: workflowActivitiesTable.metadata })
      .from(workflowActivitiesTable)
      .where(and(
        eq(workflowActivitiesTable.company_id, companyId),
        eq(workflowActivitiesTable.entity_type, "sales_invoice"),
        eq(workflowActivitiesTable.entity_id, invoiceId),
        eq(workflowActivitiesTable.event_type, "reminder_sent"),
      ));
    if (previousEvents.some((event) => {
      const metadata = event.metadata as { approval_id?: unknown } | null;
      return metadata?.approval_id === approvalId;
    })) {
      throw new Error("This approved reminder has already been recorded as sent");
    }
    await tx.insert(workflowActivitiesTable).values({
      company_id: companyId,
      entity_type: "sales_invoice",
      entity_id: invoiceId,
      event_type: "reminder_sent",
      description: `A ${tone} payment reminder was marked as sent by the user.`,
      event_date: new Date(),
      user_id: userId,
      metadata: {
        communication_type: "email",
        delivery_status: "user_confirmed_sent",
        tone,
        subject: subject.trim(),
        message: body.trim(),
        approval_id: approvalId,
        customer_id: context.customer?.id ?? context.invoice.customer_id ?? null,
      },
    });
  });
}