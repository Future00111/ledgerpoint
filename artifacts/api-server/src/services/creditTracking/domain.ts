import { decimal, fail, MAX_PENCE, netPence } from "../financialDrafts/contract";
import { calculateTaxLine } from "../financialDrafts/productionAuthority";

/** Tracking values are evidence for review, never instructions to post a journal. */
export interface ClaimMoney {
  net_pence: string;
  vat_pence: string;
  gross_pence: string;
}

export interface ClaimReceipt {
  money: ClaimMoney;
  quantity: string;
  active: boolean;
}

const moneyFields = ["net_pence", "vat_pence", "gross_pence"] as const;
const rates: Record<string, bigint> = {
  standard: 2000n, reduced: 500n, zero: 0n, exempt: 0n,
  outside_scope: 0n, no_vat: 0n,
};

function checkedMoney(value: unknown, code = "CREDIT_CLAIM_MONEY_INVALID"): ClaimMoney {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(422, code);
  const input = value as Record<string, unknown>;
  for (const field of moneyFields) {
    if (typeof input[field] !== "string" || !/^(0|[1-9]\d{0,11})$/.test(input[field] as string) ||
        BigInt(input[field] as string) > MAX_PENCE) fail(422, code);
  }
  if (BigInt(input.net_pence as string) + BigInt(input.vat_pence as string) !== BigInt(input.gross_pence as string)) {
    fail(422, code);
  }
  return { net_pence: input.net_pence as string, vat_pence: input.vat_pence as string, gross_pence: input.gross_pence as string };
}

const sameMoney = (left: ClaimMoney, right: ClaimMoney) => moneyFields.every(field => left[field] === right[field]);
const quantityText = (scaled: bigint) => {
  const fraction = (scaled % 10000n).toString().padStart(4, "0").replace(/0+$/, "");
  return `${scaled / 10000n}${fraction ? `.${fraction}` : ""}`;
};

/**
 * A posted bill's immutable line index is the identity, including when a part
 * and its surcharge have similar descriptions. Use its original VAT evidence.
 */
export function expectedClaim(bill: any, lineRef: number, quantity: string): {
  description: string; quantity: string; expected: ClaimMoney;
} {
  if (!bill || bill.kind !== "purchase_bill" || bill.status !== "posted" ||
      typeof bill.revision !== "string" || !bill.revision ||
      !bill.source || bill.source.currency !== "GBP" ||
      !Array.isArray(bill.source.line_items) || !Array.isArray(bill.money?.lines) ||
      !Array.isArray(bill.tax_context?.lines) ||
      bill.source.line_items.length !== bill.money.lines.length ||
      bill.source.line_items.length !== bill.tax_context.lines.length) {
    fail(409, "CREDIT_CLAIM_SOURCE_INVALID");
  }
  if (!Number.isInteger(lineRef) || lineRef < 0 || lineRef >= bill.source.line_items.length) {
    fail(422, "CREDIT_CLAIM_LINE_INVALID");
  }
  const line = bill.source.line_items[lineRef], fact = bill.tax_context.lines[lineRef];
  if (!line || typeof line.description !== "string" || !line.description.trim() ||
      !fact || fact.code !== line.tax_code || typeof fact.rate !== "string" ||
      !/^(0|[1-9]\d{0,2})(?:\.\d{1,2})?$/.test(fact.rate)) {
    fail(409, "CREDIT_CLAIM_TAX_EVIDENCE_INVALID");
  }
  const basis = bill.source.price_basis ?? "excluding_vat";
  if ((basis !== "excluding_vat" && basis !== "including_vat") ||
      (fact.price_basis !== undefined && fact.price_basis !== basis)) fail(409, "CREDIT_CLAIM_TAX_EVIDENCE_INVALID");
  const rate = decimal(fact.rate, false) / 100n;
  if (rates[fact.treatment] === undefined || rates[fact.treatment] !== rate) fail(409, "CREDIT_CLAIM_TAX_EVIDENCE_INVALID");

  const originalQuantity = decimal(line.quantity, true), requestedQuantity = decimal(quantity, true);
  if (requestedQuantity > originalQuantity) fail(422, "CREDIT_CLAIM_QUANTITY_EXCEEDS_ORIGINAL");
  const calculate = (qty: string): ClaimMoney => {
    const entered = netPence([{ ...line, quantity: qty }])[0]!;
    const result = calculateTaxLine(entered, rate, basis, line.unit_price);
    return checkedMoney({ net_pence: result.net.toString(), vat_pence: result.vat.toString(), gross_pence: (result.net + result.vat).toString() });
  };
  const originalMoney = checkedMoney(bill.money.lines[lineRef], "CREDIT_CLAIM_SOURCE_INVALID");
  if (!sameMoney(calculate(line.quantity), originalMoney) ||
      fact.net_pence !== originalMoney.net_pence || fact.vat_pence !== originalMoney.vat_pence) {
    fail(409, "CREDIT_CLAIM_SOURCE_INVALID");
  }
  const expected = requestedQuantity === originalQuantity ? originalMoney : calculate(quantity);
  if (moneyFields.some(field => BigInt(expected[field]) > BigInt(originalMoney[field]))) {
    fail(409, "CREDIT_CLAIM_SOURCE_INVALID");
  }
  return { description: line.description, quantity, expected };
}

