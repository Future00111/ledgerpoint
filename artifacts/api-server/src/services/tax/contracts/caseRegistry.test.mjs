import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCaseRegistry, resolveQualifiedCase } from './caseRegistry.mjs';
import { resolvePayrollCase } from '../../payroll/contracts/caseBoundary.mjs';
const registry = JSON.parse(readFileSync(new URL('../../../../../../docs/development/tax-payroll-supported-cases.json', import.meta.url)));
const clone = () => structuredClone(registry);
test('inventory remains in-house, unqualified and preserves all target domains and years', () => {
  assert.equal(validateCaseRegistry(registry), registry);
  assert.deepEqual([...new Set(registry.cases.map(c => c.selector.domain))].sort(), ['corporation','income','payroll','vat']);
  assert.deepEqual([...new Set(registry.cases.map(c => c.selector.taxYear))].sort(), ['2025-26','2026-27','2027-28']);
  assert.ok(registry.cases.every(c => c.scopeStatus === 'retained_for_qualification' && c.status === 'unsupported'));
});
for (const row of registry.cases) test(`${row.id}: explicit unqualified result matches registered example`, () => {
  assert.deepEqual(resolveQualifiedCase(registry, row.example.input), row.example.expected);
  if (row.selector.domain === 'payroll') assert.deepEqual(resolvePayrollCase(registry, row.example.input), row.example.expected);
});
test('missing, inherited, extra and non-string dimensions fail closed', () => {
  const good = registry.cases[0].selector;
  for (const bad of [null, [], {}, Object.create(good), {...good, taxYear: null}, {...good, region:'Scotland'}]) {
    assert.deepEqual(resolveQualifiedCase(registry,bad), {ok:false,code:'INVALID_CASE_SELECTOR'});
  }
});
test('unknown year and unknown combinations cannot inherit nearby qualification', () => {
  const good = registry.cases[0].selector;
  for (const patch of [{taxYear:'2028-29'},{entity:'partnership'},{scheme:'margin'}]) {
    assert.deepEqual(resolveQualifiedCase(registry,{...good,...patch}),{ok:false,code:'UNKNOWN_CASE'});
  }
});
test('duplicate identity or selectors, missing provenance and unsupported status tampering reject registry', () => {
  for (const mutate of [r=>r.cases.push({...r.cases[0]}),r=>r.cases[1].id=r.cases[0].id,r=>r.cases[0].ruleProvenance.sourceId='missing',r=>r.cases[0].status='supported']) {
    const r=clone(); mutate(r); assert.throws(()=>validateCaseRegistry(r));
  }
});
test('payroll boundary rejects cross-domain case and does not mutate input', () => {
  const before=JSON.stringify(registry);
  assert.deepEqual(resolvePayrollCase(registry,registry.cases[0].selector),{ok:false,code:'INVALID_PAYROLL_CASE'});
  resolveQualifiedCase(registry, registry.cases[0].selector);
  assert.equal(JSON.stringify(registry),before);
});
