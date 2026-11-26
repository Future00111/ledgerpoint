import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolvePayrollCase} from './caseBoundary.mjs';

const json = path => JSON.parse(readFileSync(new URL(path,import.meta.url)));
const example = json('./fixtures/employee-month-one-2026-27.json');

test('month-one employee reference ties taxable gross and PAYE to the pinned HMRC row',()=>{
  const pack = json('./fixtures/hmrc-paye-2026-27-v1.1.json');
  const row = pack.cases.find(item=>item.id === example.payeExampleId);
  assert.deepEqual(row.input,{taxYear:example.taxYear,region:'rest_of_uk',frequency:example.frequency,period:example.period,
    taxCode:example.taxCode,week1Month1:null,grossPayMinor:example.grossMinor,taxablePayToDateMinor:example.grossMinor});
  assert.equal(row.expected.taxDueMinor,example.payeMinor);
  assert.equal(row.expected.taxDueToDateMinor,example.payeMinor);
});

test('month-one category A example reconciles employee deductions and separate employer NI in exact pence',()=>{
  const gross = BigInt(example.grossMinor);
  assert.equal(example.niCategory,'A');
  assert.ok(gross > 104800n && gross <= 418900n);
  // Both contributions are exact whole pennies here. No rounding rule is exercised.
  assert.equal((gross-104800n)*8n,BigInt(example.employeeNiMinor)*100n);
  assert.equal((gross-41700n)*15n,BigInt(example.employerNiMinor)*100n);
  assert.equal(gross-BigInt(example.payeMinor)-BigInt(example.employeeNiMinor),BigInt(example.netMinor));
  const registry = json('../../../../../../docs/development/tax-payroll-supported-cases.json');
  const employee = registry.cases.find(row=>row.id==='payroll-employee-2026-27');
  assert.equal(example.status,'offline_reference_only');
  assert.equal(resolvePayrollCase(registry,employee.selector).code,'CASE_NOT_QUALIFIED');
});
