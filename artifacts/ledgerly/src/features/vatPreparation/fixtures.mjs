export function reportFixture() {
  const doc = (id, kind, net, vat, gross, vatBox, date = '2026-10-15') => ({
    id, kind, number: `REF-${id}`, party_name: `${id} party`, date, journal_id: `journal-${id}`,
    net_minor: net, vat_minor: vat, gross_minor: gross, vat_box: vatBox,
  });
  return { from: '2026-10-01', to: '2026-10-31', vat: { applicable: true,
    box1_pence: '1500', box4_pence: '600', box5_pence: '900', box6_pence: '7500', box7_pence: '4000',
    net_payable_pence: '900', repayment: false }, posted_documents: [
    doc('invoice', 'sales_invoice', '10000', '2000', '12000', '1'),
    doc('sales-credit', 'sales_credit_note', '-2500', '-500', '-3000', '1'),
    doc('bill', 'purchase_bill', '4000', '800', '4800', '4'),
    doc('supplier-credit', 'supplier_credit_note', '-1000', '-200', '-1200', '4'),
    doc('ineligible', 'purchase_bill', '1000', '0', '1200', '4'),
    doc('earlier', 'sales_invoice', '99900', '88800', '188700', '1', '2026-09-30'),
  ] };
}
