import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertTrustedInvocation,
  identity,
  validateAndPublishIdentity,
} from "./ledgerly-tr01-c3-identity-status.mjs";

const workflowPath = fileURLToPath(
  new URL("../../.github/workflows/ledgerly-tr01-c3-identity-status.yml", import.meta.url),
);
const workflowSource = await readFile(workflowPath, "utf8");
const validationRoot = process.env.LEDGERLY_C3_VALIDATION_ROOT;

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
  TR01_C3_APPROVED_WORKFLOW_SHA: "a".repeat(40),
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

function stub(first = ref, object = commit, second = first, status = {
  context: identity.context,
  state: "success",
}) {
  const calls = [];
  // Create-a-commit-status does not echo the target SHA.
  const values = [first, object, second, status];
  return {
    calls,
    request: async (...args) => {
      calls.push(args);
      return values[calls.length - 1];
    },
  };
}

test("the status producer is pinned to the exact C3 review-package identity", () => {
  assert.deepEqual(identity, {
    repository: "Future00111/ledgerpoint",
    workflowRef: "Future00111/ledgerpoint/.github/workflows/ledgerly-tr01-c3-identity-status.yml@refs/heads/main",
    ref: "refs/heads/tr01/implementation-identity-successor-c3",
    sha: "1c26be19295902a38e1939b56ff99ae9a195d3de",
    parent: "e7f43c70e45c068971aeb241ce1b01a30bb01e37",
    tree: "beb56d35539d81636b609602b3c57d167bc88888",
    context: "tr01/c3-identity-validation",
  });
});

test("only the approved protected-main manual invocation is trusted", () => {
  for (const [key, value] of [
    ["GITHUB_REPOSITORY", "attacker/fork"],
    ["GITHUB_EVENT_NAME", "pull_request"],
    ["GITHUB_REF", identity.ref],
    ["GITHUB_REF_PROTECTED", "false"],
    ["GITHUB_WORKFLOW_REF", "Future00111/ledgerpoint/.github/workflows/ledgerly-tr01-c2-identity-status.yml@refs/heads/main"],
    ["GITHUB_WORKFLOW_REF", "Future00111/ledgerpoint/.github/workflows/other.yml@refs/heads/main"],
    ["GITHUB_JOB", "validate"],
    ["GITHUB_RUN_ATTEMPT", "2"],
    ["TR01_VALIDATION_RESULT", "skipped"],
    ["TR01_VALIDATION_RESULT", "failure"],
    ["TR01_C3_APPROVED_WORKFLOW_SHA", ""],
    ["TR01_C3_APPROVED_WORKFLOW_SHA", "not-a-sha"],
    ["TR01_C3_APPROVED_WORKFLOW_SHA", "b".repeat(40)],
    ["GITHUB_WORKFLOW_SHA", "b".repeat(40)],
    ["GITHUB_SHA", "b".repeat(40)],
  ]) {
    assert.throws(() => assertTrustedInvocation({ ...env, [key]: value }));
  }
  assert.throws(
    () => assertTrustedInvocation({ ...env, TR01_C2_APPROVED_WORKFLOW_SHA: "a".repeat(40), TR01_C3_APPROVED_WORKFLOW_SHA: undefined }),
  );
});

test("valid pinned C3 identity posts only the named success on the exact SHA", async () => {
  const { calls, request } = stub();
  await validateAndPublishIdentity(env, request);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.slice(0, 3).map(([method]) => method), ["GET", "GET", "GET"]);
  assert.deepEqual(calls[3], [
    "POST",
    `/repos/${identity.repository}/statuses/${identity.sha}`,
    {
      state: "success",
      context: "tr01/c3-identity-validation",
      description: "C3 identity and non-DB checks; pinned review-package identity; NOT TI-03 qualification",
    },
  ]);
});

