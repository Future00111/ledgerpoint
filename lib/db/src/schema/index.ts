import {
  pgTable,
  index,
  uniqueIndex,
  text,
  boolean,
  integer,
  numeric,
  jsonb,
  timestamp,
  uuid,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";

// ─── helpers ────────────────────────────────────────────────────────────────

const primaryId = () =>
  uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

// ─── Company ─────────────────────────────────────────────────────────────────

export const companiesTable = pgTable("companies", {
  id: primaryId(),
  name: text("name").notNull(),
  registration_number: text("registration_number"),
  vat_number: text("vat_number"),
  address_line_1: text("address_line_1"),
  address_line_2: text("address_line_2"),
  city: text("city"),
  county: text("county"),
  postcode: text("postcode"),
  country: text("country").default("GB"),
  phone: text("phone"),
  email: text("email"),
  logo_url: text("logo_url"),
  financial_year_end: text("financial_year_end"),
  base_currency: text("base_currency").default("GBP"),
  default_vat_rate: numeric("default_vat_rate", { precision: 5, scale: 2 }),
  vat_registered: boolean("vat_registered").default(false),
  vat_scheme: text("vat_scheme").default("standard"),
  vat_return_frequency: text("vat_return_frequency").default("quarterly"),
  vat_accounting_basis: text("vat_accounting_basis").default("invoice"),
  vat_period_start: date("vat_period_start"),
  vat_period_end: date("vat_period_end"),
  vat_return_due_days: integer("vat_return_due_days").default(37),
  vat_registration_threshold: numeric("vat_registration_threshold", { precision: 12, scale: 2 }).default("90000"),
  vat_threshold_monitoring: boolean("vat_threshold_monitoring").default(true),
  invoice_prefix: text("invoice_prefix"),
  invoice_next_number: integer("invoice_next_number").default(1),
  business_type: text("business_type"),
  status: text("status").default("active"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true, created_at: true, updated_at: true });
export type Company = typeof companiesTable.$inferSelect;

// ─── CompanyUser ─────────────────────────────────────────────────────────────

export const companyUsersTable = pgTable("company_users", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  user_id: text("user_id").notNull(), // Clerk user id
  role: text("role").default("owner"),
  is_active: boolean("is_active").default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertCompanyUserSchema = createInsertSchema(companyUsersTable).omit({ id: true, created_at: true, updated_at: true });
export type CompanyUser = typeof companyUsersTable.$inferSelect;

// ─── Customer ────────────────────────────────────────────────────────────────

export const customersTable = pgTable("customers", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  name: text("name").notNull(),
  contact_name: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address_line_1: text("address_line_1"),
  address_line_2: text("address_line_2"),
  city: text("city"),
  county: text("county"),
  postcode: text("postcode"),
  country: text("country"),
  vat_number: text("vat_number"),
  customer_reference: text("customer_reference"),
  payment_terms: integer("payment_terms").default(30),
  credit_limit: numeric("credit_limit", { precision: 12, scale: 2 }),
  status: text("status").default("active"),
  notes: text("notes"),
  tags: jsonb("tags").$type<string[]>(),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, created_at: true, updated_at: true });
export type Customer = typeof customersTable.$inferSelect;

// ─── Supplier ────────────────────────────────────────────────────────────────

export const suppliersTable = pgTable("suppliers", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  name: text("name").notNull(),
  contact_name: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address_line_1: text("address_line_1"),
  address_line_2: text("address_line_2"),
  city: text("city"),
  county: text("county"),
  postcode: text("postcode"),
  country: text("country"),
  vat_number: text("vat_number"),
  supplier_reference: text("supplier_reference"),
  default_expense_category: text("default_expense_category"),
  payment_terms: integer("payment_terms").default(30),
  status: text("status").default("active"),
  notes: text("notes"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, created_at: true, updated_at: true });
export type Supplier = typeof suppliersTable.$inferSelect;

// ─── SalesInvoice ────────────────────────────────────────────────────────────

export const salesInvoicesTable = pgTable("sales_invoices", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  customer_id: uuid("customer_id"),
  customer_name: text("customer_name"),
  invoice_number: text("invoice_number"),
  issue_date: date("issue_date"),
  due_date: date("due_date"),
  payment_terms: integer("payment_terms").default(30),
  reference: text("reference"),
  line_items: jsonb("line_items").$type<object[]>(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default("0"),
  vat_total: numeric("vat_total", { precision: 12, scale: 2 }).default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).default("0"),
  amount_paid: numeric("amount_paid", { precision: 12, scale: 2 }).default("0"),
  balance_due: numeric("balance_due", { precision: 12, scale: 2 }).default("0"),
  status: text("status").default("draft"),
  notes: text("notes"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertSalesInvoiceSchema = createInsertSchema(salesInvoicesTable).omit({ id: true, created_at: true, updated_at: true });
export type SalesInvoice = typeof salesInvoicesTable.$inferSelect;

// ─── PurchaseBill ────────────────────────────────────────────────────────────

export const purchaseBillsTable = pgTable("purchase_bills", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  supplier_id: uuid("supplier_id"),
  supplier_name: text("supplier_name"),
  bill_number: text("bill_number"),
  bill_date: date("bill_date"),
  due_date: date("due_date"),
  payment_terms: integer("payment_terms").default(30),
  reference: text("reference"),
  line_items: jsonb("line_items").$type<object[]>(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default("0"),
  vat_total: numeric("vat_total", { precision: 12, scale: 2 }).default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).default("0"),
  amount_paid: numeric("amount_paid", { precision: 12, scale: 2 }).default("0"),
  balance_due: numeric("balance_due", { precision: 12, scale: 2 }).default("0"),
  status: text("status").default("draft"),
  category: text("category"),
  notes: text("notes"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertPurchaseBillSchema = createInsertSchema(purchaseBillsTable).omit({ id: true, created_at: true, updated_at: true });
export type PurchaseBill = typeof purchaseBillsTable.$inferSelect;

// ─── SalesCreditNote ─────────────────────────────────────────────────────────

export const salesCreditNotesTable = pgTable("sales_credit_notes", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  customer_id: uuid("customer_id"),
  customer_name: text("customer_name"),
  original_invoice_id: uuid("original_invoice_id"),
  credit_note_number: text("credit_note_number"),
  credit_note_date: date("credit_note_date"),
  reason: text("reason"),
  line_items: jsonb("line_items").$type<object[]>(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default("0"),
  vat_total: numeric("vat_total", { precision: 12, scale: 2 }).default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).default("0"),
  status: text("status").default("draft"),
  is_applied: boolean("is_applied").default(false),
  notes: text("notes"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertSalesCreditNoteSchema = createInsertSchema(salesCreditNotesTable).omit({ id: true, created_at: true, updated_at: true });
export type SalesCreditNote = typeof salesCreditNotesTable.$inferSelect;

// ─── SupplierCreditNote ───────────────────────────────────────────────────────

export const supplierCreditNotesTable = pgTable("supplier_credit_notes", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  supplier_id: uuid("supplier_id"),
  supplier_name: text("supplier_name"),
  original_bill_id: uuid("original_bill_id"),
  credit_note_number: text("credit_note_number"),
  credit_note_date: date("credit_note_date"),
  reason: text("reason"),
  line_items: jsonb("line_items").$type<object[]>(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default("0"),
  vat_total: numeric("vat_total", { precision: 12, scale: 2 }).default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).default("0"),
  status: text("status").default("draft"),
  is_applied: boolean("is_applied").default(false),
  notes: text("notes"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertSupplierCreditNoteSchema = createInsertSchema(supplierCreditNotesTable).omit({ id: true, created_at: true, updated_at: true });
export type SupplierCreditNote = typeof supplierCreditNotesTable.$inferSelect;

// ─── BankAccount ─────────────────────────────────────────────────────────────

export const bankAccountsTable = pgTable("bank_accounts", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  account_name: text("account_name").notNull(),
  account_number: text("account_number"),
  sort_code: text("sort_code"),
  bank_name: text("bank_name"),
  opening_balance: numeric("opening_balance", { precision: 12, scale: 2 }).default("0"),
  current_balance: numeric("current_balance", { precision: 12, scale: 2 }).default("0"),
  currency: text("currency").default("GBP"),
  account_type: text("account_type").default("current"),
  status: text("status").default("active"),
  connection_type: text("connection_type").default("manual"),
  open_banking_status: text("open_banking_status"),
  notes: text("notes"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertBankAccountSchema = createInsertSchema(bankAccountsTable).omit({ id: true, created_at: true, updated_at: true });
export type BankAccount = typeof bankAccountsTable.$inferSelect;

// ─── BankTransaction ─────────────────────────────────────────────────────────

export const bankTransactionsTable = pgTable("bank_transactions", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  bank_account_id: uuid("bank_account_id"),
  date: date("date"),
  description: text("description"),
  reference: text("reference"),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  money_in: numeric("money_in", { precision: 12, scale: 2 }),
  money_out: numeric("money_out", { precision: 12, scale: 2 }),
  balance: numeric("balance", { precision: 12, scale: 2 }),
  transaction_type: text("transaction_type"),
  status: text("status").default("unmatched"),
  matched_type: text("matched_type"),
  matched_record_id: text("matched_record_id"),
  matched_record_number: text("matched_record_number"),
  linked_invoice_id: uuid("linked_invoice_id"),
  linked_bill_id: uuid("linked_bill_id"),
  linked_credit_note_id: uuid("linked_credit_note_id"),
  category: text("category"),
  vat_rate: numeric("vat_rate", { precision: 5, scale: 2 }),
  notes: text("notes"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertBankTransactionSchema = createInsertSchema(bankTransactionsTable).omit({ id: true, created_at: true, updated_at: true });
export type BankTransaction = typeof bankTransactionsTable.$inferSelect;

// ─── ChartOfAccount ──────────────────────────────────────────────────────────

export const chartOfAccountsTable = pgTable("chart_of_accounts", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  code: text("code"),
  name: text("name").notNull(),
  account_type: text("account_type"),
  account_subtype: text("account_subtype"),
  description: text("description"),
  is_active: boolean("is_active").default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertChartOfAccountSchema = createInsertSchema(chartOfAccountsTable).omit({ id: true, created_at: true, updated_at: true });
export type ChartOfAccount = typeof chartOfAccountsTable.$inferSelect;

// ─── JournalEntry ────────────────────────────────────────────────────────────

export const journalEntriesTable = pgTable("journal_entries", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  date: date("date"),
  description: text("description"),
  reference: text("reference"),
  source_type: text("source_type"),
  source_record_id: text("source_record_id"),
  source_record_number: text("source_record_number"),
  lines: jsonb("lines").$type<object[]>(),
  total_debit: numeric("total_debit", { precision: 12, scale: 2 }).default("0"),
  total_credit: numeric("total_credit", { precision: 12, scale: 2 }).default("0"),
  status: text("status").default("draft"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({ id: true, created_at: true, updated_at: true });
export type JournalEntry = typeof journalEntriesTable.$inferSelect;

// ─── VATReturn ───────────────────────────────────────────────────────────────

export const vatReturnsTable = pgTable(
  "vat_returns",
  {
    id: primaryId(),
    company_id: uuid("company_id").notNull(),
    period_start: date("period_start"),
    period_end: date("period_end"),
    box1_output_vat: numeric("box1_output_vat", { precision: 12, scale: 2 }).default("0"),
    box2_acquisitions_vat: numeric("box2_acquisitions_vat", { precision: 12, scale: 2 }).default("0"),
    box3_total_vat_due: numeric("box3_total_vat_due", { precision: 12, scale: 2 }).default("0"),
    box4_input_vat: numeric("box4_input_vat", { precision: 12, scale: 2 }).default("0"),
    box5_net_vat_due: numeric("box5_net_vat_due", { precision: 12, scale: 2 }).default("0"),
    box6_total_sales: numeric("box6_total_sales", { precision: 12, scale: 2 }).default("0"),
    box7_total_purchases: numeric("box7_total_purchases", { precision: 12, scale: 2 }).default("0"),
    box8_eu_sales: numeric("box8_eu_sales", { precision: 12, scale: 2 }).default("0"),
    box9_eu_purchases: numeric("box9_eu_purchases", { precision: 12, scale: 2 }).default("0"),
    status: text("status").default("draft"),
    locked: boolean("locked").default(false),
    submission_date: date("submission_date"),
    vat_scheme: text("vat_scheme").default("standard"),
    calculation_snapshot: jsonb("calculation_snapshot").$type<Record<string, unknown>>(),
    approved_by: text("approved_by"),
    approved_at: timestamp("approved_at", { withTimezone: true }),
    locked_by: text("locked_by"),
    locked_at: timestamp("locked_at", { withTimezone: true }),
    revision_of_id: uuid("revision_of_id"),
    revision_number: integer("revision_number").default(1),
    approval_note: text("approval_note"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    uniqueIndex("vat_returns_company_period_revision_idx").on(t.company_id, t.period_start, t.period_end, t.revision_number),
  ],
);
export const insertVATReturnSchema = createInsertSchema(vatReturnsTable).omit({ id: true, created_at: true, updated_at: true });
export type VATReturn = typeof vatReturnsTable.$inferSelect;

// ─── VAT Assistant ───────────────────────────────────────────────────────────
// These workflow records deliberately sit alongside existing source documents.
// They never replace invoice, bill, credit-note, or bank-record VAT fields.

export const vatTaxRulesTable = pgTable(
  "vat_tax_rules",
  {
    id: primaryId(),
    company_id: uuid("company_id").notNull(),
    code: text("code").notNull(),
    label: text("label").notNull(),
    rate: numeric("rate", { precision: 5, scale: 2 }).notNull(),
    treatment: text("treatment").notNull().default("standard"),
    effective_from: date("effective_from").notNull(),
    effective_to: date("effective_to"),
    is_recoverable: boolean("is_recoverable").default(true),
    is_active: boolean("is_active").default(true),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    uniqueIndex("vat_tax_rules_company_code_start_idx").on(t.company_id, t.code, t.effective_from),
    index("vat_tax_rules_company_active_idx").on(t.company_id, t.is_active),
  ],
);
export const insertVATTaxRuleSchema = createInsertSchema(vatTaxRulesTable).omit({ id: true, created_at: true, updated_at: true });
export type VATTaxRule = typeof vatTaxRulesTable.$inferSelect;

export const vatExceptionsTable = pgTable(
  "vat_exceptions",
  {
    id: primaryId(),
    company_id: uuid("company_id").notNull(),
    dedupe_key: text("dedupe_key").notNull(),
    period_start: date("period_start"),
    period_end: date("period_end"),
    source_record_type: text("source_record_type"),
    source_record_id: text("source_record_id"),
    exception_type: text("exception_type").notNull(),
    severity: text("severity").notNull().default("medium"),
    title: text("title").notNull(),
    detail: text("detail"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>(),
    status: text("status").notNull().default("open"),
    resolved_by: text("resolved_by"),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    resolution_note: text("resolution_note"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    uniqueIndex("vat_exceptions_company_dedupe_idx").on(t.company_id, t.dedupe_key),
    index("vat_exceptions_company_status_idx").on(t.company_id, t.status),
  ],
);
export const insertVATExceptionSchema = createInsertSchema(vatExceptionsTable).omit({ id: true, created_at: true, updated_at: true });
export type VATException = typeof vatExceptionsTable.$inferSelect;

export const vatAdjustmentsTable = pgTable("vat_adjustments", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  vat_return_id: uuid("vat_return_id"),
  period_start: date("period_start").notNull(),
  period_end: date("period_end").notNull(),
  box_number: integer("box_number").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  created_by: text("created_by"),
  approved_by: text("approved_by"),
  approved_at: timestamp("approved_at", { withTimezone: true }),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertVATAdjustmentSchema = createInsertSchema(vatAdjustmentsTable).omit({ id: true, created_at: true, updated_at: true });
export type VATAdjustment = typeof vatAdjustmentsTable.$inferSelect;

export const vatReturnAuditsTable = pgTable("vat_return_audits", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  vat_return_id: uuid("vat_return_id"),
  event_type: text("event_type").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  user_id: text("user_id"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertVATReturnAuditSchema = createInsertSchema(vatReturnAuditsTable).omit({ id: true, created_at: true, updated_at: true });
export type VATReturnAudit = typeof vatReturnAuditsTable.$inferSelect;

// ─── Document ────────────────────────────────────────────────────────────────

export const documentsTable = pgTable("documents", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  name: text("name"),
  file_url: text("file_url"),
  file_type: text("file_type"),
  file_size: integer("file_size"),
  document_type: text("document_type"),
  upload_date: date("upload_date"),
  status: text("status").default("pending"),
  extracted_data: jsonb("extracted_data"),
  extraction_confidence: numeric("extraction_confidence", { precision: 5, scale: 2 }),
  linked_record_type: text("linked_record_type"),
  linked_record_id: text("linked_record_id"),
  notes: text("notes"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true, created_at: true, updated_at: true });
export type Document = typeof documentsTable.$inferSelect;

// ─── EmailAccount ────────────────────────────────────────────────────────────

export const emailAccountsTable = pgTable("email_accounts", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  email: text("email"),
  display_name: text("display_name"),
  provider: text("provider"),
  is_active: boolean("is_active").default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertEmailAccountSchema = createInsertSchema(emailAccountsTable).omit({ id: true, created_at: true, updated_at: true });
export type EmailAccount = typeof emailAccountsTable.$inferSelect;

// ─── EmailRule ───────────────────────────────────────────────────────────────

export const emailRulesTable = pgTable("email_rules", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  name: text("name"),
  sender_pattern: text("sender_pattern"),
  subject_pattern: text("subject_pattern"),
  document_type: text("document_type"),
  is_active: boolean("is_active").default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertEmailRuleSchema = createInsertSchema(emailRulesTable).omit({ id: true, created_at: true, updated_at: true });
export type EmailRule = typeof emailRulesTable.$inferSelect;

// ─── EmailCaptureLog ─────────────────────────────────────────────────────────

export const emailCaptureLogsTable = pgTable("email_capture_logs", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  email_account_id: uuid("email_account_id"),
  message_id: text("message_id"),
  sender: text("sender"),
  subject: text("subject"),
  date_found: timestamp("date_found", { withTimezone: true }),
  attachment_name: text("attachment_name"),
  attachment_url: text("attachment_url"),
  status: text("status").default("pending"),
  error_message: text("error_message"),
  document_id: uuid("document_id"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertEmailCaptureLogSchema = createInsertSchema(emailCaptureLogsTable).omit({ id: true, created_at: true, updated_at: true });
export type EmailCaptureLog = typeof emailCaptureLogsTable.$inferSelect;

// ─── EmailScanConfig ─────────────────────────────────────────────────────────

export const emailScanConfigsTable = pgTable("email_scan_configs", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  scan_mode: text("scan_mode").default("all"),
  selected_senders: jsonb("selected_senders").$type<string[]>(),
  ignored_senders: jsonb("ignored_senders").$type<string[]>(),
  only_with_attachments: boolean("only_with_attachments").default(false),
  ignore_older_than: integer("ignore_older_than"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertEmailScanConfigSchema = createInsertSchema(emailScanConfigsTable).omit({ id: true, created_at: true, updated_at: true });
export type EmailScanConfig = typeof emailScanConfigsTable.$inferSelect;

// ─── Insight ─────────────────────────────────────────────────────────────────

export const insightsTable = pgTable("insights", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  insight_type: text("insight_type"),
  title: text("title"),
  description: text("description"),
  severity: text("severity").default("info"),
  generated_date: date("generated_date"),
  is_dismissed: boolean("is_dismissed").default(false),
  related_entity_type: text("related_entity_type"),
  related_entity_id: text("related_entity_id"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertInsightSchema = createInsertSchema(insightsTable).omit({ id: true, created_at: true, updated_at: true });
export type Insight = typeof insightsTable.$inferSelect;

// ─── Automation ──────────────────────────────────────────────────────────────

export const automationsTable = pgTable("automations", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  name: text("name"),
  description: text("description"),
  trigger_type: text("trigger_type"),
  trigger_config: jsonb("trigger_config"),
  conditions: jsonb("conditions"),
  actions: jsonb("actions"),
  status: text("status").default("active"),
  last_run_at: timestamp("last_run_at", { withTimezone: true }),
  run_count: integer("run_count").default(0),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertAutomationSchema = createInsertSchema(automationsTable).omit({ id: true, created_at: true, updated_at: true });
export type Automation = typeof automationsTable.$inferSelect;

// ─── AutomationActivity ───────────────────────────────────────────────────────

export const automationActivitiesTable = pgTable("automation_activities", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  automation_id: uuid("automation_id"),
  event_type: text("event_type"),
  status: text("status"),
  message: text("message"),
  started_at: timestamp("started_at", { withTimezone: true }),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  error_message: text("error_message"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertAutomationActivitySchema = createInsertSchema(automationActivitiesTable).omit({ id: true, created_at: true, updated_at: true });
export type AutomationActivity = typeof automationActivitiesTable.$inferSelect;

// ─── WorkflowActivity ────────────────────────────────────────────────────────

export const workflowActivitiesTable = pgTable("workflow_activities", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  entity_type: text("entity_type"),
  entity_id: text("entity_id"),
  event_type: text("event_type"),
  description: text("description"),
  event_date: timestamp("event_date", { withTimezone: true }),
  user_id: text("user_id"),
  metadata: jsonb("metadata"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertWorkflowActivitySchema = createInsertSchema(workflowActivitiesTable).omit({ id: true, created_at: true, updated_at: true });
export type WorkflowActivity = typeof workflowActivitiesTable.$inferSelect;

// ─── AccountLearning ─────────────────────────────────────────────────────────

export const accountLearningsTable = pgTable("account_learnings", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  source_type: text("source_type"),
  source_record_id: text("source_record_id"),
  party_type: text("party_type"),
  party_id: text("party_id"),
  party_name: text("party_name"),
  account_id: text("account_id"),
  account_code: text("account_code"),
  account_name: text("account_name"),
  confidence: numeric("confidence", { precision: 5, scale: 2 }),
  occurrence_count: integer("occurrence_count").default(1),
  last_used_date: date("last_used_date"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertAccountLearningSchema = createInsertSchema(accountLearningsTable).omit({ id: true, created_at: true, updated_at: true });
export type AccountLearning = typeof accountLearningsTable.$inferSelect;

// ─── AccountSuggestionLog ────────────────────────────────────────────────────

export const accountSuggestionLogsTable = pgTable("account_suggestion_logs", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  source_type: text("source_type"),
  source_record_id: text("source_record_id"),
  party_type: text("party_type"),
  party_id: text("party_id"),
  party_name: text("party_name"),
  suggested_account_id: text("suggested_account_id"),
  suggested_account_name: text("suggested_account_name"),
  final_account_id: text("final_account_id"),
  final_account_name: text("final_account_name"),
  confidence: numeric("confidence", { precision: 5, scale: 2 }),
  accepted: boolean("accepted"),
  reason: text("reason"),
  suggestion_source: text("suggestion_source"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertAccountSuggestionLogSchema = createInsertSchema(accountSuggestionLogsTable).omit({ id: true, created_at: true, updated_at: true });
export type AccountSuggestionLog = typeof accountSuggestionLogsTable.$inferSelect;

// ─── SuggestionRule ──────────────────────────────────────────────────────────

export const suggestionRulesTable = pgTable("suggestion_rules", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  name: text("name"),
  rule_type: text("rule_type"),
  pattern: text("pattern"),
  account_id: text("account_id"),
  account_code: text("account_code"),
  account_name: text("account_name"),
  priority: integer("priority").default(0),
  is_active: boolean("is_active").default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertSuggestionRuleSchema = createInsertSchema(suggestionRulesTable).omit({ id: true, created_at: true, updated_at: true });
export type SuggestionRule = typeof suggestionRulesTable.$inferSelect;

// ─── SuggestionSettings ──────────────────────────────────────────────────────

export const suggestionSettingsTable = pgTable("suggestion_settings", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  auto_apply_threshold: numeric("auto_apply_threshold", { precision: 5, scale: 2 }),
  learning_enabled: boolean("learning_enabled").default(true),
  require_review: boolean("require_review").default(true),
  is_active: boolean("is_active").default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertSuggestionSettingsSchema = createInsertSchema(suggestionSettingsTable).omit({ id: true, created_at: true, updated_at: true });
export type SuggestionSettings = typeof suggestionSettingsTable.$inferSelect;

// ─── AIReconciliationResult ──────────────────────────────────────────────────
// Persisted output of the AI Accountant reconciliation analysis. Kept separate
// from the bank transaction's final linkage fields (matched_type etc.) so the
// analysis history survives approval and can be re-run safely.

export const aiReconciliationResultsTable = pgTable("ai_reconciliation_results", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  bank_transaction_id: uuid("bank_transaction_id").notNull(),
  status: text("status").default("red"), // green | amber | red
  scenario: text("scenario"), // exact | combination | overpayment | partial | no_match
  confidence: integer("confidence").default(0),
  transaction_amount: numeric("transaction_amount", { precision: 12, scale: 2 }),
  matched_total: numeric("matched_total", { precision: 12, scale: 2 }),
  remaining: numeric("remaining", { precision: 12, scale: 2 }),
  matched_records: jsonb("matched_records").$type<Record<string, unknown>[]>(),
  potential_matches: jsonb("potential_matches").$type<Record<string, unknown>[]>(),
  possible_explanations: jsonb("possible_explanations").$type<string[]>(),
  explanation: text("explanation"),
  recommendation: text("recommendation"),
  category_suggestion: text("category_suggestion"),
  category_confidence: integer("category_confidence"),
  ai_provider: text("ai_provider"),
  ai_model: text("ai_model"),
  approval_state: text("approval_state").default("pending"), // pending | approved | dismissed
  approved_by: text("approved_by"),
  approved_at: timestamp("approved_at", { withTimezone: true }),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertAIReconciliationResultSchema = createInsertSchema(aiReconciliationResultsTable).omit({ id: true, created_at: true, updated_at: true });
export type AIReconciliationResult = typeof aiReconciliationResultsTable.$inferSelect;

// ─── AIRecommendation ─────────────────────────────────────────────────────────
// Proactive AI Accountant findings (Phase 2). Each row is a detected issue or
// suggested action. `dedupe_key` is stable per finding so re-running detection
// updates rather than duplicates. The AI never applies accounting changes —
// rows only carry recommended actions; decisions are explicit user actions.

export const aiRecommendationsTable = pgTable(
  "ai_recommendations",
  {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  dedupe_key: text("dedupe_key").notNull(),
  domain: text("domain").notNull(), // revenue | expense | vat | debtor | creditor | cashflow
  kind: text("kind").notNull(), // detector identifier e.g. overdue_invoices, duplicate_payment
  priority: text("priority").default("medium"), // high | medium | low
  title: text("title").notNull(), // the problem, in plain English
  detail: text("detail"), // fuller explanation of why this was flagged
  recommended_action: text("recommended_action"),
  confidence: integer("confidence").default(0), // 0-100
  amount: numeric("amount", { precision: 12, scale: 2 }), // monetary impact where relevant
  evidence: jsonb("evidence").$type<Record<string, unknown>>(), // data points used
  related_entity_type: text("related_entity_type"),
  related_entity_id: text("related_entity_id"),
  route: text("route"), // in-app path to act on this finding
  status: text("status").default("open"), // open | approved | dismissed | snoozed | resolved
  snoozed_until: date("snoozed_until"),
  decided_by: text("decided_by"),
  decided_at: timestamp("decided_at", { withTimezone: true }),
  first_detected_at: timestamp("first_detected_at", { withTimezone: true }).defaultNow(),
  last_detected_at: timestamp("last_detected_at", { withTimezone: true }).defaultNow(),
  created_at: createdAt(),
  updated_at: updatedAt(),
  },
  (t) => [uniqueIndex("ai_recommendations_company_dedupe_idx").on(t.company_id, t.dedupe_key)],
);
export const insertAIRecommendationSchema = createInsertSchema(aiRecommendationsTable).omit({ id: true, created_at: true, updated_at: true });
export type AIRecommendation = typeof aiRecommendationsTable.$inferSelect;

// ─── AITask ──────────────────────────────────────────────────────────────────
// Phase 4 operating queue for the AI Accountant. Tasks are review records only:
// they can explain and recommend work, but never perform accounting mutations.

export const aiTasksTable = pgTable(
  "ai_tasks",
  {
    id: primaryId(),
    company_id: uuid("company_id").notNull(),
    // Internal stable key used to refresh a live finding without duplicating it.
    dedupe_key: text("dedupe_key").notNull(),
    task_type: text("task_type").notNull(),
    priority: text("priority").notNull().default("medium"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    confidence_score: integer("confidence_score").notNull().default(0),
    status: text("status").notNull().default("open"),
    source_record_id: text("source_record_id"),
    source_record_type: text("source_record_type"),
    recommendation: text("recommendation"),
    // Evidence and in-app route support an explainable, review-first UI.
    evidence: jsonb("evidence").$type<Record<string, unknown>>(),
    route: text("route"),
    reviewed_by: text("reviewed_by"),
    reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
    created_at: createdAt(),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    updated_at: updatedAt(),
  },
  (t) => [
    uniqueIndex("ai_tasks_company_dedupe_idx").on(t.company_id, t.dedupe_key),
    index("ai_tasks_company_status_idx").on(t.company_id, t.status),
    index("ai_tasks_company_priority_idx").on(t.company_id, t.priority),
  ],
);
export const insertAITaskSchema = createInsertSchema(aiTasksTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type AITask = typeof aiTasksTable.$inferSelect;

// ─── AIReviewDecision ─────────────────────────────────────────────────────────
// Append-only audit trail of user decisions on AI recommendations.

export const aiReviewDecisionsTable = pgTable("ai_review_decisions", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  recommendation_id: uuid("recommendation_id").notNull(),
  decision: text("decision").notNull(), // approved | dismissed | snoozed | reopened
  note: text("note"),
  user_id: text("user_id"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertAIReviewDecisionSchema = createInsertSchema(aiReviewDecisionsTable).omit({ id: true, created_at: true, updated_at: true });
export type AIReviewDecision = typeof aiReviewDecisionsTable.$inferSelect;

// ─── TransactionComment ───────────────────────────────────────────────────────

export const transactionCommentsTable = pgTable("transaction_comments", {
  id: primaryId(),
  company_id: uuid("company_id").notNull(),
  transaction_id: uuid("transaction_id"),
  comment: text("comment"),
  user_id: text("user_id"),
  user_name: text("user_name"),
  created_date: timestamp("created_date", { withTimezone: true }).defaultNow(),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const insertTransactionCommentSchema = createInsertSchema(transactionCommentsTable).omit({ id: true, created_at: true, updated_at: true });
export type TransactionComment = typeof transactionCommentsTable.$inferSelect;
