import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCaseRegistry, resolveQualifiedCase, prepareCaseFixtureHandoff } from './caseRegistry.mjs';
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
test('discovery provenance cannot silently become reviewed qualification', () => {
  for (const mutate of [
    r => r.cases[0].ruleProvenance.reviewedCalculation = true,
    r => r.cases[0].ruleProvenance.ruleVersion = 'unverified-v1',
    r => r.cases[0].ruleProvenance.role = 'reviewed_rule',
    r => r.cases[0].qualificationEvidence = { reviewed: true },
    r => r.cases[0].deliveryStatus = 'complete',
    r => r.cases[0].scopeStatus = 'excluded',
  ]) {
    const r = clone(); mutate(r);
    assert.throws(() => resolveQualifiedCase(r, r.cases[0].selector), /INVALID_CASE_REGISTRY/);
  }
});
test('examples must exactly identify their case and explicitly reject calculation', () => {
  for (const mutate of [
    r => delete r.cases[0].example,
    r => r.cases[0].example.input.taxYear = '2028-29',
    r => r.cases[0].example.expected.ok = true,
    r => r.cases[0].example.expected.caseId = r.cases[1].id,
    r => r.cases[0].example.expected.code = 'CALCULATION_SUPPORTED',
    r => r.cases[0].example.expected.amount = '100.00',
  ]) {
    const r = clone(); mutate(r);
    assert.throws(() => validateCaseRegistry(r), /INVALID_CASE_REGISTRY/);
  }
});
test('incomplete traceability and invalid source metadata reject the registry', () => {
  for (const mutate of [
    r => r.sources.vat = null,
    r => r.sources.vat.url = 'https://gov.uk.example.com/pretend',
    r => r.sources.vat.url = 'http://www.gov.uk/guidance/vat-guide-notice-700',
    r => r.sources.vat.checkedAt = '2026-02-30',
    r => r.sources.vat.evidence = '',
    r => r.cases[0].requiredInputs = [],
    r => r.cases[0].requiredOutputs = ['amount', 'amount'],
    r => r.cases[0].backlogTasks = ['untraceable'],
    r => r.openQualificationRequirements = [],
    r => r.selectorFields = ['domain'],
  ]) {
    const r = clone(); mutate(r);
    assert.throws(() => validateCaseRegistry(r), /INVALID_CASE_REGISTRY/);
  }
});

test('payroll scope covers every original engine/workflow bullet without promoting support', () => {
  const matrix = registry.payrollPrerequisites;
  assert.deepEqual(matrix.families.map(f => f.backlogTask).sort(), Array.from({length:10}, (_, i) => `P09-${String(i+1).padStart(2,'0')}`));
  assert.ok(matrix.families.every(f => f.status === 'unqualified' && f.expectedResultEvidence === null));
  for (const task of ['P04-02', 'P04-03']) assert.ok(matrix.nextTasks[task].length > 40);
  // Declaring a required interaction does not make it an executable case.
  const employee = registry.cases.find(c => c.id === 'payroll-employee-2026-27').selector;
  assert.deepEqual(resolvePayrollCase(registry, {...employee, employment:'concurrent_student_and_postgraduate'}), {ok:false,code:'UNKNOWN_CASE'});
});
test('missing payroll families, years, scenarios and speculative qualification fail closed', () => {
  for (const mutate of [
    r => delete r.payrollPrerequisites,
    r => r.payrollPrerequisites.families.pop(),
    r => r.payrollPrerequisites.families[1].backlogTask = 'P09-01',
    r => r.payrollPrerequisites.families[0].requiredInputs = [],
    r => r.payrollPrerequisites.families[0].requiredOutputs = [],
    r => r.payrollPrerequisites.families[0].acceptanceScenario = '',
    r => r.payrollPrerequisites.families[0].variants = [],
    r => r.payrollPrerequisites.families[0].status = 'supported',
    r => r.payrollPrerequisites.families[0].expectedResultEvidence = {passed:true},
    r => r.payrollPrerequisites.taxYears.pop(),
    r => r.payrollPrerequisites.taxYears.push('2028-29'),
    r => delete r.payrollPrerequisites.nextTasks['P04-03'],
  ]) { const r=clone(); mutate(r); assert.throws(()=>validateCaseRegistry(r), /INVALID_PAYROLL_PREREQUISITES/); }
});

test('malformed case rows retain the registry validation boundary', () => {
  for (const row of [null, undefined, 42, [], {}]) {
    const r=clone(); r.cases[0]=row;
    assert.throws(()=>validateCaseRegistry(r), /^Error: INVALID_CASE_REGISTRY$/);
  }
});

