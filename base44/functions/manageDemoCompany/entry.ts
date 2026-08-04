// Development Tools — demo company lifecycle (create / reset / delete).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  DEFAULT_ACCOUNTS, getTemplate, buildCustomers, buildSuppliers, buildBankAccounts,
  buildInvoices, buildBills, buildSalesCreditNotes, buildSupplierCreditNotes,
  buildBankTransactions, buildDocuments, buildEmailCaptures, buildVATReturns,
  buildJournalEntries, deleteCompanyData,
} from '../../shared/demoTemplates.ts';

const DEMO_NAME = 'Ledgerly Demo Ltd';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'developer')
      return Response.json({ error: 'Developer access required' }, { status: 403 });

    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'create';
    const templateKey = body.template || 'general_business';
    const tpl = getTemplate(templateKey);

    if (action === 'delete') {
      const comps = await sr.entities.Company.filter({ name: DEMO_NAME });
      const owned = (comps || []).filter((c) => true);
      const result = {};
      for (const c of owned) {
        result[c.id] = await deleteCompanyData(sr, c.id);
        await sr.entities.CompanyUser.deleteMany({ company_id: c.id });
        await sr.entities.Company.delete(c.id);
      }
      return Response.json({ action, deleted: result });
    }

    if (action === 'reset') {
      const comps = await sr.entities.Company.filter({ name: DEMO_NAME });
      if (!comps.length) return Response.json({ error: 'No demo company to reset' }, { status: 404 });
      const company = comps[0];
      const companyId = company.id;
      await deleteCompanyData(sr, companyId);
      const created = await seed(sr, tpl, companyId);
      return Response.json({ action, company_id: companyId, counts: created });
    }

    // action === 'create'
    const company = await sr.entities.Company.create({
      name: DEMO_NAME,
      business_type: tpl.business_type,
      vat_registered: true,
      vat_scheme: 'standard',
      vat_frequency: 'quarterly',
      financial_year_end: '2026-03-31',
      address_line_1: '1 Demo Street',
      city: 'London', postcode: 'EC1 1AA', email: 'demo@ledgerly.co.uk',
    });
    const companyId = company.id;
    await sr.entities.CompanyUser.create({
      company_id: companyId, user_id: user.id, user_email: user.email,
      role: 'owner', status: 'active', invited_by: user.id,
    });
    const counts = await seed(sr, tpl, companyId);
    return Response.json({ action, company_id: companyId, company, counts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function seed(sr, tpl, companyId) {
  const accounts = await sr.entities.ChartOfAccount.bulkCreate(
    DEFAULT_ACCOUNTS.map((a) => ({ ...a, company_id: companyId }))
  );
  const customers = await sr.entities.Customer.bulkCreate(buildCustomers(tpl, companyId, 10));
  const suppliers = await sr.entities.Supplier.bulkCreate(buildSuppliers(tpl, companyId, 10));
  const bankAccounts = await sr.entities.BankAccount.bulkCreate(buildBankAccounts(companyId, 2));
  const invoices = await sr.entities.SalesInvoice.bulkCreate(buildInvoices(tpl, companyId, customers, 50, 12, 'INV'));
  const bills = await sr.entities.PurchaseBill.bulkCreate(buildBills(tpl, companyId, suppliers, 35, 12, 'BILL'));
  const salesCns = await sr.entities.SalesCreditNote.bulkCreate(buildSalesCreditNotes(tpl, companyId, customers, invoices, 5));
  const supCns = await sr.entities.SupplierCreditNote.bulkCreate(buildSupplierCreditNotes(tpl, companyId, suppliers, bills, 5));
  const bankTxns = await sr.entities.BankTransaction.bulkCreate(buildBankTransactions(tpl, companyId, bankAccounts, invoices, bills, 120, 12));
  const docs = await sr.entities.Document.bulkCreate(buildDocuments(companyId, suppliers, 20));
  const emails = await sr.entities.EmailCaptureLog.bulkCreate(buildEmailCaptures(companyId, 15));
  const vat = await sr.entities.VATReturn.bulkCreate(buildVATReturns(companyId, invoices, bills, 3));
  const journals = await sr.entities.JournalEntry.bulkCreate(buildJournalEntries(companyId, accounts, invoices, bills, 50));
  return {
    accounts: accounts?.length ?? 0, customers: customers?.length ?? 0,
    suppliers: suppliers?.length ?? 0, bankAccounts: bankAccounts?.length ?? 0,
    invoices: invoices?.length ?? 0, bills: bills?.length ?? 0,
    salesCreditNotes: salesCns?.length ?? 0, supplierCreditNotes: supCns?.length ?? 0,
    bankTransactions: bankTxns?.length ?? 0, documents: docs?.length ?? 0,
    emailCaptures: emails?.length ?? 0, vatReturns: vat?.length ?? 0,
    journalEntries: journals?.length ?? 0,
  };
}