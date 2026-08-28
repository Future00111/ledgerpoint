import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { sanitizeBootstrapDiagnostic } from "../../../scripts/ci/run-ledgerly-canonical-postgresql.mjs";

const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
const workspaceDirectory = path.resolve(packageDirectory, "../..");
const expectedCommand = "pnpm --filter @workspace/api-server run test:canonical-posting";
const externalMode = process.env.LEDGERLY_CANONICAL_TEST_MODE === "external-ci";
const processDiagnosticTailMaxLength = 8_192;
const testDiagnosticFallback = "test command failed";

function requireEnvironment(names) {
  for (const name of names) {
    if (!process.env[name]) {
      throw new Error(`${name} is required; canonical tests have no fallback`);
    }
  }
}

function sha256File(relativePath) {
  return createHash("sha256")
    .update(readFileSync(path.join(workspaceDirectory, relativePath)))
    .digest("hex");
}

function sha256Files(relativePaths) {
  const hash = createHash("sha256");
  for (const relativePath of [...relativePaths].sort()) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(path.join(workspaceDirectory, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

const sourceFiles = {
  applicationSchema: "lib/db/src/schema/index.ts",
  drizzleConfig: "lib/db/drizzle.config.ts",
  securityOverlay: "scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql",
  runControlSql: "scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql",
  coordinator: "scripts/ci/run-ledgerly-canonical-postgresql.mjs",
  canonicalCoordinator: "artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs",
  canonicalTests: "artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts",
  canonicalPosting: "artifacts/api-server/src/services/accounting/canonicalPosting.ts",
  lockfile: "pnpm-lock.yaml",
  workflow: ".github/workflows/ledgerly-canonical-postgresql.yml",
};
const sourceManifestPath = ".ci/ledgerly-canonical/source-manifest.json";

function verifiedExecutionSourceTreeDigest() {
  const manifest = JSON.parse(
    readFileSync(path.join(workspaceDirectory, sourceManifestPath), "utf8"),
  );
  if (
    manifest?.version !== 1 ||
    !Array.isArray(manifest.files) ||
    !/^[0-9a-f]{64}$/.test(manifest.sourceTreeSha256) ||
    manifest.files.length === 0 ||
    manifest.files.some(
      (file) =>
        typeof file !== "string" ||
        path.isAbsolute(file) ||
        file.split("/").includes(".."),
    ) ||
    new Set(manifest.files).size !== manifest.files.length ||
    [...manifest.files].sort().some((file, index) => file !== manifest.files[index])
  ) {
    throw new Error("The execution source manifest is invalid");
  }
  const calculated = sha256Files(manifest.files);
  if (calculated !== manifest.sourceTreeSha256) {
    throw new Error("The execution source manifest digest does not match the image contents");
  }
  return calculated;
}

function commonSourceDigests() {
  return {
    applicationSchema: sha256File(sourceFiles.applicationSchema),
    drizzleConfig: sha256File(sourceFiles.drizzleConfig),
    securityOverlay: sha256File(sourceFiles.securityOverlay),
  };
}

function externalSourceDigests() {
  const testSources = [
    sourceFiles.canonicalTests,
    sourceFiles.canonicalPosting,
  ];
  return {
    ...commonSourceDigests(),
    sourceTree: verifiedExecutionSourceTreeDigest(),
    runControlSql: sha256File(sourceFiles.runControlSql),
    coordinator: sha256File(sourceFiles.coordinator),
    testSources: sha256Files(testSources),
    lockfile: sha256File(sourceFiles.lockfile),
    workflow: sha256File(sourceFiles.workflow),
    orchestrator: sha256File(sourceFiles.coordinator),
  };
}

function assertSafeConnectionUrl(url, label) {
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`${label} must use a PostgreSQL URI`);
  }
  if (!url.hostname || !url.port) {
    throw new Error(`${label} must declare its host and port`);
  }
  const keys = [...url.searchParams.keys()];
  if (keys.some((key) => key !== "sslmode") || keys.length !== new Set(keys).size) {
    throw new Error(`${label} contains a forbidden or duplicate target override`);
  }
}

function assertUuid(value, label) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
    throw new Error(`${label} is invalid`);
  }
}

