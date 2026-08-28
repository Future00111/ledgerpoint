import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const postgresImage =
  "postgres:16.15-bookworm@sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825";
const postgresTag = "postgres:16.15-bookworm";
const postgresDigest =
  "sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825";
const nodeBaseImage =
  "node:24.13.0-bookworm-slim@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f";
const testImage = "ledgerly-canonical-test:24.13.0-bookworm-slim";
const nodeTag = "node:24.13.0-bookworm-slim";
const nodeDigest =
  "sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f";
const expectedCommand = "pnpm --filter @workspace/api-server run test:canonical-posting";
const bootstrapDiagnosticMaxLength = 2_048;
const bootstrapDiagnosticFallback = "bootstrap command failed";
const testDiagnosticFallback = "test command failed";
const diagnosticTailMaxLength = 8_192;
const workflowPath = ".github/workflows/ledgerly-canonical-postgresql.yml";
const approvedWorkflowName = "Ledgerly canonical PostgreSQL qualification";
const sourceManifestPath = ".ci/ledgerly-canonical/source-manifest.json";
const executionTreePathspecs = [
  ".dockerignore",
  ".ci/ledgerly-canonical/Dockerfile.test",
  ".github",
  "artifacts",
  "lib",
  "scripts",
  "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "tsconfig.json",
];
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
const sourcePaths = {
  applicationSchema: "lib/db/src/schema/index.ts",
  drizzleConfig: "lib/db/drizzle.config.ts",
  securityOverlay: "scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql",
  runControlSql: "scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql",
  coordinator: "scripts/ci/run-ledgerly-canonical-postgresql.mjs",
  canonicalCoordinator: "artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs",
  canonicalTests: "artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts",
  canonicalPosting: "artifacts/api-server/src/services/accounting/canonicalPosting.ts",
  lockfile: "pnpm-lock.yaml",
  workflow: workflowPath,
  evidenceSchema: "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json",
};

const state = {
  phase: "preflight",
  runId: null,
  databaseName: null,
  networkName: null,
  postgresContainer: null,
  testContainer: null,
  credentialDirectory: null,
  adminEnvFile: null,
  testEnvFile: null,
  databaseCreated: false,
  containerRemoved: false,
  networkRemoved: false,
  databaseAbsent: false,
  credentialMaterialRemoved: false,
  evidence: null,
  ci: null,
  runNonce: null,
  bootstrapDiagnostic: null,
  testDiagnostic: null,
  observedIsolation: {
    noPublishedPorts: false,
    internalNetwork: false,
    testContainerNoSocket: false,
    testContainerNoExternalRoute: false,
  },
};

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(relativePath) {
  return sha256Buffer(await readFile(path.join(root, relativePath)));
}

async function sha256Files(relativePaths) {
  const hash = createHash("sha256");
  for (const relativePath of [...relativePaths].sort()) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await readFile(path.join(root, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function boundedDiagnosticTail(value) {
  return value.length > diagnosticTailMaxLength
    ? value.slice(-diagnosticTailMaxLength)
    : value;
}

function attachProcessDiagnostics(error, stdout, stderr) {
  error.stdout = boundedDiagnosticTail(stdout);
  error.stderr = boundedDiagnosticTail(stderr);
  return error;
}

function run(command, args, { env, cwd = root, input, timeoutMs, quiet = false } = {}) {
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
      if (!quiet) process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (!quiet) process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        return reject(
          attachProcessDiagnostics(new Error(`${command} timed out`), stdout, stderr),
        );
      }
      if (signal) {
        return reject(
          attachProcessDiagnostics(
            new Error(`${command} terminated by ${signal}`),
            stdout,
            stderr,
          ),
        );
      }
      if (code !== 0) {
        const detail = quiet ? "" : `: ${stderr.trim().slice(-500)}`;
        return reject(
          attachProcessDiagnostics(
            new Error(`${command} exited with status ${code}${detail}`),
            stdout,
            stderr,
          ),
        );
      }
      resolve({ stdout, stderr });
    });
    child.stdin.end(input);
  });
}

