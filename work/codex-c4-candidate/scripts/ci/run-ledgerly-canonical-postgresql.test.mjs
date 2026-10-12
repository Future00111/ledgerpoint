import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const candidateRef = "refs/heads/tr01/implementation-identity-successor-c4";
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
const digestKeys = [
  "sourceTree", "applicationSchema", "drizzleConfig", "securityOverlay",
  "runControlSql", "coordinator", "testSources", "lockfile", "workflow",
  "orchestrator",
];
const digest = (label) => createHash("sha256").update(label).digest("hex");
const negativeControls = Object.fromEntries(
  schema.properties.negativeControls.required.map((key) => [key, true]),
);

const fixtureDirectory = await mkdtemp(path.join(tmpdir(), "ledgerly-c2-acceptance-"));
const implementationFixture = path.join(fixtureDirectory, "implementation");
const workflowFixture = path.join(fixtureDirectory, "workflow");
const fixtureFiles = [
  ".dockerignore",
  ".ci/ledgerly-canonical/Dockerfile.test",
  ".github/workflows/ledgerly-canonical-postgresql.yml",
  "artifacts/api-server/package.json",
  "artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs",
  "artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts",
  "artifacts/api-server/src/services/accounting/canonicalPosting.ts",
  "lib/db/src/schema/index.ts",
  "lib/db/drizzle.config.ts",
  "scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql",
  "scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql",
  "scripts/ci/run-ledgerly-canonical-postgresql.mjs",
  "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
];
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
await mkdir(implementationFixture, { recursive: true });
for (const relativePath of fixtureFiles) {
  const file = path.join(implementationFixture, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    relativePath === "scripts/ci/run-ledgerly-canonical-postgresql.mjs" ||
      relativePath === "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json"
      ? await read(relativePath)
      : relativePath === "package.json"
        ? '{"type":"module","private":true}\n'
      : `C2 fixture ${relativePath}\n`,
  );
}
git(implementationFixture, "init", "-q", "-b", "main");
git(implementationFixture, "add", "--all");
git(implementationFixture, "-c", "user.email=fixture@example.invalid", "-c", "user.name=Fixture",
  "commit", "-qm", "C2 fixture");
const fixtureC2 = git(implementationFixture, "rev-parse", "HEAD");
git(implementationFixture, "worktree", "add", "--detach", workflowFixture, "HEAD");
await writeFile(
  path.join(workflowFixture, ".github/workflows/ledgerly-canonical-postgresql.yml"),
  "distinct protected main S workflow fixture\n",
);
await writeFile(
  path.join(workflowFixture, "scripts/ci/run-ledgerly-canonical-postgresql.mjs"),
  "distinct protected main S coordinator fixture\n",
);
git(workflowFixture, "add", ".github/workflows/ledgerly-canonical-postgresql.yml",
  "scripts/ci/run-ledgerly-canonical-postgresql.mjs");
git(workflowFixture, "-c", "user.email=fixture@example.invalid", "-c", "user.name=Fixture",
  "commit", "-qm", "activated S fixture");
const fixtureS = git(workflowFixture, "rev-parse", "HEAD");
await symlink(path.join(root, "node_modules"), path.join(implementationFixture, "node_modules"));

async function manifestFor(mode, workflowSourceRoot) {
  const files = git(implementationFixture, "ls-files", "-z").split("\0").filter(Boolean).sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(await readFile(path.join(implementationFixture, file)));
    hash.update("\0");
  }
  return {
    version: 2,
    identityMode: mode,
    implementationSourceCommit: fixtureC2,
    workflowSourceSha256: digest(
      await readFile(
        path.join(workflowSourceRoot, ".github/workflows/ledgerly-canonical-postgresql.yml"),
      ),
    ),
    files,
    sourceTreeSha256: hash.digest("hex"),
  };
}

