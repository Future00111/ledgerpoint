import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ACTIVE_INVOICE_STATUSES = ['approved', 'sent', 'part_paid', 'overdue'];

function startOfMonth(d) { const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function todayStr() { return new Date().toISOString().slice(0,10); }
function money(n) { return Math.round((n||0)*100)/100; }
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

async function generateForCompany(base44, company) {
  const companyId = company.id;
  const today = new Date(); today.setHours(0,0,0,0);
  const todayDate = todayStr();
  const thisMonthStart = startOfMonth(today);
  const lastMonthStart = startOfMonth(addMonths(today, -1));
  const nextMonthStart = startOfMonth(addMonths(today, 1));

  const insights = [];

  const [invoices, bills, transactions, vatReturns] = await Promise.all([
    base44.asServiceRole.entities.SalesInvoice.filter({ company_id: companyId }),
    base44.asServiceRole.entities.PurchaseBill.filter({ company_id: companyId }),
    base44.asServiceRole.entities.BankTransaction.filter({ company_id: companyId }),
    base44.asServiceRole.entities.VATReturn.filter({ company_id: companyId }, '-period_end'),
  ]);

  const validInvoices = invoices.filter(i => i.status && !['cancelled', 'draft'].includes(i.status));
  const validBills = bills.filter(b => b.status && b.status !== 'cancelled');

  // 1. Revenue comparison
  const thisMonthRevenue = validInvoices
    .filter(i => { const d = new Date(i.issue_date); return d >= thisMonthStart && d < nextMonthStart; })
    .reduce((s,i) => s + (i.subtotal||0), 0);
  const lastMonthRevenue = validInvoices
    .filter(i => { const d = new Date(i.issue_date); return d >= lastMonthStart && d < thisMonthStart; })
    .reduce((s,i) => s + (i.subtotal||0), 0);
  if (lastMonthRevenue > 0 || thisMonthRevenue > 0) {
    const change = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : (thisMonthRevenue > 0 ? 100 : 0);
    const up = change >= 0;
    insights.push({
      company_id: companyId, generated_date: todayDate,
      category: 'revenue',
      title: `Revenue is ${up ? 'up' : 'down'} ${Math.abs(Math.round(change))}% compared to last month`,
      description: `Sales this month: £${thisMonthRevenue.toFixed(2)} vs £${lastMonthRevenue.toFixed(2)} last month.`,
      severity: up ? 'positive' : (change < -10 ? 'warning' : 'info'),
      metric_value: money(thisMonthRevenue), metric_label: 'This month revenue',
      comparison_value: money(lastMonthRevenue), comparison_label: 'Last month revenue',
      change_percent: Math.round(change*100)/100,
      source_type: 'revenue_comparison',
      link_route: '/invoices', link_label: 'View invoices'
    });
  }

  // 2. Overdue invoices
  const overdue = validInvoices.filter(i => {
    if (!i.due_date) return false;
    return new Date(i.due_date) < today && i.status !== 'paid' && (i.balance_due||0) > 0;
  });
  if (overdue.length > 0) {
    const total = overdue.reduce((s,i) => s + (i.balance_due||i.total||0), 0);
    insights.push({
      company_id: companyId, generated_date: todayDate,
      category: 'overdue',
      title: `You have ${overdue.length} invoice${overdue.length!==1?'s':''} overdue worth £${total.toFixed(2)}`,
      description: overdue.map(i => `${i.invoice_number} (${i.customer_name||'—'})`).join(', '),
      severity: 'critical',
      metric_value: money(total), metric_label: 'Overdue total',
      comparison_value: overdue.length, comparison_label: 'Overdue count',
      source_type: 'overdue_invoices',
      source_ids: overdue.map(i=>i.id),
      link_route: '/invoices', link_label: 'View invoices'
    });
  }

  // 3. Bills due this week
  const weekEnd = addDays(today, 7);
  const dueThisWeek = bills.filter(b => {
    if (!b.due_date || ['paid','cancelled'].includes(b.status)) return false;
    const d = new Date(b.due_date);
    return d >= today && d <= weekEnd;
  });
  if (dueThisWeek.length > 0) {
    const total = dueThisWeek.reduce((s,b) => s + (b.balance_due||b.total||0), 0);
    insights.push({
      company_id: companyId, generated_date: todayDate,
      category: 'bills_due',
      title: `You have ${dueThisWeek.length} bill${dueThisWeek.length!==1?'s':''} due this week worth £${total.toFixed(2)}`,
      description: dueThisWeek.map(b => `${b.bill_number} (${b.supplier_name||'—'})`).join(', '),
      severity: 'warning',
      metric_value: money(total), metric_label: 'Due this week',
      comparison_value: dueThisWeek.length, comparison_label: 'Bill count',
      source_type: 'bills_due_this_week',
      source_ids: dueThisWeek.map(b=>b.id),
      link_route: '/bills', link_label: 'View bills'
    });
  }

  // 4. Cost increase by category
  const catThis = {};
  const catLast = {};
  validBills.forEach(b => {
    if (!b.bill_date) return;
    const d = new Date(b.bill_date);
    const cat = b.category || 'other';
    const amt = b.subtotal||0;
    if (d >= thisMonthStart && d < nextMonthStart) catThis[cat] = (catThis[cat]||0) + amt;
    else if (d >= lastMonthStart && d < thisMonthStart) catLast[cat] = (catLast[cat]||0) + amt;
  });
  let topCat = null, topIncrease = 0;
  Object.keys(catThis).forEach(cat => {
    const t = catThis[cat]||0; const l = catLast[cat]||0;
    if (l > 0) { const inc = ((t-l)/l)*100; if (inc > topIncrease) { topIncrease = inc; topCat = cat; } }
  });
  if (topCat && topIncrease >= 10) {
    insights.push({
      company_id: companyId, generated_date: todayDate,
      category: 'costs',
      title: `${capitalize(topCat)} costs increased by ${Math.round(topIncrease)}%`,
      description: `£${(catThis[topCat]||0).toFixed(2)} this month vs £${(catLast[topCat]||0).toFixed(2)} last month.`,
      severity: 'warning',
      metric_value: money(catThis[topCat]), metric_label: `${topCat} this month`,
      comparison_value: money(catLast[topCat]), comparison_label: `${topCat} last month`,
      change_percent: Math.round(topIncrease*100)/100,
      source_type: 'cost_increase', source_ids: [topCat],
      link_route: '/bills', link_label: 'View bills'
    });
  }

  // 5. VAT payment due
  if (company.vat_registered) {
    const freq = company.vat_frequency || 'quarterly';
    const months = freq === 'monthly' ? 1 : freq === 'yearly' ? 12 : 3;
    let nextDue;
    if (vatReturns.length > 0) {
      const lastEnd = new Date(vatReturns[0].period_end);
      const nextEnd = addMonths(lastEnd, months);
      nextDue = addDays(addMonths(nextEnd, 1), 7);
    } else {
      const nextEnd = addMonths(startOfMonth(today), months);
      nextDue = addDays(addMonths(nextEnd, 1), 7);
    }
    const daysUntil = Math.ceil((nextDue - today) / (1000*60*60*24));
    if (daysUntil >= 0 && daysUntil <= 60) {
      const outputVat = validInvoices.reduce((s,i)=>s+(i.vat_total||0),0);
      const inputVat = validBills.reduce((s,b)=>s+(b.vat_total||0),0);
      const netVat = outputVat - inputVat;
      insights.push({
        company_id: companyId, generated_date: todayDate,
        category: 'vat',
        title: `VAT payment due in ${daysUntil} day${daysUntil!==1?'s':''}`,
        description: `Estimated net VAT of £${netVat.toFixed(2)} due by ${nextDue.toLocaleDateString('en-GB')}.`,
        severity: daysUntil <= 7 ? 'critical' : daysUntil <= 21 ? 'warning' : 'info',
        metric_value: money(netVat), metric_label: 'Net VAT',
        comparison_value: daysUntil, comparison_label: 'Days until due',
        source_type: 'vat_due',
        link_route: '/vat', link_label: 'View VAT returns'
      });
    }
  }

  // 6. Duplicate supplier invoices
  const billMap = {};
  validBills.forEach(b => {
    if (!b.bill_number) return;
    const key = `${b.supplier_id||''}|${b.bill_number.trim().toLowerCase()}`;
    if (!billMap[key]) billMap[key] = [];
    billMap[key].push(b);
  });
  const dupes = Object.values(billMap).filter(g => g.length > 1);
  if (dupes.length > 0) {
    const dupeBills = dupes.flat();
    insights.push({
      company_id: companyId, generated_date: todayDate,
      category: 'duplicate',
      title: dupes.length === 1 ? `One supplier invoice appears duplicated` : `${dupes.length} supplier invoices appear duplicated`,
      description: dupes.map(g => `${g[0].bill_number} (${g[0].supplier_name||'—'}) appears ${g.length} times`).join('. '),
      severity: 'warning',
      metric_value: dupes.length, metric_label: 'Duplicate groups',
      source_type: 'duplicate_bills',
      source_ids: dupeBills.map(b=>b.id),
      link_route: '/bills', link_label: 'View bills'
    });
  }

  // 7. Bank reconciliation %
  if (transactions.length > 0) {
    const matched = transactions.filter(t => t.status === 'matched').length;
    const pct = Math.round((matched / transactions.length) * 100);
    insights.push({
      company_id: companyId, generated_date: todayDate,
      category: 'reconciliation',
      title: `Bank reconciliation is ${pct}% complete`,
      description: `${matched} of ${transactions.length} bank transactions matched. ${transactions.length - matched} still need reviewing.`,
      severity: pct >= 95 ? 'positive' : pct >= 70 ? 'info' : 'warning',
      metric_value: pct, metric_label: 'Reconciliation %',
      comparison_value: matched, comparison_label: 'Matched count',
      source_type: 'reconciliation',
      link_route: '/transactions', link_label: 'View transactions'
    });
  }

  return insights;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    const body = await req.json().catch(() => ({}));

    let companyIds = [];
    if (body.company_id) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      companyIds = [body.company_id];
    } else if (user) {
      return Response.json({ error: 'Missing company_id' }, { status: 400 });
    } else {
      const companies = await base44.asServiceRole.entities.Company.list();
      companyIds = companies.map(c => c.id);
    }

    const todayDate = todayStr();
    let totalCreated = 0;
    const results = [];
    for (const cid of companyIds) {
      try {
        const company = await base44.asServiceRole.entities.Company.get(cid);
        await base44.asServiceRole.entities.Insight.deleteMany({ company_id: cid, generated_date: todayDate });
        const newInsights = await generateForCompany(base44, company);
        if (newInsights.length > 0) {
          await base44.asServiceRole.entities.Insight.bulkCreate(newInsights);
        }
        totalCreated += newInsights.length;
        results.push({ company_id: cid, count: newInsights.length });
      } catch (e) {
        results.push({ company_id: cid, error: e.message });
      }
    }

    return Response.json({ ok: true, generated: totalCreated, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});