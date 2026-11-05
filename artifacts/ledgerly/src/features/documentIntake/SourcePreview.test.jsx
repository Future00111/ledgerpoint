import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SourcePreview, { SourcePreviewView } from './SourcePreview';
import { SourceCard, SourceRow } from './SourceFiles';
import { CaptureSourceReview } from './CaptureReview';

const source = { id: 'source', filename: 'synthetic-bill.png', media_type: 'image/png', byte_length: 1024, revision: '1' };
const render = element => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
const noop = () => {};
test('image preview is available on inbox rows, attached cards and draft review without edit authority', () => {
  for (const node of [<SourceRow companyId="co" source={source} canManage={false} />, <SourceCard companyId="co" source={source} compact />,
    <CaptureSourceReview companyId="co" capture={{ source, canManage: false, loading: false }} />]) {
    const html = render(node);
    assert.match(html, /Preview source image/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /Download source file/);
    assert.doesNotMatch(html, /<img|<iframe|<object|<embed/);
    assert.doesNotMatch(html, /Prepare bill/);
  }
});
test('PDF and other file types offer an honest download explanation with no renderer', () => {
  for (const type of ['application/pdf', 'image/svg+xml', 'text/html']) {
    const html = render(<SourcePreview companyId="co" source={{ ...source, media_type: type }} />);
    assert.match(html, /Download the source file/);
    assert.doesNotMatch(html, /<img|<iframe|<object|<embed|<button/);
  }
});
test('ready preview has accessible expansion, escaped source name, bounded image and no external-document frame', () => {
  const html = render(<SourcePreviewView filename={'bill <script>.png'} state={{ status: 'ready', url: 'blob:verified-source' }} regionId="image-preview" onOpen={noop} onClose={noop} onImageError={noop} />);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-controls="image-preview"/);
  assert.match(html, /id="image-preview"/);
  assert.match(html, /src="blob:verified-source"/);
  assert.match(html, /Original source document: bill &lt;script&gt;.png/);
  assert.match(html, /Close image preview/);
  assert.match(html, /does not extract fields or change accounting records/);
  assert.doesNotMatch(html, /<iframe|<object|<embed|<script/);
});
test('loading and failures remain closable and do not retain an image; retry is explicit', () => {
  const loading = render(<SourcePreviewView filename="bill.png" state={{ status: 'loading' }} regionId="preview" />);
  assert.match(loading, /role="status"/); assert.match(loading, /Close image preview/); assert.doesNotMatch(loading, /<img/);
  const failed = render(<SourcePreviewView filename="bill.png" state={{ status: 'error', error: 'Could not display image.' }} regionId="preview" />);
  assert.match(failed, /role="alert"/); assert.match(failed, /Retry image preview/); assert.doesNotMatch(failed, /<img/);
});