const corpusFor = row => JSON.parse(readFileSync(new URL(`../../../../../../${row.referenceFixtures.path}`, import.meta.url)));
for (const row of registry.cases.filter(row => row.referenceFixtures)) test(`${row.id}: P04-03 handoff preserves exact official examples and exposes missing execution context`, () => {
  const corpus = corpusFor(row);
  const handoff = prepareCaseFixtureHandoff(registry, row.selector, corpus);
  assert.equal(handoff.ok, false);
  assert.equal(handoff.code, 'CASE_NOT_QUALIFIED');
  assert.equal(handoff.prerequisiteCode, 'REFERENCE_CONTEXT_INCOMPLETE');
  assert.equal(handoff.source.sha256, corpus.source.sha256);
  const prerequisite = handoff.prerequisite;
  assert.equal(prerequisite.nextTask, 'P04-03');
  assert.equal(prerequisite.ruleEvidence, null);
  assert.equal(prerequisite.independentReview, null);
  assert.deepEqual(prerequisite.missingInputs, row.referenceFixtures.plan
    ? ['loanNotice', 'employmentId', 'paymentDate']
    : ['priorTaxDueToDateMinor', 'employmentId', 'paymentDate']);
  assert.deepEqual(prerequisite.missingOutputs, ['ruleVersion', 'calculationSteps', 'warnings']);
  for (const example of prerequisite.examples) {
    assert.deepEqual(example, corpus.cases.find(candidate => candidate.id === example.id));
    for (const field of prerequisite.missingInputs) assert.equal(Object.hasOwn(example.input, field), false);
  }
  if (row.referenceFixtures.plan) {
    assert.deepEqual(prerequisite.examples.map(example => example.expected.deductionMinor), ['0', '100']);
    assert.equal(BigInt(prerequisite.examples[1].input.payMinor) - BigInt(prerequisite.examples[0].input.payMinor), 1n);
  } else {
    assert.equal(prerequisite.examples[1].previousExampleId, prerequisite.examples[0].id);
    assert.equal(prerequisite.examples[0].input.period, 1);
    assert.equal(prerequisite.examples[1].input.period, 2);
  }
  // A consumer cannot mutate the register by preparing the next-task packet.
  prerequisite.examples[0].expected = {};
  assert.deepEqual(row.fixturePrerequisite.examples[0], corpus.cases.find(c => c.id === row.fixturePrerequisite.examples[0].id));
});
test('handoff cannot fill unknown prior PAYE with zero, alter expected pence or change official provenance', () => {
  const original = registry.cases.find(row => row.referenceFixtures?.region === 'scotland');
  for (const mutate of [
    r => r.cases.find(row => row.id === original.id).fixturePrerequisite.examples[0].input.priorTaxDueToDateMinor = '0',
    r => r.cases.find(row => row.id === original.id).fixturePrerequisite.examples[0].expected.taxDueMinor = '2034',
    r => r.cases.find(row => row.id === original.id).fixturePrerequisite.examples[0].sourceRow = 7,
    r => r.cases.find(row => row.id === original.id).fixturePrerequisite.examples[0].input.region = 'wales',
    r => r.cases.find(row => row.id === original.id).fixturePrerequisite.missingInputs = ['employmentId', 'paymentDate'],
    r => r.cases.find(row => row.id === original.id).fixturePrerequisite.ruleEvidence = 'assumed',
    r => r.cases.find(row => row.id === original.id).fixturePrerequisite.independentReview = 'author',
    r => r.cases.find(row => row.id === original.id).fixturePrerequisite.examples.reverse(),
    r => delete r.cases.find(row => row.id === original.id).fixturePrerequisite,
  ]) {
    const r = clone(); mutate(r);
    assert.throws(() => prepareCaseFixtureHandoff(r, original.selector, corpusFor(original)), /INVALID_CASE_REGISTRY|REFERENCE_HANDOFF_SOURCE_MISMATCH/);
  }
});
test('handoff requires the exact source corpus and one unambiguous example identity', () => {
  const row = registry.cases.find(row => row.referenceFixtures?.plan);
  for (const mutate of [
    c => c.taxYear = '2027-28', c => c.source.sha256 = '0'.repeat(64),
    c => c.source.version = '99.0', c => c.source.page = 'https://example.com',
    c => c.cases = [], c => c.cases.push(structuredClone(c.cases[0])),
    c => c.cases[0].expected.deductionMinor = '1',
  ]) {
    const corpus = corpusFor(row); mutate(corpus);
    assert.throws(() => prepareCaseFixtureHandoff(registry, row.selector, corpus), /REFERENCE_HANDOFF_SOURCE_MISMATCH/);
  }
});
test('unmapped tax evidence and unknown cases remain explicit blockers for P04-03', () => {
  const tax = registry.cases.find(row => row.selector.domain === 'income');
  assert.deepEqual(prepareCaseFixtureHandoff(registry, tax.selector, null), {
    ok:false, code:'CASE_NOT_QUALIFIED', caseId:tax.id, prerequisiteCode:'REFERENCE_FIXTURES_MISSING',
  });
  assert.deepEqual(prepareCaseFixtureHandoff(registry, {...tax.selector,taxYear:'2030-31'},null), {ok:false,code:'UNKNOWN_CASE'});
});