/**
 * lineRef is the incoming CREDIT line index. This checks source evidence only;
 * callers must authorise the tenant, exclude historical receipts, and verify the
 * canonical journal lifecycle before confirming a receipt. Drafts are suggestions.
 */
export function creditCandidate(claim: any, credit: any, lineRef: number): boolean {
  if (!claim || !credit || credit.kind !== "supplier_credit_note" ||
      !["draft", "posted"].includes(credit.status) ||
      !Number.isInteger(lineRef) || lineRef < 0 ||
      !Number.isInteger(claim.original_line_ref) || claim.original_line_ref < 0 ||
      !["company_id", "party_id", "bill_id", "bill_revision"].every(field => typeof claim[field] === "string" && claim[field].length > 0) ||
      credit.company_id !== claim.company_id || credit.party_id !== claim.party_id ||
      credit.source?.customer_id !== claim.party_id || credit.original_id !== claim.bill_id ||
      credit.tax_context?.original_document_id !== claim.bill_id ||
      credit.tax_context?.original_revision !== claim.bill_revision) return false;
  const refs = credit.tax_context.original_line_refs, lines = credit.source.line_items;
  if (!Array.isArray(refs) || !Array.isArray(lines) || refs.length !== lines.length ||
      lineRef >= lines.length || !lines[lineRef] ||
      refs.some(ref => !Number.isInteger(ref) || ref < 0) || new Set(refs).size !== refs.length) return false;
  return refs[lineRef] === claim.original_line_ref;
}

/** Exact totals of confirmed receipt allocations; never derive value from quantity. */
export function claimProgress(expectedInput: ClaimMoney, receipts: ClaimReceipt[]): {
  status: "awaiting" | "partial" | "received" | "needs_review";
  received: ClaimMoney;
  remaining: ClaimMoney;
  received_quantity: string;
} {
  const expected = checkedMoney(expectedInput);
  if (!Array.isArray(receipts)) fail(422, "CREDIT_CLAIM_RECEIPTS_INVALID");
  const totals = { net_pence: 0n, vat_pence: 0n, gross_pence: 0n };
  let totalQuantity = 0n, activeCount = 0, invalidated = false;
  for (const receipt of receipts) {
    if (!receipt || typeof receipt.active !== "boolean") fail(422, "CREDIT_CLAIM_RECEIPTS_INVALID");
    const value = checkedMoney(receipt.money), quantity = decimal(receipt.quantity, true);
    if (!receipt.active) { invalidated = true; continue; }
    activeCount++;
    totalQuantity += quantity;
    for (const field of moneyFields) totals[field] += BigInt(value[field]);
  }
  const received = Object.fromEntries(moneyFields.map(field => [field, totals[field].toString()])) as unknown as ClaimMoney;
  const remaining = Object.fromEntries(moneyFields.map(field => {
    const difference = BigInt(expected[field]) - totals[field];
    return [field, (difference < 0n ? 0n : difference).toString()];
  })) as unknown as ClaimMoney;
  const overage = moneyFields.some(field => totals[field] > BigInt(expected[field]));
  const complete = moneyFields.every(field => totals[field] === BigInt(expected[field]));
  const status = invalidated || overage ? "needs_review" :
    activeCount === 0 ? "awaiting" : complete ? "received" : "partial";
  return { status, received, remaining, received_quantity: quantityText(totalQuantity) };
}
