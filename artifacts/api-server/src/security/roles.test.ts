import test from "node:test";
import assert from "node:assert/strict";
import { canWriteCompanyData, isCompanyRole } from "./roles";
import { canWriteDraft } from "../services/financialDrafts/contract";
import { COMPANY_ROLES, SENSITIVE_ACTIONS, canAccessSensitiveData } from "./roles";
import { withPayrollAccess } from "../services/payroll/access/service";
import { withPersonalTaxAccess } from "../services/tax/access/service";
import { readSpecialistAccessHistory } from "../services/payroll/access/membershipHistory";
import { readPayRecord, parsePayRecordCreation } from "../services/payroll/access/payRecord";
import { readPersonalTaxPreparation, exportPersonalTaxPreparation, parsePersonalTaxPreparationCreation } from "../services/tax/access/preparationRecord";
import { requireReadOnlySensitiveStorage } from "../services/payroll/access/recordStorage";
import { requireSensitiveCreationCommand } from "../services/payroll/access/commandProtection";

test("legacy compatibility writes accept only the five known write roles", () => {
  for (const role of ["owner", "admin", "accountant", "staff", "member"]) {
    assert.equal(isCompanyRole(role), true);
    assert.equal(canWriteCompanyData(role), true);
  }
  assert.equal(isCompanyRole("read_only"), true);
  for (const role of ["read_only", "OWNER", " owner", "superadmin", "", null, undefined, {}, ["owner"], 1]) {
    assert.equal(canWriteCompanyData(role), false, JSON.stringify(role));
  }
});

test("sensitive rights separate bookkeeping, records, export, preparation and approval/submission", () => {
  assert.equal(Object.isFrozen(COMPANY_ROLES), true);
  assert.equal(Object.isFrozen(SENSITIVE_ACTIONS), true);
  const expected: Record<string, readonly string[]> = {
    owner: SENSITIVE_ACTIONS,
    payroll_reader: ["payroll.read"],
    payroll_preparer: ["payroll.read", "payroll.export", "payroll.prepare"],
    payroll_approver: ["payroll.read", "payroll.approve"],
    personal_tax_preparer: ["personal_tax.read", "personal_tax.export", "personal_tax.prepare"],
    personal_tax_submitter: ["personal_tax.read", "personal_tax.submit"],
  };
  for (const role of [...COMPANY_ROLES, "OWNER", "payroll_admin", null, undefined, {}, ["owner"]]) {
    for (const action of [...SENSITIVE_ACTIONS, "payroll.file", "payroll.READ", "", null, {}, ["payroll.read"]]) {
      assert.equal(canAccessSensitiveData(role, true, action), typeof role === "string" &&
        typeof action === "string" && (expected[role]?.includes(action) ?? false));
      for (const active of [false, null, undefined, "true", 1]) assert.equal(canAccessSensitiveData(role, active, action), false);
    }
  }
  for (const role of COMPANY_ROLES.filter(role => role.startsWith("payroll_") || role.startsWith("personal_tax_"))) {
    assert.equal(canWriteCompanyData(role), false);
    assert.equal(canWriteDraft(role, true), false);
  }
});

test("sensitive boundary rejects forged request capabilities, cross-company resources and wrong domains before I/O", async () => {
  const company = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
  const input = { company_id: company, actor_id: "synthetic-actor", resource_company_id: company, resource_id: other, action: "payroll.read" };
  let invoked = 0;
  const operation = async () => { invoked++; return "PRIVATE"; };
  for (const bad of [null, [], {}, { ...input, capabilities: ["payroll.read"] }, { ...input, role: "owner" },
    { ...input, resource_company_id: other }, { ...input, action: "personal_tax.read" }, { ...input, actor_id: "actor\nprivate" },
    { ...input, resource_id: "not-a-reference" }, { ...input, action: "payroll.file" }, Object.create(input),
    Object.defineProperty({ ...input }, "action", { get() { throw Error("Getter must never execute"); } })]) {
    await assert.rejects(() => withPayrollAccess(bad, operation), error =>
      error instanceof Error && /^(SENSITIVE_REQUEST_INVALID|SENSITIVE_ACCESS_DENIED)$/.test(error.message));
  }
  await assert.rejects(() => withPersonalTaxAccess(input, operation), /SENSITIVE_REQUEST_INVALID/);
  assert.equal(invoked, 0);
});

test("compatibility permission does not give staff or members native draft authority", () => {
  for (const role of ["staff", "member", "read_only", "unknown", null]) {
    assert.equal(canWriteDraft(role, true), false);
  }
  for (const role of ["owner", "admin", "accountant"]) {
    assert.equal(canWriteDraft(role, true), true);
    for (const active of [false, null, undefined]) assert.equal(canWriteDraft(role, active), false);
  }
});

