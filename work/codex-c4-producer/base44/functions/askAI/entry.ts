import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const gbp = (n) => `£${(Number(n) || 0).toFixed(2)}`;
const fmtDate = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-GB');
};
const today = () => new Date().toISOString().slice(0, 10);

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Does the question reference this field value?
// Strong: the value appears verbatim in the question (e.g. invoice number "INV-101",
// customer name "Taylor Homes"). Loose: every token of a multi-word name is mentioned.
function refsField(normQ, qTokens, fieldVal) {
  const fv = normalize(fieldVal);
  if (!fv) return false;
  if (normQ.includes(fv)) return true;
  const fTokens = fv.split(' ').filter(Boolean);
  if (fTokens.length > 1 && fTokens.every((ft) => qTokens.includes(ft))) return true;
  return false;
}

// Sources for reference detection + structured summaries returned to the UI.
const SOURCES = [
  {
    type: 'SalesInvoice', label: 'Invoice', search: ['invoice_number', 'customer_name', 'reference'],
    columns: ['Invoice', 'Customer', 'Status', 'Total', 'Due'],
    row: (r) => [r.invoice_number || '-', r.customer_name || '-', r.status || '-', gbp(r.total), fmtDate(r.due_date)],
    context: (r) => `Invoice ${r.invoice_number} for ${r.customer_name || '-'} — status ${r.status || '-'}, total ${gbp(r.total)}, due ${fmtDate(r.due_date)}, balance ${gbp(r.balance_due)}.`,
  },
  {
    type: 'PurchaseBill', label: 'Bill', search: ['bill_number', 'supplier_name', 'reference'],
    columns: ['Bill', 'Supplier', 'Status', 'Total', 'Due'],
    row: (r) => [r.bill_number || '-', r.supplier_name || '-', r.status || '-', gbp(r.total), fmtDate(r.due_date)],
    context: (r) => `Bill ${r.bill_number} from ${r.supplier_name || '-'} — status ${r.status || '-'}, total ${gbp(r.total)}, due ${fmtDate(r.due_date)}, balance ${gbp(r.balance_due)}.`,
  },
  {
    type: 'Customer', label: 'Customer', search: ['name', 'contact_name', 'email', 'customer_reference'],
    columns: ['Name', 'Contact', 'Email', 'Balance', 'Status'],
    row: (r) => [r.name || '-', r.contact_name || '-', r.email || '-', gbp(r.outstanding_balance), r.status || '-'],
    context: (r) => `Customer ${r.name}${r.email ? ` (${r.email})` : ''} — status ${r.status || '-'}, outstanding ${gbp(r.outstanding_balance)}, terms ${r.payment_terms ?? '-'} days.`,
  },
  {
    type: 'Supplier', label: 'Supplier', search: ['name', 'contact_name', 'email', 'supplier_reference'],
    columns: ['Name', 'Contact', 'Email', 'Balance', 'Status'],
    row: (r) => [r.name || '-', r.contact_name || '-', r.email || '-', gbp(r.outstanding_balance), r.status || '-'],
    context: (r) => `Supplier ${r.name}${r.email ? ` (${r.email})` : ''} — status ${r.status || '-'}, outstanding ${gbp(r.outstanding_balance)}, terms ${r.payment_terms ?? '-'} days.`,
  },
  {
    type: 'BankAccount', label: 'Bank Account', search: ['account_name', 'bank_name', 'sort_code', 'account_number'],
    columns: ['Account', 'Bank', 'Sort', 'Balance', 'Status'],
    row: (r) => [r.account_name || '-', r.bank_name || '-', r.sort_code || '-', gbp(r.current_balance), r.status || '-'],
    context: (r) => `Bank account ${r.account_name} at ${r.bank_name || '-'} (sort ${r.sort_code || '-'}) — balance ${gbp(r.current_balance)}, status ${r.status || '-'}.`,
  },
  {
    type: 'BankTransaction', label: 'Bank Transaction', search: ['description', 'reference'],
    columns: ['Date', 'Description', 'In', 'Out', 'Status'],
    row: (r) => [fmtDate(r.date), r.description || '-', gbp(r.money_in), gbp(r.money_out), r.status || '-'],
    context: (r) => `Bank transaction ${fmtDate(r.date)}: ${r.description || '-'} — in ${gbp(r.money_in)}, out ${gbp(r.money_out)}, status ${r.status || '-'}.`,
  },
  {
    type: 'Document', label: 'Document', search: ['name', 'supplier_or_customer', 'reference_number'],
    columns: ['Name', 'Type', 'Date', 'Status', 'Amount'],
    row: (r) => [r.name || '-', r.document_type || '-', fmtDate(r.document_date || r.upload_date), r.status || '-', gbp(r.gross_amount)],
    context: (r) => `Document ${r.name} (${r.document_type || '-'}) — ${fmtDate(r.document_date || r.upload_date)}, status ${r.status || '-'}, gross ${gbp(r.gross_amount)}.`,
  },
  {
    type: 'SalesCreditNote', label: 'Credit Note', search: ['credit_note_number', 'customer_name', 'reason'],
    columns: ['Number', 'Customer', 'Status', 'Total'],
    row: (r) => [r.credit_note_number || '-', r.customer_name || '-', r.status || '-', gbp(r.total)],
    context: (r) => `Credit note ${r.credit_note_number} for ${r.customer_name || '-'} — status ${r.status || '-'}, total ${gbp(r.total)}.`,
  },
  {
    type: 'SupplierCreditNote', label: 'Supplier Credit Note', search: ['credit_note_number', 'supplier_name', 'reason'],
    columns: ['Number', 'Supplier', 'Status', 'Total'],
    row: (r) => [r.credit_note_number || '-', r.supplier_name || '-', r.status || '-', gbp(r.total)],
    context: (r) => `Supplier credit note ${r.credit_note_number} from ${r.supplier_name || '-'} — status ${r.status || '-'}, total ${gbp(r.total)}.`,
  },
  {
    type: 'VATReturn', label: 'VAT Return', search: ['reference', 'period_start', 'period_end'],
    columns: ['Reference', 'Period', 'Status', 'Net VAT'],
    row: (r) => [r.reference || '-', `${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}`, r.status || '-', gbp(r.box5_net_vat)],
    context: (r) => `VAT return ${r.reference || fmtDate(r.period_start)} (${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}) — status ${r.status || '-'}, net VAT ${gbp(r.box5_net_vat)}.`,
  },
];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const companyId = body.company_id;
    const question = (body.question || '').trim();
    if (!companyId || !question) {
      return Response.json({ answer: 'Please ask a question about your accounts.', records: [] });
    }

    const normQ = normalize(question);
    const qTokens = normQ.split(' ').filter(Boolean);

    // Fetch lists once: used for both reference detection and aggregate context.
    const lists = await Promise.all(
      SOURCES.map(async (s) => ({
        s,
        list: await safe(() => base44.asServiceRole.entities[s.type].filter({ company_id: companyId }, '-updated_date', 200), []),
      }))
    );
    const company = await safe(() => base44.asServiceRole.entities.Company.get(companyId), null);

    // Detect referenced records and build structured summaries for the UI.
    const recordSections = [];
    const retrievedLines = [];
    let totalRetrieved = 0;
    for (const { s, list } of lists) {
      const matched = (list || [])
        .filter((r) => s.search.some((f) => refsField(normQ, qTokens, r[f])))
        .slice(0, 3);
      if (!matched.length) continue;
      recordSections.push({ type: s.label, columns: s.columns, rows: matched.map(s.row) });
      matched.forEach((r) => retrievedLines.push(`- ${s.context(r)}`));
      totalRetrieved += matched.length;
      if (totalRetrieved >= 9) break;
    }

    // Aggregate context (for broader questions).
    const byType = Object.fromEntries(lists.map(({ s, list }) => [s.type, list || []]));
    const invoices = byType.SalesInvoice || [];
    const bills = byType.PurchaseBill || [];
    const bankAccounts = byType.BankAccount || [];
    const txns = byType.BankTransaction || [];
    const vatReturns = byType.VATReturn || [];
    const sum = (arr, f) => arr.reduce((a, r) => a + (Number(r[f]) || 0), 0);
    const overdueInv = invoices.filter(
      (i) => i.status === 'overdue' || (Number(i.balance_due) > 0 && i.due_date && i.due_date < today())
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

    const aggCtx = [
      `Company: ${company?.name || companyId} — type: ${company?.business_type || 'general_business'}, VAT registered: ${company?.vat_registered ?? 'unknown'}.`,
      `Sales invoices: ${invoices.length} on file. Total invoiced ${gbp(sum(invoices, 'total'))}. Outstanding ${gbp(sum(invoices, 'balance_due'))}. Overdue ${overdueInv.length} invoices worth ${gbp(sum(overdueInv, 'balance_due'))}.`,
      `Purchase bills: ${bills.length} on file. Total spent ${gbp(sum(bills, 'total'))}. Unpaid ${gbp(sum(unpaidBills, 'balance_due'))} across ${unpaidBills.length} bills.`,
      `Bank accounts: ${bankAccounts.length}. Combined current balance ${gbp(sum(bankAccounts, 'current_balance'))}.`,
      `Bank transactions (most recent ${txns.length}): money in ${gbp(sum(txns, 'money_in'))}, money out ${gbp(sum(txns, 'money_out'))}, net ${gbp(sum(txns, 'money_in') - sum(txns, 'money_out'))}.`,
      `Top suppliers by spend: ${topSuppliers.length ? topSuppliers.map(([n, v]) => `${n} (${gbp(v)})`).join(', ') : 'none yet'}.`,
      `VAT returns on file: ${vatReturns.length}.`,
    ].join('\n');

    const retrievedBlock = retrievedLines.length
      ? `\nRetrieved records (the user is asking about these specifically — use them; do not claim you cannot see them):\n${retrievedLines.join('\n')}\n`
      : `\nNo specific records were detected in the question. If it references a record that is not in the summary below, say briefly that no matching record was found, describe what IS available, and suggest the next action.\n`;

    const contextLine = body.context ? `\nContext: ${body.context}\n` : '';

    const prompt = `You are Ledgerly's assistant. You have DIRECT access to the business's Ledgerly data — relevant records have already been retrieved for you and are listed under "Retrieved records".

Rules:
- NEVER say "I cannot provide that information" or "please navigate to…". The data is already retrieved. Use it.
- If the question is about specific records, base your answer on the Retrieved records.
- If the question references a record but none was retrieved, say briefly that no matching record was found in the books, describe what IS available from the summary, and suggest the next action (e.g. check the spelling, or create the record).
- Be concise: 3 to 6 lines. Use GBP figures and UK dates (DD/MM/YYYY).
- Give practical, business-specific insight — like an intelligent colleague with access to the books, not a generic chatbot.
- Do not invent figures beyond the data given.

Summary of the books:
${aggCtx}
${retrievedBlock}${contextLine}
Question: ${question}

Answer (3-6 lines, no preamble, no headings):`;

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    const explanation = typeof llm === 'string' ? llm : llm?.answer || llm?.text || llm?.response || String(llm || '');

    return Response.json({ answer: explanation, explanation, records: recordSections });
  } catch (error) {
    return Response.json({
      answer: 'Sorry, I could not answer that right now: ' + (error.message || 'unknown error'),
      records: [],
    });
  }
}