function assertHash(value, label) {
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${label} is invalid`);
  }
}

function extractMarker(output, marker) {
  const line = output
    .split("\n")
    .find((candidate) => candidate.startsWith(marker));
  if (!line) {
    throw new Error(`Canonical suite did not emit ${marker.trim()}`);
  }
  return JSON.parse(line.slice(marker.length));
}

function boundedDiagnosticTail(value) {
  return value.length > processDiagnosticTailMaxLength
    ? value.slice(-processDiagnosticTailMaxLength)
    : value;
}

function processFailure(message, stdout, stderr) {
  const error = new Error(message);
  error.stdout = boundedDiagnosticTail(stdout);
  error.stderr = boundedDiagnosticTail(stderr);
  return error;
}

function runProcess(command, args, { env, cwd, input, timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
          setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
        }, timeoutMs)
      : undefined;
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        reject(processFailure(`${command} timed out`, stdout, stderr));
      } else if (signal) {
        reject(processFailure(`${command} terminated by ${signal}`, stdout, stderr));
      } else if (code !== 0) {
        reject(processFailure(`${command} exited with status ${code}`, stdout, stderr));
      } else {
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
        resolve({ stdout, stderr });
      }
    });
    if (input !== undefined) {
      child.stdin.end(input);
    } else {
      child.stdin.end();
    }
  });
}

async function verifyExternalBinding({
  disposableDatabaseUrl,
  databaseName,
  runId,
  runNonce,
  environment,
  targetClass,
  ci,
  sourceDigests,
  imageBinding,
}) {
  const url = new URL(disposableDatabaseUrl);
  if (
    url.username !== "ledgerly_api" ||
    decodeURIComponent(url.pathname.slice(1)) !== databaseName ||
    url.hostname !== "ledgerly-postgres" ||
    url.port !== "5432" ||
    url.hash ||
    url.search !== "?sslmode=disable"
  ) {
    throw new Error("The external disposable target is not exact");
  }
  if (url.password.length === 0 || decodeURIComponent(url.password).length < 32) {
    throw new Error("The external disposable target has no per-run credential");
  }

  const client = new pg.Client({ connectionString: disposableDatabaseUrl });
  await client.connect();
  try {
    const identity = (
      await client.query(
        `SELECT current_database() AS database,
                current_user AS "currentUser",
                session_user AS "sessionUser",
                current_setting('server_version') AS "serverVersion"`,
      )
    ).rows[0];
    if (
      identity?.database !== databaseName ||
      identity.currentUser !== "ledgerly_api" ||
      identity.sessionUser !== "ledgerly_api" ||
      !identity.serverVersion.startsWith("16.")
    ) {
      throw new Error("The external runtime identity or PostgreSQL version is not approved");
    }

    const binding = {
      runUuid: runId,
      databaseName,
      environment,
      targetClassification: targetClass,
      ciProvider: ci.provider,
      ciRepository: ci.repository,
      ciWorkflow: ci.workflow,
      ciWorkflowRef: ci.workflowRef,
      ciRunId: ci.runId,
      ciRunAttempt: ci.runAttempt,
      ciJob: ci.job,
      sourceCommit: ci.sourceCommit,
      sourceTreeSha256: sourceDigests.sourceTree,
      applicationSchemaSha256: sourceDigests.applicationSchema,
      drizzleConfigSha256: sourceDigests.drizzleConfig,
      securityOverlaySha256: sourceDigests.securityOverlay,
      runControlSqlSha256: sourceDigests.runControlSql,
      coordinatorSha256: sourceDigests.coordinator,
      testSourcesSha256: sourceDigests.testSources,
      lockfileSha256: sourceDigests.lockfile,
      workflowSha256: sourceDigests.workflow,
      orchestratorSha256: sourceDigests.orchestrator,
      expectedCommand,
      creatorIdentity: "postgres",
      expectedRuntimeIdentity: "ledgerly_api",
      postgresImageTag: imageBinding.postgresTag,
      postgresImageDigest: imageBinding.postgresDigest,
      nodeImageTag: imageBinding.nodeTag,
      nodeImageDigest: imageBinding.nodeDigest,
    };
    const result = await client.query(
      `SELECT public.ledgerly_verify_external_disposable_run($1::uuid, $2::jsonb, $3) AS verified`,
      [runId, JSON.stringify(binding), runNonce],
    );
    if (result.rows[0]?.verified !== true) {
      throw new Error("The private external-CI run binding did not verify");
    }
    return { identity, bindingVerified: true };
  } finally {
    await client.end();
  }
}

async function verifyNoLingeringTestSessions(databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT count(*)::int AS count
       FROM pg_stat_activity
       WHERE datname = current_database()
         AND usename = current_user
         AND pid <> pg_backend_pid()`,
    );
    if (result.rows[0]?.count !== 0) {
      throw new Error("The canonical test process left API-role sessions open");
    }
  } finally {
    await client.end();
  }
}

