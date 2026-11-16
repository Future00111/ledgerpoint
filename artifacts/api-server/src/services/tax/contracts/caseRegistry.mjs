/** Pure qualification boundary. No financial result, filing authority or IO. */
export const selectorFields = Object.freeze(['domain', 'entity', 'scheme', 'income', 'employment', 'taxYear']);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validSelector = value => plain(value) && Object.keys(value).length === selectorFields.length
  && selectorFields.every(key => Object.hasOwn(value, key) && typeof value[key] === 'string' && value[key].length > 0 && value[key].length <= 128);
const signature = value => JSON.stringify(selectorFields.map(key => value[key]));
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const names = value => Array.isArray(value) && value.length > 0
  && value.every(nonempty) && new Set(value).size === value.length;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
function officialSource(source) {
  if (!plain(source) || !date(source.checkedAt) || !nonempty(source.evidence)) return false;
  try {
    const url = new URL(source.url);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && (url.hostname === 'gov.uk' || url.hostname.endsWith('.gov.uk'));
  } catch { return false; }
}
function validReference(row) {
  if (!Object.hasOwn(row, 'referenceFixtures')) return true;
  const ref = row.referenceFixtures;
  if (!plain(ref) || row.selector.domain !== 'payroll' || row.selector.entity !== 'employer'
    || row.selector.income !== 'employment' || row.selector.scheme !== 'none'
    || ref.qualification !== 'reference_only_engine_not_implemented'
    || typeof ref.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(ref.sourceSha256)
    || typeof ref.sourceVersion !== 'string' || !/^[0-9]+(?:\.[0-9]+)+$/.test(ref.sourceVersion)
    || !Number.isSafeInteger(ref.caseCount) || ref.caseCount <= 0
    || typeof ref.path !== 'string'
    || !/^artifacts\/api-server\/src\/services\/payroll\/contracts\/fixtures\/[a-z0-9.-]+\.json$/.test(ref.path)) return false;
  const loan = Object.hasOwn(ref, 'plan');
  const dimension = loan ? 'plan' : 'region';
  const allowed = loan ? ['plan_1', 'plan_2', 'plan_4', 'plan_5', 'postgraduate'] : ['rest_of_uk', 'scotland', 'wales'];
  const keys = ['path', dimension, 'caseCount', 'qualification', 'sourceSha256', 'sourceVersion', ...(loan ? ['frequencies'] : [])];
  return Object.keys(ref).length === keys.length && keys.every(key => Object.hasOwn(ref, key))
    && allowed.includes(ref[dimension])
    && row.selector.employment === `employee_${loan ? 'loan' : 'paye'}_${ref[dimension]}`
    && (!loan || names(ref.frequencies) && ref.frequencies.every(f => ['weekly', 'fortnightly', 'four_weekly', 'monthly'].includes(f)));
}
// Concrete reference examples expose missing execution context; they never qualify a calculation.
function validFixturePrerequisite(row) {
  const item = row.fixturePrerequisite;
  if (!row.referenceFixtures) return item === undefined;
  if (!plain(item) || item.status !== 'reference_only_engine_not_implemented'
    || item.nextTask !== 'P04-03' || item.owner !== row.owner
    || !nonempty(item.acceptanceScenario) || !nonempty(item.nextExecutableStep)
    || item.ruleEvidence !== null || item.independentReview !== null
    || !names(item.remainingYears) || item.remainingYears.includes(row.selector.taxYear)
    || !names(item.missingInputs) || !names(item.missingOutputs)
    || !Array.isArray(item.examples) || item.examples.length !== 2
    || !Array.isArray(item.missingFixtures) || item.missingFixtures.length === 0) return false;
  const dimension = row.referenceFixtures.plan ? 'plan' : 'region';
  const ids = new Set();
  for (const example of item.examples) {
    if (!plain(example) || !nonempty(example.id) || ids.has(example.id)
      || !nonempty(example.sourceSheet) || !Number.isSafeInteger(example.sourceRow) || example.sourceRow <= 0
      || !plain(example.input) || !plain(example.expected)
      || example.input.taxYear !== row.selector.taxYear
      || example.input[dimension] !== row.referenceFixtures[dimension]
      || Object.keys(example.expected).length === 0
      || Object.values(example.expected).some(value => typeof value !== 'string' || !/^-?(0|[1-9][0-9]*)$/.test(value) || value === '-0')
      || JSON.stringify(item.missingInputs) !== JSON.stringify(row.requiredInputs.filter(key => !Object.hasOwn(example.input, key)))
      || JSON.stringify(item.missingOutputs) !== JSON.stringify(row.requiredOutputs.filter(key => !Object.hasOwn(example.expected, key)))) return false;
    ids.add(example.id);
  }
  if (dimension === 'region' && (item.examples[0].previousExampleId !== null
    || item.examples[1].previousExampleId !== item.examples[0].id
    || item.examples[0].sequenceId !== item.examples[1].sequenceId)) return false;
  return item.missingFixtures.every(fixture => plain(fixture) && nonempty(fixture.id) && nonempty(fixture.scenario))
    && new Set(item.missingFixtures.map(fixture => fixture.id)).size === item.missingFixtures.length;
}

