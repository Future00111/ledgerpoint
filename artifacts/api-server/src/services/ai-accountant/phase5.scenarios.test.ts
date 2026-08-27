import assert from "node:assert/strict";
import test from "node:test";
import { buildReconciliation, scoreTransaction, type BankTxn, type CompanyRecords } from "./matcher.js";
import { categoriseWithAI, suggestNominalAccount, type NominalAccount } from "./categorise.js";
import { deriveDecision, detectPossibleDuplicate } from "./analysis.js";

const incoming = (amount: number, description = "ACME INV-1", date = "2026-08-20") => ({
  id: `in-${amount}-${description}`, money_in: amount.toFixed(2), money_out: "0.00", description, reference: "INV-1", date,
}) as BankTxn;
const outgoing = (amount: number, description = "Cloud Host", date = "2026-08-20") => ({
  id: `out-${amount}-${description}`, money_in: "0.00", money_out: amount.toFixed(2), description, reference: null, date,
}) as BankTxn;
const invoice = (balance: number) => ({
  id: "invoice-1", invoice_number: "INV-1", balance_due: balance.toFixed(2), total: balance.toFixed(2),
  customer_name: "ACME", issue_date: "2026-08-15", reference: null, status: "sent",
});
const records = (balance: number, extra = [] as ReturnType<typeof invoice>[]) => ({
  invoices: [invoice(balance), ...extra], bills: [], salesCNs: [], supplierCNs: [],
}) as unknown as CompanyRecords;
const reconcile = (txn: BankTxn, data: CompanyRecords) => buildReconciliation(txn, scoreTransaction(txn, data))!;
const accounts: NominalAccount[] = [
  { id: "hosting", code: "7400", name: "IT & Hosting", account_type: "expense" },
  { id: "sales", code: "4000", name: "Sales Income", account_type: "income" },
];

test("Phase 5 exact match is review-ready but never auto-posted", () => {
  const result = reconcile(incoming(100), records(100));
  const decision = deriveDecision(result, false, false);
  assert.equal(result.scenario, "exact");
  assert.equal(decision.state, "READY");
});

test("Phase 5 partial payment keeps an explicit partial-match state", () => {
  const result = reconcile(incoming(40), records(100));
  assert.equal(result.scenario, "partial");
  assert.equal(deriveDecision(result, false, false).state, "PARTIAL_MATCH");
});

test("Phase 5 multi-invoice payment keeps an explicit multi-match state", () => {
  const second = { ...invoice(60), id: "invoice-2", invoice_number: "INV-2" };
  const result = reconcile(incoming(100, "ACME INV-1 INV-2"), records(40, [second]));
  assert.equal(result.scenario, "combination");
  assert.equal(deriveDecision(result, false, false).state, "MULTI_MATCH");
});

test("Phase 5 overpayments remain review-required", () => {
  const result = reconcile(incoming(110), records(100));
  assert.equal(result.scenario, "overpayment");
  assert.notEqual(deriveDecision(result, false, false).state, "READY");
});

test("Phase 5 no match is visible as an unresolved decision", () => {
  const result = reconcile(incoming(100, "Unknown receipt"), records(10));
  assert.equal(result.scenario, "no_match");
  assert.equal(deriveDecision(result, false, false).state, "NO_MATCH");
});

test("Phase 5 preserves the unexplained portion of a receipt", () => {
  const result = reconcile(incoming(150), records(100));
  assert.equal(result.remaining, 50);
});

test("Phase 5 detects same-direction duplicate bank activity", () => {
  const txn = outgoing(54, "Cloud Host", "2026-08-22");
  const peer = { ...outgoing(54, "Cloud Host Ltd", "2026-08-20"), company_id: "company-a" };
  assert.equal(detectPossibleDuplicate(txn, [peer] as never), true);
});

test("Phase 5 does not call a different amount a duplicate", () => {
  const txn = outgoing(54, "Cloud Host", "2026-08-22");
  const peer = { ...outgoing(55, "Cloud Host", "2026-08-20"), company_id: "company-a" };
  assert.equal(detectPossibleDuplicate(txn, [peer] as never), false);
});

test("Phase 5 VAT review overrides a ready match", () => {
  const result = reconcile(incoming(100), records(100));
  assert.equal(deriveDecision(result, false, true).state, "VAT_REVIEW");
});

test("Phase 5 missing VAT evidence blocks a ready exact match", () => {
  const result = reconcile(incoming(100), records(100));
  const decision = deriveDecision(result, false, true);
  assert.equal(decision.state, "VAT_REVIEW");
  assert.notEqual(decision.state, "READY");
});

test("Phase 5 learning only suggests an account in this company chart", () => {
  const suggestion = suggestNominalAccount(outgoing(20, "Cloud Host"), accounts, [{
    party_name: "Cloud Host", account_id: "hosting", account_code: "7400", account_name: "IT & Hosting", confidence: "90", occurrence_count: 3,
  }]);
  assert.equal(suggestion?.account_id, "hosting");
  assert.equal(suggestion?.source, "learning");
});

test("Phase 5 rejects cross-company or stale learned accounts", () => {
  const suggestion = suggestNominalAccount(outgoing(20, "Cloud Host"), accounts, [{
    party_name: "Cloud Host", account_id: "other-company-account", account_code: "9999", account_name: "Foreign Account", confidence: "99", occurrence_count: 9,
  }]);
  assert.notEqual(suggestion?.account_id, "other-company-account");
});

test("Phase 5 never invents an account when no company chart exists", () => {
  assert.equal(suggestNominalAccount(outgoing(20, "AWS"), []), null);
});

test("Phase 5 AI categorisation safely degrades when no chart exists", async () => {
  assert.deepEqual(await categoriseWithAI([outgoing(20, "Unknown supplier")], []), {});
});