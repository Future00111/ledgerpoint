import test from "node:test";
import assert from "node:assert/strict";
import { authorizeMemberChange, CompanyPolicyError, createCompanyBody, updateCompanyBody, type PolicyMembership } from "./companyPolicy";

const member = (user_id: string, role: string | null = "owner", is_active: boolean | null = true): PolicyMembership =>
  ({ company_id: "company-a", user_id, role, is_active });
function change(members: PolicyMembership[], action: "remove" | "change_role" | "add" = "remove", nextRole?: unknown, actorId = "owner-a", targetId = "owner-a") {
  authorizeMemberChange({ companyId: "company-a", actorId, targetId, members, action, nextRole });
}
const failure = (code: string) => (error: unknown) => error instanceof CompanyPolicyError && error.code === code;

test("last active owner cannot leave or be demoted; another active owner permits either", () => {
  const a = member("owner-a"), b = member("owner-b");
  assert.throws(() => change([a]), failure("last_owner"));
  assert.throws(() => change([a], "change_role", "member"), failure("last_owner"));
  assert.doesNotThrow(() => change([a, b]));
  assert.doesNotThrow(() => change([a, b], "change_role", "accountant"));
  assert.doesNotThrow(() => change([a], "change_role", "owner"));
  // The second serialized request must use reloaded rows, not its stale ownership snapshot.
  assert.throws(() => change([b], "remove", undefined, "owner-b", "owner-b"), failure("last_owner"));
});

test("inactive, ambiguous and unknown memberships cannot supply owner authority or protection", () => {
  const a = member("owner-a");
  for (const role of [null, "unknown", "OWNER", "member", "read_only"]) {
    assert.throws(() => change([member("owner-a", role)], "add", "owner", "owner-a", "new-user"), failure("access_denied"));
  }
  for (const active of [false, null]) {
    assert.throws(() => change([member("owner-a", "owner", active)], "add", "owner", "owner-a", "new-user"), failure("access_denied"));
    assert.throws(() => change([a, member("owner-b", "owner", active)]), failure("last_owner"));
  }
  assert.throws(() => change([a, member("owner-a", "member")]), failure("access_denied"));
  assert.throws(() => change([a, member("owner-b"), member("owner-b", "member")]), failure("last_owner"));
  assert.throws(() => change([a, { ...member("owner-b"), company_id: "company-b" }]), failure("access_denied"));
});

test("nonowners may leave themselves but cannot remove others or grant any role", () => {
  for (const role of ["admin", "accountant", "staff", "member", "read_only"]) {
    const rows = [member("owner-a", role), member("owner-b")];
    assert.doesNotThrow(() => change(rows));
    assert.throws(() => change(rows, "remove", undefined, "owner-a", "owner-b"), failure("access_denied"));
    assert.throws(() => change(rows, "change_role", "owner"), failure("access_denied"));
    assert.throws(() => change(rows, "add", "member", "owner-a", "new-user"), failure("access_denied"));
  }
  for (const role of [null, "unknown"]) assert.throws(() => change([member("owner-a", role)]), failure("access_denied"));
});

test("member mutations reject duplicate, missing, ambiguous and invalid-role targets", () => {
  const a = member("owner-a");
  assert.throws(() => change([a], "add", "member"), failure("duplicate_member"));
  assert.throws(() => change([a], "remove", undefined, "owner-a", "missing"), failure("member_missing"));
  assert.throws(() => change([a, member("target", null)], "remove", undefined, "owner-a", "target"), failure("ambiguous_membership"));
  for (const role of [undefined, null, "administrator", {}, ["owner"]]) {
    assert.throws(() => change([a], "add", role, "owner-a", "new"), failure("access_denied"));
  }
  assert.doesNotThrow(() => change([a], "add", "read_only", "owner-a", "new"));
});

test("company request bodies admit current fields and reject mass assignment and malformed types", () => {
  const parsed = createCompanyBody.parse({ name: "  Synthetic Ltd  ", vat_registered: false, vat_return_frequency: "annual", default_vat_rate: "20.00" });
  assert.equal(parsed.name, "Synthetic Ltd");
  assert.equal(updateCompanyBody.safeParse({ city: "London", vat_registered: true }).success, true);
  for (const field of ["id", "created_at", "updated_at", "user_id", "role", "is_active", "vat_frequency", "arbitrary"]) {
    assert.equal(createCompanyBody.safeParse({ name: "Test", [field]: "injected" }).success, false, field);
    assert.equal(updateCompanyBody.safeParse({ [field]: "injected" }).success, false, field);
  }
  for (const value of [null, [], "Test", {}, { name: " " }, { name: 1 }, { name: "Test", vat_registered: "true" }]) {
    assert.equal(createCompanyBody.safeParse(value).success, false);
  }
  assert.equal(updateCompanyBody.safeParse({ name: " " }).success, false);
});
