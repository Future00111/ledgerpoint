// Manual synthetic review only. Never dispatches, writes statuses, or emits
// schema-2 qualification evidence. The production coordinator remains intact.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

function option(name) {
  const i = process.argv.indexOf(name);
  assert.ok(i >= 0 && process.argv[i + 1], name + " required");
  return process.argv[i + 1];
}
const root = path.resolve(option("--source-root"));
const base = option("--base-image");
const output = path.resolve(option("--output"));
const original = process.argv.includes("--expected-c6-failure");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const host = { PATH: process.env.PATH, HOME: process.env.HOME };
const run = (command, args, cwd = root) => {
  const r = spawnSync(command, args, { cwd, env: host, encoding: "utf8", timeout: 120000 });
  assert.ifError(r.error); assert.equal(r.status, 0, command + " review operation failed");
  return r.stdout.trim();
};
const commit = run("git", ["rev-parse", "HEAD"]);
const scope = [".dockerignore", ".ci/ledgerly-canonical/Dockerfile.test", ".github", "artifacts", "lib", "scripts",
  "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json", "package.json", "pnpm-lock.yaml",
  "pnpm-workspace.yaml", "tsconfig.base.json", "tsconfig.json"];
const files = run("git", ["ls-files", "-z", "--", ...scope]).split("\0").filter(Boolean).sort();
const aggregate = createHash("sha256");
for (const file of files) aggregate.update(file).update("\0").update(readFileSync(path.join(root, file))).update("\0");
const sourceTreeSha256 = aggregate.digest("hex");
const paths = {
  applicationSchema: "lib/db/src/schema/index.ts", drizzleConfig: "lib/db/drizzle.config.ts",
  securityOverlay: "scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql",
  runControlSql: "scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql",
  coordinator: "scripts/ci/run-ledgerly-canonical-postgresql.mjs", lockfile: "pnpm-lock.yaml",
  workflow: ".github/workflows/ledgerly-canonical-postgresql.yml",
  orchestrator: "artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs",
};
const digests = Object.fromEntries(Object.entries(paths).map(([key, file]) => [key, sha(readFileSync(path.join(root, file)))]));
const tests = createHash("sha256");
for (const file of ["artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts",
  "artifacts/api-server/src/services/accounting/canonicalPosting.ts"].sort())
  tests.update(file).update("\0").update(readFileSync(path.join(root, file))).update("\0");
Object.assign(digests, { sourceTree: sourceTreeSha256, testSources: tests.digest("hex") });
const temp = mkdtempSync(path.join(tmpdir(), "ledgerly-canonical-repair-review-"));
const seam = path.join(root, "scripts/ci/review-canonical-coordinator.mjs");
const manifest = { version: 2, reviewOnly: true, notQualificationEvidence: true,
  fixturePurpose: "synthetic-canonical-review", identityMode: "candidate", implementationSourceCommit: commit,
  files, sourceTreeSha256, workflowSourceSha256: digests.workflow };
const record = { reviewOnly: true, qualificationSuccess: false, originalC6: original,
  sourceCommit: commit, sourceTreeSha256, sourceDigests: digests };
