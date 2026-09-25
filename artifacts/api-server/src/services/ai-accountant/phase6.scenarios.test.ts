import assert from "node:assert/strict";
import test from "node:test";
import { buildReconciliation, scoreTransaction, type BankTxn, type CompanyRecords } from "./matcher.js";
import {
  detectInternalTransfer,
  detectRecurringTransaction,
  deriveDecision,
} from "./analysis.js";

const transaction = (overrides: Partial<BankTxn>) => ({
  id: "txn",
  company_id: "company-a",
  bank_account_id: "account-a",
  date: "2026-08-20",
  description: "Adobe Software",
  money_in: "0.00",
  money_out: "54.99",
  status: "review",
  ...overrides,
}) as BankTxn;

test("Phase 6 identifies a recurring transaction only from approved company history", () => {
  const current = transaction({ id: "current" });
  const history = [
    transaction({ id: "old-1", date: "2026-07-20", status: "matched" }),
    transaction({ id: "old-2", date: "2026-06-20", status: "matched" }),
  ];
  const result = detectRecurringTransaction(current, [current, ...history]);
  assert.equal(result.recurring, true);
  assert.equal(result.previousCount, 2);
  assert.equal(result.typicalAmount, 54.99);
});

test("Phase 6 does not treat unapproved lookalikes as recurring accounting evidence", () => {
  const current = transaction({ id: "current" });
  const history = [
    transaction({ id: "old-1", date: "2026-07-20", status: "review" }),
    transaction({ id: "old-2", date: "2026-06-20", status: "review" }),
  ];
  assert.equal(detectRecurringTransaction(current, [current, ...history]).recurring, false);
});

test("Phase 6 identifies equal and opposite transactions between company accounts as a transfer", () => {
  const outbound = transaction({ id: "outbound", bank_account_id: "account-a", money_out: "500.00" });
  const inbound = transaction({
    id: "inbound", bank_account_id: "account-b", date: "2026-08-21",
    description: "Transfer from account A", money_in: "500.00", money_out: "0.00",
  });
  assert.equal(detectInternalTransfer(outbound, [outbound, inbound])?.id, "inbound");
});

test("Phase 6 transfer detection requires different bank accounts and opposite direction", () => {
  const outbound = transaction({ id: "outbound", bank_account_id: "account-a", money_out: "500.00" });
  const sameAccount = transaction({ id: "same-account", bank_account_id: "account-a", money_in: "500.00", money_out: "0.00" });
  assert.equal(detectInternalTransfer(outbound, [outbound, sameAccount]), null);
});

test("Phase 6 transfer classification keeps an otherwise unmatched item out of income and expense approval", () => {
  const decision = deriveDecision({
    scenario: "no_match", confidence: 0, possible_explanations: [], transaction_amount: 500,
    matched_records: [], matched_total: 0, remaining: 500, potential_matches: [], status: "red", recommendation: "",
  }, false, false, { transfer: true });
  assert.equal(decision.state, "TRANSFER");
  assert.notEqual(decision.state, "READY");
});

test("Phase 6 retains exact supplier-bill matching for an outgoing bank transaction", () => {
  const payment = transaction({ id: "bill-payment", description: "Printer Parts BILL-1", reference: "BILL-1", money_out: "240.00" });
  const records = {
    invoices: [], salesCNs: [], supplierCNs: [],
    bills: [{ id: "bill-1", bill_number: "BILL-1", balance_due: "240.00", total: "240.00", supplier_name: "Printer Parts", bill_date: "2026-08-18", reference: null, status: "approved" }],
  } as unknown as CompanyRecords;
  assert.equal(buildReconciliation(payment, scoreTransaction(payment, records))?.scenario, "exact");
});

test("Phase 6 can retain multiple supplier bills as one outgoing settlement", () => {
  const payment = transaction({ id: "bill-batch", description: "Supplier settlement BILL-1 BILL-2", reference: "BILL-1 BILL-2", money_out: "300.00" });
  const records = {
    invoices: [], salesCNs: [], supplierCNs: [],
    bills: [
      { id: "bill-1", bill_number: "BILL-1", balance_due: "100.00", total: "100.00", supplier_name: "Supplier", bill_date: "2026-08-18", reference: null, status: "approved" },
      { id: "bill-2", bill_number: "BILL-2", balance_due: "200.00", total: "200.00", supplier_name: "Supplier", bill_date: "2026-08-18", reference: null, status: "approved" },
    ],
  } as unknown as CompanyRecords;
  assert.equal(buildReconciliation(payment, scoreTransaction(payment, records))?.scenario, "combination");
});