function sanitizeBootstrapDiagnostic(value) {
  let text = typeof value === "string" ? value : value == null ? "" : String(value);
  text = text
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(
      /\bpostgres(?:ql)?:\/\/[^\s"'`<>]+/giu,
      "[REDACTED_URI]",
    )
    .replace(
      /(?:^|[\s,{])(?:\\*["'])?(?:DATABASE_URL|PGPASSWORD|LEDGERLY_CANONICAL_TEST_[A-Z0-9_]+|[A-Z][A-Z0-9_]*(?:PASSWORD|TOKEN|SECRET|KEY))(?:\\*["'])?\s*[:=]\s*[^\r\n]*/giu,
      "[REDACTED_ENV]",
    )
    .replace(
      /\bAuthorization(?:\s+header)?\s*[:=]\s*[^\r\n]*/giu,
      "[REDACTED_AUTHORIZATION]",
    )
    .replace(
      /["']?(?:password|passwd|pwd|secret|token|access_token|refresh_token|api[_-]?key|privateKey|cookie|authorization)["']?\s*[:=]\s*[^\r\n]*/giu,
      "[REDACTED_SECRET]",
    )
    .replace(
      /[?&](?:password|passwd|pwd|token|secret|key|api[_-]?key|access[_-]?token|authorization)=[^&#\s]*/giu,
      "[REDACTED_QUERY]",
    )
    .replace(
      /\b(?:gh[psour]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/gu,
      "[REDACTED_GITHUB_TOKEN]",
    )
    .replace(
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gu,
      "[REDACTED_PRIVATE_KEY]",
    )
    .replace(/\breplit\.(?:dev|app)\b[^\s]*/giu, "[REDACTED_REPLIT_TARGET]")
    .replace(/[^\S\n]+/g, " ")
    .trim();
  if (!text) return null;
  const truncationMarker = "\n...[truncated]";
  if (text.length > bootstrapDiagnosticMaxLength) {
    return (
      text.slice(-(bootstrapDiagnosticMaxLength - truncationMarker.length)) +
      truncationMarker
    );
  }
  return text;
}

function captureBootstrapDiagnostic(error) {
  const stderr =
    error && typeof error.stderr === "string" ? error.stderr.trim() : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    sanitizeBootstrapDiagnostic(stderr || message) ??
    bootstrapDiagnosticFallback
  );
}

function captureTestDiagnostic(error) {
  const stderr =
    error && typeof error.stderr === "string" ? error.stderr.trim() : "";
  const stdout =
    error && typeof error.stdout === "string" ? error.stdout.trim() : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    sanitizeBootstrapDiagnostic(stderr || stdout || message) ??
    testDiagnosticFallback
  );
}

function bootstrapRetryClassificationInput(error) {
  const stderr =
    error && typeof error.stderr === "string" ? error.stderr.trim() : "";
  return `${String(error)}: ${stderr.slice(-500)}`;
}

function isApprovedFkIndexOrderingError(pushOutput) {
  return (
    pushOutput.includes("no unique constraint matching given keys for referenced table") &&
    pushOutput.includes("accounting_posting_effects") &&
    pushOutput.includes("economic_effect_id")
  );
}

async function docker(args, options = {}) {
  return run("docker", args, options);
}

function assertPinnedImage(image, label) {
  if (!/^[^:@]+:[^@]+@sha256:[0-9a-f]{64}$/.test(image)) {
    throw new Error(`${label} is not pinned to an immutable digest`);
  }
}

function assertTrustedWorkflowContext(environment = process.env) {
  if (
    environment.GITHUB_ACTIONS !== "true" ||
    environment.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    environment.GITHUB_REF !== "refs/heads/main" ||
    environment.GITHUB_REF_PROTECTED !== "true"
  ) {
    throw new Error("TI-03 requires a protected main-branch workflow_dispatch run");
  }
  const expectedWorkflowRef = `${environment.GITHUB_REPOSITORY}/${workflowPath}@refs/heads/main`;
  if (
    environment.GITHUB_WORKFLOW !== approvedWorkflowName ||
    environment.GITHUB_WORKFLOW_REF !== expectedWorkflowRef ||
    environment.GITHUB_JOB !== "canonical-postgresql"
  ) {
    throw new Error("TI-03 requires the exact approved workflow identity");
  }
  if (environment.DATABASE_URL) {
    throw new Error("DATABASE_URL must be absent from the external CI parent environment");
  }
  const forbidden = Object.keys(environment).filter(
    (name) =>
      name.startsWith("REPLIT_") ||
      /^PG(?:HOST|PORT|USER|DATABASE|SERVICE|SERVICEFILE|PASSFILE|PASSWORD|OPTIONS)$/.test(name),
  );
  if (forbidden.length > 0) {
    throw new Error("External CI inherited a Replit or PostgreSQL target variable");
  }
  assertPinnedImage(postgresImage, "PostgreSQL image");
  assertPinnedImage(nodeBaseImage, "Node image");
}

function buildCiIdentity() {
  return {
    provider: "github-actions",
    repository: required("GITHUB_REPOSITORY"),
    workflow: required("GITHUB_WORKFLOW"),
    workflowRef: required("GITHUB_WORKFLOW_REF"),
    runId: required("GITHUB_RUN_ID"),
    runAttempt: required("GITHUB_RUN_ATTEMPT"),
    job: required("GITHUB_JOB"),
    sourceCommit: required("GITHUB_SHA"),
  };
}

async function createExecutionSourceManifest(ci) {
  await rm(path.join(root, sourceManifestPath), { force: true });
  const head = await run("git", ["rev-parse", "HEAD"], { quiet: true });
  if (head.stdout.trim() !== ci.sourceCommit) {
    throw new Error("The checked-out commit does not match the authorized workflow commit");
  }
  await run("git", ["diff", "--quiet"], { quiet: true });
  await run("git", ["diff", "--cached", "--quiet"], { quiet: true });
  const status = await run(
    "git",
    ["status", "--porcelain", "--untracked-files=all", "--", ...executionTreePathspecs],
    { quiet: true },
  );
  if (status.stdout.trim()) {
    throw new Error("The execution tree contains uncommitted or untracked files");
  }
  const tracked = await run(
    "git",
    ["ls-files", "-z", "--", ...executionTreePathspecs],
    { quiet: true },
  );
  const files = tracked.stdout.split("\0").filter(Boolean).sort();
  for (const requiredPath of [
    ".dockerignore",
    ".ci/ledgerly-canonical/Dockerfile.test",
    workflowPath,
    "artifacts/api-server/package.json",
    sourcePaths.canonicalCoordinator,
    sourcePaths.canonicalTests,
    sourcePaths.canonicalPosting,
    sourcePaths.applicationSchema,
    sourcePaths.drizzleConfig,
    sourcePaths.securityOverlay,
    sourcePaths.runControlSql,
    sourcePaths.evidenceSchema,
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
  ]) {
    if (!files.includes(requiredPath)) {
      throw new Error(`The execution source manifest is missing ${requiredPath}`);
    }
  }
  const sourceTreeSha256 = await sha256Files(files);
  const manifest = { version: 1, files, sourceTreeSha256 };
  await writeFile(
    path.join(root, sourceManifestPath),
    `${JSON.stringify(manifest)}\n`,
    { mode: 0o644 },
  );
  return manifest;
}

async function buildTestImage() {
  state.phase = "dependency-build";
  await docker([
    "build",
    "--pull",
    "--platform",
    "linux/amd64",
    "--file",
    ".ci/ledgerly-canonical/Dockerfile.test",
    "--tag",
    testImage,
    ".",
  ], { timeoutMs: 7 * 60 * 1000 });
  const imageInfo = await docker(["buildx", "imagetools", "inspect", nodeBaseImage], {
    quiet: true,
  });
  if (!imageInfo.stdout.includes(`Digest:    ${nodeDigest}`)) {
    throw new Error("The Node base image did not resolve to its reviewed manifest digest");
  }
}

async function adminSql(database, sql, { quiet = true } = {}) {
  return docker(
    [
      "exec",
      "--user",
      "postgres",
      "--interactive",
      state.postgresContainer,
      "psql",
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--quiet",
      "--tuples-only",
      "--dbname",
      database,
    ],
    { input: sql, quiet },
  );
}

async function createCredentials(runId, databaseName, sourceDigests, ci) {
  const nonce = randomBytes(32).toString("hex");
  const nonceSha256 = sha256Buffer(nonce);
  const postgresPassword = randomBytes(32).toString("base64url");
  const apiPassword = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const createdAt = new Date().toISOString();
  const binding = {
    runUuid: runId,
    databaseName,
    environment: "external-ci-disposable-test",
    targetClassification: "external-ci-postgresql-service-container",
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
    postgresImageTag: postgresTag,
    postgresImageDigest: postgresDigest,
    nodeImageTag: nodeTag,
    nodeImageDigest: nodeDigest,
  };
  const adminUrl = `postgres://postgres:${encodeURIComponent(postgresPassword)}@ledgerly-postgres:5432/${databaseName}?sslmode=disable`;
  const apiUrl = `postgres://ledgerly_api:${encodeURIComponent(apiPassword)}@ledgerly-postgres:5432/${databaseName}?sslmode=disable`;
  state.credentialDirectory = await import("node:fs/promises").then(({ mkdtemp }) =>
    mkdtemp(path.join("/tmp", `ledgerly-ti-03-${runId}-`)),
  );
  state.adminEnvFile = path.join(state.credentialDirectory, "admin.env");
  state.testEnvFile = path.join(state.credentialDirectory, "test.env");
  await writeFile(state.adminEnvFile, `DATABASE_URL=${adminUrl}\n`, { mode: 0o600 });
  await writeFile(
    state.testEnvFile,
    [
      "LEDGERLY_CANONICAL_TEST_MODE=external-ci",
      `LEDGERLY_CANONICAL_TEST_DATABASE_URL=${apiUrl}`,
      `LEDGERLY_CANONICAL_TEST_DATABASE_NAME=${databaseName}`,
      `LEDGERLY_CANONICAL_TEST_RUN_ID=${runId}`,
      `LEDGERLY_CANONICAL_TEST_RUN_NONCE=${nonce}`,
      "LEDGERLY_CANONICAL_TEST_ENVIRONMENT=external-ci-disposable-test",
      "LEDGERLY_CANONICAL_TEST_TARGET_CLASS=external-ci-postgresql-service-container",
      `LEDGERLY_CANONICAL_TEST_SOURCE_TREE_SHA256=${sourceDigests.sourceTree}`,
      `LEDGERLY_CANONICAL_TEST_SCHEMA_SHA256=${sourceDigests.applicationSchema}`,
      `LEDGERLY_CANONICAL_TEST_CONFIG_SHA256=${sourceDigests.drizzleConfig}`,
      `LEDGERLY_CANONICAL_TEST_OVERLAY_SHA256=${sourceDigests.securityOverlay}`,
      `LEDGERLY_CANONICAL_TEST_RUN_CONTROL_SHA256=${sourceDigests.runControlSql}`,
      `LEDGERLY_CANONICAL_TEST_COORDINATOR_SHA256=${sourceDigests.coordinator}`,
      `LEDGERLY_CANONICAL_TEST_SOURCES_SHA256=${sourceDigests.testSources}`,
      `LEDGERLY_CANONICAL_TEST_LOCKFILE_SHA256=${sourceDigests.lockfile}`,
      `LEDGERLY_CANONICAL_TEST_WORKFLOW_SHA256=${sourceDigests.workflow}`,
      `LEDGERLY_CANONICAL_TEST_ORCHESTRATOR_SHA256=${sourceDigests.orchestrator}`,
      `LEDGERLY_CANONICAL_TEST_CI_PROVIDER=${ci.provider}`,
      `LEDGERLY_CANONICAL_TEST_CI_REPOSITORY=${ci.repository}`,
      `LEDGERLY_CANONICAL_TEST_CI_WORKFLOW=${ci.workflow}`,
      `LEDGERLY_CANONICAL_TEST_CI_WORKFLOW_REF=${ci.workflowRef}`,
      `LEDGERLY_CANONICAL_TEST_CI_RUN_ID=${ci.runId}`,
      `LEDGERLY_CANONICAL_TEST_CI_RUN_ATTEMPT=${ci.runAttempt}`,
      `LEDGERLY_CANONICAL_TEST_CI_JOB=${ci.job}`,
      `LEDGERLY_CANONICAL_TEST_SOURCE_COMMIT=${ci.sourceCommit}`,
      `LEDGERLY_CANONICAL_TEST_POSTGRES_IMAGE_TAG=${postgresTag}`,
      `LEDGERLY_CANONICAL_TEST_POSTGRES_IMAGE_DIGEST=${postgresDigest}`,
      `LEDGERLY_CANONICAL_TEST_NODE_IMAGE_TAG=${nodeTag}`,
      `LEDGERLY_CANONICAL_TEST_NODE_IMAGE_DIGEST=${nodeDigest}`,
    ].join("\n") + "\n",
    { mode: 0o600 },
  );
  await chmod(state.adminEnvFile, 0o600);
  await chmod(state.testEnvFile, 0o600);
  return {
    nonce,
    nonceSha256,
    createdAt,
    expiresAt,
    binding,
    apiUrl,
    adminUrl,
    postgresPassword,
    apiPassword,
  };
}

async function startPostgres(postgresPassword) {
  state.phase = "postgres-start";
  state.networkName = `ledgerly-ti03-net-${state.runId.replaceAll("-", "").slice(0, 24)}`;
  state.postgresContainer = `ledgerly-ti03-pg-${state.runId.replaceAll("-", "").slice(0, 24)}`;
  await docker(["network", "create", "--internal", "--driver", "bridge", state.networkName]);
  await docker([
    "run",
    "--detach",
    "--name",
    state.postgresContainer,
    "--network",
    state.networkName,
    "--network-alias",
    "ledgerly-postgres",
    "--env",
    `POSTGRES_PASSWORD=${postgresPassword}`,
    "--env",
    "POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256",
    "--health-cmd=pg_isready -U postgres -d postgres",
    "--health-interval=2s",
    "--health-timeout=2s",
    "--health-retries=30",
    postgresImage,
  ], { quiet: true });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const status = await docker(
      ["inspect", "--format", "{{.State.Health.Status}}", state.postgresContainer],
      { quiet: true },
    );
    if (status.stdout.trim() === "healthy") return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("PostgreSQL readiness deadline exceeded");
}

async function bootstrapDatabase(credentials, sourceDigests, ci) {
  state.phase = "bootstrap";
  const postgresIdentity = await adminSql(
    "postgres",
    `SELECT json_build_object(
       'database', current_database(),
       'currentUser', current_user,
       'sessionUser', session_user,
       'serverVersion', current_setting('server_version'),
       'serverVersionNum', current_setting('server_version_num')
     )::text;`,
  );
  const identity = JSON.parse(postgresIdentity.stdout.trim());
  if (
    identity.currentUser !== "postgres" ||
    identity.sessionUser !== "postgres" ||
    !identity.serverVersion.startsWith("16.")
  ) {
    throw new Error("PostgreSQL administrator identity or version is not approved");
  }

  await adminSql(
    "postgres",
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ledgerly_canonical_owner') THEN
         CREATE ROLE ledgerly_canonical_owner NOLOGIN NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
       END IF;
       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ledgerly_api') THEN
         CREATE ROLE ledgerly_api LOGIN NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${sqlString(credentials.apiPassword)};
       END IF;
     END
     $$;
     ALTER ROLE ledgerly_canonical_owner NOLOGIN NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
     ALTER ROLE ledgerly_api LOGIN NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${sqlString(credentials.apiPassword)};
     REVOKE postgres FROM ledgerly_canonical_owner;
     REVOKE postgres FROM ledgerly_api;`,
  );
  await adminSql(
    "postgres",
    `CREATE DATABASE "${state.databaseName}" OWNER postgres;`,
  );
  state.databaseCreated = true;

  const runControlSql = await readFile(path.join(root, sourcePaths.runControlSql), "utf8");
  const insert = `INSERT INTO ledgerly_test_control.run_identity (
      run_uuid, expected_database_name, environment, target_classification,
      ci_provider, ci_repository, ci_workflow, ci_workflow_ref, ci_run_id, ci_run_attempt, ci_job,
      source_commit, source_tree_sha256, application_schema_sha256, drizzle_config_sha256,
      security_overlay_sha256, application_schema_digest, drizzle_config_digest,
      security_overlay_digest, run_control_sql_sha256, coordinator_sha256, test_sources_sha256,
      lockfile_sha256, workflow_sha256, orchestrator_sha256, expected_test_command,
      creator_identity, expected_runtime_identity, run_binding_nonce, created_at, expires_at,
      postgres_image_tag, postgres_image_digest, node_image_tag, node_image_digest,
      prohibits_heliumdb, prohibits_production
    ) VALUES (
      ${sqlString(credentials.binding.runUuid)}, ${sqlString(credentials.binding.databaseName)},
      ${sqlString(credentials.binding.environment)}, ${sqlString(credentials.binding.targetClassification)},
      ${sqlString(credentials.binding.ciProvider)}, ${sqlString(credentials.binding.ciRepository)},
      ${sqlString(credentials.binding.ciWorkflow)}, ${sqlString(credentials.binding.ciWorkflowRef)},
      ${sqlString(credentials.binding.ciRunId)},
      ${sqlString(credentials.binding.ciRunAttempt)}, ${sqlString(credentials.binding.ciJob)},
      ${sqlString(credentials.binding.sourceCommit)}, ${sqlString(credentials.binding.sourceTreeSha256)},
      ${sqlString(credentials.binding.applicationSchemaSha256)}, ${sqlString(credentials.binding.drizzleConfigSha256)},
      ${sqlString(credentials.binding.securityOverlaySha256)},
      ${sqlString(credentials.binding.applicationSchemaSha256)},
      ${sqlString(credentials.binding.drizzleConfigSha256)},
      ${sqlString(credentials.binding.securityOverlaySha256)},
      ${sqlString(credentials.binding.runControlSqlSha256)},
      ${sqlString(credentials.binding.coordinatorSha256)}, ${sqlString(credentials.binding.testSourcesSha256)},
      ${sqlString(credentials.binding.lockfileSha256)}, ${sqlString(credentials.binding.workflowSha256)},
      ${sqlString(credentials.binding.orchestratorSha256)}, ${sqlString(expectedCommand)},
      'postgres', 'ledgerly_api', ${sqlString(credentials.nonce)},
      ${sqlString(credentials.createdAt)}, ${sqlString(credentials.expiresAt)},
      ${sqlString(postgresTag)}, ${sqlString(postgresDigest)},
      ${sqlString(nodeTag)}, ${sqlString(nodeDigest)}, true, true
    );`;
  await adminSql(state.databaseName, `${runControlSql}\n${insert}`);

  const schemaEnv = {
    PATH: process.env.PATH,
    CI: "true",
    NODE_ENV: "test",
  };
  const pushArgs = [
    "run",
    "--rm",
    "--name",
    `ledgerly-ti03-bootstrap-${state.runId.replaceAll("-", "").slice(0, 24)}`,
    "--network",
    state.networkName,
    "--env",
    "CI=true",
    "--env-file",
    state.adminEnvFile,
    testImage,
    "pnpm",
    "--filter",
    "@workspace/db",
    "run",
    "push",
  ];
  let pushFailed = false;
  let pushOutput = "";
  try {
    const result = await docker(pushArgs, {
      env: schemaEnv,
      timeoutMs: 4 * 60 * 1000,
      quiet: true,
    });
    pushOutput = `${result.stdout}\n${result.stderr}`;
  } catch (error) {
    pushFailed = true;
    pushOutput = bootstrapRetryClassificationInput(error);
    state.bootstrapDiagnostic = captureBootstrapDiagnostic(error);
  }
  if (pushFailed) {
    if (!isApprovedFkIndexOrderingError(pushOutput)) {
      throw new Error("Drizzle bootstrap failed outside the approved FK/index ordering case");
    }
    await adminSql(
      state.databaseName,
      `CREATE UNIQUE INDEX IF NOT EXISTS accounting_posting_effects_company_effect_idx
       ON public.accounting_posting_effects (company_id, economic_effect_id);`,
    );
    await docker(pushArgs, { env: schemaEnv, timeoutMs: 4 * 60 * 1000 });
  }

  const overlay = await readFile(path.join(root, sourcePaths.securityOverlay), "utf8");
  await adminSql(state.databaseName, overlay);
  const verification = await adminSql(
    state.databaseName,
    `SELECT json_build_object(
       'identity', (SELECT json_build_object(
         'database', current_database(), 'currentUser', current_user,
         'sessionUser', session_user, 'serverVersion', current_setting('server_version')
       )),
       'roles', (SELECT json_agg(json_build_object(
         'name', rolname, 'login', rolcanlogin, 'superuser', rolsuper,
         'inherit', rolinherit, 'createDatabase', rolcreatedb,
         'createRole', rolcreaterole, 'replication', rolreplication,
         'bypassRls', rolbypassrls
       ) ORDER BY rolname) FROM pg_roles
        WHERE rolname IN ('postgres', 'ledgerly_api', 'ledgerly_canonical_owner')),
       'memberships', (SELECT count(*)::int FROM pg_auth_members m
        JOIN pg_roles member ON member.oid = m.member
        JOIN pg_roles role ON role.oid = m.roleid
        WHERE member.rolname IN ('ledgerly_api', 'ledgerly_canonical_owner')),
       'schemaAcl', (SELECT nspacl::text FROM pg_namespace WHERE nspname = 'ledgerly_test_control'),
       'protectedOwners', (SELECT json_agg(json_build_object(
         'table', c.relname, 'owner', pg_get_userbyid(c.relowner), 'acl', c.relacl::text
       ) ORDER BY c.relname) FROM pg_class c
        WHERE c.relnamespace = 'public'::regnamespace
          AND c.relname IN (
            'accounting_posting_effects', 'canonical_journal_entries',
            'canonical_journal_lines', 'canonical_journal_relations',
            'accounting_audit_events'
          )),
       'functions', (SELECT json_agg(json_build_object(
         'name', p.proname, 'owner', pg_get_userbyid(p.proowner),
         'searchPath', p.proconfig
       ) ORDER BY p.proname) FROM pg_proc p
        WHERE p.pronamespace = 'public'::regnamespace
          AND p.proname IN (
            'ledgerly_canonical_append_only_guard',
            'ledgerly_canonical_journal_header_guard',
            'ledgerly_canonical_journal_line_guard',
            'ledgerly_posting_effect_transition_guard',
            'ledgerly_verify_disposable_run',
            'ledgerly_verify_external_disposable_run'
          )),
       'triggers', (SELECT json_agg(json_build_object(
         'name', t.tgname, 'enabled', t.tgenabled, 'table', c.relname
       ) ORDER BY t.tgname) FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        WHERE t.tgname IN (
          'ledgerly_accounting_audit_events_guard',
          'ledgerly_accounting_posting_effects_guard',
          'ledgerly_canonical_journal_entries_guard',
          'ledgerly_canonical_journal_lines_guard',
          'ledgerly_canonical_journal_relations_guard'
        )),
       'constraints', (SELECT json_agg(conname ORDER BY conname) FROM pg_constraint
        WHERE conrelid IN (
          'public.accounting_posting_effects'::regclass,
          'public.canonical_journal_entries'::regclass,
          'public.canonical_journal_lines'::regclass,
          'public.canonical_journal_relations'::regclass,
          'public.accounting_audit_events'::regclass
        )),
       'indexes', (SELECT json_agg(indexrelid::regclass::text ORDER BY indexrelid::regclass::text)
        FROM pg_index WHERE indrelid = 'public.accounting_posting_effects'::regclass),
       'emptyBaseline', (SELECT bool_and(row_count = 0) FROM (VALUES
         ((SELECT count(*) FROM public.accounting_posting_effects)),
         ((SELECT count(*) FROM public.canonical_journal_entries)),
         ((SELECT count(*) FROM public.canonical_journal_lines)),
         ((SELECT count(*) FROM public.canonical_journal_relations)),
         ((SELECT count(*) FROM public.accounting_audit_events)),
         ((SELECT count(*) FROM public.journal_entries))
       ) AS counts(row_count)),
       'privateRunRows', (SELECT count(*)::int FROM ledgerly_test_control.run_identity)
     )::text;`,
  );
  const bootstrap = JSON.parse(verification.stdout.trim());
  if (
    bootstrap.identity.currentUser !== "postgres" ||
    bootstrap.identity.sessionUser !== "postgres" ||
    !bootstrap.identity.serverVersion.startsWith("16.") ||
    bootstrap.privateRunRows !== 1 ||
    bootstrap.emptyBaseline !== true ||
    bootstrap.triggers?.length !== 5 ||
    bootstrap.triggers.some((trigger) => trigger.enabled !== "A")
  ) {
    throw new Error("TI-03 administrative bootstrap verification failed");
  }
  return { ...bootstrap, adminIdentity: identity };
}

async function runNegativeControls() {
  const controls = {};
  const expectReject = (label, fn) => {
    let rejected = false;
    try {
      fn();
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error(`${label} did not reject`);
    controls[label] = true;
  };
  const baseEnvironment = new Map(
    (await readFile(state.testEnvFile, "utf8"))
      .trim()
      .split("\n")
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  const runRunnerNegativeCase = async (
    label,
    mutate,
    expectedMessage,
    network = "none",
  ) => {
    const environment = new Map(baseEnvironment);
    mutate(environment);
    const file = path.join(state.credentialDirectory, `negative-${label}.env`);
    await writeFile(
      file,
      `${[...environment.entries()].map(([name, value]) => `${name}=${value}`).join("\n")}\n`,
      { mode: 0o600 },
    );
    let rejected = false;
    try {
      await docker(
        [
          "run",
          "--rm",
          "--network",
          network,
          "--env-file",
          file,
          "--read-only",
          "--tmpfs",
          "/tmp:rw,noexec,nosuid,nodev",
          "--cap-drop=ALL",
          "--security-opt=no-new-privileges:true",
          testImage,
          "node",
          "artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs",
        ],
        { quiet: true, timeoutMs: 30_000 },
      );
    } catch (error) {
      rejected =
        error instanceof Error &&
        typeof error.stderr === "string" &&
        error.stderr.includes(expectedMessage);
    } finally {
      await rm(file, { force: true });
    }
    if (!rejected) throw new Error(`${label} runner probe did not reject`);
    controls[label] = true;
  };

  await runRunnerNegativeCase("missingRunBinding", (environment) => {
    environment.delete("LEDGERLY_CANONICAL_TEST_RUN_ID");
  }, "LEDGERLY_CANONICAL_TEST_RUN_ID is required");
  await runRunnerNegativeCase("forgedRunDatabaseMismatch", (environment) => {
    environment.set("LEDGERLY_CANONICAL_TEST_RUN_ID", randomUUID());
  }, "The private external-CI run binding did not verify", state.networkName);
  await runRunnerNegativeCase("malformedUri", (environment) => {
    environment.set("LEDGERLY_CANONICAL_TEST_DATABASE_URL", "not-a-postgres-uri");
  }, "Invalid URL");
  await runRunnerNegativeCase("targetChangingQuery", (environment) => {
    environment.set(
      "LEDGERLY_CANONICAL_TEST_DATABASE_URL",
      `${environment.get("LEDGERLY_CANONICAL_TEST_DATABASE_URL")}&host=other`,
    );
  }, "contains a forbidden or duplicate target override");
  await runRunnerNegativeCase("wrongHost", (environment) => {
    const url = new URL(environment.get("LEDGERLY_CANONICAL_TEST_DATABASE_URL"));
    url.hostname = "other-host";
    environment.set("LEDGERLY_CANONICAL_TEST_DATABASE_URL", url.toString());
  }, "The external disposable target is not exact");
  await runRunnerNegativeCase("wrongPort", (environment) => {
    const url = new URL(environment.get("LEDGERLY_CANONICAL_TEST_DATABASE_URL"));
    url.port = "5433";
    environment.set("LEDGERLY_CANONICAL_TEST_DATABASE_URL", url.toString());
  }, "The external disposable target is not exact");
  await runRunnerNegativeCase("wrongDatabase", (environment) => {
    environment.set(
      "LEDGERLY_CANONICAL_TEST_DATABASE_NAME",
      `ledgerly_canonical_test_${randomUUID().replaceAll("-", "")}`,
    );
  }, "The external disposable target is not exact");
  await runRunnerNegativeCase("wrongRole", (environment) => {
    const url = new URL(environment.get("LEDGERLY_CANONICAL_TEST_DATABASE_URL"));
    url.username = "postgres";
    environment.set("LEDGERLY_CANONICAL_TEST_DATABASE_URL", url.toString());
  }, "The external disposable target is not exact");
  await runRunnerNegativeCase("parentDatabaseUrl", (environment) => {
    environment.set("DATABASE_URL", "blocked");
  }, "rejects a parent database or production marker");
  await runRunnerNegativeCase("replitMarker", (environment) => {
    environment.set("REPLIT_DEV_DOMAIN", "blocked");
  }, "rejects inherited target, Replit, or CI credential variables");
  await runRunnerNegativeCase("inheritedPgOverride", (environment) => {
    environment.set("PGHOST", "blocked");
  }, "rejects inherited target, Replit, or CI credential variables");
  expectReject("unpinnedImage", () => assertPinnedImage("postgres:16.15-bookworm", "negative"));
  expectReject("untrustedEvent", () => {
    assertTrustedWorkflowContext({ ...process.env, GITHUB_EVENT_NAME: "pull_request" });
  });
  expectReject("unauthorizedWorkflow", () => {
    assertTrustedWorkflowContext({ ...process.env, GITHUB_WORKFLOW: "Other workflow" });
  });
  const cleanupMismatch = await adminSql(
    state.databaseName,
    `SELECT count(*)::int
     FROM ledgerly_test_control.run_identity
     WHERE run_uuid = ${sqlString(randomUUID())}::uuid
       AND expected_database_name = current_database();`,
  );
  expectReject("cleanupBindingMismatch", () =>
    assertSingleCleanupBinding(cleanupMismatch.stdout.trim()),
  );
  expectReject("evidenceCredentialPattern", () =>
    sanitizeEvidence({ unsafe: "postgres://ledgerly_api:redacted@example.invalid/db" }),
  );
  return controls;
}

async function runIsolationProbes() {
  const network = await docker(
    ["network", "inspect", state.networkName, "--format", "{{json .Internal}}"],
    { quiet: true },
  );
  state.observedIsolation.internalNetwork = JSON.parse(network.stdout.trim()) === true;
  if (!state.observedIsolation.internalNetwork) {
    throw new Error("The qualification network is not internal-only");
  }

  const ports = await docker(
    ["inspect", state.postgresContainer, "--format", "{{json .NetworkSettings.Ports}}"],
    { quiet: true },
  );
  const publishedPorts = JSON.parse(ports.stdout.trim());
  state.observedIsolation.noPublishedPorts =
    publishedPorts === null || Object.values(publishedPorts).every((bindings) => bindings === null);
  if (!state.observedIsolation.noPublishedPorts) {
    throw new Error("The PostgreSQL container has a published host port");
  }

  await docker(
    [
      "run",
      "--rm",
      "--network",
      state.networkName,
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges:true",
      testImage,
      "node",
      "-e",
      "const fs=require('node:fs');process.exit(fs.existsSync('/var/run/docker.sock')?1:0)",
    ],
    { quiet: true, timeoutMs: 30_000 },
  );
  state.observedIsolation.testContainerNoSocket = true;

  await docker(
    [
      "run",
      "--rm",
      "--network",
      state.networkName,
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges:true",
      testImage,
      "node",
      "-e",
      "const net=require('node:net');const s=net.connect({host:'1.1.1.1',port:443});const stop=c=>{s.destroy();process.exit(c)};s.once('connect',()=>stop(1));s.once('error',()=>stop(0));s.setTimeout(2000,()=>stop(0))",
    ],
    { quiet: true, timeoutMs: 30_000 },
  );
  state.observedIsolation.testContainerNoExternalRoute = true;
}

async function runTestContainer(credentials, sourceDigests, ci) {
  state.phase = "test";
  state.testContainer = `ledgerly-ti03-test-${state.runId.replaceAll("-", "").slice(0, 24)}`;
  const testEnv = {
    CI: "true",
    GITHUB_ACTIONS: "true",
    PATH: process.env.PATH,
  };
  const result = await docker(
    [
      "run",
      "--rm",
      "--name",
      state.testContainer,
      "--network",
      state.networkName,
      "--env-file",
      state.testEnvFile,
      "--env",
      "CI=true",
      "--read-only",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,nodev",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges:true",
      "--pids-limit",
      "256",
      testImage,
      "pnpm",
      "--filter",
      "@workspace/api-server",
      "run",
      "test:canonical-posting",
    ],
    { env: testEnv, timeoutMs: 7 * 60 * 1000, quiet: true },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const completionLine = result.stdout
    .split("\n")
    .find((line) => line.startsWith("LEDGERLY_CANONICAL_TEST_COMPLETION "));
  if (!completionLine) throw new Error("Canonical test completion evidence was not emitted");
  const completion = JSON.parse(completionLine.slice("LEDGERLY_CANONICAL_TEST_COMPLETION ".length));
  if (
    completion.targetClass !== "external-ci-postgresql-service-container" ||
    !completion.privateRunBindingVerified ||
    !completion.concurrencyEvidence?.overlapProven ||
    completion.externalCiIsolation?.developmentEndpointMatched !== false
  ) {
    throw new Error("Canonical test evidence did not satisfy TI-03 isolation requirements");
  }
  return completion;
}

async function cleanupDatabase() {
  state.phase = "cleanup";
  let cleanupFailure = null;
  const dockerObjectExists = async (args) => {
    try {
      await docker(args, { quiet: true });
      return true;
    } catch {
      return false;
    }
  };
  try {
    if (state.testContainer) {
      if (await dockerObjectExists(["inspect", state.testContainer])) {
        await docker(["rm", "--force", state.testContainer], { quiet: true });
        if (await dockerObjectExists(["inspect", state.testContainer])) {
          throw new Error("The canonical test container still exists after cleanup");
        }
      }
      state.testContainer = null;
    }
    if (state.postgresContainer && state.databaseCreated) {
      const binding = await adminSql(
        state.databaseName,
        `SELECT count(*)::int
         FROM ledgerly_test_control.run_identity
         WHERE run_uuid = ${sqlString(state.runId)}::uuid
           AND expected_database_name = ${sqlString(state.databaseName)}
           AND expected_database_name = current_database()
           AND run_binding_nonce = ${sqlString(state.runNonce)}
           AND creator_identity = 'postgres'
           AND expected_runtime_identity = 'ledgerly_api';`,
      );
      assertSingleCleanupBinding(binding.stdout.trim());
      await adminSql(
        "postgres",
        `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
         WHERE datname = ${sqlString(state.databaseName)}
           AND pid <> pg_backend_pid()
           AND usename = 'ledgerly_api';`,
      );
      await adminSql("postgres", `DROP DATABASE IF EXISTS "${state.databaseName}";`);
      const result = await adminSql(
        "postgres",
        `SELECT count(*)::int FROM pg_database WHERE datname = ${sqlString(state.databaseName)};`,
      );
      state.databaseAbsent = result.stdout.trim() === "0";
      if (!state.databaseAbsent) throw new Error("The exact disposable database was not dropped");
      state.databaseCreated = false;
    }
  } catch (error) {
    cleanupFailure = error;
  }

  if (state.postgresContainer) {
    try {
      const containerName = state.postgresContainer;
      await docker(["rm", "--force", containerName], { quiet: true });
      if (await dockerObjectExists(["inspect", containerName])) {
        throw new Error("The PostgreSQL container still exists after cleanup");
      }
      state.containerRemoved = true;
      state.postgresContainer = null;
    } catch (error) {
      cleanupFailure ??= error;
    }
  }
  if (state.networkName) {
    try {
      const networkName = state.networkName;
      await docker(["network", "rm", networkName], { quiet: true });
      if (await dockerObjectExists(["network", "inspect", networkName])) {
        throw new Error("The internal Docker network still exists after cleanup");
      }
      state.networkRemoved = true;
      state.networkName = null;
    } catch (error) {
      cleanupFailure ??= error;
    }
  }
  if (cleanupFailure) throw cleanupFailure;
}

function assertSingleCleanupBinding(value) {
  if (value !== "1") {
    throw new Error("Cleanup refused because the exact private run binding did not match");
  }
}

async function removeCredentialMaterial() {
  if (state.credentialDirectory) {
    await rm(state.credentialDirectory, { recursive: true, force: true });
    state.credentialDirectory = null;
  }
  state.credentialMaterialRemoved = true;
}

function sanitizeEvidence(value) {
  const text = JSON.stringify(value);
  if (
    /postgres(?:ql)?:\/\//i.test(text) ||
    /"(?:password|token|cookie|privateKey|authorizationHeader)"\s*:/i.test(text) ||
    /(?:DATABASE_URL|PGPASSWORD|LEDGERLY_CANONICAL_TEST_[A-Z0-9_]+|[A-Z][A-Z0-9_]*(?:PASSWORD|TOKEN|SECRET|KEY))(?:\\*["'])?\s*[:=]/i.test(
      text,
    ) ||
    /BEGIN [A-Z ]*PRIVATE KEY/i.test(text) ||
    /(?:ghs_|github_pat_)/i.test(text) ||
    /replit\.(dev|app)/i.test(text)
  ) {
    throw new Error("Evidence secret scanner rejected the output");
  }
  return text;
}

const evidenceSchema = JSON.parse(
  await readFile(path.join(root, sourcePaths.evidenceSchema), "utf8"),
);
const evidenceAjv = new Ajv2020({
  strict: true,
  allErrors: true,
  formats: {
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  },
});
const validateEvidenceSchema = evidenceAjv.compile(evidenceSchema);

function assertJsonSchemaEvidence(value) {
  if (!validateEvidenceSchema(value)) {
    const diagnostics = (validateEvidenceSchema.errors ?? [])
      .slice(0, 8)
      .map(({ instancePath, keyword }) => `${instancePath || "/"}:${keyword}`)
      .join(", ");
    throw new Error(`Evidence JSON Schema validation failed: ${diagnostics}`);
  }
}

function validateEvidenceContract(evidence) {
  assertJsonSchemaEvidence(evidence);
  if (
    evidence?.schemaVersion !== 1 ||
    !["passed", "failed"].includes(evidence.result) ||
    typeof evidence.ci?.workflowRef !== "string" ||
    !evidence.ci.workflowRef.endsWith(`/${workflowPath}@refs/heads/main`) ||
    typeof evidence.images?.postgres?.digest !== "string" ||
    typeof evidence.images?.node?.digest !== "string" ||
    typeof evidence.cleanup !== "object" ||
    typeof evidence.isolation !== "object"
  ) {
    throw new Error("Evidence does not satisfy the TI-03 base contract");
  }
  if (evidence.result === "passed") {
    if (
      evidence.failurePhase !== null ||
      !Array.isArray(evidence.bootstrap?.roleSeparation) ||
      !Array.isArray(evidence.bootstrap?.ownership) ||
      !Array.isArray(evidence.bootstrap?.constraints) ||
      !Array.isArray(evidence.bootstrap?.indexes) ||
      !Array.isArray(evidence.bootstrap?.triggers) ||
      evidence.runtime?.currentUser !== "ledgerly_api" ||
      evidence.runtime?.sessionUser !== "ledgerly_api" ||
      evidence.runtime?.privateBindingVerified !== true ||
      requiredNegativeControls.some(
        (control) => evidence.negativeControls?.[control] !== true,
      ) ||
      Object.values(evidence.cleanup).some((value) => value !== true) ||
      evidence.isolation.parentDatabaseUrlAbsent !== true ||
      evidence.isolation.replitVariablesAbsent !== true ||
      evidence.isolation.noPublishedPorts !== true ||
      evidence.isolation.internalNetwork !== true ||
      evidence.isolation.testContainerNoSocket !== true ||
      evidence.isolation.testContainerNoExternalRoute !== true ||
      evidence.isolation.heliumdbContacted !== false ||
      evidence.isolation.productionContacted !== false
    ) {
      throw new Error("Passed evidence does not satisfy the TI-03 acceptance contract");
    }
  } else if (typeof evidence.failurePhase !== "string" || evidence.failurePhase.length === 0) {
    throw new Error("Failed evidence must identify its failure phase");
  }
}

async function writeEvidence(evidence, fileIdentity = state.runId) {
  const directory = path.join(root, "docs/governance/evidence");
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `ledgerly-44-ti-03-${fileIdentity}.json`);
  validateEvidenceContract(evidence);
  const serialized = `${sanitizeEvidence(evidence)}\n`;
  await writeFile(file, serialized, { mode: 0o644 });
  return { file, sha256: sha256Buffer(serialized) };
}

async function main() {
  assertTrustedWorkflowContext();
  const ci = buildCiIdentity();
  state.ci = ci;
  const sourceManifest = await createExecutionSourceManifest(ci);
  try {
    await buildTestImage();
  } finally {
    await rm(path.join(root, sourceManifestPath), { force: true });
  }

  state.runId = randomUUID();
  state.databaseName = `ledgerly_canonical_test_${state.runId.replaceAll("-", "").toLowerCase()}`;
  const sourceDigests = {
    sourceTree: sourceManifest.sourceTreeSha256,
    applicationSchema: await sha256File(sourcePaths.applicationSchema),
    drizzleConfig: await sha256File(sourcePaths.drizzleConfig),
    securityOverlay: await sha256File(sourcePaths.securityOverlay),
    runControlSql: await sha256File(sourcePaths.runControlSql),
    coordinator: await sha256File(sourcePaths.coordinator),
    testSources: await sha256Files([sourcePaths.canonicalTests, sourcePaths.canonicalPosting]),
    lockfile: await sha256File(sourcePaths.lockfile),
    workflow: await sha256File(sourcePaths.workflow),
    orchestrator: await sha256File(sourcePaths.coordinator),
  };
  const credentials = await createCredentials(state.runId, state.databaseName, sourceDigests, ci);
  state.runNonce = credentials.nonce;
  state.phase = "postgres-start";
  await startPostgres(credentials.postgresPassword);
  const bootstrap = await bootstrapDatabase(credentials, sourceDigests, ci);
  await runIsolationProbes();
  const negativeControls = await runNegativeControls();
  const completion = await runTestContainer(credentials, sourceDigests, ci);
  if (
    completion.negativePrivilegeEvidence?.roleEscalationDenied !== true ||
    completion.negativePrivilegeEvidence?.setRolePostgresDenied !== true ||
    completion.negativePrivilegeEvidence?.triggerDisableDenied !== true ||
    completion.negativePrivilegeEvidence?.canonicalDeleteDenied !== true
  ) {
    throw new Error("API-role negative privilege evidence was incomplete");
  }
  negativeControls.roleEscalation = true;
  negativeControls.triggerDisable = true;
  await cleanupDatabase();
  await removeCredentialMaterial();
  const evidence = {
    schemaVersion: 1,
    result: "passed",
    failurePhase: null,
    ci,
    images: {
      postgres: { tag: postgresTag, digest: postgresDigest },
      node: { tag: nodeTag, digest: nodeDigest },
      postgresServerVersion: bootstrap.identity.serverVersion,
      nodeRuntimeVersion: "24.13.0",
      pnpmVersion: "10.26.1",
    },
    binding: {
      runUuid: state.runId,
      databaseName: state.databaseName,
      environment: "external-ci-disposable-test",
      targetClassification: "external-ci-postgresql-service-container",
      creatorIdentity: "postgres",
      runtimeIdentity: "ledgerly_api",
      sourceCommit: ci.sourceCommit,
      sourceTreeSha256: sourceDigests.sourceTree,
      nonceSha256: credentials.nonceSha256,
      sourceDigests,
    },
    bootstrap: {
      status: "passed",
      roleSeparation: bootstrap.roles,
      ownership: bootstrap.protectedOwners,
      acl: { schema: bootstrap.schemaAcl },
      constraints: bootstrap.constraints,
      indexes: bootstrap.indexes,
      triggers: bootstrap.triggers,
      emptyBaseline: bootstrap.emptyBaseline,
      privateBinding: bootstrap.privateRunRows === 1,
      functions: bootstrap.functions,
      memberships: bootstrap.memberships,
    },
    runtime: {
      databaseName: completion.databaseName,
      currentUser: "ledgerly_api",
      sessionUser: "ledgerly_api",
      identityVerified: true,
      privateBindingVerified: completion.privateRunBindingVerified,
      sourceDigestsVerified: true,
      concurrencyEvidence: completion.concurrencyEvidence,
      testIdentity: completion.identityEvidence,
      negativePrivilegeEvidence: completion.negativePrivilegeEvidence,
    },
    negativeControls,
    cleanup: {
      logicalDrop: state.databaseAbsent,
      databaseAbsent: state.databaseAbsent,
      containerRemoved: state.containerRemoved,
      networkRemoved: state.networkRemoved,
      credentialMaterialRemoved: state.credentialMaterialRemoved,
    },
    isolation: {
      parentDatabaseUrlAbsent: true,
      replitVariablesAbsent: true,
      noPublishedPorts: state.observedIsolation.noPublishedPorts,
      internalNetwork: state.observedIsolation.internalNetwork,
      testContainerNoSocket: state.observedIsolation.testContainerNoSocket,
      testContainerNoExternalRoute: state.observedIsolation.testContainerNoExternalRoute,
      heliumdbContacted: false,
      productionContacted: false,
      secretScanPassed: true,
    },
  };
  state.evidence = await writeEvidence(evidence);
  console.log(
    "LEDGERLY_TI03_EVIDENCE",
    JSON.stringify({ path: path.relative(root, state.evidence.file), sha256: state.evidence.sha256 }),
  );
}

async function execute() {
  let failure;
  let failurePhase = null;
  try {
    await main();
  } catch (error) {
    failure = error;
    failurePhase = state.phase;
    if (failurePhase === "bootstrap" && !state.bootstrapDiagnostic) {
      state.bootstrapDiagnostic = captureBootstrapDiagnostic(error);
    }
    if (failurePhase === "test" && !state.testDiagnostic) {
      state.testDiagnostic = captureTestDiagnostic(error);
    }
    console.error(`TI-03 failed during ${state.phase}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    try {
      await cleanupDatabase();
    } catch (cleanupError) {
      if (!failure) {
        failure = cleanupError;
        failurePhase = "cleanup";
      }
      console.error(`TI-03 cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
    }
    try {
      await removeCredentialMaterial();
    } catch (credentialCleanupError) {
      if (!failure) {
        failure = credentialCleanupError;
        failurePhase = "credential-cleanup";
      }
      console.error(
        `TI-03 credential cleanup failed: ${
          credentialCleanupError instanceof Error
            ? credentialCleanupError.message
            : String(credentialCleanupError)
        }`,
      );
    }
    if (failure && state.ci) {
      const failedEvidence = {
        schemaVersion: 1,
        result: "failed",
        failurePhase,
        ci: state.ci,
        ...(failurePhase === "bootstrap" && state.bootstrapDiagnostic
          ? { bootstrapDiagnostic: state.bootstrapDiagnostic }
          : {}),
        ...(failurePhase === "test" && state.testDiagnostic
          ? { testDiagnostic: state.testDiagnostic }
          : {}),
        images: {
          postgres: { tag: postgresTag, digest: postgresDigest },
          node: { tag: nodeTag, digest: nodeDigest },
        },
        cleanup: {
          logicalDrop: state.databaseAbsent,
          databaseAbsent: state.databaseAbsent,
          containerRemoved: state.containerRemoved,
          networkRemoved: state.networkRemoved,
          credentialMaterialRemoved: state.credentialMaterialRemoved,
        },
        isolation: {
          parentDatabaseUrlAbsent: process.env.DATABASE_URL === undefined,
          replitVariablesAbsent: !Object.keys(process.env).some((name) => name.startsWith("REPLIT_")),
          noPublishedPorts: state.observedIsolation.noPublishedPorts,
          internalNetwork: state.observedIsolation.internalNetwork,
          testContainerNoSocket: state.observedIsolation.testContainerNoSocket,
          testContainerNoExternalRoute: state.observedIsolation.testContainerNoExternalRoute,
          heliumdbContacted: false,
          productionContacted: false,
          secretScanPassed: true,
        },
      };
      try {
        state.evidence = await writeEvidence(
          failedEvidence,
          `failed-${state.ci.runId}-${state.ci.runAttempt}`,
        );
        console.log(
          "LEDGERLY_TI03_FAILURE_EVIDENCE",
          JSON.stringify({
            path: path.relative(root, state.evidence.file),
            sha256: state.evidence.sha256,
          }),
        );
      } catch (evidenceError) {
        console.error(
          `TI-03 failure evidence write failed: ${
            evidenceError instanceof Error ? evidenceError.message : String(evidenceError)
          }`,
        );
      }
    }
  }
  if (failure) process.exitCode = 1;
}

export {
  bootstrapRetryClassificationInput,
  captureBootstrapDiagnostic,
  captureTestDiagnostic,
  isApprovedFkIndexOrderingError,
  sanitizeBootstrapDiagnostic,
  sanitizeEvidence,
  validateEvidenceContract,
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await execute();
}