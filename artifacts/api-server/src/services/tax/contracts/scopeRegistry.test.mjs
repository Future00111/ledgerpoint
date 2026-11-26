import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateCaseRegistry } from './caseRegistry.mjs';
import { validateScopeRegister, resolveDeclaredScopeCase, assessDeclaredScopeInput } from './scopeRegistry.mjs';

const root = new URL('../../../../../../', import.meta.url);
const registry = JSON.parse(readFileSync(new URL('docs/development/tax-payroll-supported-cases.json',root)));
const backlog = JSON.parse(readFileSync(new URL('docs/development/work-backlog.json',root)));
const families = registry.scopeRegister.families;
const clone = () => structuredClone(registry);
const selection = (f,variant=f.variants[0],taxYear='2026-27',entity=f.entities[0]) => ({domain:f.domain,family:f.id,variant,entity,taxYear});

test('every original VAT/payroll/income/company requirement has an exact scope and acceptance mapping', () => {
  const intended = backlog.tasks.filter(t => /^P(?:08-0[1-5]|09-(?:0[1-9]|10)|10-0[1-7]|11-0[1-7])$/.test(t.id));
  assert.equal(intended.length,29);
  assert.deepEqual(families.map(f=>f.backlogTask).sort(),intended.map(t=>t.id).sort());
  for (const task of intended) {
    const f=families.find(f=>f.backlogTask===task.id);
    const hash=createHash('sha256').update(JSON.stringify({id:task.id,description:task.description,acceptance:task.acceptance})).digest('hex');
    assert.equal(f.requirementSha256,hash,task.id);
    assert.equal(f.acceptanceScenario,task.description);
    assert.equal(f.test,'artifacts/api-server/src/services/tax/contracts/scopeRegistry.test.mjs');
    assert.ok(f.requiredInputs.length>=4 && f.requiredOutputs.length>=3);
    assert.deepEqual(Object.keys(f.inputExample),f.requiredInputs);
    assert.deepEqual(f.requiredOutputExample,Object.fromEntries(f.requiredOutputs.map(key=>[key,null])));
  }
  assert.equal(validateCaseRegistry(registry),registry);
});

test('previously missing business combinations, regional/residency choices and accounting frameworks are explicit', () => {
  const required={
    'P08-01':['boxes_2_3','boxes_8_9','signed_credits','zero_rated','reduced_rated','exempt','outside_scope','ni_eu_goods'],
    'P08-02':['standard_invoice','cash','flat_rate','annual','partial_exemption','domestic_reverse_charge','overseas_reverse_charge','imports_postponed_vat','imports_paid_vat','exports','scheme_transition'],
    'P09-01':['midyear_migration','starter','leaver','rejoiner','weekly','monthly','irregular_schedule'],
    'P09-03':['cumulative','non_cumulative','scotland','wales','code_change','refund','tax_code_forms','k_code_limit'],
    'P09-04':['category_change','director_annual','director_alternative','age_status_change','period_boundary'],
    'P09-05':['concurrent_student_and_postgraduate','protected_earnings','statutory_pay','salary_sacrifice','negative_net_pay'],
    'P10-01':['multiple_trades','multiple_property_businesses','mixed_income','employment','savings','dividends','england_northern_ireland','scotland','wales','uk_resident','non_uk_resident','dual_resident','tax_year_boundary'],
    'P10-02':['capital_allowances','trading_losses','property_losses','reliefs','income_interactions','payments_on_account','refund'],
    'P10-07':['non_aligned_period','cessation','corrected_bookkeeping','unknown_submission','prior_year_replay'],
    'P11-02':['marginal_relief','associated_companies','short_period','long_period','year_apportionment'],
    'P11-03':['applicability_review','required_supplement','omitted_supplement','unknown_supplement'],
    'P11-04':['micro_entity','frs102_section_1a','frs105','framework_eligibility','disclosures','prior_year_comparatives','approval'],
    'P11-05':['accounts_taxonomy','computation_taxonomy','taxonomy_version'],
    'P11-06':['unknown_response','amendment','recovery','companies_house_scope_gate'],
  };
  for(const [task,variants]of Object.entries(required))for(const variant of variants)
    assert.ok(families.find(f=>f.backlogTask===task).variants.includes(variant),`${task}:${variant}`);
  assert.deepEqual(registry.scopeRegister.taxYears,['2025-26','2026-27','2027-28']);
  assert.deepEqual(registry.scopeRegister.externalGates,['P08-80','P09-80']);
});

