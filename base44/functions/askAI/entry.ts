import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const gbp = (n) => `£${(Number(n) || 0).toFixed(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const companyId = body.company_id;
    const question = (body.question || '').trim();
    if (!companyId || !question) return Response.json({ answer: 'Please ask a question about your accounts.' });

    const [invoices, bills, bankAccounts, txns, vatReturns, company] = await Promise.all([
      safe(() => base44.asServiceRole.entities.SalesInvoice.filter({ company_id: companyId }, '-issue_date', 300), []),
      safe(() => base44.asServiceRole.entities.PurchaseBill.filter({ company_id: companyId }, '-bill_date', 300), []),
      safe(() => base44.asServiceRole.entities.BankAccount.filter({ company_id: companyId }), []),
      safe(() => base44.asServiceRole.entities.BankTransaction.filter({ company_id: companyId }, '-date', 200), []),
      safe(() => base44.asServiceRole.entities.VATReturn.filter({ company_id: companyId }, '-updated_date', 5), []),
      safe(() => base44.asServiceRole.entities.Company.get(companyId), null),
    ]);

    const sum = (arr, f) => arr.reduce((a, r) => a + (Number(r[f]) || 0), 0);
    const overdueInv = invoices.filter(
      (i) => (i.status === 'overdue' || (Number(i.balance_due) > 0 && i.due_date && i.due_date < today()))
    );
    const unpaidBills = bills.filter(
      (b) => b.status !== 'paid' && b.status !== 'cancelled' && Number(b.balance_due) > 0
    );

    const spend = {};
    for (const b of bills) {
      const n = b.supplier_name || 'Unknown';
      spend[n] = (spend[n] || 0) + (Number(b.total) || 0);
    }
    const topSuppliers = Object.entries(spend).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const ctx = [
      `Company: ${company?.name || companyId} — type: ${company?.business_type || 'general_business'}, VAT registered: ${company?.vat_registered ?? 'unknown'}.`,
      `Sales invoices: ${invoices.length} on file. Total invoiced ${gbp(sum(invoices, 'total'))}. Outstanding ${gbp(sum(invoices, 'balance_due'))}. Overdue ${overdueInv.length} invoices worth ${gbp(sum(overdueInv, 'balance_due'))}.`,
      `Purchase bills: ${bills.length} on file. Total spent ${gbp(sum(bills, 'total'))}. Unpaid ${gbp(sum(unpaidBills, 'balance_due'))} across ${unpaidBills.length} bills.`,
      `Bank accounts: ${bankAccounts.length}. Combined current balance ${gbp(sum(bankAccounts, 'current_balance'))}.`,
      `Bank transactions (most recent ${txns.length}): money in ${gbp(sum(txns, 'money_in'))}, money out ${gbp(sum(txns, 'money_out'))}, net ${gbp(sum(txns, 'money_in') - sum(txns, 'money_out'))}.`,
      `Top suppliers by spend: ${topSuppliers.length ? topSuppliers.map(([n, v]) => `${n} (${gbp(v)})`).join(', ') : 'none yet'}.`,
      `VAT returns on file: ${vatReturns.length}.`,
    ].join('\n');

    const contextLine = body.context ? `\nContext: ${body.context}\n` : '';
    const prompt = `You are Ledgerly's assistant. A UK small-business owner is asking a question about their accounts. Use the data provided to answer concisely (3-6 sentences) with GBP figures and practical insight. If the question refers to something the user is currently viewing (see Context), relate your answer to that record. If the data is insufficient to answer confidently, say so briefly and suggest what to check. Do not invent figures beyond the data given.\n\nData:\n${ctx}${contextLine}\n\nQuestion: ${question}`;

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    const answer = typeof llm === 'string' ? llm : llm?.answer || llm?.text || llm?.response || String(llm || '');
    return Response.json({ answer });
  } catch (error) {
    return Response.json({ answer: 'Sorry, I could not answer that right now: ' + (error.message || 'unknown error') });
  }
}