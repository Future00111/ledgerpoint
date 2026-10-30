export function reportFixture() {
  const doc = (id, kind, net, vat, gross, vatBox, date = '2026-10-15') => ({
    id, kind, number: `REF-${id}`, party_name: `${id} party`, date, journal_id: `journal-${id}`,
    net_minor: net, vat_minor: vat, gross_minor: gross, vat_box: vatBox,
  });
  const data = { from: '2026-10-01', to: '2026-10-31', vat: { applicable: true,
    box1_pence: '1500', box4_pence: '600', box5_pence: '900', box6_pence: '7500', box7_pence: '4000',
    net_payable_pence: '900', repayment: false }, posted_documents: [
    doc('invoice', 'sales_invoice', '10000', '2000', '12000', '1'),
    doc('sales-credit', 'sales_credit_note', '-2500', '-500', '-3000', '1'),
    doc('bill', 'purchase_bill', '4000', '800', '4800', '4'),
    doc('supplier-credit', 'supplier_credit_note', '-1000', '-200', '-1200', '4'),
    doc('ineligible', 'purchase_bill', '1000', '0', '1200', '4'),
    doc('earlier', 'sales_invoice', '99900', '88800', '188700', '1', '2026-09-30'),
  ] };
  data.vat_coverage = coverageFixture(data);
  return data;
}

export function coverageFixture(data) {
  const sources = data.posted_documents.filter(d => d.date >= data.from && d.date <= data.to);
  return { contract: 'vat-workings.coverage.v1', status: 'workings_reconciled', filing_ready: false,
    scope: { from: data.from, to: data.to, basis: 'posted_source_movements', currency: 'GBP', scheme: 'standard', accounting_basis: 'invoice' },
    movement_count: sources.length, source_document_count: new Set(sources.map(d => d.id)).size, journal_count: sources.length,
    boxes: Array.from({ length: 9 }, (_, i) => {
      const box = String(i + 1); const amount = data.vat[`box${box}_pence`];
      return { box, status: amount === undefined ? 'unsupported' : 'reconciled', amount_pence: amount ?? null, source_total_pence: amount ?? null };
    }),
    cases: [{ id: 'standard_invoice_basis', label: 'UK, GBP, standard scheme on an invoice basis', status: 'supported' },
      { id: 'other_schemes', label: 'Cash accounting, flat-rate and other VAT schemes', status: 'unsupported' }],
    blockers: [
      { code: 'INCOMPLETE_RETURN', message: 'Boxes 2, 3, 8 and 9 are not implemented in these workings. They are not assumed to be zero.' },
      { code: 'SUPPORTED_CASE_REVIEW', message: 'Review the source documents and supported accounting scope.' },
      { code: 'FILING_UNAVAILABLE', message: 'Submission and verified HMRC receipts are not connected.' },
    ] };
}