test('every declared variant, entity and year resolves explicitly but cannot calculate or file', () => {
  let count=0;
  for(const f of families)for(const variant of f.variants)for(const entity of f.entities)for(const year of ['2025-26','2026-27','2027-28']){
    const selected=selection(f,variant,year,entity),before=JSON.stringify(registry);
    const actual=resolveDeclaredScopeCase(registry,selected);
    assert.deepEqual(actual,{...f.expected,caseId:`${f.backlogTask}:${variant}:${entity}:${year}`,taskId:f.backlogTask,nextTask:'P04-03'});
    const input=structuredClone(f.inputExample);if(Object.hasOwn(input,'taxYear'))input.taxYear=year;
    const assessment=assessDeclaredScopeInput(registry,selected,input);
    assert.equal(assessment.code,'CASE_NOT_QUALIFIED');assert.equal(assessment.calculation,null);assert.equal(assessment.filingAllowed,false);
    assert.deepEqual(Object.keys(assessment.outputs),f.requiredOutputs);assert.ok(Object.values(assessment.outputs).every(v=>v===null));
    assert.deepEqual(assessment.outputs,f.requiredOutputExample);
    assert.deepEqual(assessment.qualificationMissing,['pinned_year_specific_rule','independent_expected_result','reviewed_engine_adapter']);
    assert.equal(JSON.stringify(registry),before);count++;
  }
  assert.ok(count>800);
});

test('missing and invented inputs fail explicitly for every family instead of receiving defaults', () => {
  for(const f of families){
    for(const key of f.requiredInputs){const input=structuredClone(f.inputExample);delete input[key];
      assert.deepEqual(assessDeclaredScopeInput(registry,selection(f),input),{ok:false,code:'SCOPE_INPUT_FIELDS',missing:[key],unknown:[]});}
    assert.deepEqual(assessDeclaredScopeInput(registry,selection(f),{...f.inputExample,assumedZero:0}),
      {ok:false,code:'SCOPE_INPUT_FIELDS',missing:[],unknown:['assumedZero']});
  }
});

test('unknown years, cross-domain/entity selections and unlisted variant combinations never inherit a case', () => {
  const f=families.find(f=>f.backlogTask==='P10-01'),good=selection(f);
  for(const patch of [{taxYear:'2028-29'},{domain:'payroll'},{entity:'partnership'},
    {family:'missing'},{variant:'mixed_income+foreign_trust'},{variant:'scotland+wales'}])
    assert.deepEqual(resolveDeclaredScopeCase(registry,{...good,...patch}),{ok:false,code:'UNKNOWN_SCOPE_CASE'});
  for(const bad of [null,[],{},Object.create(good),{...good,region:'Scotland'},{...good,taxYear:null}])
    assert.deepEqual(resolveDeclaredScopeCase(registry,bad),{ok:false,code:'INVALID_SCOPE_SELECTOR'});
});

test('accessors and inherited shape cannot execute or masquerade as synthetic inputs', () => {
  const f=families[0];let calls=0;const getter={...f.inputExample};
  Object.defineProperty(getter,f.requiredInputs[0],{enumerable:true,get(){calls++;throw Error('must not execute');}});
  for(const input of [null,[],Object.create(f.inputExample),getter])
    assert.deepEqual(assessDeclaredScopeInput(registry,selection(f),input),{ok:false,code:'INVALID_SCOPE_INPUT'});
  assert.equal(calls,0);
});

test('an explicit input year cannot contradict the selected year', () => {
  const f=families.find(f=>f.backlogTask==='P09-03');
  assert.deepEqual(assessDeclaredScopeInput(registry,selection(f),{...f.inputExample,taxYear:'2025-26'}),
    {ok:false,code:'SCOPE_INPUT_CONTEXT_MISMATCH'});
});

test('removed, duplicated, unknown or falsely qualified declarations invalidate the register', () => {
  for(const mutate of [
    r=>r.scopeRegister.families.pop(),r=>r.scopeRegister.families[1]=structuredClone(r.scopeRegister.families[0]),
    r=>r.scopeRegister.families[0].variants.pop(),r=>r.scopeRegister.families[0].variants.push('invented'),
    r=>r.scopeRegister.families[0].variants.push(r.scopeRegister.families[0].variants[0]),
    r=>r.scopeRegister.families[0].status='supported',r=>r.scopeRegister.families[0].ruleVersion='assumed',
    r=>r.scopeRegister.families[0].expected.calculation={taxMinor:'0'},
    r=>r.scopeRegister.families[0].expectedResultEvidence='author-calculated',
    r=>delete r.scopeRegister.families[0].inputExample.companyId,
    r=>r.scopeRegister.families[0].requiredOutputs=[],r=>r.scopeRegister.taxYears.pop(),
    r=>r.scopeRegister.families[0].requiredOutputExample.boxes='0',
    r=>r.scopeRegister.externalGates=[],r=>r.scopeRegister.supplementInventory.forms.pop(),
    r=>r.sources.vatReturn.url='https://example.com/fake',r=>r.sources.vatReturn.checkedAt='2026-02-30',
  ]){const r=clone();mutate(r);assert.throws(()=>validateScopeRegister(r),/INVALID_SCOPE_REGISTER/);}
});

test('official form discovery and future-year declarations cannot masquerade as reviewed financial fixtures', () => {
  assert.equal(registry.scopeRegister.supplementInventory.status,'applicability_review_required');
  assert.ok(registry.scopeRegister.futureYearPolicy.includes('independently'));
  for(const f of families){assert.equal(f.ruleVersion,null);assert.equal(f.expectedResultEvidence,null);assert.equal(f.status,'unsupported');}
  const ct=families.find(f=>f.backlogTask==='P11-03');
  assert.equal(assessDeclaredScopeInput(registry,selection(ct),ct.inputExample).filingAllowed,false);
});