test("specialist history rejects malformed company and actor identities before database access", async () => {
  for (const [company, actor] of [['invalid-company', 'synthetic-owner'],
    ['11111111-1111-4111-8111-111111111111', 'synthetic@example.test'],
    ['11111111-1111-4111-8111-111111111111', ''],
    ['11111111-1111-4111-8111-111111111111', 'owner\nprivate']]) {
    await assert.rejects(() => readSpecialistAccessHistory(company!, actor!), /SENSITIVE_REQUEST_INVALID/);
  }
});

test("native pay reads reject malformed path identities before database access", async () => {
  const company = '11111111-1111-4111-8111-111111111111', record = '22222222-2222-4222-8222-222222222222';
  for (const [scope, actor, id] of [['invalid', 'synthetic-owner', record], [company, 'synthetic@example.test', record],
    [company, 'synthetic-owner', '00000000-0000-0000-0000-000000000000'], [company, 'synthetic-owner', '../other-record']]) {
    await assert.rejects(() => readPayRecord(scope!, actor!, id!), /SENSITIVE_REQUEST_INVALID/);
  }
});

test("native personal tax reads and exports reject malformed scope and actor identities before database access", async () => {
  const company = '11111111-1111-4111-8111-111111111111', record = '22222222-2222-4222-8222-222222222222';
  for (const [scope, actor, id] of [['invalid', 'synthetic-owner', record], [company, 'synthetic@example.test', record],
    [company, 'synthetic-owner', '00000000-0000-0000-0000-000000000000'], [company, 'synthetic-owner', '../other-record']]) {
    for (const operation of [readPersonalTaxPreparation, exportPersonalTaxPreparation])
      await assert.rejects(() => operation(scope!, actor!, id!), /SENSITIVE_REQUEST_INVALID/);
  }
});

test("shared sensitive record storage accepts only closed relations and canonical runtime read-only protection", async () => {
  const safe = { actor: 'ledgerly_api', owner: 'ledgerly_canonical_owner', relkind: 'r', can_read: true,
    can_mutate: false, can_insert_column: false, can_update_column: false };
  const calls: unknown[] = [];
  const context = (rows: unknown[]) => ({ query: async (sql: string, values: unknown[]) => { calls.push({ sql, values }); return { rows, rowCount: rows.length }; } }) as any;
  for (const store of ['employee_pay_records', 'personal_tax_preparations'] as const) {
    await requireReadOnlySensitiveStorage(context([safe]), store);
    assert.deepEqual((calls.at(-1) as any).values, [store]);
    assert.match((calls.at(-1) as any).sql, /c\.relname=\$1/);
    for (const changed of [{ actor: 'another_role' }, { owner: 'ledgerly_api' }, { relkind: 'v' }, { can_read: false },
      { can_mutate: true }, { can_insert_column: true }, { can_update_column: true }]) {
      await assert.rejects(() => requireReadOnlySensitiveStorage(context([{ ...safe, ...changed }]), store), /SENSITIVE_OPERATION_UNAVAILABLE/);
    }
    for (const rows of [[], [safe, safe]]) await assert.rejects(() => requireReadOnlySensitiveStorage(context(rows), store), /SENSITIVE_OPERATION_UNAVAILABLE/);
  }
  const before = calls.length;
  for (const store of ['companies', 'public.personal_tax_preparations', "personal_tax_preparations'; DROP TABLE companies", null, {}])
    await assert.rejects(() => requireReadOnlySensitiveStorage(context([safe]), store as any), /SENSITIVE_OPERATION_UNAVAILABLE/);
  assert.equal(calls.length, before);
});

test("pay creation validates exact canonical UUID, Gregorian date and bigint intent without money rounding", () => {
  const body = { id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', employee_id: '00000000-0000-0000-0000-000000000001',
    effective_from: '2000-02-29', annual_salary_pence: '9223372036854775807' };
  assert.deepEqual(parsePayRecordCreation(body), { ...body, id: body.id.toLowerCase() });
  for (const date of ['0001-01-01', '2024-02-29', '9999-12-31']) {
    assert.equal(parsePayRecordCreation({ ...body, effective_from: date, annual_salary_pence: '9007199254740993' }).annual_salary_pence, '9007199254740993');
  }
  assert.equal(parsePayRecordCreation({ ...body, annual_salary_pence: '0' }).annual_salary_pence, '0');
});

test("pay creation rejects extra authority, malformed and inherited fields, invalid dates and noncanonical amounts", () => {
  const body = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', employee_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    effective_from: '2026-04-06', annual_salary_pence: '4800000' };
  const invalid: unknown[] = [null, [], {}, Object.create(body), { ...body, role: 'owner' }, { ...body, currency: 'GBP' },
    { ...body, company_id: body.id }, { ...body, actor_id: 'owner' }, { ...body, capabilities: ['payroll.prepare'] },
    { ...body, id: '00000000-0000-0000-0000-000000000000' }, { ...body, employee_id: 'private@example.test' },
    Object.defineProperty({ ...body }, 'id', { get() { throw Error('Getter must not execute'); } })];
  for (const date of ['0000-01-01', '1900-02-29', '2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00',
    '2026-4-6', '2026-04-06T00:00:00Z', ' 2026-04-06', '10000-01-01', null, 20260406]) invalid.push({ ...body, effective_from: date });
  for (const amount of [0, 1, '01', '-1', '-0', '+1', '1.0', '1e2', ' 1', '9223372036854775808', '99999999999999999999', null, {}]) {
    invalid.push({ ...body, annual_salary_pence: amount });
  }
  for (const key of Object.keys(body)) { const missing = { ...body } as Record<string, unknown>; delete missing[key]; invalid.push(missing); }
  for (const value of invalid) assert.throws(() => parsePayRecordCreation(value), /SENSITIVE_REQUEST_INVALID/);
});

