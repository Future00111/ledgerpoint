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
  return registry;
}
export function resolveQualifiedCase(registry, selector) {
  validateCaseRegistry(registry);
  if (!validSelector(selector)) return { ok: false, code: 'INVALID_CASE_SELECTOR' };
  const found = registry.cases.find(row => signature(row.selector) === signature(selector));
  if (!found) return { ok: false, code: 'UNKNOWN_CASE' };
  return { ok: false, code: 'CASE_NOT_QUALIFIED', caseId: found.id };
}
