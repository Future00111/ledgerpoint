import test from "node:test";
import assert from "node:assert/strict";
import { DraftError } from "../financialDrafts/contract";
import { claimProgress, creditCandidate, expectedClaim, type ClaimMoney } from "./domain";

const amount = (net: string, vat: string, gross: string): ClaimMoney => ({ net_pence: net, vat_pence: vat, gross_pence: gross });
function bill({ price = "10", quantity = "2", basis = "excluding_vat", rate = "20", treatment = "standard", money = amount("2000", "400", "2400") } = {}) {
  return {
    id: "bill-1", company_id: "company-1", party_id: "supplier-1", revision: "bill-revision-1", kind: "purchase_bill", status: "posted",
    source: { currency: "GBP", price_basis: basis, customer_id: "supplier-1", line_items: [{ description: "Replacement caliper", quantity, unit_price: price, tax_code: "ORIGINAL_TAX_CODE" }] },
    money: { lines: [money] },
    tax_context: { lines: [{ code: "ORIGINAL_TAX_CODE", treatment, rate, price_basis: basis, net_pence: money.net_pence, vat_pence: money.vat_pence }] },
  };
}
function claim() { return { company_id: "company-1", party_id: "supplier-1", bill_id: "bill-1", bill_revision: "bill-revision-1", original_line_ref: 0 }; }
function credit(status = "draft") {
  return { id: "credit-1", kind: "supplier_credit_note", status, company_id: "company-1", party_id: "supplier-1", original_id: "bill-1",
    source: { customer_id: "supplier-1", line_items: [{ description: "Replacement caliper", quantity: "1", unit_price: "10", tax_code: "ORIGINAL_TAX_CODE" }] },
    tax_context: { original_document_id: "bill-1", original_revision: "bill-revision-1", original_line_refs: [0] } };
}
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (error: unknown) => error instanceof DraftError && error.code === code);

for (const [treatment, rate, net, vat, gross] of [
  ["standard", "20", "1000", "200", "1200"], ["reduced", "5", "1000", "50", "1050"],
  ["zero", "0", "1000", "0", "1000"], ["exempt", "0", "1000", "0", "1000"],
  ["outside_scope", "0", "1000", "0", "1000"], ["no_vat", "0", "1000", "0", "1000"],
]) {
  test(`expected credit retains original ${treatment} VAT evidence`, () => {
    const money = amount(net!, vat!, gross!);
    const original = bill({ quantity: "1", rate, treatment, money });
    assert.deepEqual(expectedClaim(original, 0, "1").expected, money);
    assert.equal(original.tax_context.lines[0]!.treatment, treatment);
  });
  test(`inclusive ${treatment} claim extracts VAT using the original treatment`, () => {
    const money = amount(net!, vat!, gross!);
    const grossMinor = BigInt(gross!);
    const price = `${grossMinor / 100n}.${(grossMinor % 100n).toString().padStart(2, "0")}`;
    const original = bill({ price, quantity: "1", basis: "including_vat", rate, treatment, money });
    assert.deepEqual(expectedClaim(original, 0, "1").expected, money);
  });
}

test("partial quantities use the original exclusive rate with exact half-up rounding", () => {
  const original = bill({ price: "29.79", money: amount("5958", "1192", "7150") });
  assert.deepEqual(expectedClaim(original, 0, "1"), { description: "Replacement caliper", quantity: "1", expected: amount("2979", "596", "3575") });
  assert.deepEqual(expectedClaim(original, 0, "0.5").expected, amount("1490", "298", "1788"));
});

test("inclusive input extracts VAT from rounded gross, including fractional quantities", () => {
  const original = bill({ price: "10", basis: "including_vat", money: amount("1667", "333", "2000") });
  assert.deepEqual(expectedClaim(original, 0, "0.3333").expected, amount("277", "56", "333"));
  assert.deepEqual(expectedClaim(original, 0, "2.0000").expected, original.money.lines[0]);
});

test("full-quantity expectation preserves saved line totals instead of summing split rounding", () => {
  const original = bill({ price: "0.03", quantity: "2", money: amount("6", "1", "7") });
  assert.deepEqual(expectedClaim(original, 0, "2").expected, amount("6", "1", "7"));
  assert.deepEqual(expectedClaim(original, 0, "1").expected, amount("3", "1", "4"));
});

test("large prices and quantities stay exact without floating point multiplication", () => {
  const original = bill({ price: "999999.9999", quantity: "99.9999", rate: "0", treatment: "zero", money: amount("9999989999", "0", "9999989999") });
  assert.deepEqual(expectedClaim(original, 0, "99.9999").expected, amount("9999989999", "0", "9999989999"));
});