// Scope declaration is an input to fixture/engine work, never calculation authority.
function validPayrollPrerequisites(registry) {
  const matrix = registry.payrollPrerequisites;
  if (!nonempty(registry.registerAcceptanceBoundary) || !plain(matrix)
    || matrix.status !== 'declared_requirements_not_engine_qualification'
    || !Object.hasOwn(registry.sources, matrix.sourceId) || !names(matrix.taxYears)
    || !nonempty(matrix.scopePolicy) || !plain(matrix.nextTasks)
    || !nonempty(matrix.nextTasks['P04-02']) || !nonempty(matrix.nextTasks['P04-03'])
    || !Array.isArray(matrix.families) || matrix.families.length !== 10) return false;
  const ids = new Set(), tasks = new Set();
  for (const family of matrix.families) {
    if (!plain(family) || !nonempty(family.id) || ids.has(family.id)
      || !/^P09-(?:0[1-9]|10)$/.test(family.backlogTask) || tasks.has(family.backlogTask)
      || family.status !== 'unqualified' || !nonempty(family.owner)
      || !names(family.variants) || !names(family.requiredInputs) || !names(family.requiredOutputs)
      || !nonempty(family.acceptanceScenario) || family.expectedResultEvidence !== null) return false;
    ids.add(family.id); tasks.add(family.backlogTask);
  }
  const years = new Set(registry.cases.filter(row => row.selector?.domain === 'payroll').map(row => row.selector.taxYear));
  return matrix.taxYears.length === years.size && matrix.taxYears.every(year => years.has(year));
}
export function validateCaseRegistry(registry) {
  if (!plain(registry) || registry.version !== 1 || registry.enginePolicy !== 'in_house_only'
    || !plain(registry.sources) || !Array.isArray(registry.cases) || registry.cases.length === 0
    || !date(registry.asOf) || !names(registry.openQualificationRequirements)
    || JSON.stringify(registry.selectorFields) !== JSON.stringify(selectorFields)
    || Object.values(registry.sources).some(source => !officialSource(source))) throw new Error('INVALID_CASE_REGISTRY');
  const ids = new Set(), selectors = new Set();
  for (const row of registry.cases) {
    if (!plain(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id) || !validSelector(row.selector)
      || selectors.has(signature(row.selector)) || !['supported', 'unsupported'].includes(row.status)
      || !Array.isArray(row.backlogTasks) || row.backlogTasks.length === 0 || typeof row.owner !== 'string' || !row.owner
      || !plain(row.ruleProvenance) || !Object.hasOwn(registry.sources, row.ruleProvenance.sourceId)) throw new Error('INVALID_CASE_REGISTRY');
    if (!validReference(row) || !validFixturePrerequisite(row)) throw new Error('INVALID_CASE_REGISTRY');
    // This initial contract intentionally cannot authorize future engines from metadata.
    // Promotion requires a separately reviewed adapter tying fixtures to executable rules.
    if (row.status === 'supported') throw new Error('SUPPORTED_CASE_ADAPTER_REQUIRED');
    // Discovery links are not reviewed calculation rules. Reject contradictory
    // metadata and examples before they can be presented as acceptance evidence.
    if (row.deliveryStatus !== 'pending_qualification' || row.scopeStatus !== 'retained_for_qualification'
      || row.qualificationEvidence !== null || row.ruleProvenance.ruleVersion !== null
      || row.ruleProvenance.reviewedCalculation !== false
      || row.ruleProvenance.role !== 'official_discovery_source_not_pinned_calculation_rule'
      || !names(row.backlogTasks) || !row.backlogTasks.every(id => /^P\d{2}-\d{2}$/.test(id))
      || !names(row.requiredInputs) || !names(row.requiredOutputs)
      || !plain(row.example) || !validSelector(row.example.input)
      || signature(row.example.input) !== signature(row.selector)
      || !plain(row.example.expected) || Object.keys(row.example.expected).length !== 3
      || row.example.expected.ok !== false || row.example.expected.code !== 'CASE_NOT_QUALIFIED'
      || row.example.expected.caseId !== row.id) throw new Error('INVALID_CASE_REGISTRY');
    ids.add(row.id); selectors.add(signature(row.selector));
  }
  if (!validPayrollPrerequisites(registry)) throw new Error('INVALID_PAYROLL_PREREQUISITES');
  return registry;
}
export function resolveQualifiedCase(registry, selector) {
  validateCaseRegistry(registry);
  if (!validSelector(selector)) return { ok: false, code: 'INVALID_CASE_SELECTOR' };
  const found = registry.cases.find(row => signature(row.selector) === signature(selector));
  if (!found) return { ok: false, code: 'UNKNOWN_CASE' };
  return { ok: false, code: 'CASE_NOT_QUALIFIED', caseId: found.id };
}

