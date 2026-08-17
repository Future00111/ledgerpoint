function formatCurrency(a) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0);
}

function inDateRange(date, from, to) {
  if (!date) return true;
  const d = new Date(date);
  if (from && d < new Date(from)) return false;
  if (to && d > new Date(to + 'T23:59:59')) return false;
  return true;
}

function upToDate(date, to) {
  if (!to || !date) return true;
  return new Date(date) <= new Date(to + 'T23:59:59');
}

export function calculateReport(reportType, data, dateFrom, dateTo) {
  const { journals, accounts, invoices, bills, bankTxns } = data;

  const fJournals = journals.filter(j => inDateRange(j.date, dateFrom, dateTo));
  const fInvoices = invoices.filter(i => inDateRange(i.issue_date, dateFrom, dateTo));
  const fBills = bills.filter(b => inDateRange(b.bill_date, dateFrom, dateTo));
  const fBankTxns = bankTxns.filter(t => inDateRange(t.date, dateFrom, dateTo));

  switch (reportType) {
    case 'profit_loss':
      return calcProfitLoss(fJournals, accounts, dateFrom, dateTo);
    case 'balance_sheet':
      return calcBalanceSheet(journals, accounts, dateTo);
    case 'vat_summary':
      return calcVATSummary(fJournals, accounts);
    case 'trial_balance':
      return calcTrialBalance(fJournals, accounts);
    case 'sales_by_customer':
      return calcSalesByCustomer(fInvoices);
    case 'purchases_by_supplier':
      return calcPurchasesBySupplier(fBills);
    case 'aged_debtors':
      return calcAgedDebtors(invoices, dateTo);
    case 'aged_creditors':
      return calcAgedCreditors(bills, dateTo);
    case 'bank_reconciliation':
      return calcBankReconciliation(fBankTxns);
    default:
      return null;
  }
}

function calcProfitLoss(journals, accounts, dateFrom, dateTo) {
  const incomeAccounts = accounts.filter(a => a.type === 'income');
  const expenseAccounts = accounts.filter(a => a.type === 'expense');

  let totalIncome = 0, totalExpenses = 0;
  const incomeRows = incomeAccounts.map(acc => {
    const debit = journals.filter(j => j.account_id === acc.id).reduce((s, j) => s + (j.debit || 0), 0);
    const credit = journals.filter(j => j.account_id === acc.id).reduce((s, j) => s + (j.credit || 0), 0);
    const balance = credit - debit; // income is typically credits
    totalIncome += balance;
    return { cells: [acc.name, formatCurrency(balance)], drillDown: null };
  });

  const expenseRows = expenseAccounts.map(acc => {
    const debit = journals.filter(j => j.account_id === acc.id).reduce((s, j) => s + (j.debit || 0), 0);
    const credit = journals.filter(j => j.account_id === acc.id).reduce((s, j) => s + (j.credit || 0), 0);
    const balance = debit - credit; // expenses are typically debits
    totalExpenses += balance;
    return { cells: [acc.name, formatCurrency(balance)], drillDown: null };
  });

  const netProfit = totalIncome - totalExpenses;

  return {
    title: 'Profit and Loss',
    summaryCards: [
      { label: 'Total Income', value: totalIncome },
      { label: 'Total Expenses', value: totalExpenses },
      { label: 'Net Profit', value: netProfit },
    ],
    sections: [
      { name: 'Income', columns: ['Account', 'Amount'], rows: incomeRows, totalLabel: 'Total Income', totalValue: totalIncome },
      { name: 'Expenses', columns: ['Account', 'Amount'], rows: expenseRows, totalLabel: 'Total Expenses', totalValue: totalExpenses },
    ],
  };
}

