import { randomUUID } from "node:crypto";
import type pg from "pg";
import { DraftError, fail, canWriteDraft, money, netPence, parseInvoice, uuid, type InvoiceSource } from "./contract";

export interface DraftAuthority {
  /** Must lock/validate authoritative journal, issue, settlement and source links. */
  assertWritable(tx: pg.PoolClient, companyId: string, invoiceId: string | undefined, source: InvoiceSource): Promise<void>;
  /** Existing VAT authority adapter, not a client rate or a second VAT engine. */
  resolveTax(tx: pg.PoolClient, companyId: string, source: InvoiceSource, net: bigint[]): Promise<{
    transactionBound: true; contextRevision: string; vatPence: string[];
  }>;
}
const pounds = (pence: string) => `${BigInt(pence) / 100n}.${(BigInt(pence) % 100n).toString().padStart(2, "0")}`;
const fixedPence = (value: unknown): string => {
  if (typeof value !== "string" || !/^\d{1,10}\.\d{2}$/.test(value)) fail(503, "AUTHORITY_UNAVAILABLE");
  return BigInt(value.replace(".", "")).toString();
};
const scope = (role: unknown, active: unknown) => {
  if (!canWriteDraft(role, active)) fail(403, "CAPABILITY_DENIED");
};
export class InvoiceDraftService {
  constructor(private pool: Pick<pg.Pool, "connect">, private authority?: DraftAuthority) {}
  private async transaction<T>(companyId: string, actor: string, work: (tx: pg.PoolClient, role: string) => Promise<T>): Promise<T> {
    uuid(companyId);
    // Deliberate hold: no schema probe or ambient DB connection without approved providers.
    if (!this.authority) fail(503, "AUTHORITY_UNAVAILABLE");
    const tx = await this.pool.connect();
    try {
      await tx.query("BEGIN");
      await tx.query("SET LOCAL lock_timeout = '2s'");
      await tx.query("SET LOCAL statement_timeout = '5s'");
      const company = await tx.query("SELECT id FROM companies WHERE id=$1 FOR UPDATE", [companyId]);
      if (company.rowCount !== 1) fail(404, "RESOURCE_NOT_FOUND");
      const members = await tx.query("SELECT role,is_active FROM company_users WHERE company_id=$1 AND user_id=$2 ORDER BY id FOR UPDATE", [companyId, actor]);
      if (members.rows.length === 0) fail(404, "RESOURCE_NOT_FOUND");
      if (members.rows.length !== 1) fail(403, "CAPABILITY_DENIED");
      scope(members.rows[0].role, members.rows[0].is_active);
      const result = await work(tx, members.rows[0].role as string);
      await tx.query("COMMIT");
      return result;
    } catch (error) {
      await tx.query("ROLLBACK");
      if (error instanceof DraftError) throw error;
      const code = (error as { code?: string }).code;
      if (["42P01", "42703", "42501"].includes(code ?? "")) fail(503, "STORAGE_UNAVAILABLE");
      if (["55P03", "57014", "40001", "40P01"].includes(code ?? "")) fail(503, "WRITE_BUSY");
      if (code === "23505") fail(409, "NUMBER_CONFLICT");
      fail(500, "INTERNAL_ERROR");
    } finally { tx.release(); }
  }
  private async locked(tx: pg.PoolClient, companyId: string, id: string) {
    uuid(id);
    const rows = await tx.query("SELECT * FROM sales_invoices WHERE id=$1 AND company_id=$2 FOR UPDATE", [id, companyId]);
    if (rows.rows.length !== 1) fail(404, "RESOURCE_NOT_FOUND");
    const row = rows.rows[0];
    if (row.status !== "draft" || row.amount_paid !== "0.00") fail(409, "DOCUMENT_NOT_DRAFT");
    const managed = await tx.query("SELECT revision,source FROM w03_invoice_drafts WHERE invoice_id=$1 AND company_id=$2 FOR UPDATE", [id, companyId]);
    if (managed.rows.length !== 1) fail(409, "LEGACY_DRAFT_REVIEW_REQUIRED");
    await this.authority!.assertWritable(tx, companyId, id, managed.rows[0].source as InvoiceSource);
    return { ...row, ...managed.rows[0] };
  }
  async get(companyId: string, actor: string, id: string) {
    return this.transaction(companyId, actor, async tx => {
      const row = await this.locked(tx, companyId, id);
      return { id, kind: "invoice", company_id: companyId, status: "draft",
        source: row.source as InvoiceSource, revision: row.revision as string,
        money: { currency: "GBP", net_pence: fixedPence(row.subtotal),
          vat_pence: fixedPence(row.vat_total), gross_pence: fixedPence(row.total) } };
    });
  }
  async save(companyId: string, actor: string, body: unknown, id?: string, etag?: string) {
    // Parse create before storage; PATCH gets merged with locked persisted source.
    const createdSource = id ? undefined : parseInvoice(body);
    if (id && !etag) fail(428, "REVISION_REQUIRED");
    return this.transaction(companyId, actor, async (tx, role) => {
      const old = id ? await this.locked(tx, companyId, id) : undefined;
      if (old && etag !== `"${old.revision}"`) fail(409, "REVISION_CONFLICT");
      const source = createdSource ?? parseInvoice(body, old!.source);
      // Recheck the proposed dates/source too, not only the persisted edit target.
      // Undefined identity means creation and still requires a write-period check.
      await this.authority!.assertWritable(tx, companyId, id, source);
      const customer = await tx.query("SELECT id,name FROM customers WHERE id=$1 AND company_id=$2 AND status='active' FOR SHARE", [source.customer_id, companyId]);
      if (customer.rowCount !== 1) fail(422, "REFERENCE_INVALID", "/customer_id");
      const duplicate = await tx.query("SELECT id FROM sales_invoices WHERE company_id=$1 AND invoice_number=$2 AND ($3::uuid IS NULL OR id<>$3)", [companyId, source.invoice_number, id ?? null]);
      if (duplicate.rows.length) fail(409, "NUMBER_CONFLICT");
      const net = netPence(source.line_items);
      const tax = await this.authority!.resolveTax(tx, companyId, source, net);
      if (tax?.transactionBound !== true || typeof tax.contextRevision !== "string" || !tax.contextRevision || tax.contextRevision.length > 200) fail(503, "AUTHORITY_UNAVAILABLE");
      const totals = money(net, tax.vatPence);
      const invoiceId = id ?? randomUUID(), revision = randomUUID();
      // Preserve familiar read projections, but only server-calculated values.
      const lines = source.line_items.map((line, i) => ({ ...line, amount: pounds(totals.lines[i]!.net_pence),
        vat_amount: pounds(totals.lines[i]!.vat_pence), line_total: pounds(totals.lines[i]!.gross_pence) }));
      const args = [companyId, source.customer_id, customer.rows[0].name, source.invoice_number,
        source.issue_date, source.due_date, source.payment_terms, source.reference, JSON.stringify(lines),
        pounds(totals.net_pence), pounds(totals.vat_pence), pounds(totals.gross_pence), source.notes, invoiceId];
      if (id) {
        await tx.query(`UPDATE sales_invoices SET customer_id=$2,customer_name=$3,invoice_number=$4,
          issue_date=$5,due_date=$6,payment_terms=$7,reference=$8,line_items=$9,subtotal=$10,
          vat_total=$11,total=$12,balance_due=$12,notes=$13,updated_at=clock_timestamp()
          WHERE id=$14 AND company_id=$1`, args);
        await tx.query("UPDATE w03_invoice_drafts SET revision=$3,source=$4,tax_context=$5 WHERE invoice_id=$1 AND company_id=$2",
          [invoiceId, companyId, revision, source, { revision: tax.contextRevision }]);
      } else {
        await tx.query(`INSERT INTO sales_invoices
          (company_id,customer_id,customer_name,invoice_number,issue_date,due_date,payment_terms,reference,line_items,
          subtotal,vat_total,total,notes,id,status,amount_paid,balance_due)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft',0,$12)`, args);
        await tx.query("INSERT INTO w03_invoice_drafts(invoice_id,company_id,revision,source,tax_context) VALUES($1,$2,$3,$4,$5)",
          [invoiceId, companyId, revision, source, { revision: tax.contextRevision }]);
      }
      const requestId = randomUUID();
      await tx.query(`INSERT INTO w03_invoice_draft_audit
        (id,company_id,invoice_id,actor_id,actor_role,operation,before_revision,after_revision,
        before_source,after_source,tax_context_revision,request_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [randomUUID(), companyId, invoiceId, actor, role, id ? "update" : "create", old?.revision ?? null,
          revision, old?.source ?? null, source, tax.contextRevision, requestId]);
      return { id: invoiceId, kind: "invoice", company_id: companyId, status: "draft", source,
        revision, request_id: requestId, money: totals, calculation: { contract: "w03.money.dev.v1",
          accounting_acceptance: "pending", tax_context_revision: tax.contextRevision } };
    });
  }
}