/** Prepare reference evidence for P04-03 review, without filling missing inputs or running an engine.
 * The caller supplies the pinned corpus; repository fixture tests verify its source bytes.
 */
export function prepareCaseFixtureHandoff(registry, selector, corpus) {
  const boundary = resolveQualifiedCase(registry, selector);
  if (boundary.code !== 'CASE_NOT_QUALIFIED') return boundary;
  const row = registry.cases.find(row => row.id === boundary.caseId);
  if (!row.fixturePrerequisite) return { ...boundary, prerequisiteCode: 'REFERENCE_FIXTURES_MISSING' };
  const ref = row.referenceFixtures;
  if (!plain(corpus) || corpus.taxYear !== row.selector.taxYear
    || corpus.status !== 'reference_fixtures_only_not_engine_qualification'
    || corpus.source?.sha256 !== ref.sourceSha256 || corpus.source?.version !== ref.sourceVersion
    || corpus.source?.page !== registry.sources[row.ruleProvenance.sourceId].url
    || !Array.isArray(corpus.cases)
    || row.fixturePrerequisite.examples.some(example => {
      const matches = corpus.cases.filter(candidate => candidate?.id === example.id);
      return matches.length !== 1 || JSON.stringify(matches[0]) !== JSON.stringify(example);
    })) throw new Error('REFERENCE_HANDOFF_SOURCE_MISMATCH');
  return structuredClone({ ...boundary, prerequisiteCode: 'REFERENCE_CONTEXT_INCOMPLETE',
    source: { path: ref.path, sha256: ref.sourceSha256, version: ref.sourceVersion,
      page: corpus.source.page }, prerequisite: row.fixturePrerequisite });
}