function fixtureEnvironment(mode) {
  const sourceRef = mode === "candidate" ? candidateRef : mainRef;
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF_PROTECTED: "true",
    GITHUB_REF: sourceRef,
    GITHUB_SHA: mode === "candidate" ? fixtureC2 : fixtureS,
    GITHUB_REPOSITORY: "example/repository",
    GITHUB_WORKFLOW: "Ledgerly canonical PostgreSQL qualification",
    GITHUB_WORKFLOW_REF: `example/repository/.github/workflows/ledgerly-canonical-postgresql.yml@${sourceRef}`,
    GITHUB_JOB: "canonical-postgresql",
    GITHUB_RUN_ID: "1",
    GITHUB_RUN_ATTEMPT: "1",
    LEDGERLY_IDENTITY_MODE: mode,
    LEDGERLY_APPROVED_CANDIDATE_SHA: fixtureC2,
    LEDGERLY_IMPLEMENTATION_SOURCE_SHA: fixtureC2,
  };
}

function fixtureCi(environment) {
  return {
    ...failureEvidence().ci,
    repository: environment.GITHUB_REPOSITORY,
    workflow: environment.GITHUB_WORKFLOW,
    workflowRef: environment.GITHUB_WORKFLOW_REF,
    job: environment.GITHUB_JOB,
    workflowSourceCommit: environment.GITHUB_SHA,
    implementationSourceCommit: fixtureC2,
    identityMode: environment.LEDGERLY_IDENTITY_MODE,
    sourceRef: environment.GITHUB_REF,
  };
}

const candidateEnvironment = fixtureEnvironment("candidate");
const candidateManifest = await manifestFor("candidate", implementationFixture);
const savedEnvironment = process.env;
const fixtureModuleUrl = pathToFileURL(
  path.join(implementationFixture, "scripts/ci/run-ledgerly-canonical-postgresql.mjs"),
).href;
process.env = {
  PATH: savedEnvironment.PATH,
  HOME: savedEnvironment.HOME,
  ...candidateEnvironment,
};
const candidateModule = await import(`${fixtureModuleUrl}?candidate`);
const validateEvidenceContract = candidateModule.validateEvidenceContract;
const candidateTrusted = await candidateModule.buildTrustedEvidenceContext(
  fixtureCi(candidateEnvironment), candidateManifest,
);
for (const [label, overrides, rejection] of [
      ["old C3 ref", {
      GITHUB_REF: "refs/heads/tr01/implementation-identity-successor-c3",
    }, /identity mode requires/],
    ["old C3 workflow alias", {
      GITHUB_WORKFLOW_REF: "example/repository/.github/workflows/ledgerly-canonical-postgresql.yml@refs/heads/tr01/implementation-identity-successor-c3",
    }, /exact approved workflow identity/],
    ["stale C3 candidate pin", {
      LEDGERLY_APPROVED_CANDIDATE_SHA: "1c26be19295902a38e1939b56ff99ae9a195d3de",
    }, /exact approved candidate SHA/],
["old C2 ref", {
    GITHUB_REF: "refs/heads/tr01/implementation-identity-successor-c2",
  }, /identity mode requires/],
  ["old C2 workflow alias", {
    GITHUB_WORKFLOW_REF: "example/repository/.github/workflows/ledgerly-canonical-postgresql.yml@refs/heads/tr01/implementation-identity-successor-c2",
  }, /exact approved workflow identity/],
  ["stale C2 candidate pin", {
    LEDGERLY_APPROVED_CANDIDATE_SHA: "3ab9edc28b4922ad82e68afb7b049d69514f91e1",
  }, /exact approved candidate SHA/],
]) {
  process.env = { PATH: savedEnvironment.PATH, HOME: savedEnvironment.HOME,
    ...candidateEnvironment, ...overrides };
  await assert.rejects(
    candidateModule.buildTrustedEvidenceContext(
      fixtureCi(candidateEnvironment), candidateManifest,
    ), rejection, label,
  );
}
process.env = { PATH: savedEnvironment.PATH, HOME: savedEnvironment.HOME,
  ...candidateEnvironment };