async function runExternalCi() {
  requireEnvironment([
    "LEDGERLY_CANONICAL_TEST_DATABASE_URL",
    "LEDGERLY_CANONICAL_TEST_DATABASE_NAME",
    "LEDGERLY_CANONICAL_TEST_RUN_ID",
    "LEDGERLY_CANONICAL_TEST_RUN_NONCE",
    "LEDGERLY_CANONICAL_TEST_ENVIRONMENT",
    "LEDGERLY_CANONICAL_TEST_TARGET_CLASS",
    "LEDGERLY_CANONICAL_TEST_SOURCE_TREE_SHA256",
    "LEDGERLY_CANONICAL_TEST_SCHEMA_SHA256",
    "LEDGERLY_CANONICAL_TEST_CONFIG_SHA256",
    "LEDGERLY_CANONICAL_TEST_OVERLAY_SHA256",
    "LEDGERLY_CANONICAL_TEST_RUN_CONTROL_SHA256",
    "LEDGERLY_CANONICAL_TEST_COORDINATOR_SHA256",
    "LEDGERLY_CANONICAL_TEST_SOURCES_SHA256",
    "LEDGERLY_CANONICAL_TEST_LOCKFILE_SHA256",
    "LEDGERLY_CANONICAL_TEST_WORKFLOW_SHA256",
    "LEDGERLY_CANONICAL_TEST_ORCHESTRATOR_SHA256",
    "LEDGERLY_CANONICAL_TEST_CI_PROVIDER",
    "LEDGERLY_CANONICAL_TEST_CI_REPOSITORY",
    "LEDGERLY_CANONICAL_TEST_CI_WORKFLOW",
    "LEDGERLY_CANONICAL_TEST_CI_WORKFLOW_REF",
    "LEDGERLY_CANONICAL_TEST_CI_RUN_ID",
    "LEDGERLY_CANONICAL_TEST_CI_RUN_ATTEMPT",
    "LEDGERLY_CANONICAL_TEST_CI_JOB",
    "LEDGERLY_CANONICAL_TEST_SOURCE_COMMIT",
    "LEDGERLY_CANONICAL_TEST_POSTGRES_IMAGE_TAG",
    "LEDGERLY_CANONICAL_TEST_POSTGRES_IMAGE_DIGEST",
    "LEDGERLY_CANONICAL_TEST_NODE_IMAGE_TAG",
    "LEDGERLY_CANONICAL_TEST_NODE_IMAGE_DIGEST",
  ]);

  if (process.env.DATABASE_URL || process.env.NODE_ENV === "production") {
    throw new Error("External-CI mode rejects a parent database or production marker");
  }
  const forbiddenKeys = Object.keys(process.env).filter(
    (name) =>
      /^PG(?:HOST|PORT|USER|DATABASE|SERVICE|SERVICEFILE|PASSFILE|PASSWORD|OPTIONS)$/.test(
        name,
      ) ||
      name.startsWith("REPLIT_") ||
      name === "REPLIT_DEV_DOMAIN" ||
      name === "GITHUB_TOKEN",
  );
  if (forbiddenKeys.length > 0) {
    throw new Error("External-CI mode rejects inherited target, Replit, or CI credential variables");
  }

  const databaseName = process.env.LEDGERLY_CANONICAL_TEST_DATABASE_NAME;
  const runId = process.env.LEDGERLY_CANONICAL_TEST_RUN_ID;
  const runNonce = process.env.LEDGERLY_CANONICAL_TEST_RUN_NONCE;
  const environment = process.env.LEDGERLY_CANONICAL_TEST_ENVIRONMENT;
  const targetClass = process.env.LEDGERLY_CANONICAL_TEST_TARGET_CLASS;
  assertUuid(runId, "The external disposable run UUID");
  assertHash(runNonce, "The external disposable run nonce");
  assertHash(process.env.LEDGERLY_CANONICAL_TEST_SOURCE_TREE_SHA256, "The source-tree digest");
  if (!/^ledgerly_canonical_test_[0-9a-f]{32}$/.test(databaseName)) {
    throw new Error("The external disposable database name is not allowlisted");
  }
  if (
    environment !== "external-ci-disposable-test" ||
    targetClass !== "external-ci-postgresql-service-container" ||
    process.env.LEDGERLY_CANONICAL_TEST_CI_PROVIDER !== "github-actions"
  ) {
    throw new Error("The external-CI binding markers are not exact");
  }

  const disposableDatabaseUrl = new URL(process.env.LEDGERLY_CANONICAL_TEST_DATABASE_URL);
  assertSafeConnectionUrl(disposableDatabaseUrl, "The external disposable database URL");
  const sourceDigests = externalSourceDigests();
  const expectedDigests = {
    sourceTree: process.env.LEDGERLY_CANONICAL_TEST_SOURCE_TREE_SHA256,
    applicationSchema: process.env.LEDGERLY_CANONICAL_TEST_SCHEMA_SHA256,
    drizzleConfig: process.env.LEDGERLY_CANONICAL_TEST_CONFIG_SHA256,
    securityOverlay: process.env.LEDGERLY_CANONICAL_TEST_OVERLAY_SHA256,
    runControlSql: process.env.LEDGERLY_CANONICAL_TEST_RUN_CONTROL_SHA256,
    coordinator: process.env.LEDGERLY_CANONICAL_TEST_COORDINATOR_SHA256,
    testSources: process.env.LEDGERLY_CANONICAL_TEST_SOURCES_SHA256,
    lockfile: process.env.LEDGERLY_CANONICAL_TEST_LOCKFILE_SHA256,
    workflow: process.env.LEDGERLY_CANONICAL_TEST_WORKFLOW_SHA256,
    orchestrator: process.env.LEDGERLY_CANONICAL_TEST_ORCHESTRATOR_SHA256,
  };
  if (
    Object.entries(expectedDigests).some(
      ([name, expected]) => sourceDigests[name] !== expected,
    )
  ) {
    throw new Error("External-CI source digests do not match the private run binding");
  }

  const ci = {
    provider: process.env.LEDGERLY_CANONICAL_TEST_CI_PROVIDER,
    repository: process.env.LEDGERLY_CANONICAL_TEST_CI_REPOSITORY,
    workflow: process.env.LEDGERLY_CANONICAL_TEST_CI_WORKFLOW,
    workflowRef: process.env.LEDGERLY_CANONICAL_TEST_CI_WORKFLOW_REF,
    runId: process.env.LEDGERLY_CANONICAL_TEST_CI_RUN_ID,
    runAttempt: process.env.LEDGERLY_CANONICAL_TEST_CI_RUN_ATTEMPT,
    job: process.env.LEDGERLY_CANONICAL_TEST_CI_JOB,
    sourceCommit: process.env.LEDGERLY_CANONICAL_TEST_SOURCE_COMMIT,
  };
  const imageBinding = {
    postgresTag: process.env.LEDGERLY_CANONICAL_TEST_POSTGRES_IMAGE_TAG,
    postgresDigest: process.env.LEDGERLY_CANONICAL_TEST_POSTGRES_IMAGE_DIGEST,
    nodeTag: process.env.LEDGERLY_CANONICAL_TEST_NODE_IMAGE_TAG,
    nodeDigest: process.env.LEDGERLY_CANONICAL_TEST_NODE_IMAGE_DIGEST,
  };
  const binding = await verifyExternalBinding({
    disposableDatabaseUrl: process.env.LEDGERLY_CANONICAL_TEST_DATABASE_URL,
    databaseName,
    runId,
    runNonce,
    environment,
    targetClass,
    ci,
    sourceDigests,
    imageBinding,
  });

  const childEnvironment = {
    PATH: process.env.PATH,
    NODE_ENV: "test",
    DATABASE_URL: process.env.LEDGERLY_CANONICAL_TEST_DATABASE_URL,
    LEDGERLY_CANONICAL_TEST_DATABASE_NAME: databaseName,
    LEDGERLY_CANONICAL_TEST_RUN_ID: runId,
    LEDGERLY_CANONICAL_TEST_ENVIRONMENT: environment,
    LEDGERLY_CANONICAL_TEST_TARGET_CLASS: targetClass,
  };
  const output = path.join(os.tmpdir(), `ledgerly-canonical-posting-${runId}.cjs`);
  let testOutput;
  try {
    await runProcess(
      "pnpm",
      [
        "exec",
        "esbuild",
        "src/services/accounting/canonicalPosting.integration.test.ts",
        "--bundle",
        "--platform=node",
        "--format=cjs",
        "--external:pg",
        "--external:pino",
        "--external:pino-http",
        "--external:pino-pretty",
        "--external:thread-stream",
        `--outfile=${output}`,
      ],
      { cwd: packageDirectory, env: childEnvironment, timeoutMs: 7 * 60 * 1000 },
    );
    testOutput = await runProcess("node", ["--test", output], {
      cwd: packageDirectory,
      env: childEnvironment,
      timeoutMs: 7 * 60 * 1000,
    });
  } finally {
    await rm(output, { force: true });
  }
  await verifyNoLingeringTestSessions(process.env.LEDGERLY_CANONICAL_TEST_DATABASE_URL);

  const identityEvidence = extractMarker(testOutput.stdout, "LEDGERLY_DISPOSABLE_IDENTITY ");
  const concurrencyEvidence = extractMarker(testOutput.stdout, "LEDGERLY_CONCURRENCY_EVIDENCE ");
  const negativePrivilegeEvidence = extractMarker(
    testOutput.stdout,
    "LEDGERLY_NEGATIVE_PRIVILEGE_EVIDENCE ",
  );
  if (!concurrencyEvidence.overlapProven) {
    throw new Error("The concurrency barrier did not prove overlapping transactions");
  }
  console.log(
    "LEDGERLY_CANONICAL_TEST_COMPLETION",
    JSON.stringify({
      runId,
      databaseName,
      environment,
      targetClass,
      privateRunBindingVerified: binding.bindingVerified,
      sourceDigests,
      identityEvidence,
      concurrencyEvidence,
      negativePrivilegeEvidence,
      externalCiIsolation: {
        parentDatabaseUrlAbsent: true,
        replitVariablesAbsent: true,
        developmentEndpointMatched: false,
      },
    }),
  );
}

