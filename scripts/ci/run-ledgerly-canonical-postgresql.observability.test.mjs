import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import {
  appendDiagnosticTail as appendCoordinatorDiagnosticTail,
  bootstrapRetryClassificationInput,
  captureBootstrapDiagnostic,
  captureTestDiagnostic,
  isApprovedFkIndexOrderingError,
  run,
  runApprovedBootstrapRetry,
  sanitizeBootstrapDiagnostic,
  sanitizeEvidence,
  validateEvidenceContract,
} from "./run-ledgerly-canonical-postgresql.mjs";
import {
  appendDiagnosticTail as appendRunnerDiagnosticTail,
  runProcess,
} from "../../artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs";

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

test("captures bounded child output and applies stderr-first test precedence", async () => {
  await assert.rejects(
    runProcess(process.execPath, [
      "-e",
      "process.stdout.write('stdout diagnostic'); process.stderr.write('stderr diagnostic'); process.exit(1)",
    ]),
    (error) => {
      assert.equal(error.stdout, "stdout diagnostic");
      assert.equal(error.stderr, "stderr diagnostic");
      assert.equal(captureTestDiagnostic(error), "stderr diagnostic");
      return true;
    },
  );
});

test("keeps successful child-process output unchanged", async () => {
  const result = await runProcess(process.execPath, [
    "-e",
    "process.stdout.write('successful stdout'); process.stderr.write('successful stderr')",
  ]);
  assert.deepEqual(result, {
    stdout: "successful stdout",
    stderr: "successful stderr",
  });
});

test("preserves long successful stdout and completion markers outside the failure tail", async () => {
  const marker = "LEDGERLY_CANONICAL_TEST_COMPLETION marker-at-the-start\n";
  const expected = marker + "s".repeat(12_000);
  const result = await runProcess(process.execPath, [
    "-e",
    `process.stdout.write(${JSON.stringify(expected)})`,
  ]);
  assert.equal(result.stdout, expected);
  assert.match(result.stdout, /^LEDGERLY_CANONICAL_TEST_COMPLETION marker-at-the-start/);
});

test("preserves long successful stderr", async () => {
  const expected = "e".repeat(12_000);
  const result = await runProcess(process.execPath, [
    "-e",
    `process.stderr.write(${JSON.stringify(expected)})`,
  ]);
  assert.equal(result.stderr, expected);
});

