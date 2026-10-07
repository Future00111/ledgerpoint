// Manual, NON-QUALIFICATION review fixture. Never uses managed DBs or gh.
// Requires a prebuilt C3 review image; uses its pinned dependencies offline.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runner = "artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs";
const coordinator = "scripts/ci/run-ledgerly-canonical-postgresql.mjs";
const workflow = ".github/workflows/ledgerly-canonical-postgresql.yml";
const postgres = "postgres:16.15-bookworm@sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825";
const sha = (b) => createHash("sha256").update(b).digest("hex");

if (!process.argv.includes("--inside") && !process.argv.includes("--disposable-review")) {
  console.log("Manual binding review only: use --disposable-review --base-image <prebuilt-C3-review-image>. No database started.");
} else if (process.argv.includes("--inside")) {
  const fixture = JSON.parse(readFileSync(0, "utf8"));
  const { externalSourceDigests, verifyExternalBinding } = await import(
    pathToFileURL(path.join(root, "artifacts/api-server/scripts/review-binding-module.mjs")).href
  );
  const results = [];
  async function check(name, action) {
    try { await action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, reason: error.message }); }
  }
  await check("source digest parity: runtime orchestrator is not coordinator", () => {
    const actual = externalSourceDigests();
    assert.notEqual(fixture.args.sourceDigests.coordinator, fixture.args.sourceDigests.orchestrator);
    assert.deepEqual(actual, fixture.args.sourceDigests);
  });
  await check("valid private binding passes actual PostgreSQL verifier", async () => {
    const actual = await verifyExternalBinding(fixture.args);
    assert.equal(actual.bindingVerified, true);
    assert.equal(actual.identity.currentUser, "ledgerly_api");
    assert.equal(actual.identity.sessionUser, "ledgerly_api");
    assert.match(actual.identity.serverVersion, /^16\.15/);
  });
  await check("forged run UUID rejected by private database binding", async () => {
    await assert.rejects(
      verifyExternalBinding({ ...fixture.args, runId: randomUUID() }),
      /The private external-CI run binding did not verify/,
    );
  });
  if (fixture.args.ci.ciSourceRef.endsWith("successor-c4")) {
    await check("old C3 identity rejected by private database binding", async () => {
      const oldRef = "refs/heads/tr01/implementation-identity-successor-c3";
      await assert.rejects(verifyExternalBinding({ ...fixture.args, ci: {
        ...fixture.args.ci, ciSourceRef: oldRef,
        workflowRef: fixture.args.ci.workflowRef.replace("successor-c4", "successor-c3"),
      } }), /The private external-CI run binding did not verify/);
    });
  }
  await check("forged nonce rejected by private database binding", async () => {
    await assert.rejects(
      verifyExternalBinding({ ...fixture.args, runNonce: randomBytes(32).toString("hex") }),
      /The private external-CI run binding did not verify/,
    );
  });
  await check("actual runner forged probe reaches intended rejection, not digest failure", () => {
    const result = spawnSync("node", [runner], {
      cwd: root, env: fixture.env, encoding: "utf8", timeout: 20000,
    });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /The private external-CI run binding did not verify/);
    assert.doesNotMatch(result.stderr, /source digests do not match/);
  });
  console.log(JSON.stringify({ reviewOnly: true, results }));
  process.exitCode = results.every((r) => r.passed) ? 0 : 1;
} else {
  assert.ok(process.argv.includes("--disposable-review"), "Explicit --disposable-review required");
  const baseIndex = process.argv.indexOf("--base-image");
  assert.ok(baseIndex >= 0, "Explicit prebuilt review --base-image required");
  const base = process.argv[baseIndex + 1];
  assert.match(base, /^[a-zA-Z0-9._:/@-]+$/);
  const expectOriginal = process.argv.includes("--expect-original-defect");
  const temp = mkdtempSync(path.join(tmpdir(), "ledgerly-binding-review-"));
  const suffix = randomBytes(12).toString("hex");
  const network = `ledgerly-binding-review-${suffix}`;
  const container = `${network}-pg`;
  const image = `ledgerly-binding-review:${suffix}`;
  const hostEnv = { PATH: process.env.PATH };
  const cleanup = { container: false, network: false, image: false, fixture: false };
  function command(args, input, timeout = 60000) {
    const r = spawnSync("docker", args, { env: hostEnv, input, encoding: "utf8", timeout });
    assert.equal(r.error, undefined, `Docker command failed/timed out: ${args[0]}`);
    assert.equal(r.status, 0, `Docker ${args[0]} failed (credential output suppressed)`);
    return r.stdout;
  }
  const sourceRef = expectOriginal ? "refs/heads/tr01/implementation-identity-successor-c3" : "refs/heads/tr01/implementation-identity-successor-c4";
  // Deliberately synthetic identity: cannot satisfy trusted GitHub provenance.
  const commit = "a".repeat(40);
  const runId = randomUUID();
  const databaseName = `ledgerly_canonical_test_${runId.replaceAll("-", "")}`;
  const password = randomBytes(32).toString("hex");
  const nonce = randomBytes(32).toString("hex");
  try {
    const ls = spawnSync("git", ["ls-tree", "-r", "--name-only", "1c26be19295902a38e1939b56ff99ae9a195d3de", "--",
      ".dockerignore", ".ci/ledgerly-canonical/Dockerfile.test", ".github", "artifacts", "lib", "scripts",
      "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json", "package.json", "pnpm-lock.yaml",
      "pnpm-workspace.yaml", "tsconfig.base.json", "tsconfig.json"],
      { cwd: root, env: hostEnv, encoding: "utf8", timeout: 15000 });
    assert.equal(ls.status, 0);
    const original = spawnSync("git", ["show", `1c26be19295902a38e1939b56ff99ae9a195d3de:${runner}`],
      { cwd: root, env: hostEnv, timeout: 15000 });
    assert.equal(original.status, 0);
    const runtimeBytes = expectOriginal ? original.stdout : readFileSync(path.join(root, runner));
    const originalCache = new Map();
  const sourceBytes = (f) => {
    if (!expectOriginal) return readFileSync(path.join(root, f));
    if (!originalCache.has(f)) {
      const result = spawnSync("git", ["show", `1c26be19295902a38e1939b56ff99ae9a195d3de:${f}`], { cwd: root, env: hostEnv, timeout: 15000 });
      assert.equal(result.status, 0);
      originalCache.set(f, result.stdout);
    }
    return originalCache.get(f);
  };
    const files = ls.stdout.trim().split("\n").sort();
    const treeHash = createHash("sha256");
    for (const f of files) {
      const bytes = sourceBytes(f);
      treeHash.update(f).update("\0").update(bytes).update("\0");
      const dest = path.join(temp, "source", f);
      mkdirSync(path.dirname(dest), { recursive: true }); writeFileSync(dest, bytes);
    }
    const sourceTree = treeHash.digest("hex");
    const fileHash = (f) => sha(sourceBytes(f));
    const testHash = createHash("sha256");
    for (const f of ["artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts",
      "artifacts/api-server/src/services/accounting/canonicalPosting.ts"].sort()) {
      testHash.update(f).update("\0").update(readFileSync(path.join(root, f))).update("\0");
    }
    const digests = {
      applicationSchema: fileHash("lib/db/src/schema/index.ts"),
      drizzleConfig: fileHash("lib/db/drizzle.config.ts"),
      securityOverlay: fileHash("scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql"),
      sourceTree, runControlSql: fileHash("scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql"),
      coordinator: fileHash(coordinator), testSources: testHash.digest("hex"),
      lockfile: fileHash("pnpm-lock.yaml"), workflow: fileHash(workflow), orchestrator: fileHash(runner),
    };
    writeFileSync(path.join(temp, "source/.ci/ledgerly-canonical/source-manifest.json"), JSON.stringify({
      version: 2, files, sourceTreeSha256: sourceTree, workflowSourceSha256: digests.workflow,
      identityMode: "candidate", implementationSourceCommit: commit, reviewOnly: true,
    }));
    writeFileSync(path.join(temp, "fixture-test.mjs"), readFileSync(fileURLToPath(import.meta.url)));
    // Test-only access seam. Real CLI source stays byte-for-byte uninstrumented.
    writeFileSync(path.join(temp, "review-binding-module.mjs"), runtimeBytes +
      "\nexport { externalSourceDigests, verifyExternalBinding };\n");
    writeFileSync(path.join(temp, "Dockerfile"),
      `FROM ${base}\nUSER root\nCOPY source /workspace\nCOPY fixture-test.mjs /workspace/scripts/ci/ledgerly-external-binding-regression.test.mjs\nCOPY review-binding-module.mjs /workspace/artifacts/api-server/scripts/review-binding-module.mjs\nUSER node\n`);
    command(["build", "--network=none", "-t", image, temp], undefined, 180000);
    command(["network", "create", "--internal", network]);
    // Initializer executes administration locally in the fresh container.
    // No network administrator connection and no dependency on docker exec.
    const statements = [];
    const sql = (database, text) => statements.push(`\\connect ${database}\n${text}`);
    sql("postgres", `CREATE ROLE ledgerly_api LOGIN NOINHERIT PASSWORD '${password}';\nCREATE ROLE ledgerly_canonical_owner NOLOGIN;\nCREATE DATABASE ${databaseName};`);
    const ci = { provider: "github-actions", repository: "review-only/local-binding-fixture",
      workflow: "Ledgerly canonical PostgreSQL qualification",
      workflowRef: `review-only/local-binding-fixture/${workflow}@${sourceRef}`,
      runId: "1", runAttempt: "1", job: "canonical-postgresql", identityMode: "candidate",
      ciSourceRef: sourceRef, ciRefProtected: true, workflowSourceCommit: commit,
      implementationSourceCommit: commit, ancestryVerified: true, workflowCheckoutClean: true,
      implementationCheckoutClean: true };
    const imageBinding = { postgresTag: "postgres:16.15-bookworm", postgresDigest: postgres.split("@")[1],
      nodeTag: "node:24.13.0-bookworm-slim",
      nodeDigest: "sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f" };
    const values = { run_uuid: runId, expected_database_name: databaseName,
      environment: "external-ci-disposable-test", target_classification: "external-ci-postgresql-service-container",
      identity_mode: "candidate", ci_source_ref: sourceRef, ci_ref_protected: true,
      workflow_source_commit: commit, implementation_source_commit: commit,
      ancestry_verified: true, workflow_checkout_clean: true, implementation_checkout_clean: true,
      source_tree_sha256: sourceTree, application_schema_digest: digests.applicationSchema,
      drizzle_config_digest: digests.drizzleConfig, security_overlay_digest: digests.securityOverlay,
      expected_test_command: "pnpm --filter @workspace/api-server run test:canonical-posting",
      creator_identity: "postgres", expected_runtime_identity: "ledgerly_api", run_binding_nonce: nonce,
      created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 600000).toISOString(),
      prohibits_heliumdb: true, prohibits_production: true,
    };
    for (const [k, v] of Object.entries(ci)) {
      if (["provider", "repository", "workflow", "workflowRef", "runId", "runAttempt", "job"].includes(k))
        values["ci_" + k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase())] = v;
    }
    const digestColumns = { sourceTree: "source_tree", applicationSchema: "application_schema",
      drizzleConfig: "drizzle_config", securityOverlay: "security_overlay", runControlSql: "run_control_sql",
      coordinator: "coordinator", testSources: "test_sources", lockfile: "lockfile", workflow: "workflow", orchestrator: "orchestrator" };
    for (const [k, v] of Object.entries(digests)) values[digestColumns[k] + "_sha256"] = v;
    for (const [k, v] of Object.entries(imageBinding)) values[k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()).replace(/^(node|postgres)_/, "$1_image_")] = v;
    const literal = (x) => typeof x === "boolean" ? String(x) : "'" + x.replaceAll("'", "''") + "'";
    const control = sourceBytes("scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql").toString("utf8");
    const overlay = sourceBytes("scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql").toString("utf8");
    const verifier = overlay.slice(overlay.indexOf("CREATE OR REPLACE FUNCTION public.ledgerly_verify_external_disposable_run("),
      overlay.indexOf("\nDROP TRIGGER", overlay.indexOf("CREATE OR REPLACE FUNCTION public.ledgerly_verify_external_disposable_run(")));
    assert.match(verifier, /TO ledgerly_api;/);
    sql(databaseName, control + `\nINSERT INTO ledgerly_test_control.run_identity (${Object.keys(values).join(",")}) VALUES (${Object.values(values).map(literal).join(",")});\n` + verifier);
    const adminEnv = path.join(temp, "admin.env");
    const sqlFile = path.join(temp, "fixture.sql");
    writeFileSync(adminEnv, `POSTGRES_PASSWORD=${password}\n`, { mode: 0o600 });
    writeFileSync(sqlFile, "\\set ON_ERROR_STOP on\n" + statements.join("\n"), { mode: 0o600 });
    const bootstrap = [
      "set -e",
      "while [ ! -f /tmp/fixture.sql ]; do sleep 0.1; done",
      "cp /tmp/fixture.sql /docker-entrypoint-initdb.d/01-fixture.sql",
      "chmod 644 /docker-entrypoint-initdb.d/01-fixture.sql",
      "docker-entrypoint.sh postgres & server=$!",
      "for i in $(seq 1 120); do",
      "  if pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then touch /tmp/review-ready; wait \"$server\"; exit $?; fi",
      "  kill -0 \"$server\" || exit 1; sleep 0.5",
      "done", "kill \"$server\"; exit 1",
    ].join("\n");
    command(["run", "-d", "--name", container, "--network", network, "--network-alias", "ledgerly-postgres",
      "--pull=never", "--env-file", adminEnv, "--tmpfs", "/var/lib/postgresql/data",
      postgres, "bash", "-c", bootstrap]);
    command(["cp", sqlFile, `${container}:/tmp/fixture.sql`]);
    const inspect = JSON.parse(command(["inspect", container]))[0];
    assert.deepEqual(inspect.HostConfig.PortBindings, {});
    assert.equal(inspect.HostConfig.Binds, null);
    assert.equal(JSON.parse(command(["network", "inspect", network]))[0].Internal, true);
    let ready = false;
    for (let i = 0; i < 120; i++) {
      const r = spawnSync("docker", ["cp", `${container}:/tmp/review-ready`, path.join(temp, "ready")],
        { env: hostEnv, encoding: "utf8", timeout: 5000 });
      if (r.status === 0) { ready = true; break; }
      assert.equal(command(["inspect", "-f", "{{.State.Running}}", container]).trim(), "true",
        "Disposable PostgreSQL initializer must not fail");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, "Disposable PostgreSQL initializer must become ready");
    const args = { disposableDatabaseUrl: `postgresql://ledgerly_api:${password}@ledgerly-postgres:5432/${databaseName}?sslmode=disable`,
      databaseName, runId, runNonce: nonce, environment: values.environment, targetClass: values.target_classification,
      ci, sourceDigests: digests, imageBinding };
    const env = { PATH: "/usr/local/bin:/usr/bin:/bin", LEDGERLY_CANONICAL_TEST_MODE: "external-ci",
      LEDGERLY_CANONICAL_TEST_DATABASE_URL: args.disposableDatabaseUrl,
      LEDGERLY_CANONICAL_TEST_DATABASE_NAME: databaseName, LEDGERLY_CANONICAL_TEST_RUN_ID: randomUUID(),
      LEDGERLY_CANONICAL_TEST_RUN_NONCE: nonce, LEDGERLY_CANONICAL_TEST_ENVIRONMENT: args.environment,
      LEDGERLY_CANONICAL_TEST_TARGET_CLASS: args.targetClass };
    const names = { sourceTree: "SOURCE_TREE", applicationSchema: "SCHEMA", drizzleConfig: "CONFIG",
      securityOverlay: "OVERLAY", runControlSql: "RUN_CONTROL", coordinator: "COORDINATOR",
      testSources: "SOURCES", lockfile: "LOCKFILE", workflow: "WORKFLOW", orchestrator: "ORCHESTRATOR" };
    for (const [k, v] of Object.entries(digests)) env[`LEDGERLY_CANONICAL_TEST_${names[k]}_SHA256`] = v;
    const ciNames = { provider: "CI_PROVIDER", repository: "CI_REPOSITORY", workflow: "CI_WORKFLOW",
      workflowRef: "CI_WORKFLOW_REF", runId: "CI_RUN_ID", runAttempt: "CI_RUN_ATTEMPT", job: "CI_JOB",
      identityMode: "IDENTITY_MODE", ciSourceRef: "SOURCE_REF", ciRefProtected: "REF_PROTECTED",
      workflowSourceCommit: "WORKFLOW_SOURCE_COMMIT", implementationSourceCommit: "IMPLEMENTATION_SOURCE_COMMIT",
      ancestryVerified: "ANCESTRY_VERIFIED", workflowCheckoutClean: "WORKFLOW_CHECKOUT_CLEAN",
      implementationCheckoutClean: "IMPLEMENTATION_CHECKOUT_CLEAN" };
    for (const [k, v] of Object.entries(ci)) env[`LEDGERLY_CANONICAL_TEST_${ciNames[k]}`] = String(v);
    for (const [k, v] of Object.entries(imageBinding)) env[`LEDGERLY_CANONICAL_TEST_${k.replace(/[A-Z]/g, (c) => "_" + c).toUpperCase().replace(/^(NODE|POSTGRES)_/, "$1_IMAGE_")}`] = v;
    const execution = spawnSync("docker", ["run", "--rm", "-i", "--network", network, "--read-only",
      "--tmpfs", "/tmp:rw,noexec,nosuid,nodev", "--cap-drop=ALL", "--security-opt=no-new-privileges:true",
      image, "node", "scripts/ci/ledgerly-external-binding-regression.test.mjs", "--inside"],
      { env: hostEnv, input: JSON.stringify({ args, env }), encoding: "utf8", timeout: 60000 });
    assert.equal(execution.error, undefined);
    const result = JSON.parse(execution.stdout.trim());
    console.log(JSON.stringify({ reviewOnly: true, originalC3Executable: expectOriginal,
      runtimeOrchestratorSha256: sha(runtimeBytes) }));
    console.log(JSON.stringify(result, null, 2));
    if (expectOriginal) {
      assert.equal(execution.status, 1);
      assert.deepEqual(result.results.filter((r) => !r.passed).map((r) => r.name), [
        "source digest parity: runtime orchestrator is not coordinator",
        "actual runner forged probe reaches intended rejection, not digest failure",
      ]);
      console.log("PASS reproduced original defect: real SQL rejects forged identity; runner stops prematurely on wrong digest.");
    } else {
      assert.equal(execution.status, 0, "All binding regressions must pass");
      console.log("PASS binding-specific disposable review; NOT hosted/canonical qualification.");
    }
  } finally {
    for (const [key, args] of [
      ["container", ["rm", "-f", "-v", container]], ["network", ["network", "rm", network]],
      ["image", ["image", "rm", image]],
    ]) {
      const r = spawnSync("docker", args, { env: hostEnv, encoding: "utf8", timeout: 30000 });
      cleanup[key] = r.status === 0;
    }
    rmSync(temp, { recursive: true, force: true }); cleanup.fixture = true;
    console.log(JSON.stringify({ reviewOnly: true, cleanup }));
    assert.ok(Object.values(cleanup).every(Boolean), "Disposable review cleanup must complete");
  }
}
