import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePayrollReferenceEvidence } from './referenceEvidence.mjs';
import { validateCaseRegistry } from '../../tax/contracts/caseRegistry.mjs';
const registry = JSON.parse(readFileSync(new URL('../../../../../../docs/development/tax-payroll-supported-cases.json', import.meta.url)));
const root = new URL('../../../../../../', import.meta.url);
const corpora = Object.fromEntries([...new Set(registry.cases.filter(r => r.referenceFixtures).map(r => r.referenceFixtures.path))]
  .map(path => [path, JSON.parse(readFileSync(new URL(path, root)))]));
const first = r => r.cases.find(row => row.referenceFixtures);
test('every registered payroll reference matches its pinned corpus without qualifying calculations', () => {
  assert.deepEqual(validatePayrollReferenceEvidence(registry, corpora), {referenceCases:8, qualifiedCases:0});
});
test('contradictory reference descriptors fail at the ordinary registry boundary', () => {
  for (const mutate of [
    row => row.referenceFixtures.qualification = 'qualified',
    row => row.referenceFixtures.path = '../../elsewhere.json',
    row => row.referenceFixtures.caseCount = -1,
    row => row.referenceFixtures.caseCount = 1.5,
    row => row.referenceFixtures.plan = 'plan_2',
    row => row.referenceFixtures.region = 'scotland',
    row => row.referenceFixtures.frequencies = ['weekly', 'weekly'],
    row => row.referenceFixtures = null,
  ]) {
    const r = structuredClone(registry); mutate(first(r));
    assert.throws(() => validateCaseRegistry(r), /INVALID_CASE_REGISTRY/);
  }
});
test('missing, wrong-year, reclassified and inconsistent corpus evidence fails closed', () => {
  const path = first(registry).referenceFixtures.path;
  for (const mutate of [
    c => delete c[path],
    c => c[path].taxYear = '2027-28',
    c => c[path].source.page = 'https://example.com',
    c => c[path].source.sha256 = 'unverified',
    c => c[path].status = 'qualified',
    c => c[path].cases.pop(),
    c => c[path].cases[1].id = c[path].cases[0].id,
    c => c[path].cases[0].input.taxYear = '2025-26',
    c => c[path].cases[0].input.frequency = 'annual',
  ]) {
    const c = structuredClone(corpora); mutate(c);
    assert.throws(() => validatePayrollReferenceEvidence(registry, c), /INVALID_PAYROLL_REFERENCE_EVIDENCE/);
  }
});
test('incorrect declared count and frequencies cannot pass as reference coverage', () => {
  for (const mutate of [r => first(r).referenceFixtures.caseCount++, r => first(r).referenceFixtures.frequencies.pop()]) {
    const r = structuredClone(registry); mutate(r);
    assert.throws(() => validatePayrollReferenceEvidence(r, corpora), /INVALID_PAYROLL_REFERENCE_EVIDENCE/);
  }
});
