import assert from "node:assert/strict";
import test from "node:test";
import {
  bootstrapRetryClassificationInput,
  captureBootstrapDiagnostic,
  isApprovedFkIndexOrderingError,
  sanitizeBootstrapDiagnostic,
  sanitizeEvidence,
  validateEvidenceContract,
} from "./run-ledgerly-canonical-postgresql.mjs";

const digest = `sha256:${"a".repeat(64)}`;
const ci = {
  provider: "github-actions",
  repository: "example/ledgerly",
  workflow: "Ledgerly canonical PostgreSQL qualification",
  workflowRef:
    "example/ledgerly/.github/workflows/ledgerly-canonical-postgresql.yml@refs/heads/main",
  runId: "1",
  runAttempt: "1",
  job: "canonical-postgresql",
  sourceCommit: "abc123",
};
const images = {
  postgres: { tag: "postgres:16.15-bookworm", digest },
  node: { tag: "node:24.13.0-bookworm-slim", digest },
};
const cleanup = {
  logicalDrop: true,
  databaseAbsent: true,
  containerRemoved: true,
  networkRemoved: true,
  credentialMaterialRemoved: true,
};
const failedIsolation = {
  parentDatabaseUrlAbsent: true,
  replitVariablesAbsent: true,
  noPublishedPorts: false,
  internalNetwork: false,
  testContainerNoSocket: false,
  testContainerNoExternalRoute: false,
  heliumdbContacted: false,
  productionContacted: false,
  secretScanPassed: true,
};
const passedIsolation = {
  ...failedIsolation,
  noPublishedPorts: true,
  internalNetwork: true,
  testContainerNoSocket: true,
  testContainerNoExternalRoute: true,
};
const requiredNegativeControls = [
  "missingRunBinding",
  "forgedRunDatabaseMismatch",
  "malformedUri",
  "targetChangingQuery",
  "wrongHost",
  "wrongPort",
  "wrongDatabase",
  "wrongRole",
  "parentDatabaseUrl",
  "replitMarker",
  "inheritedPgOverride",
  "unpinnedImage",
  "untrustedEvent",
  "unauthorizedWorkflow",
  "cleanupBindingMismatch",
  "evidenceCredentialPattern",
  "roleEscalation",
  "triggerDisable",
];

function failedEvidence(overrides = {}) {
  return {
    schemaVersion: 1,
    result: "failed",
    failurePhase: "bootstrap",
    ci,
    images,
    cleanup,
    isolation: failedIsolation,
    ...overrides,
  };
}

function passedEvidence() {
  return {
    schemaVersion: 1,
    result: "passed",
    failurePhase: null,
    ci,
    images,
    binding: {
      runUuid: "11111111-1111-4111-8111-111111111111",
      databaseName: `ledgerly_canonical_test_${"a".repeat(32)}`,
      environment: "external-ci-disposable-test",
      targetClassification: "external-ci-postgresql-service-container",
      creatorIdentity: "postgres",
      runtimeIdentity: "ledgerly_api",
      sourceCommit: "abc123",
      sourceTreeSha256: "a".repeat(64),
      nonceSha256: "b".repeat(64),
    },
    bootstrap: {
      status: "passed",
      roleSeparation: [],
      ownership: [],
      acl: {},
      constraints: [],
      indexes: [],
      triggers: [],
      emptyBaseline: true,
      privateBinding: true,
    },
    runtime: {
      databaseName: `ledgerly_canonical_test_${"a".repeat(32)}`,
      currentUser: "ledgerly_api",
      sessionUser: "ledgerly_api",
      identityVerified: true,
      privateBindingVerified: true,
      sourceDigestsVerified: true,
      concurrencyEvidence: {},
    },
    negativeControls: Object.fromEntries(
      requiredNegativeControls.map((control) => [control, true]),
    ),
    cleanup,
    isolation: passedIsolation,
  };
}

test("retains an ordinary database error and prefers stderr", () => {
  const error = new Error("message diagnostic");
  error.stderr = "ERROR: relation accounting_posting_effects does not exist";
  const diagnostic = captureBootstrapDiagnostic(error);
  assert.match(diagnostic, /relation accounting_posting_effects does not exist/);
  assert.doesNotMatch(diagnostic, /message diagnostic/);
});