function calcBalanceSheet(journals, accounts, dateTo) {
  const assetAccounts = accounts.filter(a => a.type === 'asset');
  const liabilityAccounts = accounts.filter(a => a.type === 'liability');
  const equityAccounts = accounts.filter(a => a.type === 'equity');

  const fJournals = journals.filter(j => upToDate(j.date, dateTo));

  let totalAssets = 0, totalLiabilities = 0, totalEquity = 0;

  const assetRows = assetAccounts.map(acc => {
    const debit = fJournals.filter(j => j.account_id === acc.id).reduce((s, j) => s + (j.debit || 0), 0);
    const credit = fJournals.filter(j => j.account_id === acc.id).reduce((s, j) => s + (j.credit || 0), 0);
    const balance = debit - credit; // assets are debits
    totalAssets += balance;
    return { cells: [acc.name, formatCurrency(balance)], drillDown: null };
  });

  const liabilityRows = liabilityAccounts.map(acc => {
    const debit = fJournals.filter(j => j.account_id === acc.id).reduce((s, j) => s + (j.debit || 0), 0);
    const credit = fJournals.filter(j => j.account_id === acc.id).reduce((s, j) => s + (j.credit || 0), 0);
    const balance = credit - debit; // liabilities are credits
    totalLiabilities += balance;
    return { cells: [acc.name, formatCurrency(balance)], drillDown: null };
  });

  const equityRows = equityAccounts.map(acc => {
    const debit = fJournals.filter(j => j.account_id === acc.id).reduce((s, j) => s + (j.debit || 0), 0);
    const credit = fJournals.filter(j => j.account_id === acc.id).reduce((s, j) => s + (j.credit || 0), 0);
    const balance = credit - debit; // equity is credits
    totalEquity += balance;
    return { cells: [acc.name, formatCurrency(balance)], drillDown: null };
  });

  return {
    title: 'Balance Sheet',
    summaryCards: [
      { label: 'Total Assets', value: totalAssets },
      { label: 'Total Liabilities', value: totalLiabilities },
      { label: 'Total Equity', value: totalEquity },
    ],
    sections: [
      { name: 'Assets', columns: ['Account', 'Amount'], rows: assetRows, totalLabel: 'Total Assets', totalValue: totalAssets },
      { name: 'Liabilities', columns: ['Account', 'Amount'], rows: liabilityRows, totalLabel: 'Total Liabilities', totalValue: totalLiabilities },
      { name: 'Equity', columns: ['Account', 'Amount'], rows: equityRows, totalLabel: 'Total Equity', totalValue: totalEquity },
    ],
  };
}

function calcVATSummary(journals, accounts) {
  const vatAccounts = accounts.filter(a => a.type === 'vat');

  let outputVAT = 0, inputVAT = 0;
  const rows = vatAccounts.map(acc => {
    const debit = journals.filter(j => j.account_id === acc.id).reduce((s, j) => s + (j.debit || 0), 0);
    const credit = journals.filter(j => j.account_id === acc.id).reduce((s, j) => s + (j.credit || 0), 0);
    const balance = credit - debit; // VAT is typically credit
    if (balance > 0) outputVAT += balance;
    else inputVAT += Math.abs(balance);
    return { cells: [acc.name, formatCurrency(balance)], drillDown: null };
  });

  const netVAT = outputVAT - inputVAT;

  return {
    title: 'VAT Summary',
    summaryCards: [
      { label: 'Output VAT', value: outputVAT },
      { label: 'Input VAT', value: inputVAT },
      { label: 'Net VAT Payable', value: netVAT },
    ],
    sections: [
      { name: 'VAT Breakdown', columns: ['Account', 'Amount'], rows, totalLabel: 'Net VAT', totalValue: netVAT },
    ],
  };
}

function calcTrialBalance(journals, accounts) {
  let totalDebits = 0, totalCredits = 0;
  const rows = accounts.map(acc => {
    const debit = journals.filter(j => j.account_id === acc.id).reduce((s, j) => s + (j.debit || 0), 0);
    const credit = journals.filter(j => j.account_id === acc.id).reduce((s, j) => s + (j.credit || 0), 0);
    totalDebits += debit;
    totalCredits += credit;
    return {
      cells: [acc.code, acc.name, formatCurrency(debit), formatCurrency(credit)],
      drillDown: null,
    };
  }).filter(r => r.cells[2] !== '$0.00' || r.cells[3] !== '$0.00');

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return {
    title: 'Trial Balance',
    summaryCards: [
      { label: 'Total Debits', value: totalDebits },
      { label: 'Total Credits', value: totalCredits },
      { label: 'Balanced', value: isBalanced ? 1 : 0 },
    ],
    sections: [
      {
        name: 'Trial Balance',
        columns: ['Code', 'Account', 'Debit', 'Credit'],
        rows,
        totalCells: ['', 'Total', formatCurrency(totalDebits), formatCurrency(totalCredits)],
      },
    ],
  };
}