let module;
let failure;
try {
  writeFileSync(path.join(temp, "source-manifest.json"), JSON.stringify(manifest));
  writeFileSync(path.join(temp, "Dockerfile"), `FROM ${base}\nUSER root\nCOPY --chmod=0444 source-manifest.json /workspace/.ci/ledgerly-canonical/source-manifest.json\nUSER node\n`);
  run("docker", ["build", "--network=none", "-t", "ledgerly-canonical-test:24.13.0-bookworm-slim", temp]);
  record.reviewImageId = run("docker", ["image", "inspect", "ledgerly-canonical-test:24.13.0-bookworm-slim", "--format", "{{.Id}}"]);
  writeFileSync(seam, readFileSync(path.join(root, paths.coordinator), "utf8") +
    "\nexport { state, createCredentials, startPostgres, bootstrapDatabase, runIsolationProbes, runNegativeControls, runTestContainer, cleanupDatabase, removeCredentialMaterial, assertTrustedWorkflowContext };\n");
  module = await import(pathToFileURL(seam).href);
  const ref = `refs/heads/tr01/implementation-identity-successor-${original ? "c6" : "c7"}`;
  const repository = "review-only/synthetic-canonical-fixture";
  const workflow = "Ledgerly canonical PostgreSQL qualification";
  const ci = { provider: "github-actions", repository, workflow,
    workflowRef: `${repository}/${paths.workflow}@${ref}`, runId: "synthetic-review", runAttempt: "1",
    job: "canonical-postgresql", identityMode: "candidate", sourceRef: ref, refProtected: true,
    workflowSourceCommit: commit, implementationSourceCommit: commit, ancestryVerified: true,
    workflowCheckoutClean: true, implementationCheckoutClean: true };
  Object.assign(process.env, { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REPOSITORY: repository, GITHUB_WORKFLOW: workflow, GITHUB_WORKFLOW_REF: ci.workflowRef,
    GITHUB_REF: ref, GITHUB_REF_PROTECTED: "true", GITHUB_SHA: commit, GITHUB_RUN_ID: ci.runId,
    GITHUB_RUN_ATTEMPT: "1", GITHUB_JOB: ci.job, LEDGERLY_IDENTITY_MODE: "candidate",
    LEDGERLY_APPROVED_CANDIDATE_SHA: commit, LEDGERLY_IMPLEMENTATION_SOURCE_SHA: commit,
    LEDGERLY_WORKFLOW_ROOT: root });
  // A valid synthetic string envelope is needed to exercise the negative
  // controls for their intended reason; it is not trusted GitHub provenance.
  module.assertTrustedWorkflowContext();
  if (!original) await assert.rejects(module.buildTrustedEvidenceContext(ci, manifest),
    /Trusted implementation source manifest is unavailable or invalid/);
  const { state } = module;
  state.runId = randomUUID(); state.databaseName = "ledgerly_canonical_test_" + state.runId.replaceAll("-", "");
  state.ci = ci;
  const credentials = await module.createCredentials(state.runId, state.databaseName, digests, ci);
  state.runNonce = credentials.nonce;
  await module.startPostgres(credentials.postgresPassword);
  const bootstrap = await module.bootstrapDatabase(credentials, digests, ci);
  record.bootstrap = bootstrap;
  await module.runIsolationProbes();
  record.isolation = state.observedIsolation;
  record.negativeControls = await module.runNegativeControls();
  const completion = await module.runTestContainer(credentials, digests, ci);
  assert.equal(original, false, "Frozen C6 must reproduce its test failures");
  assert.equal(completion.privateRunBindingVerified, true);
  assert.equal(completion.concurrencyEvidence.overlapProven, true);
  assert.ok(Object.values(completion.negativePrivilegeEvidence).every((value) => value === true));
  record.negativeControls.roleEscalation = true; record.negativeControls.triggerDisable = true;
  assert.equal(Object.keys(record.negativeControls).length, 18);
  assert.ok(Object.values(record.negativeControls).every((value) => value === true));
  const lock = completion.journalLockEvidence;
  assert.equal(lock.functionOwner, "ledgerly_canonical_owner"); assert.equal(lock.callerHasUpdate, false);
  for (const key of ["scopedLookupsRejected", "directMutationDenied", "temporaryShadowRejected", "transactionalRowLockProven"])
    assert.equal(lock[key], true, key);
  assert.equal(new Set(lock.backendPids).size, 2);
  assert.deepEqual(bootstrap.schemaPush, { recoveredOrdering: true, pushes: 2 });
  assert.equal(bootstrap.relationForeignKeys.length, 7);
  assert.ok(bootstrap.relationForeignKeys.every((key) => key.validated));
  record.completion = completion;
} catch (error) {
  record.failure = error.message;
  if (original && module?.state?.phase === "test" && /docker exited with status 1/.test(error.message))
    record.expectedC6Failure = true;
  else failure = error;
} finally {
  try {
    if (module) {
      await module.cleanupDatabase(); await module.removeCredentialMaterial();
      const { state } = module;
      record.cleanup = { logicalDrop: state.databaseAbsent, databaseAbsent: state.databaseAbsent,
        containerRemoved: state.containerRemoved, networkRemoved: state.networkRemoved,
        credentialMaterialRemoved: state.credentialMaterialRemoved };
      assert.ok(Object.values(record.cleanup).every((value) => value === true));
    }
  } catch (error) { record.cleanupFailure = error.message; failure ??= error; }
  rmSync(seam, { force: true }); rmSync(temp, { recursive: true, force: true });
  if (run("docker", ["images", "-q", "ledgerly-canonical-test:24.13.0-bookworm-slim"]))
    run("docker", ["image", "rm", "ledgerly-canonical-test:24.13.0-bookworm-slim"]);
  record.result = failure ? "failed" : "passed";
  writeFileSync(output, JSON.stringify(record, null, 2) + "\n");
}
if (failure) { console.error(failure.message); process.exitCode = 1; }
else console.log(original ? "PASS exact C6 test failure reproduced; review only" : "PASS repaired canonical review; NOT qualification evidence");