const expectedDigests = { ...candidateTrusted.sourceDigests };
const activatedEnvironment = fixtureEnvironment("activated");
const activatedManifest = await manifestFor("activated", workflowFixture);
process.env = {
  PATH: savedEnvironment.PATH,
  HOME: savedEnvironment.HOME,
  ...activatedEnvironment,
  LEDGERLY_WORKFLOW_ROOT: workflowFixture,
};
const activatedModule = await import(`${fixtureModuleUrl}?activated`);
const validateActivatedEvidence = activatedModule.validateEvidenceContract;
const activatedTrusted = await activatedModule.buildTrustedEvidenceContext(
  fixtureCi(activatedEnvironment), activatedManifest,
);
process.env = savedEnvironment;
assert.doesNotThrow(() => validateEvidenceContract(activated));
assert.notEqual(candidateTrusted.ci.workflowSourceCommit, activatedTrusted.ci.workflowSourceCommit);
assert.notEqual(candidateTrusted.sourceDigests.workflow, activatedTrusted.sourceDigests.workflow);
assert.equal(candidateTrusted.sourceDigests.sourceTree, activatedTrusted.sourceDigests.sourceTree);
const sCoordinatorDigest = digest(await readFile(
  path.join(workflowFixture, "scripts/ci/run-ledgerly-canonical-postgresql.mjs"),
));
assert.notEqual(sCoordinatorDigest, activatedTrusted.sourceDigests.coordinator);
const sTreeHash = createHash("sha256");
for (const file of activatedManifest.files) {
  sTreeHash.update(file);
  sTreeHash.update("\0");
  sTreeHash.update(await readFile(path.join(workflowFixture, file)));
  sTreeHash.update("\0");
}
const sTreeDigest = sTreeHash.digest("hex");
assert.notEqual(sTreeDigest, activatedTrusted.sourceDigests.sourceTree);
await assert.rejects(
  // A source manifest cannot redefine the authenticated C2 tracked-file list.
  (async () => {
    process.env = { PATH: savedEnvironment.PATH, HOME: savedEnvironment.HOME, ...candidateEnvironment };
    try {
      return await candidateModule.buildTrustedEvidenceContext(
        fixtureCi(candidateEnvironment), { ...candidateManifest, files: [] },
      );
    } finally {
      process.env = savedEnvironment;
    }
  })(),
  /manifest no longer matches/,
);
await assert.rejects(
  // An activated context cannot substitute the candidate-mode S root.
  (async () => {
    process.env = {
      PATH: savedEnvironment.PATH, HOME: savedEnvironment.HOME, ...activatedEnvironment,
    };
    try {
      return await candidateModule.buildTrustedEvidenceContext(
        fixtureCi(activatedEnvironment), activatedManifest,
      );
    } finally {
      process.env = savedEnvironment;
    }
  })(),
  /Workflow checkout HEAD does not match/,
);

function passedEvidence(ci = candidateTrusted.ci, sourceDigests = expectedDigests) {
  return {
    ...failureEvidence(),
    result: "passed",
    failurePhase: null,
    ci: { ...ci },
    binding: {
      ...bindingShape.binding,
      identityMode: ci.identityMode,
      ciSourceRef: ci.sourceRef,
      workflowSourceCommit: ci.workflowSourceCommit,
      implementationSourceCommit: ci.implementationSourceCommit,
      sourceTreeSha256: sourceDigests.sourceTree,
      sourceDigests: { ...sourceDigests },
    },
    bootstrap: {
      status: "passed", roleSeparation: [], ownership: [], acl: {},
      constraints: [], indexes: [], triggers: [], emptyBaseline: true,
      privateBinding: true,
    },
    runtime: {
      databaseName: bindingShape.binding.databaseName,
      currentUser: "ledgerly_api", sessionUser: "ledgerly_api",
      identityVerified: true, privateBindingVerified: true,
      sourceDigestsVerified: true, concurrencyEvidence: {},
    },
    negativeControls: { ...negativeControls },
    cleanup: Object.fromEntries(
      Object.keys(failureEvidence().cleanup).map((key) => [key, true]),
    ),
    isolation: {
      ...failureEvidence().isolation,
      noPublishedPorts: true, internalNetwork: true,
      testContainerNoSocket: true, testContainerNoExternalRoute: true,
    },
  };
}