for (const [name, first, object, second] of [
  ["missing branch", null, commit, ref],
  ["C2 successor ref", { ...ref, ref: "refs/heads/tr01/implementation-identity-successor-c2" }, commit, ref],
  ["wrong branch tip including C2 SHA", { ...ref, object: { sha: "3ab9edc28b4922ad82e68afb7b049d69514f91e1", type: "commit" } }, commit, ref],
  ["noncommit tip", { ...ref, object: { sha: identity.sha, type: "tag" } }, commit, ref],
  ["wrong commit SHA including C2 SHA", ref, { ...commit, sha: "3ab9edc28b4922ad82e68afb7b049d69514f91e1" }, ref],
  ["wrong parent including C2 parent", ref, { ...commit, parents: [{ sha: "d292f3a64c6253e022b40de8cf055f3e722ff1ea" }] }, ref],
  ["extra parent", ref, { ...commit, parents: [commit.parents[0], commit.parents[0]] }, ref],
  ["wrong tree including C2 tree", ref, { ...commit, tree: { sha: "365303e152430560b828c88165dd8f4d03f2a4fc" } }, ref],
  ["ref changes during validation", ref, commit, { ...ref, object: { sha: "3ab9edc28b4922ad82e68afb7b049d69514f91e1", type: "commit" } }],
  ["ref changes type during validation", ref, commit, { ...ref, object: { sha: identity.sha, type: "tag" } }],
]) {
  test(`${name} cannot publish success`, async () => {
    const { calls, request } = stub(first, object, second);
    await assert.rejects(validateAndPublishIdentity(env, request));
    assert.ok(calls.every(([method]) => method === "GET"));
    assert.equal(calls.some(([method]) => method === "POST"), false);
  });
}

test("an upstream API failure cannot publish success", async () => {
  const calls = [];
  await assert.rejects(
    validateAndPublishIdentity(env, async (method) => {
      calls.push(method);
      throw new Error("HTTP 403");
    }),
  );
  assert.deepEqual(calls, ["GET"]);
});

for (const [name, status] of [
  ["C2 identity context", { context: "tr01/c2-identity-validation", state: "success" }],
  ["unauthorized context", { context: "other/status", state: "success" }],
  ["failure state", { context: identity.context, state: "failure" }],
  ["missing status fields", {}],
]) {
  test(`a ${name} status response is rejected`, async () => {
    const { calls, request } = stub(ref, commit, ref, status);
    await assert.rejects(validateAndPublishIdentity(env, request), /did not confirm/);
    assert.equal(calls.filter(([method]) => method === "POST").length, 1);
  });
}

test("untrusted invocation makes no API calls", async () => {
  for (const change of [
    { GITHUB_REF_PROTECTED: "false" },
    { GITHUB_WORKFLOW_REF: "Future00111/ledgerpoint/.github/workflows/ledgerly-tr01-c2-identity-status.yml@refs/heads/main" },
    { TR01_VALIDATION_RESULT: "skipped" },
    { TR01_C3_APPROVED_WORKFLOW_SHA: "" },
    { GITHUB_WORKFLOW_SHA: "b".repeat(40) },
    { GITHUB_SHA: "b".repeat(40) },
  ]) {
    const { calls, request } = stub();
    await assert.rejects(validateAndPublishIdentity({ ...env, ...change }, request));
    assert.equal(calls.length, 0);
  }
});

test("workflow is manual-only and limits validation to protected main", () => {
  const triggers = workflowSource.match(/^on:\n([\s\S]*?)(?=^permissions:)/m)?.[1];
  const validateJob = workflowSource.match(/^  validate:\n([\s\S]*?)(?=^  identity:)/m)?.[1];
  assert.ok(triggers);
  assert.match(triggers, /^\s+workflow_dispatch:\s*$/m);
  assert.doesNotMatch(triggers, /^\s+(?:push|pull_request|schedule|workflow_call):/m);
  assert.ok(validateJob);
  assert.match(validateJob, /github\.repository == 'Future00111\/ledgerpoint'/);
  assert.match(validateJob, /github\.ref == 'refs\/heads\/main'/);
  assert.match(validateJob, /github\.ref_protected == true/);
});

