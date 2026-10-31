import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { sortDocuments, DocumentSort, MobileDocumentCards, DocumentTable, DocumentStatusFilters, DocumentTotal, documentSettlement, documentSettlementsAvailable, SettlementFilterNotice } from '@/pages/AccountingDocumentList';
import PostedDocument, { PostedLineCards } from '@/components/accounting/PostedDocument';
import { DiscountEditor, DraftWriteActions } from '@/features/documentDiscounts/DiscountControls';
import { CaptureDraftActions } from './CaptureReview';
import DocumentProgress from './DocumentProgress';
import { UploadQueue } from './IntakeWorkspace';
import { SourceActions } from './SourceFiles';
import { emptyAcknowledgements } from './model.mjs';

const noop = () => {};
const render = element => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
const sourceId = '6bba1f6e-0b9b-4ca8-a13b-aeb5abebbcac';
const source = { invoice_number: 'SYNTHETIC-1', issue_date: '2026-10-30', due_date: '2026-11-29', payment_terms: 30,
  line_items: [{ description: 'Caliper', quantity: '2', unit_price: '50', tax_code: 'S20' }, { description: 'Surcharge', quantity: '1', unit_price: '20', tax_code: 'S20' }] };
const doc = { id: 'doc', revision: '1', status: 'posted', source, party_name: 'Synthetic Supplier', original_id: 'original', party_id: 'party',
  money: { net_pence: '12000', vat_pence: '2400', gross_pence: '14400', lines: [{ net_pence: '10000' }, { net_pence: '2000' }] } };

test('uploaded files expose direct preparation links; duplicate linked files reopen with source return', () => {
  const item = { id: 1, file: { name: 'bill.pdf' }, status: 'done', source: { id: sourceId }, duplicate: false };
  const html = render(<UploadQueue items={[item]} canManage onRemove={noop} />);
  assert.ok(html.includes(`/bills/new?capture=${sourceId}`));
  assert.ok(html.includes(`/supplier-credit-notes/new?capture=${sourceId}`));
  assert.ok(!html.includes('>Open source<'));
  const readonly = render(<SourceActions source={item.source} canManage={false} compact />);
  assert.ok(!readonly.includes('Prepare bill'));
  const duplicate = render(<SourceActions source={{ id: sourceId, document_id: 'bill', document_kind: 'purchase_bill' }} canManage />);
  assert.ok(duplicate.includes(`/bills/bill?capture=${sourceId}`));
  assert.ok(!duplicate.includes('Prepare bill'));
});

test('status controls are real filter buttons with selected state and zero/loading counts', () => {
  const html = render(<DocumentStatusFilters title="Bills" tabs={[["all", "All"], ["draft", "Draft"], ["settled", "Settled"]]} filter="draft" counts={{ all: 0, draft: 2, settled: null }} onChange={noop} />);
  assert.ok(html.includes('role="group"'));
  assert.ok(!html.includes('role="tab'));
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.ok(html.includes('>0</span>'));
  assert.ok(html.includes('>—</span>'));
});

test('mobile cards retain all four document routes, precise money and role-aware draft actions', () => {
  for (const [kind, path] of [['sales_invoice', '/invoices'], ['purchase_bill', '/bills'], ['sales_credit_note', '/sales-credit-notes'], ['supplier_credit_note', '/supplier-credit-notes']]) {
    const record = { ...doc, kind, status: 'draft', money: { gross_pence: '9007199254740993' } };
    const props = { docs: [record], kind, remaining: () => null, ledgerLoading: false };
    const editable = render(<MobileDocumentCards {...props} capabilities={{ edit_drafts: true }} />);
    assert.ok(editable.includes(`href="${path}/doc"`));
    assert.ok(editable.includes('£90,071,992,547,409.93'));
    assert.ok(editable.includes('Edit draft'));
    const readonly = render(<MobileDocumentCards {...props} capabilities={{}} />);
    assert.ok(!readonly.includes('Edit draft'));
    assert.ok(readonly.includes('>View</a>'));
    assert.equal(editable.includes('Still due'), !kind.includes('credit_note'));
  }
});

test('mobile supplier rows pass the exact original indices and server net values to line controls', () => {
  const seen = [];
  const html = render(<PostedLineCards doc={doc} creditUI={{ lineControl: index => { seen.push(index); return <button type="button">Select original line {index}</button>; } }} />);
  assert.deepEqual(seen, [0, 1]);
  assert.ok(html.includes('mobile-row-line-0'));
  assert.ok(html.includes('mobile-row-line-1'));
  assert.ok(html.includes('£100.00'));
  assert.ok(html.includes('£20.00'));
  assert.ok(html.indexOf('Caliper') < html.indexOf('Select original line 0'));
  assert.ok(html.indexOf('Surcharge') < html.indexOf('Select original line 1'));
});

