import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { IntakeWorkspaceView, UploadQueue } from './IntakeWorkspace';
import { SourceCard, RequestedSourceView } from './SourceFiles';
import { CaptureDraftActions, CaptureSourceReview } from './CaptureReview';
import { emptyAcknowledgements, displayedDocumentMoney } from './model.mjs';
import DocumentLineFields from '@/features/documentDiscounts/DocumentLineFields';
const render = element => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
const noop = () => {};
const source = { id: 'source', filename: 'synthetic-bill.pdf', media_type: 'application/pdf', byte_length: 1024, revision: '1' };

test('native workspace shows honest provider status and file limits, and gates upload/prepare by verified role', () => {
  const state = { loading: false, error: null, data: { can_manage: true, sources: [source] }, refresh: noop };
  const html = render(<IntakeWorkspaceView companyId="co" state={state} items={[]} onSelect={noop} />);
  for (const text of ['Automatic extraction: not connected', 'Email intake: not connected', '5 MiB', '10 files', 'one at a time', 'Latest 100 uploads', 'Prepare bill', 'Prepare supplier credit', 'type="file"']) assert.ok(html.includes(text), text);
  assert.ok(html.includes('/bills/new?capture=source'));
  for (const denied of [{ ...state, data: { ...state.data, can_manage: false } }, { loading: true, data: null }, { loading: false, data: null, error: new Error('Unavailable') }]) {
    const blocked = render(<IntakeWorkspaceView companyId="co" state={denied} items={[]} />);
    assert.ok(!blocked.includes('type="file"'));
    assert.ok(!blocked.includes('Prepare bill'));
  }
  const loading = render(<IntakeWorkspaceView companyId="co" state={{ loading: true }} items={[]} />);
  assert.ok(loading.includes('Checking upload permissions'));
});

test('source cards only offer explicit downloads, and linked duplicates open their existing document', () => {
  const html = render(<SourceCard companyId="co" source={{ ...source, document_id: 'bill', document_kind: 'purchase_bill' }} canManage />);
  assert.ok(html.includes('href="/bills/bill"'));
  assert.ok(html.includes('Open linked document'));
  assert.ok(html.includes('Download source file'));
  assert.ok(!html.includes('Prepare bill'));
  assert.ok(!html.includes('<iframe'));
  assert.ok(!html.includes('<img'));
});

test('an older duplicate outside the recent list resolves a selected source and retains native preparation actions', () => {
  const html = render(<IntakeWorkspaceView companyId="co" highlighted="old-source" state={{ data: { can_manage: true, sources: [] }, loading: false }} items={[]} />);
  assert.ok(html.includes('Requested source file'));
  assert.ok(html.includes('Selected source file'));
  const resolved = render(<RequestedSourceView companyId="co" source={{ ...source, id: 'old-source' }} loading={false} canManage />);
  assert.ok(resolved.includes('/bills/new?capture=old-source'));
  assert.ok(resolved.includes('/supplier-credit-notes/new?capture=old-source'));
  assert.ok(!render(<RequestedSourceView companyId="co" source={source} loading={false} canManage={false} />).includes('Prepare bill'));
});

test('reviewed capture line renders server money before a draft document exists, and stale review hides amounts', () => {
  const review = { money: { net_pence: '833', vat_pence: '167', gross_pence: '1000', lines: [{ net_pence: '833', vat_pence: '167', gross_pence: '1000' }] } };
  const document = null;
  const displayedMoney = displayedDocumentMoney(true, review, document, true);
  const props = { line: { description: 'Synthetic part', quantity: '1', unit_price: '10', tax_code: 'S20' }, index: 0, priceBasis: 'including_vat', taxRules: [], onChange: noop };
  const html = render(<DocumentLineFields {...props} money={displayedMoney?.lines?.[0]} />);
  for (const text of ['£8.33', '£1.67', '£10.00']) assert.ok(html.includes(text), text);
  const staleMoney = displayedDocumentMoney(true, null, document, true);
  assert.equal(staleMoney, null);
  const stale = render(<DocumentLineFields {...props} money={staleMoney?.lines?.[0]} />);
  assert.ok(!stale.includes('£8.33'));
  assert.equal(displayedDocumentMoney(false, null, { money: review.money }, true), null);
});

test('queue renders real reading progress, uncertain failure retry and duplicate links without pretending extraction', () => {
  const items = [
    { id: 1, file: { name: 'reading.pdf' }, status: 'reading', progress: 50 },
    { id: 2, file: { name: 'retry.pdf' }, status: 'error', error: 'Connection interrupted.', retryable: true },
    { id: 3, file: { name: 'duplicate.pdf' }, status: 'done', duplicate: true, source: { ...source, document_id: 'credit', document_kind: 'supplier_credit_note' } },
  ];
  const html = render(<UploadQueue items={items} canManage onRetry={noop} onRemove={noop} />);
  assert.ok(html.includes('Reading file · 50%'));
  assert.ok(html.includes('Retry upload'));
  assert.ok(html.includes('Already uploaded · existing source retained'));
  assert.ok(html.includes('href="/supplier-credit-notes/credit"'));
  assert.ok(!render(<UploadQueue items={items} canManage={false} />).includes('Retry upload'));
});

test('capture save requires current review plus explicit three confirmations, with no posting action', () => {
  const capture = { canManage: true, currentReview: null, busy: false, acknowledgements: emptyAcknowledgements(), acknowledge: noop };
  const initial = render(<CaptureDraftActions capture={capture} canEdit />);
  assert.ok(initial.includes('Review details &amp; totals'));
  assert.ok(!initial.includes('Save linked draft'));
  const reviewed = render(<CaptureDraftActions capture={{ ...capture, currentReview: { money: {} } }} canEdit />);
  assert.equal((reviewed.match(/type="checkbox"/g) || []).length, 3);
  assert.match(reviewed, /<button[^>]*value="save"[^>]*disabled=""/);
  const acknowledged = render(<CaptureDraftActions capture={{ ...capture, currentReview: {}, acknowledgements: { source_reviewed: true, supplier_confirmed: true, tax_treatment_confirmed: true } }} canEdit />);
  assert.ok(!acknowledged.match(/<button[^>]*value="save"[^>]*disabled=""/));
  assert.ok(acknowledged.includes('review and post that saved draft separately'));
  assert.ok(!acknowledged.includes('Confirm posting'));
  assert.equal(render(<CaptureDraftActions capture={capture} canEdit={false} />), '');
  assert.equal(render(<CaptureDraftActions capture={{ ...capture, canManage: false }} canEdit />), '');
});

test('capture metadata failures and already-linked sources stay recoverable without showing new draft writes', () => {
  const failed = render(<CaptureSourceReview companyId="co" capture={{ loading: false, error: new Error('Source unavailable'), refresh: noop }} />);
  assert.ok(failed.includes('Source unavailable'));
  assert.ok(failed.includes('No fields have been extracted'));
  const existing = render(<CaptureSourceReview companyId="co" capture={{ loading: false, source: { ...source, document_id: 'bill', document_kind: 'purchase_bill' }, canManage: false }} />);
  assert.ok(existing.includes('This file already has a linked document'));
  assert.ok(existing.includes('Open the existing document'));
  assert.ok(existing.includes('href="/bills/bill"'));
});