test("tax creation validates exact native UUID, integer storage year and bigint string without coercion", () => {
  const body = { id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', taxpayer_id: '00000000-0000-0000-0000-000000000001',
    tax_year_start: 2026, employment_income_pence: '9223372036854775807' };
  assert.deepEqual(parsePersonalTaxPreparationCreation(body), { ...body, id: body.id.toLowerCase() });
  for (const year of [1, 2026, 9998]) for (const amount of ['0', '9007199254740993', '9223372036854775807'])
    assert.deepEqual(parsePersonalTaxPreparationCreation({ ...body, tax_year_start: year, employment_income_pence: amount }),
      { ...body, id: body.id.toLowerCase(), tax_year_start: year, employment_income_pence: amount });
});

test("tax creation rejects extra authority/origin, inherited or accessor fields, invalid years and noncanonical amounts", () => {
  const body = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', taxpayer_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tax_year_start: 2026, employment_income_pence: '1' };
  const bad: unknown[] = [null, [], {}, Object.create(body), { ...body, currency: 'GBP' }, { ...body, role: 'owner' },
    { ...body, company_id: body.id }, { ...body, actor_id: 'synthetic' }, { ...body, capabilities: ['personal_tax.prepare'] },
    { ...body, created_by_tax_command: true }, { ...body, id: '00000000-0000-0000-0000-000000000000' }, { ...body, taxpayer_id: 'private@example.test' },
    Object.defineProperty({ ...body }, 'tax_year_start', { get() { throw Error('Getter must never execute'); } })];
  for (const year of [0, -1, 9999, 10000, 2026.5, '2026', null, undefined, true, NaN, Infinity, {}]) bad.push({ ...body, tax_year_start: year });
  for (const amount of [0, 1, '01', '-1', '-0', '+1', '1.0', '1e2', ' 1', '1 ', '9223372036854775808', null, {}]) bad.push({ ...body, employment_income_pence: amount });
  for (const key of Object.keys(body)) { const missing = { ...body } as Record<string, unknown>; delete missing[key]; bad.push(missing); }
  for (const value of bad) assert.throws(() => parsePersonalTaxPreparationCreation(value), /SENSITIVE_REQUEST_INVALID/);
});

test("creation command protection uses a closed signature map and refuses unsafe owner, ACL, path and result metadata", async () => {
  const safe = { owner: 'ledgerly_canonical_owner', prosecdef: true, proretset: false, prokind: 'f', proconfig: ['search_path=pg_catalog'],
    text_result: true, can_execute: true, unsafe_acl: false };
  const calls: any[] = [];
  const context = (rows: unknown[]) => ({ query: async (sql: string, values: unknown[]) => { calls.push({ sql, values }); return { rows, rowCount: rows.length }; } }) as any;
  for (const [command, signature] of [['pay', 'public.ledgerly_create_employee_pay_record(uuid,text,uuid,uuid,date,bigint)'],
    ['personal_tax', 'public.ledgerly_create_personal_tax_preparation(uuid,text,uuid,uuid,integer,bigint)']] as const) {
    await requireSensitiveCreationCommand(context([safe]), command); assert.deepEqual(calls.at(-1).values, [signature]); assert.match(calls.at(-1).sql, /to_regprocedure\(\$1\)/);
    for (const changed of [{ owner: 'ledgerly_api' }, { prosecdef: false }, { proretset: true }, { prokind: 'p' }, { text_result: false },
      { can_execute: false }, { unsafe_acl: true }, { proconfig: null }, { proconfig: ['search_path=public'] }, { proconfig: ['search_path=pg_catalog', 'role=ledgerly_api'] }])
      await assert.rejects(() => requireSensitiveCreationCommand(context([{ ...safe, ...changed }]), command), /SENSITIVE_OPERATION_UNAVAILABLE/);
    for (const rows of [[], [safe, safe]]) await assert.rejects(() => requireSensitiveCreationCommand(context(rows), command), /SENSITIVE_OPERATION_UNAVAILABLE/);
  }
  const before = calls.length;
  for (const command of ['constructor', 'public.other()', 'personal_tax;DROP TABLE companies', '', null, {}])
    await assert.rejects(() => requireSensitiveCreationCommand(context([safe]), command as any), /SENSITIVE_OPERATION_UNAVAILABLE/);
  assert.equal(calls.length, before);
});