test('posted payment and credit actions occur once in the header, only on permitted originals with valid capacity', () => {
  const props = { doc: { ...doc, kind: 'purchase_bill' }, kind: 'purchase_bill', company: { id: 'company', name: 'Synthetic Company' }, journal: { status: 'loading' }, settlement: { loading: false, to: '2026-10-30' },
    openItem: { gross_minor: '14400', paid_minor: '5000', credited_minor: '0', open_minor: '9400', settlement: 'part_paid', history: [] }, capabilities: { edit_drafts: true, post_documents: true } };
  const html = render(<PostedDocument {...props} />);
  const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0] ?? '';
  assert.ok(header.includes('Record payment'));
  assert.ok(header.includes('Create credit note'));
  assert.equal((html.match(/Record payment/g) || []).length, 1);
  assert.equal((html.match(/Create credit note/g) || []).length, 1);
  for (const kind of ['sales_credit_note', 'supplier_credit_note']) {
    const credit = render(<PostedDocument {...props} kind={kind} doc={{ ...doc, kind }} />);
    assert.ok(!credit.includes('Record payment'));
    assert.ok(!credit.includes('Create credit note'));
  }
  for (const extra of [{ capabilities: null }, { settlement: { loading: true } }, { settlement: { loading: false, error: new Error('Unavailable') } }, { openItem: { ...props.openItem, open_minor: '0', settlement: 'settled' } }]) {
    const blocked = render(<PostedDocument {...props} {...extra} />);
    assert.ok(!blocked.includes('Record payment'));
    assert.ok(!blocked.includes('Create credit note'));
  }
});

test('capture keeps exactly two distinct submit intents and three unchecked acknowledgements', () => {
  const capture = { canManage: true, currentReview: { money: doc.money }, acknowledgements: emptyAcknowledgements(), acknowledge: noop };
  const html = render(<form><CaptureDraftActions capture={capture} canEdit /></form>);
  assert.equal((html.match(/<form\b/g) || []).length, 1);
  assert.equal((html.match(/type="submit"/g) || []).length, 2);
  const submitButtons = html.match(/<button\b[^>]*type="submit"[^>]*>/g) || [];
  for (const value of ['review', 'save']) assert.ok(submitButtons.some(button => button.includes('name="capture_action"') && button.includes(`value="${value}"`)));
  assert.equal((html.match(/type="checkbox"/g) || []).length, 3);
  assert.ok(!html.includes('checked=""'));
  assert.ok(html.includes('£144.00'));
  assert.match(html, /value="save"[^>]*disabled=""/);
  assert.ok(!html.includes('Confirm posting'));
  const progress = render(<DocumentProgress captureMode reviewed />);
  assert.ok(progress.includes('Review source &amp; totals'));
  assert.ok(progress.includes('Save linked draft'));
  assert.ok(!progress.includes('Review &amp; post'));
  assert.equal((progress.match(/aria-current="step"/g) || []).length, 1);
});

test('optional discount stays compact until needed, while existing discounts and draft safeguards remain visible', () => {
  const collapsed = render(<DiscountEditor value={null} onChange={noop} />);
  assert.ok(collapsed.includes('Add a discount (optional)'));
  assert.ok(!collapsed.includes('discount-value'));
  const existing = render(<DiscountEditor value={{ type: 'amount', value: '10' }} onChange={noop} priceBasis="including_vat" />);
  assert.ok(existing.includes('Discount amount (including VAT)'));
  assert.ok(existing.includes('value="10"'));
  const draft = render(<DraftWriteActions compact capabilities={{ edit_drafts: true, post_documents: true }} doc={{ money: { gross_pence: '0' } }} editId="doc" onReview={noop} />);
  assert.match(draft, /disabled=""[^>]*data-testid="button-post"/);
  assert.equal((draft.match(/type="submit"/g) || []).length, 1);
  assert.ok(draft.includes('Zero-value documents cannot be posted yet'));
});


