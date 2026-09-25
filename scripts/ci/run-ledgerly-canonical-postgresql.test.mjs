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
const {
  parseLiteralTrue,
  validateExecutionSourceManifest,
} = await import(
  path.join(root, "artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs")
);
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

const bindingShape = failureEvidence();
bindingShape.binding = {
  runUuid: "00000000-0000-4000-8000-000000000000",
  databaseName: "ledgerly_canonical_test_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  environment: "external-ci-disposable-test",
  targetClassification: "external-ci-postgresql-service-container",
  creatorIdentity: "postgres",
  runtimeIdentity: "ledgerly_api",
  identityMode: "candidate",
  ciSourceRef: candidateRef,
  ciRefProtected: true,
  workflowSourceCommit: sha,
  implementationSourceCommit: sha,
  ancestryVerified: true,
  workflowCheckoutClean: true,
  implementationCheckoutClean: true,
  sourceTreeSha256: "b".repeat(64),
  nonceSha256: "c".repeat(64),
};
assert.equal(validate(bindingShape), true);
for (const field of [
  "identityMode",
  "ciSourceRef",
  "ciRefProtected",
  "workflowSourceCommit",
  "implementationSourceCommit",
  "ancestryVerified",
  "workflowCheckoutClean",
  "implementationCheckoutClean",
]) {
  const missing = structuredClone(bindingShape);
  delete missing.binding[field];
  assert.equal(validate(missing), false, `missing binding.${field} must fail`);
}
for (const field of [
  "ciRefProtected",
  "ancestryVerified",
  "workflowCheckoutClean",
  "implementationCheckoutClean",
]) {
  for (const invalid of [false, "true", "TRUE", 1, null, [], {}]) {
    const malformed = structuredClone(bindingShape);
    malformed.binding[field] = invalid;
    assert.equal(validate(malformed), false, `binding.${field}=${JSON.stringify(invalid)} must fail`);
  }
}
for (const legacyField of ["sourceCommit", "source_commit"]) {
  const legacy = structuredClone(bindingShape);
  legacy.binding[legacyField] = sha;
  assert.equal(validate(legacy), false, `legacy binding.${legacyField} must fail`);
}

assert.equal(parseLiteralTrue("true", "FLAG"), true);
for (const invalid of [undefined, "", "false", "TRUE", "1", "yes"]) {
  assert.throws(
    () => parseLiteralTrue(invalid, "FLAG"),
    /must equal the literal string true/,
  );
}

const sourceTreeSha256 = "d".repeat(64);
const workflowSourceSha256 = "e".repeat(64);
const implementationWorkflowSha256 = "f".repeat(64);
const executionManifest = validateExecutionSourceManifest(
  {
    version: 2,
    identityMode: "activated",
    implementationSourceCommit: sha,
    workflowSourceSha256,
    files: [".github/workflows/ledgerly-canonical-postgresql.yml"],
    sourceTreeSha256,
  },
  () => sourceTreeSha256,
);
assert.equal(executionManifest.workflowSourceSha256, workflowSourceSha256);
assert.notEqual(executionManifest.workflowSourceSha256, implementationWorkflowSha256);
assert.throws(
  () =>
    validateExecutionSourceManifest(
      { ...executionManifest, workflowSourceSha256: "short" },
      () => sourceTreeSha256,
    ),
  /execution source manifest is invalid/,
);

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

const disposableRunner = await read("artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs");
for (const environmentName of [
  "LEDGERLY_CANONICAL_TEST_IDENTITY_MODE",
  "LEDGERLY_CANONICAL_TEST_SOURCE_REF",
  "LEDGERLY_CANONICAL_TEST_REF_PROTECTED",
  "LEDGERLY_CANONICAL_TEST_WORKFLOW_SOURCE_COMMIT",
  "LEDGERLY_CANONICAL_TEST_IMPLEMENTATION_SOURCE_COMMIT",
  "LEDGERLY_CANONICAL_TEST_ANCESTRY_VERIFIED",
  "LEDGERLY_CANONICAL_TEST_WORKFLOW_CHECKOUT_CLEAN",
  "LEDGERLY_CANONICAL_TEST_IMPLEMENTATION_CHECKOUT_CLEAN",
]) {
  assert.match(disposableRunner, new RegExp(environmentName));
}
assert.match(disposableRunner, /must equal the literal string true/);
assert.match(disposableRunner, /Object\.hasOwn\(process\.env, "LEDGERLY_CANONICAL_TEST_SOURCE_COMMIT"\)/);
assert.doesNotMatch(disposableRunner, /sourceCommit:\s*ci\.sourceCommit/);
const externalDigests = disposableRunner.slice(
  disposableRunner.indexOf("function externalSourceDigests"),
  disposableRunner.indexOf("function assertSafeConnectionUrl"),
);
assert.match(externalDigests, /workflow: manifest\.workflowSourceSha256/);
assert.doesNotMatch(externalDigests, /workflow:\s*sha256File\(sourceFiles\.workflow\)/);

const overlay = await read("scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql");
assert.doesNotMatch(overlay, /r\.source_commit|p_binding->>'sourceCommit'/);
const externalVerifier = overlay.slice(
  overlay.indexOf("CREATE OR REPLACE FUNCTION public.ledgerly_verify_external_disposable_run"),
  overlay.indexOf("ALTER FUNCTION public.ledgerly_verify_external_disposable_run"),
);
assert.match(externalVerifier, /NOT \(p_binding \? 'sourceCommit'\)/);
assert.match(externalVerifier, /NOT \(p_binding \? 'source_commit'\)/);
for (const [column, field] of [
  ["ci_ref_protected", "ciRefProtected"],
  ["ancestry_verified", "ancestryVerified"],
  ["workflow_checkout_clean", "workflowCheckoutClean"],
  ["implementation_checkout_clean", "implementationCheckoutClean"],
]) {
  assert.match(externalVerifier, new RegExp(`r\\.${column} IS TRUE`));
  assert.match(externalVerifier, new RegExp(`p_binding->'${field}' = 'true'::jsonb`));
}
const localVerifier = overlay.slice(
  overlay.indexOf("CREATE OR REPLACE FUNCTION public.ledgerly_verify_disposable_run"),
  overlay.indexOf("ALTER FUNCTION public.ledgerly_verify_disposable_run"),
);
assert.doesNotMatch(localVerifier, /\bp_binding\b/);

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