async function runDevelopment() {
  requireEnvironment([
    "DATABASE_URL",
    "LEDGERLY_CANONICAL_TEST_DATABASE_URL",
    "LEDGERLY_CANONICAL_TEST_DATABASE_NAME",
    "LEDGERLY_CANONICAL_TEST_RUN_ID",
    "LEDGERLY_CANONICAL_TEST_RUN_NONCE",
    "LEDGERLY_CANONICAL_TEST_ENVIRONMENT",
    "LEDGERLY_CANONICAL_TEST_SCHEMA_SHA256",
    "LEDGERLY_CANONICAL_TEST_CONFIG_SHA256",
    "LEDGERLY_CANONICAL_TEST_OVERLAY_SHA256",
  ]);
  if (
    !process.env.REPLIT_DEV_DOMAIN ||
    process.env.REPLIT_DEPLOYMENT ||
    process.env.REPLIT_DEPLOYMENT_ID ||
    process.env.NODE_ENV === "production"
  ) {
    throw new Error("Canonical integration tests are permitted only in a Replit development workspace");
  }

  const normalDatabaseUrl = new URL(process.env.DATABASE_URL);
  const disposableDatabaseUrl = new URL(process.env.LEDGERLY_CANONICAL_TEST_DATABASE_URL);
  const databaseName = process.env.LEDGERLY_CANONICAL_TEST_DATABASE_NAME;
  const runId = process.env.LEDGERLY_CANONICAL_TEST_RUN_ID;
  const environment = process.env.LEDGERLY_CANONICAL_TEST_ENVIRONMENT;
  const runNonce = process.env.LEDGERLY_CANONICAL_TEST_RUN_NONCE;
  assertSafeConnectionUrl(normalDatabaseUrl, "The normal development database URL");
  assertSafeConnectionUrl(disposableDatabaseUrl, "The disposable database URL");
  if (!/^ledgerly_canonical_test_[0-9a-f]{32}$/.test(databaseName)) {
    throw new Error("The disposable database name is not allowlisted");
  }
  assertUuid(runId, "The disposable run UUID");
  assertHash(runNonce, "The disposable run nonce");
  if (environment !== "development-disposable-test") {
    throw new Error("The disposable environment marker is invalid");
  }
  if (
    decodeURIComponent(normalDatabaseUrl.username) !== "ledgerly_api" ||
    normalDatabaseUrl.pathname.slice(1) !== "heliumdb"
  ) {
    throw new Error("The normal development identity is not the approved ledgerly_api/heliumdb boundary");
  }
  if (
    decodeURIComponent(disposableDatabaseUrl.username) !== "ledgerly_api" ||
    disposableDatabaseUrl.pathname.slice(1) !== databaseName ||
    databaseName === "heliumdb"
  ) {
    throw new Error("The disposable database identity does not match the approved API-role binding");
  }
  if (
    normalDatabaseUrl.protocol !== disposableDatabaseUrl.protocol ||
    normalDatabaseUrl.hostname !== disposableDatabaseUrl.hostname ||
    normalDatabaseUrl.port !== disposableDatabaseUrl.port ||
    normalDatabaseUrl.search !== disposableDatabaseUrl.search
  ) {
    throw new Error("The disposable database is not on the approved development database endpoint");
  }
  const sourceDigests = commonSourceDigests();
  if (
    sourceDigests.applicationSchema !== process.env.LEDGERLY_CANONICAL_TEST_SCHEMA_SHA256 ||
    sourceDigests.drizzleConfig !== process.env.LEDGERLY_CANONICAL_TEST_CONFIG_SHA256 ||
    sourceDigests.securityOverlay !== process.env.LEDGERLY_CANONICAL_TEST_OVERLAY_SHA256
  ) {
    throw new Error("The bound bootstrap source digest changed");
  }

  async function snapshotNormalDevelopment() {
    const client = new pg.Client({ connectionString: normalDatabaseUrl.toString() });
    await client.connect();
    try {
      const identity = (
        await client.query(
          `SELECT current_database() AS database, current_user AS current_user, session_user AS session_user`,
        )
      ).rows[0];
      if (
        identity?.database !== "heliumdb" ||
        identity.current_user !== "ledgerly_api" ||
        identity.session_user !== "ledgerly_api"
      ) {
        throw new Error("The normal development snapshot identity changed");
      }
      const tables = [
        "accounting_posting_effects",
        "canonical_journal_entries",
        "canonical_journal_lines",
        "canonical_journal_relations",
        "accounting_audit_events",
        "journal_entries",
      ];
      const snapshot = {};
      for (const table of tables) {
        const rows = (
          await client.query(
            `SELECT id::text AS id, to_jsonb(t)::text AS row_json
             FROM public."${table}" t
             ORDER BY id`,
          )
        ).rows;
        snapshot[table] = {
          count: rows.length,
          sha256: createHash("sha256")
            .update(rows.map((row) => `${row.id}:${row.row_json}`).join("\n"))
            .digest("hex"),
        };
      }
      return snapshot;
    } finally {
      await client.end();
    }
  }

  async function verifyPrivateRunBinding() {
    const client = new pg.Client({ connectionString: disposableDatabaseUrl.toString() });
    await client.connect();
    try {
      const identity = (
        await client.query(
          `SELECT current_database() AS database, current_user AS current_user, session_user AS session_user`,
        )
      ).rows[0];
      if (
        identity?.database !== databaseName ||
        identity.current_user !== "ledgerly_api" ||
        identity.session_user !== "ledgerly_api"
      ) {
        throw new Error("The disposable runtime identity does not match its binding");
      }
      const verification = await client.query(
        `SELECT public.ledgerly_verify_disposable_run(
           $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9
         ) AS verified`,
        [
          runId,
          databaseName,
          environment,
          "postgres",
          sourceDigests.applicationSchema,
          sourceDigests.drizzleConfig,
          sourceDigests.securityOverlay,
          expectedCommand,
          runNonce,
        ],
      );
      if (verification.rows[0]?.verified !== true) {
        throw new Error("The private disposable run binding did not verify");
      }
    } finally {
      await client.end();
    }
  }

  const output = path.join(os.tmpdir(), `ledgerly-canonical-posting-${runId}.cjs`);
  const childEnvironment = {
    ...process.env,
    DATABASE_URL: disposableDatabaseUrl.toString(),
  };
  for (const name of [
    "PGHOST",
    "PGPORT",
    "PGUSER",
    "PGPASSWORD",
    "PGDATABASE",
    "PGSSLMODE",
    "LEDGERLY_CANONICAL_TEST_DATABASE_URL",
    "LEDGERLY_CANONICAL_TEST_RUN_NONCE",
  ]) {
    delete childEnvironment[name];
  }
  const normalBefore = await snapshotNormalDevelopment();
  await verifyPrivateRunBinding();
  let testOutput;
  try {
    await runProcess(
      "pnpm",
      [
        "exec",
        "esbuild",
        "src/services/accounting/canonicalPosting.integration.test.ts",
        "--bundle",
        "--platform=node",
        "--format=cjs",
        "--external:pg",
        "--external:pino",
        "--external:pino-http",
        "--external:pino-pretty",
        "--external:thread-stream",
        `--outfile=${output}`,
      ],
      { cwd: packageDirectory, env: childEnvironment },
    );
    testOutput = await runProcess("node", ["--test", output], {
      cwd: packageDirectory,
      env: childEnvironment,
    });
  } finally {
    await rm(output, { force: true });
  }
  await verifyNoLingeringTestSessions(disposableDatabaseUrl.toString());
  const normalAfter = await snapshotNormalDevelopment();
  if (JSON.stringify(normalBefore) !== JSON.stringify(normalAfter)) {
    throw new Error("The normal development canonical manifest changed during disposable tests");
  }
  const identityEvidence = extractMarker(testOutput.stdout, "LEDGERLY_DISPOSABLE_IDENTITY ");
  const concurrencyEvidence = extractMarker(testOutput.stdout, "LEDGERLY_CONCURRENCY_EVIDENCE ");
  if (!concurrencyEvidence.overlapProven) {
    throw new Error("The concurrency barrier did not prove overlapping transactions");
  }
  console.log(
    "LEDGERLY_CANONICAL_TEST_COMPLETION",
    JSON.stringify({
      runId,
      databaseName,
      environment,
      privateRunBindingVerified: true,
      developmentEndpointMatched: true,
      sourceDigests,
      identityEvidence,
      concurrencyEvidence,
      normalDevelopmentBefore: normalBefore,
      normalDevelopmentAfter: normalAfter,
      normalDevelopmentUnchanged: true,
      administrativeEnvironmentRemovedFromTestProcess: true,
    }),
  );
}

async function execute() {
  try {
    if (externalMode) {
      await runExternalCi();
    } else {
      await runDevelopment();
    }
  } catch (error) {
    const stderr =
      error && typeof error.stderr === "string" ? error.stderr.trim() : "";
    const stdout =
      error && typeof error.stdout === "string" ? error.stdout.trim() : "";
    const message = error instanceof Error ? error.message : String(error);
    const diagnostic =
      sanitizeBootstrapDiagnostic(stderr || stdout || message) ??
      testDiagnosticFallback;
    process.stderr.write(`${diagnostic}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await execute();
}

export { boundedDiagnosticTail, runProcess };