test("streams successful child output before the child exits", async () => {
  const runnerUrl = new URL(
    "../../artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs",
    import.meta.url,
  ).href;
  const nestedScript =
    "process.stdout.write('stream-now'); setTimeout(() => process.exit(0), 400)";
  const harnessScript =
    `import { runProcess } from ${JSON.stringify(runnerUrl)};` +
    `await runProcess(process.execPath, ['-e', ${JSON.stringify(nestedScript)}]);`;
  const harness = spawn(
    process.execPath,
    ["--input-type=module", "-e", harnessScript],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stdout = "";
  let stderr = "";
  let firstStdoutAt = null;
  harness.stdout.on("data", (chunk) => {
    firstStdoutAt ??= Date.now();
    stdout += chunk;
  });
  harness.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const result = await new Promise((resolve, reject) => {
    harness.on("error", reject);
    harness.on("close", (code, signal) => {
      resolve({ code, signal, closedAt: Date.now() });
    });
  });
  assert.deepEqual({ code: result.code, signal: result.signal }, { code: 0, signal: null });
  assert.equal(stdout, "stream-now");
  assert.equal(stderr, "");
  assert.notEqual(firstStdoutAt, null);
  assert.ok(
    result.closedAt - firstStdoutAt >= 200,
    "stdout was not forwarded while the child was still running",
  );
});

test("retains only the final 8192 characters from each failed stream", async () => {
  await assert.rejects(
    runProcess(process.execPath, [
      "-e",
      "process.stdout.write('o'.repeat(9000)); process.stderr.write('e'.repeat(9000)); process.exit(1)",
    ]),
    (error) => {
      assert.equal(error.stdout.length, 8_192);
      assert.equal(error.stderr.length, 8_192);
      assert.equal(error.stdout, "o".repeat(8_192));
      assert.equal(error.stderr, "e".repeat(8_192));
      return true;
    },
  );
});

test("bounds both rolling stream buffers while chunks are received", () => {
  for (const appendTail of [
    appendCoordinatorDiagnosticTail,
    appendRunnerDiagnosticTail,
  ]) {
    let tail = "";
    for (let index = 0; index < 256; index += 1) {
      tail = appendTail(tail, `${index}:` + "x".repeat(16_384));
      assert.ok(tail.length <= 8_192);
    }
    assert.equal(tail, "x".repeat(8_192));
  }
});

test("preserves explicitly bounded successful coordinator output above 8192 characters", async () => {
  const expected = "manifest-entry\n".repeat(2_200);
  const result = await run(
    process.execPath,
    ["-e", `process.stdout.write(${JSON.stringify(expected)})`],
    {
      quiet: true,
      captureMaxLength: 64 * 1024,
      failOnCaptureLimit: true,
    },
  );
  assert.equal(result.stdout, expected);
  assert.equal(result.stderr, "");
});

test("fails closed when explicit successful-output capture exceeds its finite limit", async () => {
  await assert.rejects(
    run(
      process.execPath,
      ["-e", "process.stdout.write('x'.repeat(70000))"],
      {
        quiet: true,
        captureMaxLength: 32 * 1024,
        failOnCaptureLimit: true,
      },
    ),
    (error) => {
      assert.equal(
        error.message,
        `${process.execPath} exceeded its output capture limit`,
      );
      assert.equal(error.stdout.length, 8_192);
      return true;
    },
  );
});

test("uses stdout, then the error message, then the test fallback", () => {
  const stdoutError = new Error("message diagnostic");
  stdoutError.stdout = "stdout diagnostic";
  assert.equal(captureTestDiagnostic(stdoutError), "stdout diagnostic");
  assert.equal(captureTestDiagnostic(new Error("message diagnostic")), "message diagnostic");
  assert.equal(captureTestDiagnostic(undefined), "test command failed");
});

test("unknown child-process failures remain fail-closed", async () => {
  await assert.rejects(
    runProcess(process.execPath, ["-e", "process.exit(23)"]),
    (error) => {
      assert.equal(error.message, `${process.execPath} exited with status 23`);
      assert.equal(error.stdout, "");
      assert.equal(error.stderr, "");
      return true;
    },
  );
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
      "LEDGERLY_CANONICAL_TEST_DATABASE_URL: postgres://ledgerly_api:colon-password@example.invalid/db",
      '"LEDGERLY_CANONICAL_TEST_RUN_NONCE" : "quoted nonce secret"',
      "'PGPASSWORD'  :  'quoted database password'",
      '{\\"LEDGERLY_CANONICAL_TEST_RUN_NONCE\\" : \\"escaped nonce secret\\"}',
      "github token github_pat_secretvalue",
      "ghs_secretvalue",
      "-----BEGIN PRIVATE KEY-----",
      "private-key-secret",
      "-----END PRIVATE KEY-----",
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
    "colon-password",
    "quoted nonce secret",
    "quoted database password",
    "escaped nonce secret",
    "github_pat_secretvalue",
    "ghs_secretvalue",
    "private-key-secret",
  ]) {
    assert.equal(diagnostic.includes(secret), false, `secret leaked: ${secret}`);
  }
  assert.match(diagnostic, /safe database error remains/);
  assert.doesNotThrow(() => sanitizeEvidence({ testDiagnostic: diagnostic }));
});

test("redacts multiline credential values without retaining the following line", () => {
  const diagnostic = sanitizeBootstrapDiagnostic(
    [
      "password:",
      "password-secret",
      "password=",
      "password-equals-secret",
      "TOKEN=",
      "token-secret",
      "Authorization:",
      "Bearer bearer-secret",
      "DATABASE_PASSWORD:",
      "database-password-secret",
      "DATABASE_PASSWORD=",
      "database-password-equals-secret",
      "ordinary following line remains",
    ].join("\n"),
  );
  for (const secret of [
    "password-secret",
    "password-equals-secret",
    "token-secret",
    "bearer-secret",
    "database-password-secret",
    "database-password-equals-secret",
  ]) {
    assert.equal(diagnostic.includes(secret), false, `secret leaked: ${secret}`);
  }
  assert.match(diagnostic, /ordinary following line remains/);
  assert.doesNotThrow(() => sanitizeEvidence({ testDiagnostic: diagnostic }));
});

