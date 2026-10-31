import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { recoveryPlan } from './recovery.mjs';
const root = new URL('../../../../../', import.meta.url);
const inventory = JSON.parse(readFileSync(new URL('docs/development/service-data-boundaries.json', root)));
const request = Object.freeze({ service: 'openai_assistance', destination: 'https://unknown.invalid', operationId: 'original-operation', intentFingerprint: 'original-intent' });

test('source inventory grants no unverified destination, scope or retention assurance', () => {
  assert.equal(inventory.runtime_enforcement, false);
  assert.equal(new Set(inventory.services.map(s => s.id)).size, inventory.services.length);
  for (const service of inventory.services) {
    assert.equal(service.qualification, 'unverified');
    assert.equal(service.destination_allowlist, null);
    assert.equal(service.allowed_scopes, null);
    assert.equal(service.retention.provider, null);
    for (const source of service.source_paths) assert.ok(existsSync(fileURLToPath(new URL(source, root))), source);
  }
});

test('expiry, outage, revocation and unknown outcome never lose work or broaden unqualified access', () => {
  for (const failure of ['credential_expired', 'revoked', 'timeout', 'outage', 'unexpected']) {
    const result = recoveryPlan({ ...request, failure }, inventory);
    assert.equal(result.externalCallAllowed, false);
    assert.equal(result.discardSavedWork, false);
    assert.equal(result.broadenScopes, false);
    assert.equal(result.operationId, request.operationId);
    assert.equal(result.intentFingerprint, request.intentFingerprint);
    assert.equal(result.reason, 'UNQUALIFIED_DESTINATION');
  }
});

test('unknown services, malformed operation identity and premature destination entries fail closed', () => {
  assert.equal(recoveryPlan({ ...request, service: 'invented' }, inventory).reason, 'UNKNOWN_SERVICE');
  assert.equal(recoveryPlan({ ...request, operationId: '' }, inventory).reason, 'OPERATION_IDENTITY_REQUIRED');
  const premature = structuredClone(inventory);
  premature.services.find(s => s.id === request.service).destination_allowlist = [request.destination];
  assert.equal(recoveryPlan(request, premature).reason, 'SERVICE_NOT_QUALIFIED');
  assert.equal(inventory.services.find(s => s.id === request.service).destination_allowlist, null);
});


test('every current AI completion caller is covered by explicit outbound data inventory', () => {
  const service = inventory.services.find(item => item.id === 'openai_assistance');
  const directory = new URL('artifacts/api-server/src/', root);
  const callers = readdirSync(directory, { recursive: true }).filter(path => path.endsWith('.ts') && !path.includes('.test.') &&
    /aiService\.complete\s*\(/.test(readFileSync(new URL(path, directory), 'utf8'))).map(path => `artifacts/api-server/src/${path}`);
  assert.ok(callers.length > 0);
  for (const caller of callers) {
    assert.ok(service.source_paths.includes(caller), `Missing AI source ${caller}`);
    const payloads = service.outbound_payloads.filter(item => item.source_path === caller);
    assert.ok(payloads.length > 0 && payloads.every(item => item.fields.length > 0 && item.bounds), `Missing payload boundaries ${caller}`);
  }
  const fields = service.outbound_payloads.flatMap(item => item.fields);
  for (const sensitive of ['transaction.id', 'accountNames', 'matched_records.name', 'customer_name', 'outstanding_balance_gbp', 'revenue_this_month', 'by_state']) {
    assert.ok(fields.includes(sensitive), `Missing known outbound field ${sensitive}`);
  }
});
