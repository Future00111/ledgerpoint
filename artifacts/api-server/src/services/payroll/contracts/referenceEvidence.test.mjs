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
    row => delete row.referenceFixtures.sourceSha256,
    row => row.referenceFixtures.sourceSha256 = 'not-a-digest',
    row => row.referenceFixtures.sourceSha256 = [row.referenceFixtures.sourceSha256],
    row => delete row.referenceFixtures.sourceVersion,
    row => row.referenceFixtures.sourceVersion = 'unreviewed',
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

test('PAYE reference coverage preserves ordered workbook sequence lineage', () => {
  const path = registry.cases.find(row => row.referenceFixtures?.region).referenceFixtures.path;
  for (const mutate of [
    c => c.cases[0].previousExampleId = 'missing',
    c => c.cases[1].previousExampleId = null,
    c => c.cases[1].previousExampleId = c.cases.find(e => e.input.region === 'wales').id,
    c => c.cases[1].sequenceId = 'unrelated/sequence',
    c => c.cases[1].sourceSheet = 'another_sheet',
    c => c.cases[1].sourceWorkbook = 'missing.xlsx',
    c => c.cases[1].sourceWorkbook = c.source.workbooks.find(b => b.region === 'wales').path,
    c => c.cases[1].input.frequency = 'weekly',
    c => c.cases[1].input.week1Month1 = 'WM1',
    c => delete c.cases[1].input.week1Month1,
    c => c.cases[1].sourceRow = c.cases[0].sourceRow,
    c => [c.cases[0], c.cases[1]] = [c.cases[1], c.cases[0]],
    c => delete c.source.workbooks,
    c => c.source.workbooks.push({...c.source.workbooks[0]}),
    c => c.source.workbooks[0].sha256 = 'unverified',
  ]) {
    const c = structuredClone(corpora); mutate(c[path]);
    assert.throws(() => validatePayrollReferenceEvidence(registry, c), /INVALID_PAYROLL_REFERENCE_EVIDENCE/);
  }
});

test('independent PAYE sequences can interleave without losing their own lineage', () => {
  const path = registry.cases.find(row => row.referenceFixtures?.region).referenceFixtures.path;
  const c = structuredClone(corpora);
  const sequences = Map.groupBy(c[path].cases, e => e.sequenceId);
  c[path].cases = [];
  while ([...sequences.values()].some(rows => rows.length)) {
    for (const rows of sequences.values()) if (rows.length) c[path].cases.push(rows.shift());
  }
  assert.deepEqual(validatePayrollReferenceEvidence(registry, c), {referenceCases:8, qualifiedCases:0});
});


test('registered reference identity rejects substituted valid hashes and source versions', () => {
  for (const path of Object.keys(corpora)) {
    for (const mutate of [
      c => c.source.sha256 = 'f'.repeat(64),
      c => c.source.version = '99.0',
      c => delete c.source.version,
    ]) {
      const c = structuredClone(corpora); mutate(c[path]);
      assert.throws(() => validatePayrollReferenceEvidence(registry, c), /INVALID_PAYROLL_REFERENCE_EVIDENCE/);
    }
    const r = structuredClone(registry);
    const rows = r.cases.filter(row => row.referenceFixtures?.path === path);
    for (const row of rows) row.referenceFixtures.sourceSha256 = 'f'.repeat(64);
    assert.throws(() => validatePayrollReferenceEvidence(r, corpora), /INVALID_PAYROLL_REFERENCE_EVIDENCE/);
  }
});
