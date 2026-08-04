import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function contains(haystack, needle) {
  return (haystack != null ? String(haystack) : '').toLowerCase().includes(needle);
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const companyId = body.company_id;
    const query = (body.query || '').trim();
    if (!companyId || query.length < 2) return Response.json({ groups: [] });
    const q = query.toLowerCase();

    const sources = [
      { label: 'Customers', type: 'Customer', fields: ['name', 'email', 'customer_reference'], labelFn: (r) => r.name, subFn: (r) => r.email, route: () => '/customers' },
      { label: 'Suppliers', type: 'Supplier', fields: ['name', 'email', 'supplier_reference'], labelFn: (r) => r.name, subFn: (r) => r.email, route: () => '/suppliers' },
      { label: 'Invoices', type: 'SalesInvoice', fields: ['invoice_number', 'customer_name', 'reference'], labelFn: (r) => r.invoice_number, subFn: (r) => r.customer_name, route: (r) => `/invoices/${r.id}` },
      { label: 'Bills', type: 'PurchaseBill', fields: ['bill_number', 'supplier_name', 'reference'], labelFn: (r) => r.bill_number, subFn: (r) => r.supplier_name, route: (r) => `/bills/${r.id}` },
      { label: 'Credit Notes', type: 'SalesCreditNote', fields: ['credit_note_number', 'customer_name', 'reason'], labelFn: (r) => r.credit_note_number, subFn: (r) => r.customer_name, route: (r) => `/sales-credit-notes/${r.id}` },
      { label: 'Supplier Credits', type: 'SupplierCreditNote', fields: ['credit_note_number', 'supplier_name', 'reason'], labelFn: (r) => r.credit_note_number, subFn: (r) => r.supplier_name, route: (r) => `/supplier-credit-notes/${r.id}` },
      { label: 'Bank Transactions', type: 'BankTransaction', fields: ['description', 'reference'], labelFn: (r) => r.description, subFn: (r) => r.reference, route: () => '/transactions' },
      { label: 'Documents', type: 'Document', fields: ['name', 'supplier_or_customer', 'reference_number'], labelFn: (r) => r.name, subFn: (r) => r.supplier_or_customer, route: () => '/documents' },
      { label: 'Ledger Accounts', type: 'ChartOfAccount', fields: ['code', 'name'], labelFn: (r) => r.name, subFn: (r) => r.code, route: () => '/chart-of-accounts' },
      { label: 'VAT Returns', type: 'VATReturn', fields: ['reference', 'period_start'], labelFn: (r) => r.reference || 'VAT Return', subFn: (r) => r.period_start, route: (r) => `/vat/${r.id}` },
    ];

    const results = await Promise.all(
      sources.map(async (s) => {
        let list = [];
        try {
          list = await base44.asServiceRole.entities[s.type].filter({ company_id: companyId }, '-updated_date', 60);
        } catch (_e) {
          list = [];
        }
        const matched = list
          .filter((r) => s.fields.some((f) => contains(r[f], q)))
          .slice(0, 6)
          .map((r) => ({
            id: r.id,
            label: s.labelFn(r) || 'Untitled',
            sublabel: s.subFn(r) || '',
            route: s.route(r),
          }));
        return { label: s.label, items: matched };
      })
    );

    const groups = results.filter((g) => g.items.length > 0);
    return Response.json({ groups });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}