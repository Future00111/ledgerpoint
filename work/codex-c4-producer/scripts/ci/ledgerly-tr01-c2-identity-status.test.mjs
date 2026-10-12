import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertTrustedInvocation,
  identity,
  validateAndPublishIdentity,
} from "./ledgerly-tr01-c2-identity-status.mjs";

const env = {
  GITHUB_REPOSITORY: identity.repository,
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/main",
  GITHUB_REF_PROTECTED: "true",
  GITHUB_WORKFLOW_REF: identity.workflowRef,
  GITHUB_JOB: "identity",
  GITHUB_RUN_ATTEMPT: "1",
  GITHUB_WORKFLOW_SHA: "a".repeat(40),
  GITHUB_SHA: "a".repeat(40),
  TR01_APPROVED_WORKFLOW_SHA: "a".repeat(40),
  TR01_VALIDATION_RESULT: "success",
};
const ref = {
  ref: identity.ref,
  object: { sha: identity.sha, type: "commit" },
};
const commit = {
  sha: identity.sha,
  tree: { sha: identity.tree },
  parents: [{ sha: identity.parent }],
};
function stub(first = ref, object = commit, second = first) {
  const calls = [];
  // GitHub's Create a commit status response does not echo the target SHA.
  const values = [first, object, second, {
    context: identity.context, state: "success",
  }];
  return {
    calls,
    request: async (...args) => {
      calls.push(args);
      return values[calls.length - 1];
    },
  };
}

test("only protected main manual invocation is accepted", () => {
  for (const [key, value] of [
    ["GITHUB_REPOSITORY", "attacker/fork"],
    ["GITHUB_EVENT_NAME", "pull_request"],
    ["GITHUB_REF", identity.ref],
    ["GITHUB_REF_PROTECTED", "false"],
    ["GITHUB_WORKFLOW_REF", "Future00111/ledgerpoint/.github/workflows/other.yml@refs/heads/main"],
    ["GITHUB_JOB", "validate"],
    ["GITHUB_RUN_ATTEMPT", "2"],
    ["TR01_VALIDATION_RESULT", "skipped"],
    ["TR01_VALIDATION_RESULT", "failure"],
    ["TR01_APPROVED_WORKFLOW_SHA", ""],
    ["TR01_APPROVED_WORKFLOW_SHA", "not-a-sha"],
    ["TR01_APPROVED_WORKFLOW_SHA", "b".repeat(40)],
    ["GITHUB_WORKFLOW_SHA", "b".repeat(40)],
    ["GITHUB_SHA", "b".repeat(40)],
  ]) {
    assert.throws(() => assertTrustedInvocation({ ...env, [key]: value }));
  }
});

test("valid immutable identity posts only the named success on exact SHA", async () => {
  const { calls, request } = stub();
  await validateAndPublishIdentity(env, request);
  assert.equal(calls.length, 4);
  assert.equal(calls[0][0], "GET");
  assert.equal(calls[1][0], "GET");
  assert.equal(calls[2][0], "GET");
  assert.deepEqual(calls[3], [
    "POST",
    `/repos/${identity.repository}/statuses/${identity.sha}`,
    {
      state: "success",
      context: identity.context,
      description: "C2 identity and non-DB checks; NOT TI-03 qualification",
    },
  ]);
});

for (const [name, first, object, second] of [
  ["missing branch", null, commit, ref],
  ["wrong ref", { ...ref, ref: "refs/heads/main" }, commit, ref],
  ["wrong branch tip", { ...ref, object: { sha: identity.parent, type: "commit" } }, commit, ref],
  ["noncommit tip", { ...ref, object: { sha: identity.sha, type: "tag" } }, commit, ref],
  ["wrong commit SHA", ref, { ...commit, sha: identity.parent }, ref],
  ["wrong parent", ref, { ...commit, parents: [{ sha: identity.sha }] }, ref],
  ["extra parent", ref, { ...commit, parents: [commit.parents[0], commit.parents[0]] }, ref],
  ["wrong tree", ref, { ...commit, tree: { sha: identity.parent } }, ref],
  ["ref changes mid-run", ref, commit, { ...ref, object: { sha: identity.parent } }],
  ["ref changes type mid-run", ref, commit, { ...ref, object: { sha: identity.sha, type: "tag" } }],
]) {
  test(`${name} cannot publish success`, async () => {
    const { calls, request } = stub(first, object, second);
    await assert.rejects(validateAndPublishIdentity(env, request));
    assert.ok(calls.every(([method]) => method === "GET"));
  });
}

test("API failure cannot publish success", async () => {
  const calls = [];
  await assert.rejects(
    validateAndPublishIdentity(env, async (method) => {
      calls.push(method);
      throw new Error("HTTP 403");
    }),
  );
  assert.deepEqual(calls, ["GET"]);
});

test("a wrong status API response is not accepted", async () => {
  const { calls, request } = stub();
  await assert.rejects(
    validateAndPublishIdentity(env, async (...args) => {
      const result = await request(...args);
      return args[0] === "POST" ? { ...result, context: "other/status" } : result;
    }),
    /did not confirm/,
  );
  assert.equal(calls.filter(([method]) => method === "POST").length, 1);
});

test("untrusted invocation performs no API calls", async () => {
  for (const change of [
    { GITHUB_REF_PROTECTED: "false" },
    { TR01_VALIDATION_RESULT: "skipped" },
    { TR01_APPROVED_WORKFLOW_SHA: "" },
    { GITHUB_WORKFLOW_SHA: "b".repeat(40) },
    { GITHUB_SHA: "b".repeat(40) },
  ]) {
    const { calls, request } = stub();
    await assert.rejects(validateAndPublishIdentity({ ...env, ...change }, request));
    assert.equal(calls.length, 0);
  }
});
