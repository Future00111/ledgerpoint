import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReconciliation,
  scoreTransaction,
  type BankTxn,
  type CompanyRecords,
} from "./matcher.js";

const txn = (amount: number, description = "", date = "2026-08-20", reference = "") =>
  ({
    id: `txn-${amount}-${description}`,
    money_in: amount.toFixed(2),
    money_out: "0.00",
    description,
    date,
    reference,
  }) as BankTxn;

const invoice = (
  id: string,
  invoiceNumber: string,
  balance: number,
  customerName: string,
  issueDate = "2026-08-15",
  reference: string | null = null,
) => ({
  id,
  invoice_number: invoiceNumber,
  balance_due: balance.toFixed(2),
  total: balance.toFixed(2),
  customer_name: customerName,
  issue_date: issueDate,
  reference,
  status: "sent",
});

const records = (...invoices: ReturnType<typeof invoice>[]) =>
  ({
    invoices,
    bills: [],
    salesCNs: [],
    supplierCNs: [],
  }) as unknown as CompanyRecords;

const reconcile = (payment: BankTxn, companyRecords: CompanyRecords) =>
  buildReconciliation(payment, scoreTransaction(payment, companyRecords));

test("exact invoice receipt keeps confidence below 100 and proposes full allocation", () => {
  const result = reconcile(txn(1250, "ACME LTD INV-100", "2026-08-20"), records(
    invoice("inv-100", "INV-100", 1250, "ACME LTD"),
  ));
  assert.equal(result?.scenario, "exact");
  assert.equal(result?.status, "green");
  assert.equal(result?.matched_records[0]?.allocated_amount, 1250);
  assert.ok((result?.confidence ?? 100) < 100);
});

test("one receipt can match multiple invoices", () => {
  const result = reconcile(txn(3000, "Settlement INV-101 and INV-102"), records(
    invoice("inv-101", "INV-101", 1200, "Acme Ltd"),
    invoice("inv-102", "INV-102", 1800, "Acme Ltd"),
  ));
  assert.equal(result?.scenario, "combination");
  assert.equal(result?.matched_records.length, 2);
  assert.equal(result?.matched_total, 3000);
});

test("partial payment records allocation separately from the remaining invoice balance", () => {
  const result = reconcile(txn(8000, "TURNER CONSULTING INV-103"), records(
    invoice("inv-103", "INV-103", 10000, "TURNER CONSULTING"),
  ));
  assert.equal(result?.scenario, "partial");
  assert.equal(result?.matched_total, 8000);
  assert.equal(result?.remaining, 0);
  assert.equal(result?.matched_records[0]?.allocated_amount, 8000);
  assert.equal(result?.matched_records[0]?.invoice_balance_remaining, 2000);
});

test("small excess against a strong invoice signal is an overpayment candidate", () => {
  const result = reconcile(txn(5500, "TIGER LTD INV-104"), records(
    invoice("inv-104", "INV-104", 5000, "TIGER LTD"),
  ));
  assert.equal(result?.scenario, "overpayment");
  assert.equal(result?.remaining, 500);
  assert.equal(result?.matched_total, 5000);
});

test("receipt with no invoice remains a no-match review result", () => {
  const result = reconcile(txn(3400, "Unidentified bank credit"), records(
    invoice("inv-105", "INV-105", 950, "Other Customer"),
  ));
  assert.equal(result?.scenario, "no_match");
  assert.equal(result?.remaining, 3400);
  assert.equal(result?.matched_records.length, 0);
});

test("incorrect reference can still match from amount, name, and date evidence", () => {
  const result = reconcile(txn(2500, "NORTHSTAR payment ref WRONG-REF"), records(
    invoice("inv-106", "INV-106", 2500, "NORTHSTAR"),
  ));
  assert.equal(result?.scenario, "exact");
  assert.ok(!result?.matched_records[0]?.reasons.some((reason) => reason.includes("Reference number")));
});

test("delayed payment can match when reference and party evidence are strong", () => {
  const result = reconcile(txn(1650, "RIVERSTONE INV-107", "2026-10-20"), records(
    invoice("inv-107", "INV-107", 1650, "RIVERSTONE", "2026-08-01"),
  ));
  assert.equal(result?.scenario, "exact");
  assert.ok(!result?.matched_records[0]?.reasons.some((reason) => reason.startsWith("Date within")));
});

test("multiple payments against one invoice can be reviewed as sequential allocations", () => {
  const first = reconcile(txn(4000, "HARBOR INV-108"), records(
    invoice("inv-108", "INV-108", 10000, "HARBOR"),
  ));
  const second = reconcile(txn(6000, "HARBOR INV-108", "2026-09-20"), records(
    invoice("inv-108", "INV-108", 6000, "HARBOR", "2026-08-15"),
  ));
  assert.equal(first?.scenario, "partial");
  assert.equal(first?.matched_records[0]?.invoice_balance_remaining, 6000);
  assert.equal(second?.scenario, "exact");
});

test("slightly different customer names produce a reviewable close-name match", () => {
  const result = reconcile(txn(2200, "ACME CONSULT payment INV-109"), records(
    invoice("inv-109", "INV-109", 2200, "ACME CONSULTING LIMITED"),
  ));
  assert.equal(result?.scenario, "exact");
  assert.ok(result?.matched_records[0]?.reasons.includes("Customer name is a close match"));
});

test("partially unexplained revenue leaves the unmatched receipt value visible", () => {
  const result = reconcile(txn(12500, "ORBIT INV-110"), records(
    invoice("inv-110", "INV-110", 10000, "ORBIT"),
  ));
  assert.equal(result?.scenario, "partial");
  assert.equal(result?.matched_total, 10000);
  assert.equal(result?.remaining, 2500);
});