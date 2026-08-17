import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  DEFAULT_ACCOUNTS, getTemplate, buildCustomers, buildSuppliers, buildBankAccounts,
  buildInvoices, buildBills, buildSalesCreditNotes, buildSupplierCreditNotes,
  buildBankTransactions, buildDocuments, buildVATReturns, buildJournalEntries,
} from '../../shared/demoTemplates.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'developer')
      return Response.json({ error: 'Developer access required' }, { status: 403 });

    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const companyId = body.company_id;
    if (!companyId) return Response.json({ error: 'company_id required' }, { status: 400 });

    const company = await sr.entities.Company.get(companyId).catch(() => null);
    const tpl = getTemplate(body.template || (company ? company.business_type : 'general_business'));
    const months = body.random ? Math.floor(Math.random() * 12) + 1 : Number(body.months) || 1;
    const scale = body.random ? Math.floor(Math.random() * 3) + 1 : months;

    // Ensure base parties/accounts exist.
    let customers = await sr.entities.Customer.filter({ company_id: companyId }, '-created_date', 200);
    let suppliers = await sr.entities.Supplier.filter({ company_id: companyId }, '-created_date', 200);
    let bankAccounts = await sr.entities.BankAccount.filter({ company_id: companyId }, '-created_date', 200);
    if (!customers.length) customers = await sr.entities.Customer.bulkCreate(buildCustomers(tpl, companyId, 10));
    if (!suppliers.length) suppliers = await sr.entities.Supplier.bulkCreate(buildSuppliers(tpl, companyId, 10));
    if (!bankAccounts.length) bankAccounts = await sr.entities.BankAccount.bulkCreate(buildBankAccounts(companyId, 2));

    let accounts = await sr.entities.ChartOfAccount.filter({ company_id: companyId });
    if (!accounts.length) accounts = await sr.entities.ChartOfAccount.bulkCreate(DEFAULT_ACCOUNTS.map((a) => ({ ...a, company_id: companyId })));

    const nInv = scale * 5;
    const nBill = scale * 3;
    const nTxn = scale * 12;
    const nJrn = scale * 5;
    const nDoc = scale * 2;

    const invoices = await sr.entities.SalesInvoice.bulkCreate(buildInvoices(tpl, companyId, customers, nInv, months, 'GEN'));
    const bills = await sr.entities.PurchaseBill.bulkCreate(buildBills(tpl, companyId, suppliers, nBill, months, 'GBL'));
    const salesCns = await sr.entities.SalesCreditNote.bulkCreate(buildSalesCreditNotes(tpl, companyId, customers, invoices, Math.max(1, Math.floor(scale / 3))));
    const supCns = await sr.entities.SupplierCreditNote.bulkCreate(buildSupplierCreditNotes(tpl, companyId, suppliers, bills, Math.max(1, Math.floor(scale / 3))));
    const bankTxns = await sr.entities.BankTransaction.bulkCreate(buildBankTransactions(tpl, companyId, bankAccounts, invoices, bills, nTxn, months));
    const docs = await sr.entities.Document.bulkCreate(buildDocuments(companyId, suppliers, nDoc));
    const vat = await sr.entities.VATReturn.bulkCreate(buildVATReturns(companyId, invoices, bills, Math.max(1, Math.ceil(months / 3))));
    const journals = await sr.entities.JournalEntry.bulkCreate(buildJournalEntries(companyId, accounts, invoices, bills, nJrn));

    // Refresh business insights for the dashboard.
    try { await sr.functions.invoke('generateInsights', { company_id: companyId }); } catch { /* non-critical */ }

    return Response.json({
      months, random: !!body.random, scale,
      counts: {
        invoices: invoices?.length ?? 0, bills: bills?.length ?? 0,
        salesCreditNotes: salesCns?.length ?? 0, supplierCreditNotes: supCns?.length ?? 0,
        bankTransactions: bankTxns?.length ?? 0, documents: docs?.length ?? 0,
        vatReturns: vat?.length ?? 0, journalEntries: journals?.length ?? 0,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}