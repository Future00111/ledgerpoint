import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup, renderToPipeableStream } from 'react-dom/server';
import { Writable } from 'node:stream';
import { RouteLoading, RouteLoadFailure, RouteChunkBoundary, lazyRoute, createLazyRoute } from '@/components/RouteLoadingBoundary';
import { RouteChunkError, createRouteLoader } from './loader.mjs';

function renderResolved(node) {
  return new Promise((resolve, reject) => {
    let output = '';
    const stream = renderToPipeableStream(node, {
      onAllReady() {
        const sink = new Writable({ write(chunk, encoding, done) { output += chunk.toString(); done(); } });
        sink.on('finish', () => resolve(output));
        sink.on('error', reject);
        stream.pipe(sink);
      },
      onError: reject,
    });
  });
}

test('loading and failure views are accessible and offer explicit retry without revealing errors', () => {
  const loading = renderToStaticMarkup(<RouteLoading />);
  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-live="polite"/);
  const failed = renderToStaticMarkup(<RouteLoadFailure onRetry={() => {}} error={new Error('secret-url')} />);
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Try loading again/);
  assert.match(failed, /Reload this page/);
  assert.doesNotMatch(failed, /secret-url/);
});

test('only import failures use the route retry boundary; runtime errors keep the application boundary', () => {
  assert.deepEqual(RouteChunkBoundary.getDerivedStateFromError(new RouteChunkError()), { failed: true });
  const error = new Error('business rendering error');
  assert.throws(() => RouteChunkBoundary.getDerivedStateFromError(error), value => value === error);
});

test('a lazy page resolves with its original route props and leaves the surrounding shell rendered', async () => {
  let calls = 0;
  const Page = lazyRoute(async () => {
    calls++;
    return { default: ({ kind, legacyFallback }) => <article><h1>{kind}</h1>{legacyFallback}</article> };
  });
  const html = await renderResolved(<main><nav>Workspace</nav><Page kind="purchase_bill" legacyFallback={<p>Legacy details</p>} /></main>);
  assert.equal(calls, 1);
  assert.match(html, /<nav>Workspace<\/nav>/);
  assert.match(html, /purchase_bill/);
  assert.match(html, /Legacy details/);
  assert.doesNotMatch(html, /This page could not be loaded/);
});

test('remounting a route after successful retry never resurrects its rejected lazy value', async () => {
  let calls = 0;
  const loader = createRouteLoader(() => {
    if (++calls === 1) return Promise.reject(new Error('offline'));
    return { default: ({ id }) => <h1>Document {id}</h1> };
  });
  const Page = createLazyRoute(loader);
  await assert.rejects(renderResolved(<Page id="first" />), RouteChunkError);
  assert.equal(loader.retry(), true);
  await loader.load(); // The shared import succeeds after the user's retry.
  const remounted = await renderResolved(<Page id="returned" />);
  assert.match(remounted.replace(/<!--[\s\S]*?-->/g, ''), /Document returned/);
  assert.doesNotMatch(remounted, /could not be loaded/);
  assert.equal(calls, 2);
});
