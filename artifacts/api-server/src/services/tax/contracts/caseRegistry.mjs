/** Pure qualification boundary. No financial result, filing authority or IO. */
export const selectorFields = Object.freeze(['domain', 'entity', 'scheme', 'income', 'employment', 'taxYear']);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validSelector = value => plain(value) && Object.keys(value).length === selectorFields.length
  && selectorFields.every(key => Object.hasOwn(value, key) && typeof value[key] === 'string' && value[key].length > 0 && value[key].length <= 128);
const signature = value => JSON.stringify(selectorFields.map(key => value[key]));
export function validateCaseRegistry(registry) {
  if (!plain(registry) || registry.version !== 1 || registry.enginePolicy !== 'in_house_only'
    || !plain(registry.sources) || !Array.isArray(registry.cases) || registry.cases.length === 0) throw new Error('INVALID_CASE_REGISTRY');
  const ids = new Set(), selectors = new Set();
  for (const row of registry.cases) {
    if (!plain(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id) || !validSelector(row.selector)
      || selectors.has(signature(row.selector)) || !['supported', 'unsupported'].includes(row.status)
      || !Array.isArray(row.backlogTasks) || row.backlogTasks.length === 0 || typeof row.owner !== 'string' || !row.owner
      || !plain(row.ruleProvenance) || !Object.hasOwn(registry.sources, row.ruleProvenance.sourceId)) throw new Error('INVALID_CASE_REGISTRY');
    // This initial contract intentionally cannot authorize future engines from metadata.
    // Promotion requires a separately reviewed adapter tying fixtures to executable rules.
    if (row.status === 'supported') throw new Error('SUPPORTED_CASE_ADAPTER_REQUIRED');
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
