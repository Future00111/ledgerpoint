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
test('unregistered and malformed examples cannot be silently omitted from coverage', () => {
  const path = first(registry).referenceFixtures.path;
  for (const extra of [null, {}, {id:'orphan', input:{plan:'unknown_plan'}}]) {
    const c = structuredClone(corpora); c[path].cases.push(extra);
    assert.throws(() => validatePayrollReferenceEvidence(registry, c), /INVALID_PAYROLL_REFERENCE_EVIDENCE/);
  }
  const r = structuredClone(registry);
  r.cases = r.cases.filter(row => row.id !== first(r).id);
  assert.throws(() => validatePayrollReferenceEvidence(r, corpora), /INVALID_PAYROLL_REFERENCE_EVIDENCE/);
});
test('case identity is unique across all dimensions of a linked corpus', () => {
  const c = structuredClone(corpora);
  const path = first(registry).referenceFixtures.path;
  const examples = c[path].cases;
  const other = examples.find(example => example.input.plan !== examples[0].input.plan);
  other.id = examples[0].id;
  assert.throws(() => validatePayrollReferenceEvidence(registry, c), /INVALID_PAYROLL_REFERENCE_EVIDENCE/);
});
test('reference amounts and source coordinates must be complete exact values', () => {
  for (const path of Object.keys(corpora)) {
    for (const mutate of [
      e => e.expected = null,
      e => e.expected = {},
      e => e.expected.extraResult = '100',
      e => e.expected[Object.keys(e.expected)[0]] = 100,
      e => e.expected[Object.keys(e.expected)[0]] = '1.2',
      e => e.expected[Object.keys(e.expected)[0]] = '-0',
      e => e.input[Object.keys(e.input).find(key => key.endsWith('Minor'))] = 'NaN',
      e => e.sourceRow = 1.5,
      e => e.sourceSheet = '',
    ]) {
      const c = structuredClone(corpora); mutate(c[path].cases[0]);
      assert.throws(() => validatePayrollReferenceEvidence(registry, c), /INVALID_PAYROLL_REFERENCE_EVIDENCE/);
    }
  }
  for (const c of [null, [], undefined]) {
    assert.throws(() => validatePayrollReferenceEvidence(registry, c), /INVALID_PAYROLL_REFERENCE_EVIDENCE/);
  }
});
