import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import { DraftError, fail, canWriteDraft, money, netPence, parseInvoice, uuid, draftSourceFingerprint, type InvoiceSource } from "./contract";

export interface DraftAuthority {
  /** Must lock/validate authoritative journal, issue, settlement and source links. */
  assertWritable(tx: pg.PoolClient, companyId: string, invoiceId: string | undefined, source: InvoiceSource): Promise<void>;
  /** Existing VAT authority adapter, not a client rate or a second VAT engine. */
  resolveTax(tx: pg.PoolClient, companyId: string, source: InvoiceSource, net: bigint[]): Promise<{
     transactionBound: true; contextRevision: string; context: Record<string, unknown>;
     vatPence: string[]; netPence: string[]; unitNetPrices: string[];
  }>;
}
const contextDigest = (context: Record<string, unknown>) =>
  `sha256:${createHash("sha256").update(JSON.stringify(context)).digest("hex")}`;
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

  /**
   * Read-only form context. This is company-scoped and advisory; save rechecks
   * membership, customer, lifecycle and tax evidence inside its write transaction.
   */
  async context(companyId: string, actor: string) {
    uuid(companyId);
    const tx = await this.pool.connect();
    try {
      await tx.query("BEGIN READ ONLY");
      await tx.query("SET LOCAL statement_timeout = '5s'");
      const company = await tx.query(
        `SELECT id,name,base_currency,vat_registered,vat_scheme,vat_accounting_basis,
          address_line_1,address_line_2,city,county,postcode,email,vat_number
         FROM companies WHERE id=$1`,
        [companyId],
      );
      if (company.rowCount !== 1) fail(404, "RESOURCE_NOT_FOUND");
      const members = await tx.query(
        "SELECT role,is_active FROM company_users WHERE company_id=$1 AND user_id=$2 ORDER BY id",
        [companyId, actor],
      );
      if (members.rows.length !== 1) fail(404, "RESOURCE_NOT_FOUND");
      if (members.rows[0]!.is_active !== true) fail(403, "CAPABILITY_DENIED");
      const customers = await tx.query(
        `SELECT id,name,email,address_line_1,address_line_2,city,county,postcode
         FROM customers WHERE company_id=$1 AND status='active' ORDER BY name,id`,
        [companyId],
      );
      const taxRules = await tx.query(
        `SELECT id,code,label,rate,treatment,effective_from::text AS effective_from,
          effective_to::text AS effective_to
         FROM vat_tax_rules WHERE company_id=$1 AND is_active=true
         ORDER BY code,effective_from DESC,id`,
        [companyId],
      );
      await tx.query("COMMIT");
      return {
        company: company.rows[0],
        customers: customers.rows,
        tax_rules: taxRules.rows,
        can_write_draft: canWriteDraft(members.rows[0]!.role, true),
      };
    } catch (error) {
      await tx.query("ROLLBACK");
      if (error instanceof DraftError) throw error;
      const code = (error as { code?: string }).code;
      if (["42P01", "42703", "42501"].includes(code ?? "")) fail(503, "STORAGE_UNAVAILABLE");
      if (["55P03", "57014", "40001", "40P01"].includes(code ?? "")) fail(503, "WRITE_BUSY");
      fail(500, "INTERNAL_ERROR");
    } finally {
      tx.release();
    }
  }

  private async transaction<T>(companyId: string, actor: string, work: (tx: pg.PoolClient, role: string) => Promise<T>): Promise<T> {
    uuid(companyId);
    // Fail closed if the API is constructed without transaction-bound authority.
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
    const managed = await tx.query("SELECT revision,source,tax_context FROM w03_invoice_drafts WHERE invoice_id=$1 AND company_id=$2 FOR UPDATE", [id, companyId]);
    if (managed.rows.length !== 1) fail(409, "LEGACY_DRAFT_REVIEW_REQUIRED");
    await this.authority!.assertWritable(tx, companyId, id, managed.rows[0].source as InvoiceSource);
    return { ...row, ...managed.rows[0] };
  }
  async get(companyId: string, actor: string, id: string) {
    return this.transaction(companyId, actor, async tx => {
      const row = await this.locked(tx, companyId, id);
      const storedLines = Array.isArray(row.line_items) ? row.line_items as Array<Record<string, unknown>> : [];
      const lines = storedLines.map(line => ({
        net_pence: fixedPence(line.amount),
        vat_pence: fixedPence(line.vat_amount),
        gross_pence: fixedPence(line.line_total),
      }));
      return { id, kind: "invoice", company_id: companyId, status: "draft",
        source: parseInvoice(row.source), revision: row.revision as string, tax_context: row.tax_context,
        money: { currency: "GBP", net_pence: fixedPence(row.subtotal),
          vat_pence: fixedPence(row.vat_total), gross_pence: fixedPence(row.total), lines } };
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
      const enteredPence = netPence(source.line_items);
      const tax = await this.authority!.resolveTax(tx, companyId, source, enteredPence);
      if (tax?.transactionBound !== true || typeof tax.contextRevision !== "string" ||
          tax.contextRevision.length > 200 || !tax.context || typeof tax.context !== "object" ||
          Array.isArray(tax.context) || contextDigest(tax.context) !== tax.contextRevision ||
          !Array.isArray(tax.context.lines) || tax.context.lines.length !== source.line_items.length ||
          !Array.isArray(tax.netPence) || tax.netPence.length !== source.line_items.length ||
          !Array.isArray(tax.unitNetPrices) || tax.unitNetPrices.length !== source.line_items.length ||
          !Array.isArray(tax.vatPence) || tax.vatPence.length !== source.line_items.length ||
          tax.context.price_basis !== source.price_basis ||
          tax.context.source_fingerprint !== draftSourceFingerprint(source)) {
        fail(503, "AUTHORITY_UNAVAILABLE");
      }
      const net = tax.netPence.map(value => {
        if (typeof value !== "string" || !/^(0|[1-9]\d{0,11})$/.test(value)) fail(503, "AUTHORITY_UNAVAILABLE");
        return BigInt(value);
      });
      const totals = money(net, tax.vatPence);
      const resolvedLines = tax.context.lines as Array<Record<string, unknown>>;
      for (let index = 0; index < source.line_items.length; index++) {
        const resolved = resolvedLines[index]!;
        if (resolved.code !== source.line_items[index]!.tax_code ||
            resolved.net_pence !== net[index]!.toString() ||
            resolved.vat_pence !== tax.vatPence[index] ||
            resolved.price_basis !== source.price_basis ||
            resolved.entered_unit_price !== source.line_items[index]!.unit_price ||
            resolved.unit_net_price !== tax.unitNetPrices[index] ||
            typeof tax.unitNetPrices[index] !== "string" ||
            !/^(0|[1-9]\d{0,7})(\.\d{1,4})?$/.test(tax.unitNetPrices[index]!) ||
            (source.price_basis === "including_vat"
              ? totals.lines[index]!.gross_pence !== enteredPence[index]!.toString()
              : net[index] !== enteredPence[index]) ||
            typeof resolved.rule_id !== "string" || !resolved.rule_id ||
            typeof resolved.label !== "string" || !resolved.label ||
            typeof resolved.treatment !== "string" || !resolved.treatment ||
            typeof resolved.rate !== "string" || !resolved.rate) {
          fail(503, "AUTHORITY_UNAVAILABLE");
        }
      }
      const invoiceId = id ?? randomUUID(), revision = randomUUID();
      // Preserve familiar read projections, but only server-calculated values.
      const lines = source.line_items.map((line, i) => {
        const rule = resolvedLines[i]!;
        return { ...line, unit_price: tax.unitNetPrices[i], entered_unit_price: line.unit_price,
          price_basis: source.price_basis, amount: pounds(totals.lines[i]!.net_pence),
          vat_amount: pounds(totals.lines[i]!.vat_pence), line_total: pounds(totals.lines[i]!.gross_pence),
          vat_rate: rule.rate, tax_treatment: rule.treatment, tax_rule_id: rule.rule_id, tax_label: rule.label };
      });
      const args = [companyId, source.customer_id, customer.rows[0].name, source.invoice_number,
        source.issue_date, source.due_date, source.payment_terms, source.reference, JSON.stringify(lines),
        pounds(totals.net_pence), pounds(totals.vat_pence), pounds(totals.gross_pence), source.notes, invoiceId];
      if (id) {
        await tx.query(`UPDATE sales_invoices SET customer_id=$2,customer_name=$3,invoice_number=$4,
          issue_date=$5,due_date=$6,payment_terms=$7,reference=$8,line_items=$9,subtotal=$10,
          vat_total=$11,total=$12,balance_due=$12,notes=$13,updated_at=clock_timestamp()
          WHERE id=$14 AND company_id=$1`, args);
        await tx.query("UPDATE w03_invoice_drafts SET revision=$3,source=$4,tax_context=$5 WHERE invoice_id=$1 AND company_id=$2",
          [invoiceId, companyId, revision, source, tax.context]);
      } else {
        await tx.query(`INSERT INTO sales_invoices
          (company_id,customer_id,customer_name,invoice_number,issue_date,due_date,payment_terms,reference,line_items,
          subtotal,vat_total,total,notes,id,status,amount_paid,balance_due)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft',0,$12)`, args);
        await tx.query("INSERT INTO w03_invoice_drafts(invoice_id,company_id,revision,source,tax_context) VALUES($1,$2,$3,$4,$5)",
          [invoiceId, companyId, revision, source, tax.context]);
      }
      const requestId = randomUUID();
      await tx.query(`INSERT INTO w03_invoice_draft_audit
        (id,company_id,invoice_id,actor_id,actor_role,operation,before_revision,after_revision,
        before_source,after_source,tax_context,tax_context_revision,request_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [randomUUID(), companyId, invoiceId, actor, role, id ? "update" : "create", old?.revision ?? null,
          revision, old?.source ?? null, source, tax.context, tax.contextRevision, requestId]);
      return { id: invoiceId, kind: "invoice", company_id: companyId, status: "draft", source,
        revision, request_id: requestId, money: totals, tax_context: tax.context,
         calculation: { contract: "w03.money.dev.v3",
           price_basis: source.price_basis, source_fingerprint: draftSourceFingerprint(source),
           rounding_method: "nearest-penny-half-up-per-line",
           total_method: "sum-saved-rounded-lines",
          accounting_acceptance: "pending", tax_context_revision: tax.contextRevision } };
    });
  }
}