test("drafts, wrong kinds and malformed source evidence cannot become claims", () => {
  for (const patch of [{ status: "draft" }, { kind: "sales_invoice" }, { revision: "" }]) {
    throwsCode(() => expectedClaim({ ...bill(), ...patch }, 0, "1"), "CREDIT_CLAIM_SOURCE_INVALID");
  }
  const wrongCurrency = bill(); wrongCurrency.source.currency = "USD";
  throwsCode(() => expectedClaim(wrongCurrency, 0, "1"), "CREDIT_CLAIM_SOURCE_INVALID");
  const missingLine = bill(); missingLine.tax_context.lines = [];
  throwsCode(() => expectedClaim(missingLine, 0, "1"), "CREDIT_CLAIM_SOURCE_INVALID");
});

test("selection rejects nonexistent indices, invalid decimals and excessive quantities", () => {
  for (const index of [-1, 0.5, 1, NaN, Infinity]) throwsCode(() => expectedClaim(bill(), index, "1"), "CREDIT_CLAIM_LINE_INVALID");
  for (const quantity of ["0", "-1", "1e0", "1.00001", "NaN", "01"]) assert.throws(() => expectedClaim(bill(), 0, quantity), DraftError);
  throwsCode(() => expectedClaim(bill(), 0, "2.0001"), "CREDIT_CLAIM_QUANTITY_EXCEEDS_ORIGINAL");
  throwsCode(() => expectedClaim(bill(), 0, 1 as unknown as string), "DECIMAL_REQUIRED");
});

test("stored totals and tax evidence must agree with original deterministic calculation", () => {
  const wrongAmount = bill(); wrongAmount.money.lines[0] = amount("2001", "400", "2401");
  throwsCode(() => expectedClaim(wrongAmount, 0, "1"), "CREDIT_CLAIM_SOURCE_INVALID");
  for (const patch of [{ code: "OTHER_CODE" }, { rate: "5" }, { rate: "20.001" }, { treatment: "zero" }, { price_basis: "including_vat" }]) {
    const original = bill(); Object.assign(original.tax_context.lines[0]!, patch);
    throwsCode(() => expectedClaim(original, 0, "1"), "CREDIT_CLAIM_TAX_EVIDENCE_INVALID");
  }
  const wrongTaxAmount = bill(); wrongTaxAmount.tax_context.lines[0]!.vat_pence = "399";
  throwsCode(() => expectedClaim(wrongTaxAmount, 0, "1"), "CREDIT_CLAIM_SOURCE_INVALID");
});

test("candidate identifies the exact source and accepts drafts only as suggestions", () => {
  assert.equal(creditCandidate(claim(), credit("draft"), 0), true);
  assert.equal(creditCandidate(claim(), credit("posted"), 0), true);
  const candidate = credit(); candidate.source.line_items[0]!.description = "Different supplier wording";
  assert.equal(creditCandidate(claim(), candidate, 0), true);
});

test("candidate rejects wrong company, supplier, bill, revision and document kind", () => {
  for (const patch of [{ company_id: "company-2" }, { party_id: "supplier-2" }, { original_id: "bill-2" }, { kind: "sales_credit_note" }, { status: "voided" }]) {
    assert.equal(creditCandidate(claim(), { ...credit(), ...patch }, 0), false);
  }
  for (const patch of [{ original_revision: "stale" }, { original_document_id: "bill-2" }]) {
    const candidate = credit(); Object.assign(candidate.tax_context, patch);
    assert.equal(creditCandidate(claim(), candidate, 0), false);
  }
  const wrongSourceSupplier = credit(); wrongSourceSupplier.source.customer_id = "supplier-2";
  assert.equal(creditCandidate(claim(), wrongSourceSupplier, 0), false);
});

test("part and surcharge remain independent even with identical descriptions", () => {
  const candidate = credit();
  candidate.source.line_items.push({ ...candidate.source.line_items[0]! });
  candidate.tax_context.original_line_refs = [1, 0];
  assert.equal(creditCandidate(claim(), candidate, 0), false);
  assert.equal(creditCandidate(claim(), candidate, 1), true);
  const surchargeClaim = { ...claim(), original_line_ref: 1 };
  assert.equal(creditCandidate(surchargeClaim, candidate, 0), true);
  assert.equal(creditCandidate(surchargeClaim, candidate, 1), false);
});

test("malformed candidate indices and mappings fail closed", () => {
  for (const index of [-1, 0.5, 1, NaN]) assert.equal(creditCandidate(claim(), credit(), index), false);
  for (const refs of [[], [0, 1], [-1], [0.5]]) {
    const candidate = credit(); candidate.tax_context.original_line_refs = refs;
    assert.equal(creditCandidate(claim(), candidate, 0), false);
  }
  const duplicate = credit(); duplicate.source.line_items.push({ ...duplicate.source.line_items[0]! }); duplicate.tax_context.original_line_refs = [0, 0];
  assert.equal(creditCandidate(claim(), duplicate, 0), false);
  assert.equal(creditCandidate({ ...claim(), bill_revision: "" }, credit(), 0), false);
  assert.equal(creditCandidate(undefined, credit(), 0), false);
});