function calcSalesByCustomer(invoices) {
  const byCustomer = {};
  for (const inv of invoices) {
    const id = inv.customer_id || inv.customer_name || 'unknown';
    if (!byCustomer[id]) byCustomer[id] = { name: inv.customer_name || 'Unknown', net: 0, vat: 0, total: 0, count: 0, items: [] };
    byCustomer[id].net += inv.subtotal || 0;
    byCustomer[id].vat += inv.vat_total || 0;
    byCustomer[id].total += inv.total || 0;
    byCustomer[id].count++;
    byCustomer[id].items.push(inv);
  }
  const rows = Object.values(byCustomer).sort((a, b) => b.total - a.total);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return {
    title: 'Sales by Customer',
    summaryCards: [
      { label: 'Total Sales', value: grandTotal },
      { label: 'Customers', value: rows.length },
    ],
    sections: [
      {
        name: 'Sales by Customer',
        columns: ['Customer', 'Invoices', 'Net', 'VAT', 'Total'],
        rows: rows.map(r => ({
          cells: [r.name, String(r.count), formatCurrency(r.net), formatCurrency(r.vat), formatCurrency(r.total)],
          drillDown: { title: r.name + ' - Transactions', items: r.items },
        })),
        totalLabel: 'Total Sales',
        totalValue: grandTotal,
      },
    ],
  };
}

function calcPurchasesBySupplier(bills) {
  const bySupplier = {};
  for (const bill of bills) {
    const id = bill.supplier_id || bill.supplier_name || 'unknown';
    if (!bySupplier[id]) bySupplier[id] = { name: bill.supplier_name || 'Unknown', net: 0, vat: 0, total: 0, count: 0, items: [] };
    bySupplier[id].net += bill.subtotal || 0;
    bySupplier[id].vat += bill.vat_total || 0;
    bySupplier[id].total += bill.total || 0;
    bySupplier[id].count++;
    bySupplier[id].items.push(bill);
  }
  const rows = Object.values(bySupplier).sort((a, b) => b.total - a.total);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return {
    title: 'Purchases by Supplier',
    summaryCards: [
      { label: 'Total Purchases', value: grandTotal },
      { label: 'Suppliers', value: rows.length },
    ],
    sections: [
      {
        name: 'Purchases by Supplier',
        columns: ['Supplier', 'Bills', 'Net', 'VAT', 'Total'],
        rows: rows.map(r => ({
          cells: [r.name, String(r.count), formatCurrency(r.net), formatCurrency(r.vat), formatCurrency(r.total)],
          drillDown: { title: r.name + ' - Transactions', items: r.items },
        })),
        totalLabel: 'Total Purchases',
        totalValue: grandTotal,
      },
    ],
  };
}

function calcAgedDebtors(invoices, dateTo) {
  const now = dateTo ? new Date(dateTo) : new Date();
  const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && (i.balance_due || 0) > 0);

  const rows = outstanding.map(inv => {
    const dueDate = new Date(inv.due_date);
    const days = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
    const amount = inv.balance_due || 0;
    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    if (days <= 30) buckets['0-30'] = amount;
    else if (days <= 60) buckets['31-60'] = amount;
    else if (days <= 90) buckets['61-90'] = amount;
    else buckets['90+'] = amount;

    return {
      cells: [
        inv.customer_name || 'Unknown',
        inv.invoice_number || '-',
        inv.due_date || '-',
        formatCurrency(buckets['0-30']),
        formatCurrency(buckets['31-60']),
        formatCurrency(buckets['61-90']),
        formatCurrency(buckets['90+']),
        formatCurrency(amount),
      ],
      drillDown: { title: 'Invoice ' + (inv.invoice_number || ''), items: [inv] },
      buckets,
      amount,
    };
  });

  const totals = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  for (const r of rows) {
    totals['0-30'] += r.buckets['0-30'];
    totals['31-60'] += r.buckets['31-60'];
    totals['61-90'] += r.buckets['61-90'];
    totals['90+'] += r.buckets['90+'];
  }
  const grandTotal = totals['0-30'] + totals['31-60'] + totals['61-90'] + totals['90+'];

  return {
    title: 'Aged Debtors',
    summaryCards: [
      { label: 'Total Outstanding', value: grandTotal },
      { label: 'Invoices', value: rows.length },
    ],
    sections: [
      {
        name: 'Aged Debtors',
        columns: ['Customer', 'Invoice #', 'Due Date', '0-30', '31-60', '61-90', '90+', 'Total'],
        rows,
        totalCells: ['', '', 'Total', formatCurrency(totals['0-30']), formatCurrency(totals['31-60']), formatCurrency(totals['61-90']), formatCurrency(totals['90+']), formatCurrency(grandTotal)],
        totalLabel: 'Total Outstanding',
        totalValue: grandTotal,
      },
    ],
  };
}