test('document totals disclose saved net and VAT precisely without inferring unavailable tax', () => {
  const money = { net_pence: '9007199254740993', vat_pence: '0', gross_pence: '9007199254740993' };
  const before = JSON.stringify(money);
  const html = render(<DocumentTotal money={money} documentNumber="SYNTHETIC-EXACT" />);
  assert.match(html, /<details[^>]*><summary/);
  assert.match(html, /Net &amp; VAT/);
  assert.match(html, /for SYNTHETIC-EXACT/);
  assert.match(html, /£90,071,992,547,409.93/);
  assert.match(html, /<dt>VAT<\/dt><dd>[^]*?£0.00/);
  assert.equal(JSON.stringify(money), before);
  const unavailable = render(<DocumentTotal money={{ gross_pence: '14400' }} />);
  assert.match(unavailable, /£144.00/);
  assert.equal(unavailable.includes('£0.00'), false);
  assert.match(unavailable, /<dt>Net<\/dt><dd>[^]*?—/);
  assert.match(unavailable, /<dt>VAT<\/dt><dd>[^]*?—/);
  for (const kind of ['sales_invoice', 'purchase_bill', 'sales_credit_note', 'supplier_credit_note']) {
    const mobile = render(<MobileDocumentCards docs={[doc]} kind={kind} capabilities={{}} remaining={() => null} ledgerLoading={false} />);
    assert.match(mobile, /Net &amp; VAT/);
    assert.match(mobile, /£120.00/);
    assert.match(mobile, /£24.00/);
    assert.equal(mobile.includes('Edit draft'), false);
  }
});


test('settlement views discard stale cached balances after failed refresh and retain document access', () => {
  const item = { id: 'doc', gross_minor: '14400', open_minor: '0', paid_minor: '14400', credited_minor: '0', settlement: 'settled' };
  const data = { open_items: [item] };
  assert.equal(documentSettlement({ data, loading: false, error: null }, 'doc'), item);
  assert.equal(documentSettlement({ data, loading: false, error: null }, 'missing'), null);
  for (const ledger of [{ data, error: new Error('Refresh failed') }, { data, loading: true }, { loading: false }]) {
    assert.equal(documentSettlement(ledger, 'doc'), null);
    const html = render(<MobileDocumentCards docs={[doc]} kind="purchase_bill" capabilities={{}} remaining={d => documentSettlement(ledger, d.id)} ledgerLoading={Boolean(ledger.loading)} />);
    assert.ok(html.includes('href="/bills/doc"'));
    assert.match(html, /<dt[^>]*>Paid<\/dt><dd[^>]*>[^]*?—[^]*?<\/dd>/);
    assert.ok(html.includes(ledger.loading ? 'Loading…' : 'Unavailable'));
  }
  const failed = render(<SettlementFilterNotice loading={false} onShowAll={noop} />);
  assert.ok(failed.includes('role="status"'));
  assert.ok(failed.includes('Payment status is unavailable'));
  assert.ok(failed.includes('Show all documents'));
  assert.equal(failed.includes('Nothing matches'), false);
  const loading = render(<SettlementFilterNotice loading onShowAll={noop} />);
  assert.ok(loading.includes('Loading payment status…'));
  assert.equal(loading.includes('unavailable'), false);
});


test('desktop document tables preserve keyboard access, full references and named document actions', () => {
  for (const [kind, path] of [['sales_invoice', '/invoices'], ['purchase_bill', '/bills'], ['sales_credit_note', '/sales-credit-notes'], ['supplier_credit_note', '/supplier-credit-notes']]) {
    const record = { ...doc, status: 'draft', source: { ...doc.source, reference: 'Purchase order 123456789012345678901234567890' } };
    const props = { docs: [record], kind, remaining: () => null, ledgerLoading: false, isOverdue: () => false };
    const html = render(<DocumentTable {...props} capabilities={{ edit_drafts: true }} />);
    assert.match(html, /tabindex="0" role="region"/);
    assert.match(html, /table, scroll for more columns/);
    assert.match(html, /<caption[^>]*>Matching/);
    assert.match(html, /scope="col"/);
    assert.ok(html.includes(record.source.reference));
    assert.equal(html.includes('truncate'), false);
    assert.ok(html.includes(`href="${path}/doc"`));
    assert.ok(html.includes('aria-label="Edit draft SYNTHETIC-1 for Synthetic Supplier"'));
    assert.ok(html.includes('£144.00'));
    assert.ok(html.includes('£24.00'));
    const readonly = render(<DocumentTable {...props} capabilities={{}} />);
    assert.equal(readonly.includes('Edit draft'), false);
    assert.ok(readonly.includes('aria-label="View SYNTHETIC-1 for Synthetic Supplier"'));
    assert.equal(readonly.includes('Still due'), !kind.includes('credit_note'));
  }
});