test("redacts credential and token values including whitespace", () => {
  const diagnostic = sanitizeBootstrapDiagnostic(
    [
      "postgresql://ledgerly_api:uri-password@example.invalid/db?password=query-password",
      "password: correct horse battery staple",
      "token=multi word token value",
      "Authorization: Bearer bearer-secret",
      "PGPASSWORD=database password with spaces",
      "DATABASE_URL=postgres://user:password@example.invalid/db",
      "github token github_pat_secretvalue",
      "ghs_secretvalue",
      "safe database error remains",
    ].join("\n"),
  );
  for (const secret of [
    "uri-password",
    "query-password",
    "correct horse battery staple",
    "multi word token value",
    "bearer-secret",
    "database password with spaces",
    "github_pat_secretvalue",
    "ghs_secretvalue",
  ]) {
    assert.equal(diagnostic.includes(secret), false, `secret leaked: ${secret}`);
  }
  assert.match(diagnostic, /safe database error remains/);
  assert.doesNotThrow(() => sanitizeEvidence({ bootstrapDiagnostic: diagnostic }));
});

test("bounds the sanitized diagnostic to 2048 characters", () => {
  const diagnostic = sanitizeBootstrapDiagnostic(
    `password: hidden secret\n${"x".repeat(5_000)}`,
  );
  assert.ok(diagnostic.length <= 2_048);
  assert.match(diagnostic, /\.\.\.\[truncated\]$/);
  assert.equal(diagnostic.includes("hidden secret"), false);
});

test("uses the message and generic fallback when stderr is unavailable", () => {
  assert.equal(
    captureBootstrapDiagnostic(new Error("message diagnostic")),
    "message diagnostic",
  );
  assert.equal(captureBootstrapDiagnostic(undefined), "bootstrap command failed");
});

test("preserves the approved bounded FK/index retry classification", () => {
  const approved =
    "no unique constraint matching given keys for referenced table " +
    "accounting_posting_effects economic_effect_id";
  const approvedError = new Error("docker exited with status 1");
  approvedError.stderr = approved;
  assert.equal(
    isApprovedFkIndexOrderingError(
      bootstrapRetryClassificationInput(approvedError),
    ),
    true,
  );

  const trailingWhitespaceError = new Error("docker exited with status 1");
  trailingWhitespaceError.stderr = `${approved}${"\n ".repeat(600)}`;
  assert.equal(
    isApprovedFkIndexOrderingError(
      bootstrapRetryClassificationInput(trailingWhitespaceError),
    ),
    true,
  );

  const unknownError = new Error("docker exited with status 1");
  unknownError.stderr =
    `${approved}${"x".repeat(600)}`;
  assert.equal(
    isApprovedFkIndexOrderingError(
      bootstrapRetryClassificationInput(unknownError),
    ),
    false,
  );
  assert.equal(
    isApprovedFkIndexOrderingError("accounting_posting_effects economic_effect_id"),
    false,
  );
});

test("validates new and historical failed evidence", () => {
  assert.doesNotThrow(() => validateEvidenceContract(failedEvidence()));
  assert.doesNotThrow(() =>
    validateEvidenceContract(
      failedEvidence({ bootstrapDiagnostic: "ERROR: relation does not exist" }),
    ),
  );
  assert.throws(() =>
    validateEvidenceContract(
      failedEvidence({ bootstrapDiagnostic: "x".repeat(2_049) }),
    ),
  );
  assert.throws(() =>
    validateEvidenceContract(
      failedEvidence({
        failurePhase: "test",
        bootstrapDiagnostic: "diagnostic",
      }),
    ),
  );
});

test("keeps successful evidence valid and excludes bootstrap diagnostics", () => {
  assert.doesNotThrow(() => validateEvidenceContract(passedEvidence()));
  assert.throws(() =>
    validateEvidenceContract({
      ...passedEvidence(),
      bootstrapDiagnostic: "diagnostic",
    }),
  );
});