function calcAgedCreditors(bills, dateTo) {
  const now = dateTo ? new Date(dateTo) : new Date();
  const outstanding = bills.filter(b => b.status !== 'paid' && b.status !== 'cancelled' && (b.balance_due || 0) > 0);

  const rows = outstanding.map(bill => {
    const dueDate = new Date(bill.due_date);
    const days = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
    const amount = bill.balance_due || 0;
    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    if (days <= 30) buckets['0-30'] = amount;
    else if (days <= 60) buckets['31-60'] = amount;
    else if (days <= 90) buckets['61-90'] = amount;
    else buckets['90+'] = amount;

    return {
      cells: [
        bill.supplier_name || 'Unknown',
        bill.bill_number || '-',
        bill.due_date || '-',
        formatCurrency(buckets['0-30']),
        formatCurrency(buckets['31-60']),
        formatCurrency(buckets['61-90']),
        formatCurrency(buckets['90+']),
        formatCurrency(amount),
      ],
      drillDown: { title: 'Bill ' + (bill.bill_number || ''), items: [bill] },
      buckets,
      amount,
    };
  });

  const totals = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  for (const r of rows) {
    totals['0-30'] += r.buckets['0-30'];
    totals['31-60'] += r.buckets['31-60'];
    totals['61-90'] += r.buckets['61-90'];
    totals['90+'] += r.buckets['90+'];
  }
  const grandTotal = totals['0-30'] + totals['31-60'] + totals['61-90'] + totals['90+'];

  return {
    title: 'Aged Creditors',
    summaryCards: [
      { label: 'Total Outstanding', value: grandTotal },
      { label: 'Bills', value: rows.length },
    ],
    sections: [
      {
        name: 'Aged Creditors',
        columns: ['Supplier', 'Bill #', 'Due Date', '0-30', '31-60', '61-90', '90+', 'Total'],
        rows,
        totalCells: ['', '', 'Total', formatCurrency(totals['0-30']), formatCurrency(totals['31-60']), formatCurrency(totals['61-90']), formatCurrency(totals['90+']), formatCurrency(grandTotal)],
        totalLabel: 'Total Outstanding',
        totalValue: grandTotal,
      },
    ],
  };
}

function calcBankReconciliation(bankTxns) {
  const matched = bankTxns.filter(t => t.status === 'matched');
  const unmatched = bankTxns.filter(t => t.status !== 'matched');
  const moneyIn = bankTxns.reduce((s, t) => s + (t.money_in || 0), 0);
  const moneyOut = bankTxns.reduce((s, t) => s + (t.money_out || 0), 0);
  const netFlow = moneyIn - moneyOut;

  return {
    title: 'Bank Reconciliation Summary',
    summaryCards: [
      { label: 'Total Transactions', value: bankTxns.length },
      { label: 'Matched', value: matched.length },
      { label: 'Unmatched', value: unmatched.length },
      { label: 'Net Cash Flow', value: netFlow },
    ],
    sections: [
      {
        name: 'Matched Transactions',
        columns: ['Date', 'Description', 'Money In', 'Money Out', 'Matched To'],
        rows: matched.map(t => ({
          cells: [t.date || '-', t.description || '-', formatCurrency(t.money_in), formatCurrency(t.money_out), t.matched_record_number || '-'],
          drillDown: { title: 'Transaction Details', items: [t] },
        })),
        totalLabel: 'Total Matched',
        totalValue: matched.length,
      },
      {
        name: 'Unmatched Transactions',
        columns: ['Date', 'Description', 'Money In', 'Money Out'],
        rows: unmatched.map(t => ({
          cells: [t.date || '-', t.description || '-', formatCurrency(t.money_in), formatCurrency(t.money_out)],
          drillDown: { title: 'Transaction Details', items: [t] },
        })),
        totalLabel: 'Total Unmatched',
        totalValue: unmatched.length,
      },
    ],
  };
}