test('malformed settlement snapshots cannot crash document rows or masquerade as filtered zero balances', () => {
  const item = { id: 'doc', gross_minor: '14400', open_minor: '9400', paid_minor: '5000', credited_minor: '0', settlement: 'part_paid' };
  const valid = { data: { open_items: [item] }, loading: false };
  assert.equal(documentSettlementsAvailable(valid), true);
  assert.equal(documentSettlement(valid, 'doc'), item);
  assert.equal(documentSettlementsAvailable({ data: { open_items: [] } }), true);
  const badItems = [null, {}, { ...item, id: '' }, { ...item, gross_minor: '14401' },
    { ...item, open_minor: 'not-money' }, { ...item, paid_minor: 5000 }, { ...item, credited_minor: '-1' },
    { ...item, open_minor: '09400' }, { ...item, settlement: 'settled' }, { ...item, settlement: 'unknown' }];
  const snapshots = [undefined, {}, { data: {} }, { data: { open_items: {} } },
    { data: { open_items: [item, item] } }, ...badItems.map(bad => ({ data: { open_items: [item, bad] } }))];
  for (const ledger of snapshots) {
    assert.equal(documentSettlementsAvailable(ledger), false);
    assert.equal(documentSettlement(ledger, 'doc'), null);
    for (const kind of ['sales_invoice', 'purchase_bill']) {
      const props = { docs: [doc], kind, capabilities: {}, remaining: d => documentSettlement(ledger, d.id), ledgerLoading: false, isOverdue: () => false };
      for (const Component of [MobileDocumentCards, DocumentTable]) {
        const html = render(<Component {...props} />);
        assert.ok(html.includes(kind === 'sales_invoice' ? 'href="/invoices/doc"' : 'href="/bills/doc"'));
        assert.ok(html.includes('Unavailable'));
        assert.equal(html.includes('settlement-status'), false);
        assert.equal(html.includes('£94.00'), false);
        assert.equal(html.includes('£50.00'), false);
        assert.ok(html.includes('£144.00'));
      }
    }
  }
});


test('document sorting compares exact saved amounts, preserves ties and places missing values last', () => {
  const records = [
    { id: 'unknown', money: { gross_pence: 'not-money' } },
    { id: 'a', money: { gross_pence: '9007199254740992' } },
    { id: 'b', money: { gross_pence: '9007199254740993' } },
    { id: 'zero', money: { gross_pence: '0' } },
    { id: 'tie', money: { gross_pence: '9007199254740992' } },
    { id: 'missing' },
  ];
  const before = JSON.stringify(records);
  const ids = order => sortDocuments(records, order).map(record => record.id);
  assert.deepEqual(ids('largest'), ['b', 'a', 'tie', 'zero', 'unknown', 'missing']);
  assert.deepEqual(ids('smallest'), ['zero', 'a', 'tie', 'b', 'unknown', 'missing']);
  for (const order of ['saved', 'invalid']) assert.deepEqual(ids(order), records.map(record => record.id));
  assert.equal(JSON.stringify(records), before);
  assert.notEqual(sortDocuments(records), records);
  assert.equal(sortDocuments(records, 'largest')[0], records[2]);
});

test('document date ordering is stable, rejects impossible dates and does not invent credit due dates', () => {
  const records = [
    { id: 'a', source: { issue_date: '2026-10-31', due_date: '2026-11-30' } },
    { id: 'missing' },
    { id: 'b', source: { issue_date: '2026-10-30', due_date: '2026-11-01' } },
    { id: 'invalid', source: { issue_date: '2026-02-30', due_date: 'tomorrow' } },
    { id: 'tie', source: { issue_date: '2026-10-31', due_date: '2026-11-30' } },
  ];
  const ids = order => sortDocuments(records, order).map(record => record.id);
  assert.deepEqual(ids('newest'), ['a', 'tie', 'b', 'missing', 'invalid']);
  assert.deepEqual(ids('oldest'), ['b', 'a', 'tie', 'missing', 'invalid']);
  assert.deepEqual(ids('due'), ['b', 'a', 'tie', 'missing', 'invalid']);
  const html = render(<DocumentSort value="largest" onChange={noop} />);
  assert.match(html, /<label[^>]*>Sort documents<select/);
  assert.match(html, /<option value="largest" selected="">/);
  assert.match(html, /Due date: earliest first/);
  const credit = render(<DocumentSort value="saved" onChange={noop} credit />);
  assert.equal(credit.includes('Due date'), false);
  assert.match(credit, /Total: largest first/);
});