test("workflow separates read-only validation from the protected status writer", () => {
  const validateJob = workflowSource.match(/^  validate:\n([\s\S]*?)(?=^  identity:)/m)?.[1];
  const identityJob = workflowSource.match(/^  identity:\n([\s\S]*)$/m)?.[1];
  assert.ok(validateJob);
  assert.ok(identityJob);
  assert.match(validateJob, /permissions:\n\s+contents: read/);
  assert.doesNotMatch(validateJob, /statuses:\s*write/);
  assert.match(identityJob, /needs: validate/);
  assert.match(identityJob, /needs\.validate\.result == 'success'/);
  assert.match(identityJob, /github\.repository == 'Future00111\/ledgerpoint'/);
  assert.match(identityJob, /github\.ref == 'refs\/heads\/main'/);
  assert.match(identityJob, /github\.ref_protected == true/);
  assert.match(identityJob, /environment:\n\s+name: ledgerly-canonical/);
  assert.match(identityJob, /permissions:\n\s+contents: read\n\s+statuses: write/);
});

test("workflow pins immutable C3 and both checkout paths disable credential persistence", () => {
  const identityJob = workflowSource.match(/^  identity:\n([\s\S]*)$/m)?.[1];
  assert.match(workflowSource, /ref: 1c26be19295902a38e1939b56ff99ae9a195d3de/);
  assert.match(workflowSource, /git rev-parse HEAD\^\{tree\}.*beb56d35539d81636b609602b3c57d167bc88888/);
  assert.match(workflowSource, /git rev-parse HEAD\^.*e7f43c70e45c068971aeb241ce1b01a30bb01e37/);
  assert.match(workflowSource, /git rev-list --parents -n 1 HEAD \| wc -w.*-eq 2/);
  assert.match(workflowSource, /persist-credentials: false/);
  assert.match(workflowSource, /ref: \$\{\{ github\.sha \}\}/);
  assert.ok(identityJob);
  assert.match(identityJob, /persist-credentials: false/);
  assert.match(identityJob, /TR01_C3_APPROVED_WORKFLOW_SHA: \$\{\{ vars\.TR01_C3_APPROVED_WORKFLOW_SHA \}\}/);
  assert.doesNotMatch(workflowSource, /TR01_C2_APPROVED_WORKFLOW_SHA/);
});

test("workflow runs pinned-source non-DB checks and an offline-build-only Docker smoke", () => {
  const fixture = workflowSource.match(/const fixture = \{([\s\S]*?)\n\s+\};/)?.[1];
  assert.match(workflowSource, /node --check scripts\/ci\/run-ledgerly-canonical-postgresql\.mjs/);
  assert.match(workflowSource, /pnpm run typecheck:libs/);
  assert.match(workflowSource, /pnpm run typecheck/);
  assert.match(workflowSource, /pnpm install --frozen-lockfile --ignore-scripts/);
  assert.match(workflowSource, /DOCKER_BUILDKIT: "1"/);
  assert.match(workflowSource, /--file \.ci\/ledgerly-canonical\/Dockerfile\.test/);
  assert.match(workflowSource, /--tag "\$image"/);
  assert.match(workflowSource, /ledgerly-tr01-c3-offline-pnpm-smoke:local/);
  assert.match(workflowSource, /LEDGERLY_OFFLINE_PNPM_TEST_IMAGE="\$image"\s+\\\s*node --test scripts\/ci\/ledgerly-offline-pnpm\.test\.mjs/);
  assert.match(workflowSource, /"\.dockerignore"[\s\S]*"\.github"[\s\S]*"scripts"[\s\S]*"pnpm-lock\.yaml"/);
  assert.ok(fixture);
  assert.match(fixture, /fixturePurpose: "offline-build-only"/);
  assert.match(fixture, /notQualificationEvidence: true/);
  assert.match(fixture, /version: 1/);
  assert.match(fixture, /qualificationWorkflowSha256: hashes\[qualificationWorkflow\]/);
  assert.doesNotMatch(fixture, /\b(?:schemaVersion|result|ci)\s*:/);
});

