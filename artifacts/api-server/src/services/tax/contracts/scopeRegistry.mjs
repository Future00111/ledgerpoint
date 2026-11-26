/** Declaration/qualification handoff only. No calculation, persistence, or filing adapter. */
import { isDeepStrictEqual } from 'node:util';

const ownRecord = value => value !== null && typeof value === 'object'
  && [Object.prototype, null].includes(Object.getPrototypeOf(value))
  && Reflect.ownKeys(value).every(key => typeof key === 'string'
    && Object.getOwnPropertyDescriptor(value, key)?.enumerable
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
const names = value => Array.isArray(value) && value.length > 0
  && value.every(item => typeof item === 'string' && item.length > 0 && item.length <= 256)
  && new Set(value).size === value.length;
const fields = ['domain', 'family', 'variant', 'entity', 'taxYear'];
const years = ['2025-26', '2026-27', '2027-28'];
const tasks = ['P08-01','P08-02','P08-03','P08-04','P08-05',
  'P09-01','P09-02','P09-03','P09-04','P09-05','P09-06','P09-07','P09-08','P09-09','P09-10',
  'P10-01','P10-02','P10-03','P10-04','P10-05','P10-06','P10-07',
  'P11-01','P11-02','P11-03','P11-04','P11-05','P11-06','P11-07'];
const variantsByTask = Object.freeze({
  "P08-01": "nine_boxes boxes_2_3 boxes_8_9 source_adjustments signed_credits zero_rated reduced_rated exempt outside_scope ni_eu_goods",
  "P08-02": "standard_invoice cash flat_rate annual partial_exemption domestic_reverse_charge overseas_reverse_charge imports_postponed_vat imports_paid_vat exports scheme_transition",
  "P08-03": "period_lock late_entry adjustment correction prior_snapshot preserved_source",
  "P08-04": "taxpayer_authority agent_authority obligations submit liabilities payment_visibility receipt rejection unknown_response fraud_headers sandbox production_access",
  "P08-05": "review warnings approve signoff receipt_evidence amendment_guidance",
  "P09-01": "employee director starter leaver rejoiner midyear_migration weekly fortnightly four_weekly monthly irregular_schedule effective_change",
  "P09-02": "salary hours overtime bonus arrears holiday_absence adjustment benefit pay_period_cutoff effective_change",
  "P09-03": "cumulative non_cumulative rest_of_uk scotland wales code_change irregular_pay refund tax_code_forms k_code_limit multiple_employments",
  "P09-04": "employee employer category_change director_annual director_alternative irregular_earnings_period age_status_change employee_employer_thresholds period_boundary",
  "P09-05": "student_plan_1 student_plan_2 student_plan_4 student_plan_5 postgraduate concurrent_student_and_postgraduate protected_earnings statutory_pay statutory_recovery other_deductions salary_sacrifice negative_net_pay effective_date eligibility_limit",
  "P09-06": "assessment enrolment postponement opt_out re_enrolment scheme_contributions scheme_specific_output specialist_review",
  "P09-07": "preview approve finalise lock correction duplicate_retry net_pay_reconciliation employer_cost_reconciliation liability_reconciliation journal_duplicate",
  "P09-08": "payslip employer_report p45 p60 payment_file year_end access_separation delivery opening_values",
  "P09-09": "fps eps receipt rejection unknown_response amendment notice late_reporting correction verified_receipt",
  "P09-10": "ordinary_cycle correction_cycle tax_year_rollover prior_year_replay 2027_28_readiness",
  "P10-01": "sole_trade uk_property employment savings dividends mixed_income multiple_trades multiple_property_businesses england_northern_ireland scotland wales uk_resident non_uk_resident dual_resident tax_year_boundary",
  "P10-02": "disallowable_expenses capital_allowances trading_losses property_losses reliefs class_2_ni class_4_ni income_interactions payments_on_account cash_basis traditional_accounting refund negative_profit",
  "P10-03": "book_profit tax_adjustments personal_liability source_evidence unsupported_income_relief correction",
  "P10-04": "digital_records per_business_obligations quarterly_update annual_adjustments review finalisation amendment taxpayer_authority agent_authority",
  "P10-05": "matching_calculation discrepancy unknown_status revised_calculation finalisation_block",
  "P10-06": "fraud_headers sandbox_tests production_access intended_tax_year access_window_recheck",
  "P10-07": "year_change non_aligned_period loss cessation corrected_bookkeeping rejection unknown_submission immutable_receipt prior_year_replay",
  "P11-01": "company_identity accounting_period book_to_tax disallowable_costs capital_allowances trading_losses reliefs",
  "P11-02": "main_rate small_profits marginal_relief associated_companies short_period long_period year_apportionment rate_change",
  "P11-03": "ct600_main applicability_review required_supplement omitted_supplement unknown_supplement disclosure_validation",
  "P11-04": "small_limited_company micro_entity frs102_section_1a frs105 framework_eligibility disclosures prior_year_comparatives approval ledger_reconciliation",
  "P11-05": "accounts_taxonomy computation_taxonomy taxonomy_version tag_contexts readable_copy validation_result",
  "P11-06": "authority validate submit receipt rejection unknown_response amendment recovery companies_house_scope_gate",
  "P11-07": "accounts_tax_filing_reconciliation period_boundaries rounding_boundaries professional_review rule_update form_update taxonomy_update prior_year_replay",
});
const expected = { ok: false, code: 'CASE_NOT_QUALIFIED', calculation: null, filingAllowed: false };
const fail = () => { throw new Error('INVALID_SCOPE_REGISTER'); };
const same = (a,b) => isDeepStrictEqual(a,b);

function officialDiscovery(source) {
  if (!ownRecord(source) || typeof source.evidence !== 'string' || !source.evidence.trim()
    || typeof source.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt)) return false;
  try { const u = new URL(source.url); return u.protocol === 'https:' && !u.username && !u.password && !u.port
    && (u.hostname === 'gov.uk' || u.hostname.endsWith('.gov.uk'))
    && new Date(source.checkedAt).toISOString().slice(0,10) === source.checkedAt; } catch { return false; }
}

