import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const candidateRef = "refs/heads/tr01/implementation-identity-candidate";
const mainRef = "refs/heads/main";
const sha = "a".repeat(40);

const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const schema = JSON.parse(
  await read("docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json"),
);
const validate = new Ajv2020({
  strict: true,
  allErrors: true,
  formats: { uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i },
}).compile(schema);

function failureEvidence(overrides = {}) {
  return {
    schemaVersion: 2,
    result: "failed",
    failurePhase: "preflight",
    ci: {
      provider: "github-actions",
      repository: "example/repository",
      workflow: "Ledgerly canonical PostgreSQL qualification",
      workflowRef: `example/repository/.github/workflows/ledgerly-canonical-postgresql.yml@${candidateRef}`,
      runId: "1",
      runAttempt: "1",
      job: "canonical-postgresql",
      workflowSourceCommit: sha,
      implementationSourceCommit: sha,
      identityMode: "candidate",
      sourceRef: candidateRef,
      refProtected: true,
      ancestryVerified: true,
      workflowCheckoutClean: true,
      implementationCheckoutClean: true,
    },
    images: {
      postgres: { tag: "postgres:16", digest: `sha256:${"b".repeat(64)}` },
      node: { tag: "node:24", digest: `sha256:${"c".repeat(64)}` },
    },
    cleanup: {
      logicalDrop: false,
      databaseAbsent: false,
      containerRemoved: false,
      networkRemoved: false,
      credentialMaterialRemoved: false,
    },
    isolation: {
      parentDatabaseUrlAbsent: true,
      replitVariablesAbsent: true,
      noPublishedPorts: false,
      internalNetwork: false,
      testContainerNoSocket: false,
      testContainerNoExternalRoute: false,
      heliumdbContacted: false,
      productionContacted: false,
      secretScanPassed: true,
    },
    ...overrides,
  };
}

assert.equal(schema.properties.schemaVersion.const, 2);
assert.equal(validate(failureEvidence()), true);
assert.equal(validate({ ...failureEvidence(), schemaVersion: 1 }), false);

const legacyCi = failureEvidence();
legacyCi.ci.sourceCommit = sha;
assert.equal(validate(legacyCi), false);

const shortSha = failureEvidence();
shortSha.ci.workflowSourceCommit = "a".repeat(39);
assert.equal(validate(shortSha), false);

const activated = failureEvidence({
  ci: {
    ...failureEvidence().ci,
    workflowRef: `example/repository/.github/workflows/ledgerly-canonical-postgresql.yml@${mainRef}`,
    workflowSourceCommit: "b".repeat(40),
    identityMode: "activated",
    sourceRef: mainRef,
  },
});
assert.equal(validate(activated), true);

const activatedCandidateRef = structuredClone(activated);
activatedCandidateRef.ci.sourceRef = candidateRef;
assert.equal(validate(activatedCandidateRef), false);

const coordinator = await read("scripts/ci/run-ledgerly-canonical-postgresql.mjs");
assert.match(coordinator, /const fullShaPattern = \/\^\[0-9a-f\]\{40\}\$\//);
assert.match(coordinator, /merge-base", "--is-ancestor"/);
assert.match(coordinator, /workflowSourceCommit/);
assert.match(coordinator, /implementationSourceCommit/);
assert.match(coordinator, /schemaVersion !== 2/);
assert.doesNotMatch(coordinator, /sourceCommit:\s*ci\.sourceCommit/);
assert.doesNotMatch(coordinator, /\bsource_commit\b/);
assert.match(coordinator, /sha256File\(sourcePaths\.workflow, workflowRoot\)/);
assert.match(coordinator, /sha256File\(sourcePaths\.applicationSchema, implementationRoot\)/);

const sql = await read("scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql");
for (const column of [
  "identity_mode",
  "ci_source_ref",
  "ci_ref_protected",
  "workflow_source_commit",
  "implementation_source_commit",
  "ancestry_verified",
  "workflow_checkout_clean",
  "implementation_checkout_clean",
]) {
  assert.match(sql, new RegExp(`\\b${column}\\b`));
}
assert.doesNotMatch(sql, /\bsource_commit\b/);
assert.match(sql, /identity_mode = 'candidate'/);
assert.match(sql, /identity_mode = 'activated'/);
assert.match(sql, /refs\/heads\/tr01\/implementation-identity-candidate/);
assert.match(sql, /refs\/heads\/main/);

const workflow = await read(".github/workflows/ledgerly-canonical-postgresql.yml");
assert.match(workflow, /fetch-depth: 0/);
assert.match(workflow, /path: candidate/);
assert.match(workflow, /LEDGERLY_APPROVED_CANDIDATE_SHA/);
assert.match(workflow, /LEDGERLY_IDENTITY_MODE/);
assert.match(workflow, /candidate\/scripts\/ci\/run-ledgerly-canonical-postgresql\.mjs/);
assert.match(workflow, /\*\*\/docs\/governance\/evidence\/ledgerly-44-ti-03-\*\.json/);

console.log("TR-01 identity-contract static tests passed");