import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SourceUpload, { selectSourceFiles, dropSourceFiles } from './SourceUpload';
import { SourceRow } from './SourceFiles';
import { IntakeWorkspaceView } from './IntakeWorkspace';

const render = element => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
const sourceId = '5616c1a7-9ea7-4111-bbbe-655339c132dc';
const source = { id: sourceId, filename: 'Synthetic invoice.pdf', media_type: 'application/pdf', byte_length: 3000 };
const noop = () => {};

test('a file drop reaches the same native selection queue with original file objects and prevents navigation', () => {
  const files = [{ name: 'one.pdf' }, { name: 'two.png' }];
  const received = [];
  let prevented = 0, stopped = 0;
  const accepted = dropSourceFiles({ dataTransfer: { files }, preventDefault: () => prevented++, stopPropagation: () => stopped++ }, { canManage: true, busy: false, onSelect: selected => received.push(selected) });
  assert.equal(accepted, true);
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);
  assert.equal(received.length, 1);
  assert.equal(received[0][0], files[0]);
  assert.equal(received[0][1], files[1]);
});

test('read-only and busy drops prevent navigation without accepting files or starting a second queue', () => {
  for (const gate of [{ canManage: false, busy: false }, { canManage: true, busy: true }]) {
    let prevented = 0;
    const options = { ...gate, onSelect: () => assert.fail('Unauthorised or busy selection') };
    assert.equal(selectSourceFiles([{ name: 'photo.jpg' }], options), false);
    assert.equal(dropSourceFiles({ preventDefault: () => prevented++, stopPropagation: noop, dataTransfer: { files: [{ name: 'bill.pdf' }] } }, options), false);
    assert.equal(prevented, 1);
  }
});

test('cancelling a picker or dropping text does not create an empty upload request', () => {
  const options = { canManage: true, busy: false, onSelect: () => assert.fail('Empty queue entry') };
  for (const files of [undefined, null, []]) assert.equal(selectSourceFiles(files, options), false);
  assert.equal(dropSourceFiles({ preventDefault: noop, stopPropagation: noop, dataTransfer: { files: [] } }, options), false);
});

test('file and camera choices stay native, keyboard-operable and limited to the supported formats', () => {
  const html = render(<SourceUpload canManage onSelect={noop} />);
  const inputs = html.match(/<input\b[^>]*>/g);
  assert.equal(inputs.length, 2);
  assert.ok(inputs.some(input => input.includes('multiple=""') && input.includes('application/pdf')));
  assert.ok(inputs.some(input => input.includes('capture="environment"') && input.includes('accept="image/jpeg,image/png"') && !input.includes('multiple')));
  for (const label of ['Choose files', 'Take a photo']) assert.match(html, new RegExp(`<button[^>]*type="button"[^>]*>[\\s\\S]*?${label}`));
  assert.ok(html.includes('or an image picker'));
  assert.ok(!html.includes('<iframe'));
  assert.ok(!html.includes('contenteditable'));
});

test('active uploads disable both pickers, and unverified roles cannot access a file input', () => {
  const busy = render(<SourceUpload canManage busy onSelect={noop} />);
  for (const input of busy.match(/<input\b[^>]*>/g)) assert.ok(input.includes('disabled=""'));
  for (const button of busy.match(/<button\b[^>]*>/g)) assert.ok(button.includes('disabled=""'));
  const denied = render(<SourceUpload canManage={false} onSelect={noop} />);
  assert.ok(!denied.includes('type="file"'));
  assert.ok(denied.includes('require editing permission'));
});

test('compact source rows retain explicit native bill/credit choice and only download original bytes', () => {
  const html = render(<SourceRow source={source} companyId="company" canManage />);
  assert.ok(html.includes(`/bills/new?capture=${sourceId}`));
  assert.ok(html.includes(`/supplier-credit-notes/new?capture=${sourceId}`));
  assert.ok(html.includes(`id="capture-${sourceId}"`));
  assert.ok(html.includes('Download source file Synthetic invoice.pdf'));
  assert.ok(!html.includes('<iframe'));
  assert.ok(!html.includes('<img'));
  const linked = render(<SourceRow source={{ ...source, document_id: 'bill', document_kind: 'purchase_bill' }} companyId="company" canManage />);
  assert.ok(linked.includes(`/bills/bill?capture=${sourceId}`));
  assert.ok(!linked.includes('Prepare bill'));
  const readonly = render(<SourceRow source={source} companyId="company" />);
  assert.ok(!readonly.includes('Prepare bill'));
  assert.ok(readonly.includes(`/documents?capture=${sourceId}`));
});

test('mixed source inbox groups preparation and linked records without losing an original source', () => {
  const linked = { ...source, id: 'older', filename: 'Linked source.pdf', document_id: 'bill', document_kind: 'purchase_bill' };
  const html = render(<IntakeWorkspaceView companyId="company" state={{ data: { can_manage: true, sources: [linked, source] }, loading: false, refresh: noop }} items={[]} onSelect={noop} />);
  assert.ok(html.includes('aria-label="Ready to prepare"'));
  assert.ok(html.includes('aria-label="Linked to documents"'));
  assert.equal((html.match(new RegExp(`id="capture-${sourceId}"`, 'g')) || []).length, 1);
  assert.equal((html.match(/id="capture-older"/g) || []).length, 1);
  assert.ok(html.indexOf('id="capture-' + sourceId) < html.indexOf('id="capture-older'));
});
