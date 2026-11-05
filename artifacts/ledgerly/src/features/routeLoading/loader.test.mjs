import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouteLoader, RouteChunkError } from './loader.mjs';

test('loading is lazy, concurrent reads share one import, and successful modules remain cached', async () => {
  let calls = 0, finish;
  const module = { default: () => null };
  const loader = createRouteLoader(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  assert.equal(calls, 0);
  const first = loader.load(), second = loader.load();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(loader.retry(), false);
  finish(module);
  assert.equal(await first, module);
  assert.equal(loader.load(), first);
  assert.equal(loader.retry(), false);
});

test('a failed module is retried only on request and its sensitive error is not exposed', async () => {
  let calls = 0;
  const module = { default: () => null };
  const loader = createRouteLoader(() => {
    if (++calls === 1) throw new Error('Secret import URL: https://private.example/asset?token=secret');
    return module;
  });
  const first = loader.load();
  await assert.rejects(first, error => error instanceof RouteChunkError && !error.message.includes('secret') && !error.cause);
  assert.equal(loader.load(), first);
  assert.equal(calls, 1);
  assert.equal(loader.retry(), true);
  assert.equal(loader.retry(), false);
  const second = loader.load();
  assert.notEqual(second, first);
  assert.equal(await second, module);
  assert.equal(calls, 2);
});

test('missing default exports fail safely and a subsequent corrected module can load', async () => {
  let valid = false;
  const loader = createRouteLoader(() => valid ? { default: () => null } : {});
  await assert.rejects(loader.load(), RouteChunkError);
  valid = true;
  assert.equal(loader.retry(), true);
  assert.equal(typeof (await loader.load()).default, 'function');
});

test('independent route failures do not reset a successfully loaded page', async () => {
  let successfulCalls = 0;
  const first = createRouteLoader(() => { successfulCalls++; return { default: () => null }; });
  const second = createRouteLoader(() => Promise.reject(new Error('offline')));
  const saved = await first.load();
  await assert.rejects(second.load(), RouteChunkError);
  second.retry();
  assert.equal(await first.load(), saved);
  assert.equal(successfulCalls, 1);
});