test("rejects unsanitized sensitive environment assignments in evidence", () => {
  for (const testDiagnostic of [
    "LEDGERLY_CANONICAL_TEST_RUN_NONCE: nonce-secret",
    " LEDGERLY_CANONICAL_TEST_DATABASE_URL = postgres://ledgerly_api:password@example.invalid/db",
    '"LEDGERLY_CANONICAL_TEST_RUN_NONCE" : "quoted-secret"',
    "'PGPASSWORD'  :  'quoted-password'",
    '{\\"LEDGERLY_CANONICAL_TEST_RUN_NONCE\\" : \\"escaped-secret\\"}',
    "password:\nmultiline-password",
    "TOKEN=\nmultiline-token",
    "Authorization:\nBearer multiline-authorization",
    "DATABASE_PASSWORD:\nmultiline-database-password",
  ]) {
    assert.throws(
      () => sanitizeEvidence({ testDiagnostic }),
      /Evidence secret scanner rejected the output/,
    );
  }
});

test("bounds the sanitized diagnostic to 2048 characters", () => {
  const diagnostic = sanitizeBootstrapDiagnostic(
    `password: hidden secret\n${"x".repeat(5_000)}`,
  );
  assert.ok(diagnostic.length <= 2_048);
  assert.match(diagnostic, /\.\.\.\[truncated\]$/);
  assert.equal(diagnostic.includes("hidden secret"), false);
});

test("keeps the exact truncation marker within the 2048-character test bound", () => {
  const diagnostic = captureTestDiagnostic({
    stderr: "e".repeat(10_000),
  });
  assert.equal(diagnostic.length, 2_048);
  assert.equal(diagnostic.endsWith("\n...[truncated]"), true);
  assert.equal("\n...[truncated]".length, 15);
});

test("redacts a credential crossing the pre-boundary truncation point", () => {
  const secret = "boundary-secret";
  const diagnostic = captureTestDiagnostic({
    stderr: `${"x".repeat(3_000)}\npassword: ${secret}${"y".repeat(2_018)}`,
  });
  assert.equal(diagnostic.length, 2_048);
  assert.equal(diagnostic.includes(secret), false);
  assert.equal(diagnostic.endsWith("\n...[truncated]"), true);
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

test("keeps approved bootstrap retry failures quiet and sanitized", async () => {
  let observedOptions;
  await assert.rejects(
    runApprovedBootstrapRetry([], { CI: "true" }, async (_args, options) => {
      observedOptions = options;
      const error = new Error("docker exited with status 1");
      error.stderr =
        "LEDGERLY_CANONICAL_TEST_DATABASE_URL: postgres://ledgerly_api:retry-secret@example.invalid/db";
      throw error;
    }),
    (error) => {
      assert.equal(error.message, "Drizzle bootstrap retry failed");
      assert.equal(error.stderr, "[REDACTED_ENV]");
      assert.equal(error.stderr.includes("retry-secret"), false);
      return true;
    },
  );
  assert.deepEqual(observedOptions, {
    env: { CI: "true" },
    timeoutMs: 4 * 60 * 1000,
    quiet: true,
  });
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
  assert.doesNotThrow(() =>
    validateEvidenceContract(
      failedEvidence({
        failurePhase: "test",
        testDiagnostic: "ERROR: canonical test failed",
      }),
    ),
  );
  assert.throws(() =>
    validateEvidenceContract(
      failedEvidence({ testDiagnostic: "wrong phase" }),
    ),
  );
  assert.throws(() =>
    validateEvidenceContract(
      failedEvidence({
        failurePhase: "test",
        testDiagnostic: "x".repeat(2_049),
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
  assert.throws(() =>
    validateEvidenceContract({
      ...passedEvidence(),
      testDiagnostic: "diagnostic",
    }),
  );
});