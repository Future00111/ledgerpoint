// Development Tools — targeted or full data reset for a company.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { deleteCompanyData } from '../../shared/demoTemplates.ts';

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
    const target = body.target || 'everything';

    const counts = {};
    const del = async (type, query) => {
      try {
        const r = await sr.entities[type].deleteMany(query);
        counts[type] = r?.deleted_count ?? r?.count ?? 'ok';
      } catch (e) {
        counts[type] = 'error';
      }
    };

    if (target === 'transactions') {
      await del('BankTransaction', { company_id: companyId });
      await del('JournalEntry', { company_id: companyId });
    } else if (target === 'customers') {
      await del('SalesInvoice', { company_id: companyId });
      await del('SalesCreditNote', { company_id: companyId });
      await del('Customer', { company_id: companyId });
    } else if (target === 'suppliers') {
      await del('PurchaseBill', { company_id: companyId });
      await del('SupplierCreditNote', { company_id: companyId });
      await del('Supplier', { company_id: companyId });
    } else if (target === 'documents') {
      await del('Document', { company_id: companyId });
      await del('EmailCaptureLog', { company_id: companyId });
    } else {
      // everything
      const all = await deleteCompanyData(sr, companyId);
      return Response.json({ target, deleted: all });
    }

    return Response.json({ target, deleted: counts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}