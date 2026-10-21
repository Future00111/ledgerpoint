import test from "node:test";
import assert from "node:assert/strict";
import { canWriteDraft, checkDraftJson, decimal, money, netPence, parseInvoice } from "./contract";
import { isGenericEntityWriteBlocked } from "../../routes/entityWritePolicy";
import { InvoiceDraftService } from "./invoiceService";
import { assertInvoiceSettlementReady } from "./settlementBoundary";

const source = () => ({ contract: "w03.draft.v1", currency: "GBP",
  customer_id: "11111111-1111-4111-8111-111111111111", invoice_number: "DRAFT-1",
  issue_date: "2026-10-20", due_date: "2026-11-19", payment_terms: 30,
  line_items: [{ description: "Fixture", quantity: "1.2345", unit_price: "2.3456", tax_code: "fixture-only" }] });
test("finite draft capabilities deny unknown, legacy, inactive and unconfigured Manager", () => {
  for (const role of ["owner","admin","accountant"]) assert.equal(canWriteDraft(role, true), true);
  for (const role of ["manager","read_only","member","staff","OWNER",null,undefined,{ toString: () => "owner" }]) {
    assert.equal(canWriteDraft(role, true), false);
  }
  assert.equal(canWriteDraft("owner", false), false);
});
test("integer half-up line rounding and authoritative VAT composition preserve GBP pence", () => {
  const parsed = parseInvoice({ ...source(), line_items: [
    { description:"Exact", quantity:"1", unit_price:"19.99", tax_code:"no_vat" },
  ] });
  assert.deepEqual(netPence(parsed.line_items), [1999n]);
  assert.equal(parsed.line_items[0]!.tax_code, "NO_VAT");
  assert.equal(money([1999n], ["0"]).gross_pence, "1999");
  assert.equal(netPence([{ ...parsed.line_items[0]!, unit_price:"0.0050" }])[0], 1n);
  assert.equal(netPence([{ ...parsed.line_items[0]!, unit_price:"0.0049" }])[0], 0n);
  assert.equal(netPence([{ ...parsed.line_items[0]!, quantity:"1.2345", unit_price:"2.3456" }])[0], 290n);
  assert.equal(netPence([{ ...parsed.line_items[0]!, quantity:"100", unit_price:"99999999.9999" }])[0], 999999999999n);
  assert.throws(() => netPence([{ ...parsed.line_items[0]!, quantity:"100.0001", unit_price:"99999999.9999" }]), /MONEY_LIMIT/);
  assert.equal(money([10000n], ["2000"]).gross_pence, "12000");
  assert.equal(money([3n,3n,3n], ["1","1","1"]).gross_pence, "12");
  assert.throws(() => money([999999999999n], ["1"]), /MONEY_LIMIT/);
  assert.throws(() => money([1n], []), /AUTHORITY_UNAVAILABLE/);
});
test("decimal grammar, bounds, dates, nulls and tenant/financial field injection reject", () => {
  for (const value of [1, true, null, "1e2", "-1", " 1", "+1", "01", "0.00001", "Infinity"]) {
    assert.throws(() => decimal(value, true));
  }
  assert.throws(() => decimal("0", true), /QUANTITY_RANGE/);
  for (const key of ["company_id","actor_id","total","subtotal","status","amount_paid","journal_id","audit"]) {
    assert.throws(() => parseInvoice({ ...source(), [key]: "injected" }), /FIELD_INVALID/);
  }
  for (const bad of [{ notes:null },{ due_date:"2026-99-01" },{ issue_date:"2026-02-30" }]) {
    assert.throws(() => parseInvoice({ ...source(), ...bad }), /FIELD_INVALID/);
  }
  assert.throws(() => parseInvoice({ ...source(), line_items:[{ ...source().line_items[0], amount:"9" }] }), /FIELD_INVALID/);
});
test("PATCH merges validated source but rejects currency, empty patch, unknown fields", () => {
  const previous = parseInvoice(source());
  assert.equal(parseInvoice({ contract:"w03.draft.v1",notes:"updated" }, previous).notes, "updated");
  for (const patch of [{contract:"w03.draft.v1"},{contract:"w03.draft.v1",currency:"GBP"},
    {contract:"w03.draft.v1",total:"1"}]) assert.throws(() => parseInvoice(patch, previous));
});
test("duplicate JSON keys (including escaped and nested keys) fail closed", () => {
  for (const raw of ['{"a":1,"a":2}', '{"a":{"b":1,"b":2}}', '{"a":1,"\\u0061":2}']) {
    assert.throws(() => checkDraftJson(raw), /DUPLICATE_KEY/);
  }
  checkDraftJson('{"a":[{"b":1},{"b":2}],"s":"quote: \\" a"}');
});
test("generic invoice writes blocked for every generic operation policy", () => {
  assert.equal(isGenericEntityWriteBlocked("SalesInvoice"), true);
  assert.equal(isGenericEntityWriteBlocked("CompanyUser"), true);
  assert.equal(isGenericEntityWriteBlocked("VATReturn"), true);
  assert.equal(isGenericEntityWriteBlocked("VATTaxRule"), true);
  assert.equal(isGenericEntityWriteBlocked("Customer"), false);
});
test("shared single/batch settlement sink rejects draft invoice targets", () => {
  assert.throws(() => assertInvoiceSettlementReady("sales_invoice", "draft"), /cannot be settled/);
  assert.doesNotThrow(() => assertInvoiceSettlementReady("sales_invoice", "posted"));
  assert.doesNotThrow(() => assertInvoiceSettlementReady("purchase_bill", "draft"));
});
test("absent authority refuses even a valid request without connecting a DB", async () => {
  let connects = 0;
  const pool = { connect: async () => { connects++; throw new Error("DB must not be opened"); } };
  const service = new InvoiceDraftService(pool as never);
  await assert.rejects(service.save(source().customer_id, "fixture-actor", source()), /AUTHORITY_UNAVAILABLE/);
  assert.equal(connects, 0);
});