export function validateScopeRegister(registry) {
  const scope = registry?.scopeRegister;
  if (!ownRecord(scope) || scope.version !== 1 || scope.status !== 'declared_scope_not_engine_qualification'
    || scope.sourceBacklog !== 'docs/development/work-backlog.json' || scope.sourceBulletCount !== 92
    || !same(scope.taxYears,years) || !same(scope.selectionFields,fields)
    || !same(scope.externalGates,['P08-80','P09-80'])
    || !['combinationPolicy','futureYearPolicy','existingAccountingBoundary','scopeBoundary'].every(k => typeof scope[k] === 'string' && scope[k].trim())
    || !ownRecord(scope.qualificationHandoff) || !['P04-03','P02-04','P04-02'].every(k => typeof scope.qualificationHandoff[k] === 'string' && scope.qualificationHandoff[k].trim())
    || !Array.isArray(scope.families) || scope.families.length !== tasks.length) fail();
  const ids = new Set(), seenTasks = new Set();
  for (const f of scope.families) {
    if (!ownRecord(f) || typeof f.id !== 'string' || !/^[a-z][a-z0-9_]+$/.test(f.id)
      || ids.has(f.id) || !tasks.includes(f.backlogTask) || seenTasks.has(f.backlogTask)
      || !['vat','payroll','income','corporation'].includes(f.domain)
      || ({P08:'vat',P09:'payroll',P10:'income',P11:'corporation'})[f.backlogTask.slice(0,3)] !== f.domain
      || f.owner !== 'coordinator' || f.status !== 'unsupported' || f.scopeStatus !== 'retained_for_qualification'
      || f.ruleVersion !== null || f.expectedResultEvidence !== null || f.nextTask !== 'P04-03'
      || typeof f.requirementSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(f.requirementSha256)
      || !ownRecord(registry.sources) || !Object.hasOwn(registry.sources,f.sourceId) || !officialDiscovery(registry.sources[f.sourceId])
      || !names(f.entities) || !names(f.variants) || !same(f.variants,variantsByTask[f.backlogTask].split(' '))
      || !names(f.requiredInputs) || !names(f.requiredOutputs)
      || !ownRecord(f.inputExample) || !same(Object.keys(f.inputExample).sort(),[...f.requiredInputs].sort())
      || !ownRecord(f.requiredOutputExample)
      || !same(f.requiredOutputExample,Object.fromEntries(f.requiredOutputs.map(key => [key,null])))
      || !same(f.expected,expected) || typeof f.acceptanceScenario !== 'string' || !f.acceptanceScenario.trim()
      || typeof f.exampleMeaning !== 'string' || !f.exampleMeaning.trim()
      || f.test !== 'artifacts/api-server/src/services/tax/contracts/scopeRegistry.test.mjs') fail();
    const entityChoices = {vat:['sole_trader','small_limited_company'],payroll:['employer'],income:['individual'],corporation:['small_limited_company']};
    if (!same(f.entities,entityChoices[f.domain])) fail();
    ids.add(f.id); seenTasks.add(f.backlogTask);
  }
  const inventory = scope.supplementInventory;
  if (!ownRecord(inventory) || inventory.sourceId !== 'ctForms' || !Object.hasOwn(registry.sources,'ctForms')
    || inventory.status !== 'applicability_review_required' || !names(inventory.forms)
    || !same(inventory.forms,['CT600A','CT600B','CT600C','CT600D','CT600E','CT600F','CT600H','CT600I','CT600J','CT600K','CT600L','CT600M','CT600N','CT600P'])
    || typeof inventory.unknownFormPolicy !== 'string' || !inventory.unknownFormPolicy.trim()) fail();
  return scope;
}