test("a new claim awaits credit and has its full expected balance", () => {
  assert.deepEqual(claimProgress(amount("2000", "400", "2400"), []), {
    status: "awaiting", received: amount("0", "0", "0"), remaining: amount("2000", "400", "2400"), received_quantity: "0",
  });
});

test("partial and multiple receipts retain exact monetary and quantity remainders", () => {
  const expected = amount("2000", "400", "2400");
  const first = { money: amount("750", "150", "900"), quantity: "0.75", active: true };
  assert.deepEqual(claimProgress(expected, [first]), { status: "partial", received: first.money, remaining: amount("1250", "250", "1500"), received_quantity: "0.75" });
  const second = { money: amount("1250", "250", "1500"), quantity: "1.2500", active: true };
  assert.deepEqual(claimProgress(expected, [first, second]), { status: "received", received: expected, remaining: amount("0", "0", "0"), received_quantity: "2" });
});

test("a lower-price credit does not close the claim even if it covers the full quantity", () => {
  const progress = claimProgress(amount("4000", "800", "4800"), [{ money: amount("3000", "600", "3600"), quantity: "1", active: true }]);
  assert.equal(progress.status, "partial");
  assert.equal(progress.received_quantity, "1");
  assert.deepEqual(progress.remaining, amount("1000", "200", "1200"));
});

test("matching gross with different net and VAT requires review", () => {
  const progress = claimProgress(amount("1000", "200", "1200"), [{ money: amount("1100", "100", "1200"), quantity: "1", active: true }]);
  assert.equal(progress.status, "needs_review");
  assert.deepEqual(progress.received, amount("1100", "100", "1200"));
  assert.equal(progress.remaining.gross_pence, "0");
  assert.equal(progress.remaining.vat_pence, "100");
});

test("over-crediting is visible rather than clamped out of received totals", () => {
  const progress = claimProgress(amount("1000", "200", "1200"), [{ money: amount("1100", "220", "1320"), quantity: "1.1", active: true }]);
  assert.equal(progress.status, "needs_review");
  assert.deepEqual(progress.received, amount("1100", "220", "1320"));
  assert.deepEqual(progress.remaining, amount("0", "0", "0"));
});

test("invalidated receipts do not satisfy a claim and explicitly require review", () => {
  const expected = amount("1000", "200", "1200");
  const invalidated = { money: expected, quantity: "1", active: false };
  assert.deepEqual(claimProgress(expected, [invalidated]), { status: "needs_review", received: amount("0", "0", "0"), remaining: expected, received_quantity: "0" });
  assert.equal(claimProgress(expected, [invalidated, { ...invalidated, active: true }]).status, "needs_review");
});

test("receipt quantities accumulate exactly to four decimal places", () => {
  const progress = claimProgress(amount("100", "0", "100"), [
    { money: amount("33", "0", "33"), quantity: "0.3333", active: true },
    { money: amount("67", "0", "67"), quantity: "0.6667", active: true },
  ]);
  assert.equal(progress.received_quantity, "1");
  assert.equal(progress.status, "received");
});

test("malformed money, inconsistent totals and numeric quantities are rejected", () => {
  for (const money of [amount("01", "0", "1"), amount("-1", "0", "-1"), amount("1.1", "0", "1.1"), amount("100", "20", "119"), amount("9999999999999", "0", "9999999999999")]) {
    throwsCode(() => claimProgress(money, []), "CREDIT_CLAIM_MONEY_INVALID");
  }
  throwsCode(() => claimProgress(amount("10", "0", "10"), [{ money: amount("1", "0", "1"), quantity: 1 as unknown as string, active: true }]), "DECIMAL_REQUIRED");
  throwsCode(() => claimProgress(amount("10", "0", "10"), [{ money: amount("1", "0", "1"), quantity: "1", active: undefined as unknown as boolean }]), "CREDIT_CLAIM_RECEIPTS_INVALID");
});

test("tracking functions leave source documents and receipt evidence unchanged", () => {
  const original = bill(), candidate = credit(), snapshot = JSON.stringify({ original, candidate });
  expectedClaim(original, 0, "1"); creditCandidate(claim(), candidate, 0);
  const receipts = [{ money: amount("1000", "200", "1200"), quantity: "1", active: true }], before = JSON.stringify(receipts);
  claimProgress(amount("2000", "400", "2400"), receipts);
  assert.equal(JSON.stringify({ original, candidate }), snapshot);
  assert.equal(JSON.stringify(receipts), before);
});
