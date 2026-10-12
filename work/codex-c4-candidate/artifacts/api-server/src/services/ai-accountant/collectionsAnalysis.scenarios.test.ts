import assert from "node:assert/strict";
import test from "node:test";
import { analyseCollections } from "./collectionsAnalysis.js";

const invoice = (overrides: Record<string, unknown>) => ({
  id: "inv-1",
  customer_id: "customer-1",
  customer_name: "Northstar Ltd",
  invoice_number: "INV-001",
  issue_date: "2026-05-01",
  due_date: "2026-05-31",
  total: "1000.00",
  amount_paid: "0.00",
  balance_due: "1000.00",
  status: "sent",
  ...overrides,
});

const customer = { id: "customer-1", name: "Northstar Ltd", email: "finance@northstar.test", payment_terms: 30 };

test("prioritises an old, high-value overdue invoice and includes actual payment evidence", () => {
  const result = analyseCollections([
    invoice({ id: "old", invoice_number: "INV-OLD", due_date: "2026-04-01", total: "12000.00", balance_due: "12000.00" }),
    invoice({ id: "history", invoice_number: "INV-HISTORY", due_date: "2026-03-01", total: "500.00", balance_due: "0.00", amount_paid: "500.00", status: "paid" }),
  ], [customer], [
    { id: "payment-history", linked_invoice_id: "history", date: "2026-03-21", money_in: "500.00" },
  ], "2026-06-01");

  assert.equal(result.overdue_invoices.length, 1);
  const overdue = result.overdue_invoices[0]!;
  assert.equal(overdue.days_overdue, 61);
  assert.equal(overdue.balance_due, 12000);
  assert.equal(overdue.priority, "critical");
  assert.equal(overdue.average_payment_delay_days, 20);
  assert.equal(overdue.payment_history.linked_payment_count, 0);
  assert.equal(result.summary.total_overdue, 12000);
  assert.equal(result.customers[0]?.previous_overdue_invoices, 2);
});

test("excludes paid, cancelled and not-yet-due invoices from a collection queue", () => {
  const result = analyseCollections([
    invoice({ id: "future", due_date: "2026-06-15", balance_due: "300.00" }),
    invoice({ id: "paid", status: "paid", balance_due: "0.00", amount_paid: "1000.00" }),
    invoice({ id: "cancelled", status: "cancelled", balance_due: "1000.00" }),
  ], [customer], [], "2026-06-01");

  assert.equal(result.overdue_invoices.length, 0);
  assert.equal(result.summary.total_overdue, 0);
  assert.equal(result.summary.overdue_customer_count, 0);
  assert.equal(result.customers[0]?.total_outstanding, 300);
});

test("keeps customer totals separate while ranking independent overdue invoices", () => {
  const secondCustomer = { id: "customer-2", name: "Harbour Studio", email: "accounts@harbour.test" };
  const result = analyseCollections([
    invoice({ id: "northstar", due_date: "2026-05-28", balance_due: "100.00" }),
    invoice({
      id: "harbour",
      customer_id: "customer-2",
      customer_name: "Harbour Studio",
      invoice_number: "HAR-100",
      due_date: "2026-04-20",
      total: "3000.00",
      balance_due: "3000.00",
    }),
  ], [customer, secondCustomer], [], "2026-06-01");

  assert.equal(result.customers.length, 2);
  assert.equal(result.overdue_invoices[0]?.invoice_id, "harbour");
  assert.equal(result.overdue_invoices[0]?.customer_overdue, 3000);
  assert.equal(result.overdue_invoices[1]?.customer_overdue, 100);
  assert.equal(result.summary.total_overdue, 3100);
});