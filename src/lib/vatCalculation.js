import { base44 } from '@/api/base44Client';

export async function calculateVATReturn(companyId, dateFrom, dateTo) {
  const [invoices, bills, salesCNs, supplierCNs] = await Promise.all([
    base44.entities.SalesInvoice.filter({ company_id: companyId }),
    base44.entities.PurchaseBill.filter({ company_id: companyId }),
    base44.entities.SalesCreditNote.filter({ company_id: companyId }),
    base44.entities.SupplierCreditNote.filter({ company_id: companyId }),
  ]);

  const filteredInvoices = invoices.filter(i =>
    i.status !== 'cancelled' && i.status !== 'draft' &&
    i.issue_date >= dateFrom && i.issue_date <= dateTo
  );
  const filteredBills = bills.filter(b =>
    b.status !== 'cancelled' && b.status !== 'draft' &&
    b.bill_date >= dateFrom && b.bill_date <= dateTo
  );
  const filteredSalesCNs = salesCNs.filter(c =>
    c.status !== 'cancelled' && c.status !== 'draft' &&
    c.credit_note_date >= dateFrom && c.credit_note_date <= dateTo
  );
  const filteredSupplierCNs = supplierCNs.filter(c =>
    c.status !== 'cancelled' && c.status !== 'draft' &&
    c.credit_note_date >= dateFrom && c.credit_note_date <= dateTo
  );

  const salesVat = filteredInvoices.reduce((s, i) => s + (i.vat_total || 0), 0);
  const salesCNVat = filteredSalesCNs.reduce((s, c) => s + (c.vat_total || 0), 0);
  const purchaseVat = filteredBills.reduce((s, b) => s + (b.vat_total || 0), 0);
  const supplierCNVat = filteredSupplierCNs.reduce((s, c) => s + (c.vat_total || 0), 0);
  const salesNet = filteredInvoices.reduce((s, i) => s + (i.subtotal || 0), 0);
  const salesCNNet = filteredSalesCNs.reduce((s, c) => s + (c.subtotal || 0), 0);
  const purchaseNet = filteredBills.reduce((s, b) => s + (b.subtotal || 0), 0);
  const supplierCNNet = filteredSupplierCNs.reduce((s, c) => s + (c.subtotal || 0), 0);

  const box1 = salesVat - salesCNVat;
  const box2 = 0;
  const box3 = box1 + box2;
  const box4 = purchaseVat - supplierCNVat;
  const box5 = box3 - box4;
  const box6 = salesNet - salesCNNet;
  const box7 = purchaseNet - supplierCNNet;
  const box8 = 0;
  const box9 = 0;

  const breakdown = {
    sales_invoices: filteredInvoices.map(i => ({
      id: i.id, number: i.invoice_number, customer_name: i.customer_name,
      date: i.issue_date, subtotal: i.subtotal, vat_total: i.vat_total
    })),
    sales_credit_notes: filteredSalesCNs.map(c => ({
      id: c.id, number: c.credit_note_number, customer_name: c.customer_name,
      date: c.credit_note_date, subtotal: c.subtotal, vat_total: c.vat_total
    })),
    purchase_bills: filteredBills.map(b => ({
      id: b.id, number: b.bill_number, supplier_name: b.supplier_name,
      date: b.bill_date, subtotal: b.subtotal, vat_total: b.vat_total
    })),
    supplier_credit_notes: filteredSupplierCNs.map(c => ({
      id: c.id, number: c.credit_note_number, supplier_name: c.supplier_name,
      date: c.credit_note_date, subtotal: c.subtotal, vat_total: c.vat_total
    })),
  };

  return {
    box1_output_vat: box1,
    box2_acquisitions: box2,
    box3_total_vat_due: box3,
    box4_vat_reclaimed: box4,
    box5_net_vat: box5,
    box6_total_sales: box6,
    box7_total_purchases: box7,
    box8_total_acquisitions: box8,
    box9_total_supplies: box9,
    breakdown,
  };
}