import { computeCustomerHealth } from './customerHealth';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// AI invoice intelligence — answers "will it be paid?", "what next?" and the
// supporting analytics, computed deterministically from live data so the
// numbers are always consistent with the books.
export function computeInvoiceIntelligence({ invoice, customer, customerInvoices = [], payments = [], creditNotes = [] }) {
  const now = new Date();
  const total = Number(invoice.total) || 0;
  const balanceDue = Number(invoice.balance_due) || 0;
  const amountPaid = Number(invoice.amount_paid) || 0;
  const terms = Number(invoice.payment_terms || customer?.payment_terms || 30);
  const issueDate = invoice.issue_date ? new Date(invoice.issue_date) : null;
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
  const status = invoice.status || 'draft';
  const isPaid = status === 'paid';
  const isCancelled = status === 'cancelled';
  const isDraft = status === 'draft';
  const activeStatuses = ['approved', 'sent', 'part_paid', 'overdue'];
  const daysOverdue = (!isPaid && !isCancelled && dueDate && dueDate < now && activeStatuses.includes(status)) ? Math.floor((now - dueDate) / 86400000) : 0;
  const isOverdue = daysOverdue > 0;

  // ---- Customer-level metrics ----
  const validInv = customerInvoices.filter((i) => i.status !== 'cancelled');
  const outstandingInv = validInv.filter((i) => Number(i.balance_due) > 0);
  const customerOutstanding = outstandingInv.reduce((s, i) => s + Number(i.balance_due || 0), 0);
  const customerOverdue = outstandingInv.filter((i) => i.due_date && new Date(i.due_date) < now);
  const customerOverdueTotal = customerOverdue.reduce((s, i) => s + Number(i.balance_due || 0), 0);
  const oldestCustomerOverdueDays = customerOverdue.length ? Math.max(...customerOverdue.map((i) => Math.floor((now - new Date(i.due_date)) / 86400000))) : 0;
  const lifetimeRevenue = validInv.reduce((s, i) => s + Number(i.total || 0), 0);
  const creditExceeded = customer?.credit_limit > 0 && customerOutstanding > customer.credit_limit;

  const twelveAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const ytd = new Date(now.getFullYear(), 0, 1);
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
  const revenue12m = validInv.filter((i) => i.issue_date && new Date(i.issue_date) >= twelveAgo).reduce((s, i) => s + Number(i.total || 0), 0);
  const revenueYtd = validInv.filter((i) => i.issue_date && new Date(i.issue_date) >= ytd).reduce((s, i) => s + Number(i.total || 0), 0);
  const revenueLastYear = validInv.filter((i) => i.issue_date && new Date(i.issue_date) >= lastYearStart && new Date(i.issue_date) <= lastYearEnd).reduce((s, i) => s + Number(i.total || 0), 0);
  const invoiceCount12m = validInv.filter((i) => i.issue_date && new Date(i.issue_date) >= twelveAgo).length;

  // Average payment days (customer history)
  const payDays = [];
  payments.forEach((p) => {
    const inv = customerInvoices.find((i) => i.id === p.linked_invoice_id);
    if (inv && inv.issue_date && p.date) payDays.push(Math.max(0, (new Date(p.date) - new Date(inv.issue_date)) / 86400000));
  });
  const avgPaymentDays = payDays.length ? Math.round(payDays.reduce((a, b) => a + b, 0) / payDays.length) : null;

  const health = computeCustomerHealth({
    overdueCount: customerOverdue.length, overdueTotal: customerOverdueTotal, oldestOverdueDays: oldestCustomerOverdueDays,
    outstanding: customerOutstanding, avgPaymentDays, terms,
    revenue12m, revenueLastYear, revenueYtd,
    invoiceCount12m, lifetimeValue: lifetimeRevenue, creditExceeded, hasInvoices: customerInvoices.length > 0,
  });

  // ---- Payment probability ----
  let probability;
  if (isPaid) probability = 100;
  else {
    probability = 85;
    if (daysOverdue > 120) probability -= 68;
    else if (daysOverdue > 90) probability -= 50;
    else if (daysOverdue > 60) probability -= 38;
    else if (daysOverdue > 30) probability -= 22;
    else if (daysOverdue > 14) probability -= 12;
    else if (daysOverdue > 0) probability -= 5;
    if (avgPaymentDays != null && avgPaymentDays > terms) probability -= Math.min(15, avgPaymentDays - terms);
    if (customerOverdue.length > 1) probability -= Math.min(9, customerOverdue.length * 3);
    if (creditExceeded) probability -= 8;
    if (health.tone === 'rose') probability -= 8;
    else if (health.tone === 'amber') probability -= 4;
    probability = clamp(probability, 3, 97);
  }
  const likelihood = probability >= 70 ? 'High' : probability >= 40 ? 'Medium' : probability >= 15 ? 'Low' : 'Very low';
  const likelihoodTone = probability >= 70 ? 'emerald' : probability >= 40 ? 'amber' : 'rose';
  const riskScore = Math.round(100 - probability);
  const riskLabel = riskScore >= 75 ? 'Critical' : riskScore >= 50 ? 'High' : riskScore >= 25 ? 'Medium' : 'Low';
  const riskTone = riskScore >= 50 ? 'rose' : riskScore >= 25 ? 'amber' : 'emerald';

  // ---- Predicted payment date ----
  const thisPayment = payments.find((p) => p.linked_invoice_id === invoice.id);
  let predictedDate;
  if (isPaid && thisPayment?.date) predictedDate = `Paid ${fmtDate(thisPayment.date)}`;
  else if (isOverdue && (daysOverdue > 90 || probability < 25)) predictedDate = 'Unknown';
  else if (avgPaymentDays != null && dueDate) predictedDate = fmtDate(new Date(dueDate.getTime() + avgPaymentDays * 86400000));
  else if (dueDate) predictedDate = fmtDate(dueDate);
  else predictedDate = '—';

  // ---- Confidence ----
  let confidence = 68;
  if (avgPaymentDays != null) confidence += 11;
  if (customerInvoices.length >= 3) confidence += 5;
  if (payments.length >= 2) confidence += 4;
  if (daysOverdue > 30) confidence += 3;
  if (isDraft) confidence -= 15;
  confidence = clamp(confidence, 40, 95);

  // ---- Risk factors ----
  const otherTotals = validInv.filter((i) => i.id !== invoice.id).map((i) => Number(i.total) || 0);
  const customerAvg = otherTotals.length ? otherTotals.reduce((a, b) => a + b, 0) / otherTotals.length : 0;
  const riskFactors = [];
  if (isOverdue) riskFactors.push(`${daysOverdue} days overdue`);
  if (avgPaymentDays != null && isOverdue && avgPaymentDays <= terms) riskFactors.push('Customer payment pattern has changed');
  else if (avgPaymentDays != null && avgPaymentDays > terms) riskFactors.push('Customer payment pattern has changed');
  if (customerAvg > 0 && total > customerAvg * 1.5) riskFactors.push('Outstanding balance exceeds historical averages');
  if (customerOverdue.length > 0) riskFactors.push(`Customer has ${customerOverdue.length} overdue invoice${customerOverdue.length > 1 ? 's' : ''}`);
  if (creditExceeded) riskFactors.push('Credit limit exceeded');
  if (health.tone === 'rose') riskFactors.push('Customer classified as high risk');

  // ---- Customer behaviour ----
  let behaviour;
  if (avgPaymentDays == null) behaviour = 'No payment history';
  else if (avgPaymentDays <= terms) behaviour = 'Historically reliable';
  else if (avgPaymentDays <= terms + 14) behaviour = 'Often pays late';
  else behaviour = 'Unpredictable';

  // ---- Recommendation ----
  let recommendation, recommendationTone;
  if (isDraft) { recommendation = 'Approve and send'; recommendationTone = 'primary'; }
  else if (isCancelled) { recommendation = 'No action — cancelled'; recommendationTone = 'muted'; }
  else if (isPaid) { recommendation = 'No action required'; recommendationTone = 'emerald'; }
  else if (isOverdue) {
    if (daysOverdue > 90) { recommendation = 'Place account on hold'; recommendationTone = 'rose'; }
    else if (daysOverdue > 60) { recommendation = 'Send final demand'; recommendationTone = 'rose'; }
    else if (daysOverdue > 30) { recommendation = 'Send second reminder'; recommendationTone = 'amber'; }
    else { recommendation = 'Send reminder'; recommendationTone = 'amber'; }
  } else if (status === 'sent' || status === 'part_paid') { recommendation = 'Await payment'; recommendationTone = 'muted'; }
  else { recommendation = 'Send invoice'; recommendationTone = 'primary'; }

  // ---- Collections workflow (5 stages) ----
  const stageNum = !isOverdue
    ? (activeStatuses.concat('paid').includes(status) ? 1 : 0)
    : daysOverdue > 120 ? 5 : daysOverdue > 60 ? 4 : daysOverdue > 30 ? 3 : daysOverdue > 14 ? 2 : 1;
  const workflowStages = [
    { n: 1, label: 'Invoice sent', tone: 'emerald' },
    { n: 2, label: 'First reminder', tone: 'amber' },
    { n: 3, label: 'Second reminder', tone: 'amber' },
    { n: 4, label: 'Final demand', tone: 'amber' },
    { n: 5, label: 'Legal action', tone: 'rose' },
  ].map((s) => ({ ...s, done: s.n <= stageNum, next: s.n === stageNum + 1 }));

  // ---- Invoice analytics ----
  const largestPrevious = otherTotals.length ? Math.max(...otherTotals) : 0;
  const isLargestEver = otherTotals.length > 0 && total >= largestPrevious;
  const amountVsAvgPct = customerAvg > 0 ? Math.round((total / customerAvg - 1) * 100) : null;
  let trend;
  if (!otherTotals.length) trend = 'First invoice for this customer';
  else if (isLargestEver) trend = 'Largest invoice ever issued';
  else if (total > customerAvg * 1.5) trend = 'Well above customer average';
  else if (total > customerAvg) trend = 'Above customer average';
  else if (total < customerAvg * 0.5) trend = 'Below customer average';
  else trend = 'In line with customer average';
  let onTime = 0, paidWithPayment = 0;
  validInv.filter((i) => i.status === 'paid').forEach((i) => {
    const p = payments.find((pp) => pp.linked_invoice_id === i.id);
    if (p && i.due_date && p.date) { paidWithPayment++; if (new Date(p.date) <= new Date(i.due_date)) onTime++; }
  });
  const onTimeRate = paidWithPayment > 0 ? Math.round((onTime / paidWithPayment) * 100) : null;

  // ---- Relationship value ----
  let relationshipValue, relationshipValueTone;
  if (revenue12m >= 50000) { relationshipValue = 'Strategic'; relationshipValueTone = 'primary'; }
  else if (revenue12m >= 20000) { relationshipValue = 'High Value'; relationshipValueTone = 'emerald'; }
  else if (revenue12m > 0) { relationshipValue = 'Standard'; relationshipValueTone = 'muted'; }
  else { relationshipValue = 'Low Activity'; relationshipValueTone = 'amber'; }

  // ---- What needs attention ----
  const attention = [];
  if (isOverdue) attention.push({ label: `${daysOverdue} days overdue`, detail: `${fmtGbp(balanceDue)} outstanding`, severity: daysOverdue > 60 ? 'critical' : 'warning' });
  if (customerOverdue.length > 1) attention.push({ label: `Customer has ${customerOverdue.length} overdue invoices`, detail: `${fmtGbp(customerOverdueTotal)} across account`, severity: 'critical' });
  if (isOverdue) attention.push({ label: `Account at collection stage ${stageNum}`, detail: workflowStages[stageNum - 1]?.label || 'In progress', severity: stageNum >= 4 ? 'critical' : 'warning' });
  if (health.tone === 'rose') attention.push({ label: 'Customer classified as high risk', detail: `Health score ${health.score}/100`, severity: 'critical' });
  else if (health.tone === 'amber') attention.push({ label: 'Customer health declining', detail: `Health score ${health.score}/100`, severity: 'warning' });
  if (isOverdue && stageNum === 3) attention.push({ label: 'Final demand required', detail: 'Issue final demand before account hold', severity: 'critical' });
  if (isOverdue && stageNum >= 4) attention.push({ label: 'Account hold recommended', detail: 'Place account on hold to prevent further sales', severity: 'critical' });
  if (creditExceeded) attention.push({ label: 'Credit limit exceeded', detail: `${fmtGbp(customerOutstanding)} vs ${fmtGbp(customer.credit_limit)} limit`, severity: 'critical' });
  if (attention.length === 0 && isPaid) attention.push({ label: 'Invoice paid in full', detail: 'No action required', severity: 'positive' });
  if (attention.length === 0 && !isPaid && !isCancelled) attention.push({ label: 'No issues detected', detail: 'Invoice is on track', severity: 'positive' });

  // ---- Related invoices (other outstanding for this customer) ----
  const relatedInvoices = outstandingInv.filter((i) => i.id !== invoice.id).map((i) => {
    const days = i.due_date && new Date(i.due_date) < now ? Math.floor((now - new Date(i.due_date)) / 86400000) : 0;
    return { id: i.id, number: i.invoice_number, daysOverdue: days, amount: Number(i.balance_due) || 0, dueDate: i.due_date };
  }).sort((a, b) => b.daysOverdue - a.daysOverdue);

  return {
    total, balanceDue, amountPaid, terms, issueDate, dueDate, status,
    isPaid, isCancelled, isDraft, daysOverdue, isOverdue,
    customerOutstanding, customerOverdueCount: customerOverdue.length, lifetimeRevenue, avgPaymentDays, creditExceeded,
    health, relationshipValue, relationshipValueTone,
    probability, likelihood, likelihoodTone, riskScore, riskLabel, riskTone, predictedDate, confidence, riskFactors,
    behaviour, recommendation, recommendationTone,
    stageNum, workflowStages,
    customerAvg, largestPrevious, isLargestEver, amountVsAvgPct, trend, onTimeRate,
    attention, relatedInvoices, openInvoices: outstandingInv.length,
  };
}

const fmtGbp = (n) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(n) || 0);