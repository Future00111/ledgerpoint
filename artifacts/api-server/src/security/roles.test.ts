import test from "node:test";
import assert from "node:assert/strict";
import { canWriteCompanyData, isCompanyRole } from "./roles";
import { canWriteDraft } from "../services/financialDrafts/contract";
import { COMPANY_ROLES, SENSITIVE_ACTIONS, canAccessSensitiveData } from "./roles";
import { withPayrollAccess } from "../services/payroll/access/service";
import { withPersonalTaxAccess } from "../services/tax/access/service";
import { readSpecialistAccessHistory } from "../services/payroll/access/membershipHistory";
import { readPayRecord } from "../services/payroll/access/payRecord";

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