/** Exact selection: no defaults, fallback to nearby tax years, or implicit combinations. */
export function resolveDeclaredScopeCase(registry, selection) {
  const scope = validateScopeRegister(registry);
  if (!ownRecord(selection) || !same(Object.keys(selection).sort(),[...fields].sort())
    || fields.some(key => typeof selection[key] !== 'string' || !selection[key] || selection[key].length > 256))
    return { ok:false, code:'INVALID_SCOPE_SELECTOR' };
  const family = scope.families.find(f => f.id === selection.family);
  if (!family || family.domain !== selection.domain || !family.entities.includes(selection.entity)
    || !family.variants.includes(selection.variant) || !scope.taxYears.includes(selection.taxYear))
    return { ok:false, code:'UNKNOWN_SCOPE_CASE' };
  return { ...expected, caseId:[family.backlogTask,selection.variant,selection.entity,selection.taxYear].join(':'),
    taskId:family.backlogTask, nextTask:family.nextTask };
}

/** Validate the declared input shape; it deliberately does not qualify values as statutory inputs. */
export function assessDeclaredScopeInput(registry, selection, input) {
  const boundary = resolveDeclaredScopeCase(registry, selection);
  if (boundary.code !== 'CASE_NOT_QUALIFIED') return boundary;
  const family = registry.scopeRegister.families.find(f => f.backlogTask === boundary.taskId);
  if (!ownRecord(input)) return {ok:false,code:'INVALID_SCOPE_INPUT'};
  const missing = family.requiredInputs.filter(key => !Object.hasOwn(input,key));
  const unknown = Object.keys(input).filter(key => !family.requiredInputs.includes(key));
  if (missing.length || unknown.length) return {ok:false,code:'SCOPE_INPUT_FIELDS',missing,unknown};
  if (Object.hasOwn(input,'taxYear') && input.taxYear !== selection.taxYear)
    return {ok:false,code:'SCOPE_INPUT_CONTEXT_MISMATCH'};
  // Null is intentional: missing qualification must never be presented as zero tax or no liability.
  return { ...boundary, outputs:Object.fromEntries(family.requiredOutputs.map(key => [key,null])),
    qualificationMissing:['pinned_year_specific_rule','independent_expected_result','reviewed_engine_adapter'] };
}
