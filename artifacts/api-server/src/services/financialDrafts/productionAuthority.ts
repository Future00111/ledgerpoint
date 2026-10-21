import { createHash } from "node:crypto";
import type pg from "pg";
import { fail, type InvoiceSource } from "./contract";
import type { DraftAuthority } from "./invoiceService";

const digest = (value: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const RATE_BY_TREATMENT: Record<string, bigint> = {
  standard: 2000n,
  reduced: 500n,
  zero: 0n,
  exempt: 0n,
  outside_scope: 0n,
  no_vat: 0n,
};

function basisPoints(value: unknown): bigint {
  const text = String(value ?? "");
  if (!/^(0|[1-9]\d{0,2})(?:\.\d{1,2})?$/.test(text)) fail(422, "TAX_RULE_UNSUPPORTED");
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function createProductionInvoiceDraftAuthority(): DraftAuthority {
  return {
    async assertWritable(tx: pg.PoolClient, companyId: string, invoiceId: string | undefined, _source: InvoiceSource) {
      const companies = await tx.query(
        "SELECT country,base_currency FROM companies WHERE id=$1 FOR SHARE",
        [companyId],
      );
      if (companies.rowCount !== 1) fail(404, "RESOURCE_NOT_FOUND");
      const company = companies.rows[0]!;
      if (company.country !== "GB" || company.base_currency !== "GBP") {
        fail(422, "COMPANY_SETUP_UNSUPPORTED");
      }
      if (!invoiceId) return;

      // Any canonical source record, including a reversed posting, permanently
      // removes an invoice from this draft-only editor.
      const postings = await tx.query(
        "SELECT id FROM canonical_journal_entries WHERE company_id=$1 AND source_id=$2 FOR SHARE",
        [companyId, invoiceId],
      );
      if (postings.rowCount) fail(409, "DOCUMENT_NOT_DRAFT");

      const links = await tx.query(
        `SELECT id FROM bank_transactions
         WHERE company_id=$1 AND (
           linked_invoice_id=$2::uuid OR
           (matched_record_id=$2::text AND lower(coalesce(matched_type,'')) IN ('sales_invoice','invoice'))
         ) FOR SHARE`,
        [companyId, invoiceId],
      );
      if (links.rowCount) fail(409, "DOCUMENT_HAS_FINANCIAL_LINK");
    },

    async resolveTax(tx: pg.PoolClient, companyId: string, source: InvoiceSource, net: bigint[]) {
      const companies = await tx.query(
        `SELECT country,base_currency,vat_registered,vat_scheme,vat_accounting_basis
         FROM companies WHERE id=$1 FOR SHARE`,
        [companyId],
      );
      if (companies.rowCount !== 1) fail(404, "RESOURCE_NOT_FOUND");
      const company = companies.rows[0]!;
      if (company.country !== "GB" || company.base_currency !== "GBP") {
        fail(422, "COMPANY_SETUP_UNSUPPORTED");
      }
      if (company.vat_registered !== true && company.vat_registered !== false) {
        fail(422, "VAT_SETUP_INCOMPLETE");
      }
      if (company.vat_registered === true &&
          (company.vat_scheme !== "standard" || company.vat_accounting_basis !== "invoice")) {
        fail(422, "VAT_SETUP_UNSUPPORTED");
      }

      const lines: Array<Record<string, string>> = [];
      const vatPence: string[] = [];
      for (let index = 0; index < source.line_items.length; index++) {
        const line = source.line_items[index]!;
        const matches = await tx.query(
          `SELECT id,code,label,rate::text AS rate,treatment,effective_from::text AS effective_from,
            effective_to::text AS effective_to
           FROM vat_tax_rules
           WHERE company_id=$1 AND code=$2 AND is_active=true
             AND effective_from <= $3::date
             AND (effective_to IS NULL OR effective_to >= $3::date)
           ORDER BY effective_from DESC,id
           FOR SHARE`,
          [companyId, line.tax_code, source.issue_date],
        );
        if (matches.rowCount === 0) fail(422, "TAX_RULE_NOT_FOUND", `/line_items/${index}/tax_code`);
        if (matches.rowCount !== 1) fail(409, "TAX_RULE_AMBIGUOUS", `/line_items/${index}/tax_code`);
        const rule = matches.rows[0]!;
        const treatment = String(rule.treatment ?? "");
        const rate = basisPoints(rule.rate);
        if (RATE_BY_TREATMENT[treatment] !== rate || !String(rule.label ?? "").trim()) {
          fail(422, "TAX_RULE_UNSUPPORTED", `/line_items/${index}/tax_code`);
        }
        if ((company.vat_registered === false && treatment !== "no_vat") ||
            (company.vat_registered === true && treatment === "no_vat")) {
          fail(422, "TAX_SETUP_MISMATCH", `/line_items/${index}/tax_code`);
        }

        const numerator = net[index]! * rate;
        const vat = ((numerator + 5000n) / 10000n).toString();
        vatPence.push(vat);
        lines.push({
          rule_id: String(rule.id),
          code: String(rule.code),
          label: String(rule.label),
          treatment,
          rate: String(rule.rate),
          effective_from: String(rule.effective_from),
          effective_to: rule.effective_to == null ? "" : String(rule.effective_to),
          net_pence: net[index]!.toString(),
          vat_pence: vat,
        });
      }

      const context = {
        company: {
          country: String(company.country),
          currency: String(company.base_currency),
          vat_registered: company.vat_registered,
          vat_scheme: company.vat_scheme == null ? "" : String(company.vat_scheme),
          vat_accounting_basis: company.vat_accounting_basis == null ? "" : String(company.vat_accounting_basis),
        },
        issue_date: source.issue_date,
        rounding: {
          contract: "w03.money.dev.v2",
          method: "nearest-penny-half-up",
          scope: "round each line net and VAT; document totals sum saved rounded lines without another VAT rounding",
          decision_scope: "development invoice drafts only; not retrospective DEC-04 approval or production qualification",
        },
        lines,
      };
      return { transactionBound: true as const, contextRevision: digest(context), context, vatPence };
    },
  };
}

export function contextRevision(value: unknown): string {
  return digest(value);
}