const candidatePassed = passedEvidence();
assert.equal(validate(candidatePassed), true);
assert.doesNotThrow(() => validateEvidenceContract(candidatePassed, candidateTrusted));
assert.doesNotThrow(() => validateEvidenceContract(failureEvidence()));
assert.throws(() => validateEvidenceContract(candidatePassed), /verified S\/C2 checkouts/);
assert.throws(
  () => validateEvidenceContract(candidatePassed, { ...candidateTrusted, manifestVerified: false }),
  /verified S\/C2 checkouts/,
);
assert.throws(
  () => validateEvidenceContract(candidatePassed, { ...candidateTrusted, rootsVerified: false }),
  /verified S\/C2 checkouts/,
);
assert.throws(
  () => validateEvidenceContract(candidatePassed, { ...candidateTrusted, sourceDigests: null }),
  /verified S\/C2 checkouts/,
);
const forgedEvidence = structuredClone(candidatePassed);
forgedEvidence.binding.sourceDigests = Object.fromEntries(
  digestKeys.map((key) => [key, digest(`forged-${key}`)]),
);
forgedEvidence.binding.sourceTreeSha256 = forgedEvidence.binding.sourceDigests.sourceTree;
assert.throws(
  () => validateEvidenceContract(forgedEvidence, {
    ...candidateTrusted,
    sourceDigests: forgedEvidence.binding.sourceDigests,
    sourceTreeSha256: forgedEvidence.binding.sourceTreeSha256,
  }),
  /verified S\/C2 checkouts/,
);

function rejectMutation(
  name, mutate, base = candidatePassed, trusted = candidateTrusted,
  accept = validateEvidenceContract,
) {
  const evidence = structuredClone(base);
  mutate(evidence);
  assert.throws(
    () => accept(evidence, trusted),
    /Evidence JSON Schema validation failed|TI-03 base contract|Passed evidence|Failed evidence/,
    name,
  );
}

rejectMutation("missing map", (value) => { delete value.binding.sourceDigests; });
rejectMutation("empty map", (value) => { value.binding.sourceDigests = {}; });
rejectMutation("partial map", (value) => { delete value.binding.sourceDigests.orchestrator; });
rejectMutation("extra key", (value) => { value.binding.sourceDigests.legacy = digest("legacy"); });
for (const invalid of ["", "1".repeat(63), "z".repeat(64), "A".repeat(64), null]) {
  rejectMutation(`malformed digest ${String(invalid)}`, (value) => {
    value.binding.sourceDigests.coordinator = invalid;
  });
}
for (const key of digestKeys) {
  rejectMutation(`single wrong ${key} digest`, (value) => {
    value.binding.sourceDigests[key] = digest(`wrong-${key}`);
  });
}
rejectMutation("swapped workflow/tree", (value) => {
  [value.binding.sourceDigests.workflow, value.binding.sourceDigests.sourceTree] =
    [value.binding.sourceDigests.sourceTree, value.binding.sourceDigests.workflow];
  value.binding.sourceTreeSha256 = value.binding.sourceDigests.sourceTree;
});
rejectMutation("workflow attributed to implementation checkout", (value) => {
  value.binding.sourceDigests.workflow = digest("trusted-C2-workflow");
});
rejectMutation("implementation attributed to workflow checkout", (value) => {
  value.binding.sourceDigests.coordinator = digest("trusted-S-coordinator");
});
rejectMutation("tree digest not bound to implementation", (value) => {
  value.binding.sourceTreeSha256 = digest("untrusted-tree");
});
for (const field of ["sourceCommit", "source_commit"]) {
  rejectMutation(`legacy ci.${field}`, (value) => { value.ci[field] = sha; });
  rejectMutation(`legacy binding.${field}`, (value) => { value.binding[field] = sha; });
}
rejectMutation("v1", (value) => { value.schemaVersion = 1; });
rejectMutation("wrong candidate ref", (value) => {
  value.ci.sourceRef = "refs/heads/tr01/implementation-identity-candidate";
});
  rejectMutation("old C3 candidate evidence", (value) => {
    value.ci.sourceRef = "refs/heads/tr01/implementation-identity-successor-c3";
    value.ci.workflowRef = "example/repository/.github/workflows/ledgerly-canonical-postgresql.yml@" + value.ci.sourceRef;
    value.binding.ciSourceRef = value.ci.sourceRef;
  });