test("workflow wires this contract suite against same-event protected-main code after C3 install", () => {
  const producerCheckout = workflowSource.match(
    /- name: Checkout same-event protected-main producer tests\n([\s\S]*?)(?=\n      - name: Validate C3)/,
  )?.[1];
  assert.ok(producerCheckout);
  assert.match(producerCheckout, /uses: actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683/);
  assert.match(producerCheckout, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(producerCheckout, /path: \.local\/tr01-c3-producer/);
  assert.match(producerCheckout, /persist-credentials: false/);
  assert.match(workflowSource, /pnpm install --frozen-lockfile --ignore-scripts[\s\S]*?LEDGERLY_C3_VALIDATION_ROOT="\$GITHUB_WORKSPACE" node --test \.local\/tr01-c3-producer\/scripts\/ci\/ledgerly-tr01-c3-identity-status\.test\.mjs/);
});

test("offline-build-only source fixture is rejected by actual C3 validation before hashing or qualification", {
  skip: !validationRoot,
}, async () => {
  const root = resolve(validationRoot);
  const modulePath = resolve(root, "scripts/ci/run-ledgerly-canonical-postgresql.mjs");
  const expectedSha = "1c26be19295902a38e1939b56ff99ae9a195d3de";
  assert.equal(execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), expectedSha);
  const c3Source = await readFile(modulePath, "utf8");
  const fixtureGuardOffset = c3Source.indexOf("manifest?.version !== 2");
  const sourceHashOffset = c3Source.indexOf("const sourceTree = await sha256Files");
  const databaseStartOffset = c3Source.indexOf("await startPostgres(credentials.postgresPassword)");
  assert.ok(fixtureGuardOffset >= 0);
  assert.ok(sourceHashOffset > fixtureGuardOffset);
  assert.ok(databaseStartOffset > sourceHashOffset);

  const { buildTrustedEvidenceContext } = await import(pathToFileURL(modulePath).href);
  const branch = "refs/heads/tr01/implementation-identity-successor-c3";
  const environment = {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: branch,
    GITHUB_REF_PROTECTED: "true",
    GITHUB_REPOSITORY: identity.repository,
    GITHUB_WORKFLOW: "Ledgerly canonical PostgreSQL qualification",
    GITHUB_WORKFLOW_REF: `${identity.repository}/.github/workflows/ledgerly-canonical-postgresql.yml@${branch}`,
    GITHUB_JOB: "canonical-postgresql",
    GITHUB_SHA: expectedSha,
    GITHUB_RUN_ID: "offline-fixture-regression",
    GITHUB_RUN_ATTEMPT: "1",
    LEDGERLY_IDENTITY_MODE: "candidate",
    LEDGERLY_APPROVED_CANDIDATE_SHA: expectedSha,
    LEDGERLY_IMPLEMENTATION_SOURCE_SHA: expectedSha,
    LEDGERLY_WORKFLOW_ROOT: root,
  };
  const previousEnvironment = new Map(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, environment);
  const ci = {
    provider: "github-actions",
    repository: identity.repository,
    workflow: "Ledgerly canonical PostgreSQL qualification",
    workflowRef: environment.GITHUB_WORKFLOW_REF,
    runId: environment.GITHUB_RUN_ID,
    runAttempt: "1",
    job: "canonical-postgresql",
    workflowSourceCommit: expectedSha,
    implementationSourceCommit: expectedSha,
    identityMode: "candidate",
    sourceRef: branch,
    refProtected: true,
    ancestryVerified: true,
    workflowCheckoutClean: true,
    implementationCheckoutClean: true,
  };
  const offlineBuildFixture = {
    version: 1,
    fixturePurpose: "offline-build-only",
    notQualificationEvidence: true,
    sourceCommit: expectedSha,
    files: [],
    sourceTreeSha256: "0".repeat(64),
  };
  try {
    await assert.rejects(
      buildTrustedEvidenceContext(ci, offlineBuildFixture),
      /Trusted implementation source manifest is unavailable or invalid/,
    );
  } finally {
    for (const [key, value] of previousEnvironment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});