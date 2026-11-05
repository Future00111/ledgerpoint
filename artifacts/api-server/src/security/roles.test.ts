import test from "node:test";
import assert from "node:assert/strict";
import { canWriteCompanyData, isCompanyRole } from "./roles";
import { canWriteDraft } from "../services/financialDrafts/contract";

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

test("compatibility permission does not give staff or members native draft authority", () => {
  for (const role of ["staff", "member", "read_only", "unknown", null]) {
    assert.equal(canWriteDraft(role, true), false);
  }
  for (const role of ["owner", "admin", "accountant"]) {
    assert.equal(canWriteDraft(role, true), true);
    for (const active of [false, null, undefined]) assert.equal(canWriteDraft(role, active), false);
  }
});