rejectMutation("old C2 candidate evidence", (value) => {
  value.ci.sourceRef = "refs/heads/tr01/implementation-identity-successor-c2";
  value.ci.workflowRef = "example/repository/.github/workflows/ledgerly-canonical-postgresql.yml@" +
    value.ci.sourceRef;
  value.binding.ciSourceRef = value.ci.sourceRef;
});
rejectMutation("wrong workflow ref", (value) => {
  value.ci.workflowRef = "example/repository/.github/workflows/other.yml@" + candidateRef;
});
rejectMutation("wrong candidate commit", (value) => {
  value.ci.workflowSourceCommit = "b".repeat(40);
  value.binding.workflowSourceCommit = value.ci.workflowSourceCommit;
});
rejectMutation("false ancestry", (value) => { value.ci.ancestryVerified = false; });
rejectMutation("dirty workflow root", (value) => { value.ci.workflowCheckoutClean = false; });
rejectMutation("dirty implementation root", (value) => {
  value.ci.implementationCheckoutClean = false;
});
rejectMutation("self-consistent untrusted digest map", (value) => {
  value.binding.sourceDigests = Object.fromEntries(
    digestKeys.map((key) => [key, digest(`untrusted-${key}`)]),
  );
  value.binding.sourceTreeSha256 = value.binding.sourceDigests.sourceTree;
});

const activatedPassed = passedEvidence(activatedTrusted.ci, activatedTrusted.sourceDigests);
assert.doesNotThrow(() => validateActivatedEvidence(activatedPassed, activatedTrusted));
rejectMutation("activated workflow falsely attributed to C2", (value) => {
  value.binding.sourceDigests.workflow = candidateTrusted.sourceDigests.workflow;
}, activatedPassed, activatedTrusted, validateActivatedEvidence);
rejectMutation("activated implementation falsely attributed to S", (value) => {
  value.binding.sourceDigests.coordinator = sCoordinatorDigest;
}, activatedPassed, activatedTrusted, validateActivatedEvidence);
rejectMutation("activated implementation tree falsely attributed to S", (value) => {
  value.binding.sourceDigests.sourceTree = sTreeDigest;
  value.binding.sourceTreeSha256 = sTreeDigest;
}, activatedPassed, activatedTrusted, validateActivatedEvidence);
rejectMutation("activated wrong implementation commit", (value) => {
  value.ci.implementationSourceCommit = "c".repeat(40);
  value.binding.implementationSourceCommit = value.ci.implementationSourceCommit;
}, activatedPassed, activatedTrusted, validateActivatedEvidence);
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
assert.match(disposableRunner, /refs\/heads\/tr01\/implementation-identity-successor-c4/);
assert.doesNotMatch(disposableRunner, /refs\/heads\/tr01\/implementation-identity-successor-c2/);
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
assert.match(sql, /refs\/heads\/tr01\/implementation-identity-successor-c4/);
assert.doesNotMatch(sql, /refs\/heads\/tr01\/implementation-identity-successor-c2/);
assert.match(sql, /refs\/heads\/main/);

const workflow = await read(".github/workflows/ledgerly-canonical-postgresql.yml");
assert.match(workflow, /fetch-depth: 0/);
assert.match(workflow, /path: candidate/);
assert.match(workflow, /LEDGERLY_APPROVED_CANDIDATE_SHA/);
assert.match(workflow, /LEDGERLY_IDENTITY_MODE/);
assert.match(workflow, /refs\/heads\/tr01\/implementation-identity-successor-c4/);
assert.doesNotMatch(workflow, /refs\/heads\/tr01\/implementation-identity-successor-c2/);
assert.match(workflow, /candidate\/scripts\/ci\/run-ledgerly-canonical-postgresql\.mjs/);
assert.match(workflow, /\*\*\/docs\/governance\/evidence\/ledgerly-44-ti-03-\*\.json/);

await rm(fixtureDirectory, { recursive: true, force: true });
console.log("TR-01 identity and acceptance tests passed");