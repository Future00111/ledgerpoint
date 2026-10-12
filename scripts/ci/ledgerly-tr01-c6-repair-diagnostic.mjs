// Review-only diagnostic. No Environment, status writer or qualification dispatch.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const original = path.resolve(".local/c5-original");
const candidate = path.resolve(".local/c6-candidate");
const producer = path.resolve(".local/c6-producer");
const output = path.resolve("generated-artifacts/c6-repair-diagnostic");
const oldImage = "ledgerly-c5-module-reproduction:3a5c6e1";
const newImage = "ledgerly-c6-module-review:12df9aa";
const postgres = "postgres:16.15-bookworm@sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825";
const host = { PATH: process.env.PATH, HOME: process.env.HOME,
  COREPACK_ENABLE_AUTO_PIN: "0", COREPACK_DEFAULT_TO_LATEST: "0" };
const sha = (data) => createHash("sha256").update(data).digest("hex");
mkdirSync(output, { recursive: true });
const record = {
  diagnosticOnly: true, qualificationSuccess: false,
  workflowSha: process.env.GITHUB_SHA, workflowRef: process.env.GITHUB_WORKFLOW_REF,
  runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  sources: {}, checks: {},
};
let failure;

function run(command, args, { cwd = root, env = host, input, timeout = 60000, log, includeStderr = false } = {}) {
  const result = spawnSync(command, args, { cwd, env, input, encoding: "utf8", timeout,
    killSignal: "SIGKILL", maxBuffer: 20 * 1024 * 1024 });
  if (log) writeFileSync(path.join(output, log), result.stdout + result.stderr);
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${command} failed; see ${log ?? "diagnostic evidence"}`);
  return (result.stdout + (includeStderr ? result.stderr : "")).trim();
}
function verifySource(directory, commit, tree, parent, label) {
  const git = (...args) => run("git", args, { cwd: directory });
  assert.equal(git("rev-parse", "HEAD"), commit);
  assert.equal(git("rev-parse", "HEAD^{tree}"), tree);
  assert.equal(git("show", "-s", "--format=%P", "HEAD"), parent);
  assert.equal(git("status", "--porcelain", "--untracked-files=all"), "");
  const scope = [".dockerignore", ".ci/ledgerly-canonical/Dockerfile.test", ".github",
    "artifacts", "lib", "scripts", "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json",
    "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json", "tsconfig.json"];
  const files = git("ls-files", "-z", "--", ...scope).split("\0").filter(Boolean).sort();
  const hashes = {};
  const aggregate = createHash("sha256");
  for (const file of files) {
    const bytes = readFileSync(path.join(directory, file));
    const blob = spawnSync("git", ["show", `${commit}:${file}`], { cwd: directory, env: host,
      timeout: 15000, maxBuffer: 20 * 1024 * 1024 });
    assert.equal(blob.status, 0);
    assert.equal(sha(bytes), sha(blob.stdout), `Source differs: ${file}`);
    hashes[file] = sha(bytes);
    aggregate.update(file).update("\0").update(bytes).update("\0");
  }
  record.sources[label] = { commit, tree, parent, fileSha256: hashes,
    sourceTreeSha256: aggregate.digest("hex") };
  return { files, hashes };
}
function build(directory, image, sources, label) {
  writeFileSync(path.join(directory, ".ci/ledgerly-canonical/source-manifest.json"), JSON.stringify({
    fixturePurpose: "offline-build-only", notQualificationEvidence: true, version: 1,
    sourceCommit: record.sources[label].commit, files: sources.files, fileSha256: sources.hashes,
  }));
  run("docker", ["build", "-f", ".ci/ledgerly-canonical/Dockerfile.test", "-t", image, "."],
    { cwd: directory, timeout: 420000, log: `${label}-docker-build.log` });
  rmSync(path.join(directory, ".ci/ledgerly-canonical/source-manifest.json"));
  assert.equal(run("docker", ["image", "inspect", image, "--format", "{{.Config.User}}"]), "node");
  record.sources[label].imageId = run("docker", ["image", "inspect", image, "--format", "{{.Id}}"]);
  const script = `
    import assert from "node:assert/strict";
    import {createHash} from "node:crypto";
    import {readFileSync} from "node:fs";
    assert.equal(process.getuid(),1000);
    for (const [file,hash] of Object.entries(${JSON.stringify(sources.hashes)})) {
      assert.equal(createHash("sha256").update(readFileSync("/workspace/"+file)).digest("hex"),hash,file);
    }
    const manifest=JSON.parse(readFileSync("/workspace/.ci/ledgerly-canonical/source-manifest.json"));
    assert.equal(manifest.notQualificationEvidence,true); assert.equal(manifest.version,1);
    console.log("PASS exact source/image bytes and non-qualification manifest");
  `;
  run("docker", ["run", "--rm", "-i", "--pull=never", "--network", "none", "--read-only",
    "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--tmpfs", "/tmp:rw,noexec,nosuid,nodev", image, "node", "--input-type=module", "-"],
    { input: script, log: `${label}-image-source.log` });
  record.sources[label].imageSourceVerified = true;
}
function residual(kind) {
  if (kind === "containers") return run("docker", ["ps", "-a", "--format", "{{.ID}} {{.Names}}"])
    .split("\n").filter((s) => /ledgerly-binding-review/.test(s));
  return run("docker", kind === "networks"
    ? ["network", "ls", "--format", "{{.Name}}"]
    : ["images", "--format", "{{.Repository}}:{{.Tag}}"])
    .split("\n").filter((s) => s.startsWith("ledgerly-binding-review"));
}
try {
  assert.equal(process.env.GITHUB_REPOSITORY, "Future00111/ledgerpoint");
  assert.equal(process.env.GITHUB_REF, "refs/heads/review/tr01-c6-repair-diagnostic");
  assert.equal(process.env.GITHUB_EVENT_NAME, "push");
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, "1");
  for (const key of ["DATABASE_URL", "LEDGERLY_CANONICAL_TEST_DATABASE_URL", "GH_TOKEN",
    "GITHUB_TOKEN", "PGPASSWORD", "PGHOST", "REPLIT_DEV_DOMAIN", "OPENAI_API_KEY", "CLERK_SECRET_KEY"])
    assert.ok(!(key in process.env), `Forbidden parent credential/target: ${key}`);
  record.parentCredentialExclusion = true;
  for (const kind of ["containers", "networks", "images"]) assert.deepEqual(residual(kind), []);
  const old = verifySource(original, "3a5c6e1318b49edcdc7f0f918d3a01813f960e71",
    "3f2e22ccceb70ea50034b41af352a125b63cf127", "6e8255949c3da130561f781614785f692796b621", "c5");
  const fresh = verifySource(candidate, "12df9aa93deb9814c3d4b1d8ab3cd5d3cb2d9258",
    "f74c079e63cc3600398dcfa97a57a506287455b5", "39d598341c085ad8ff058f2db4663fc5fee9eaea", "c6");
  verifySource(producer, "98f8e52d6b845ec4dd0820612e49e90fb2dce974",
    "eb069529a80ee8cec03b9b2e8fe4ae52b0d053f8", "82e122115b99a6c206b5bd07743331398cae6bbe", "producer");
  for (const file of ["scripts/ci/run-ledgerly-canonical-postgresql.mjs",
    "artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs",
    "scripts/ci/ledgerly-nested-offline-review.mjs", "scripts/ci/ledgerly-offline-pnpm.test.mjs",
    "scripts/ci/ledgerly-external-binding-regression.test.mjs"])
    run("node", ["--check", file], { cwd: candidate, log: path.basename(file) + "-syntax.log" });
  build(original, oldImage, old, "c5");
  const fixture = readFileSync(path.join(candidate, "scripts/ci/ledgerly-nested-offline-review.mjs"), "utf8");
  const reproduced = run("docker", ["run", "--rm", "-i", "--pull=never", "--network", "none",
    "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--tmpfs", "/tmp:rw,noexec,nosuid,nodev", oldImage,
    "node", "--input-type=module", "-", "--inside", "--expect-c5"],
    { input: fixture, timeout: 75000, log: "c5-pg-reproduction.log", includeStderr: true });
  assert.match(reproduced, /EXPECTED_C5_MODULE_RESOLUTION_FAILURE/);
  assert.match(reproduced, /Cannot find module 'pg'/);
  assert.match(reproduced, /NESTED_FIXTURE_CLEANUP_PASS/);
  record.checks.byteExactC5PgFailureReproduced = true;
  build(candidate, newImage, fresh, "c6");
  const offline = run("node", ["--test", "scripts/ci/ledgerly-offline-pnpm.test.mjs"], {
    cwd: candidate, env: { ...host, LEDGERLY_OFFLINE_PNPM_TEST_IMAGE: newImage },
    timeout: 300000, log: "c6-offline-tests.log" });
  assert.match(offline, /pass 7/); assert.match(offline, /fail 0/); assert.match(offline, /skipped 0/);
  record.checks.offlinePassed = 7;
  run("corepack", ["enable"]);
  run("corepack", ["prepare", "pnpm@10.26.1", "--activate"], { timeout: 90000, log: "pinned-toolchain.log" });
  run("pnpm", ["install", "--frozen-lockfile", "--ignore-scripts"],
    { cwd: candidate, timeout: 180000, log: "candidate-install.log" });
  run("node", ["--test", "scripts/ci/run-ledgerly-canonical-postgresql.test.mjs"],
    { cwd: candidate, timeout: 120000, log: "c6-identity-acceptance.log" });
  record.checks.identityAcceptancePassed = true;
  run("pnpm", ["run", "typecheck:libs"], { cwd: candidate, timeout: 180000, log: "candidate-typecheck-libs.log" });
  run("pnpm", ["run", "typecheck"], { cwd: candidate, timeout: 180000, log: "candidate-typecheck.log" });
  record.checks.candidateTypechecksPassed = true;
  run("pnpm", ["install", "--frozen-lockfile", "--ignore-scripts"],
    { cwd: producer, timeout: 180000, log: "producer-install.log" });
  const producerTests = run("node", ["--test", "scripts/ci/ledgerly-tr01-c6-identity-status.test.mjs"], {
    cwd: producer, env: { ...host, LEDGERLY_C6_VALIDATION_ROOT: candidate },
    timeout: 120000, log: "producer-tests.log" });
  assert.match(producerTests, /pass 28/); assert.match(producerTests, /fail 0/); assert.match(producerTests, /skipped 0/);
  record.checks.producerTestsPassed = 28;
  run("pnpm", ["run", "typecheck:libs"], { cwd: producer, timeout: 180000, log: "producer-typecheck-libs.log" });
  run("pnpm", ["run", "typecheck"], { cwd: producer, timeout: 180000, log: "producer-typecheck.log" });
  record.checks.producerTypechecksPassed = true;
  run("docker", ["pull", postgres], { timeout: 90000, log: "postgres-image-preparation.log" });
  record.postgresPrepared = true;
  const digest = run("docker", ["image", "inspect", postgres, "--format", "{{json .RepoDigests}}"]);
  assert.ok(JSON.parse(digest).some((s) => s.endsWith("@sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825")));
  const raw = run("node", ["scripts/ci/ledgerly-external-binding-regression.test.mjs",
    "--disposable-review", "--base-image", newImage], { cwd: candidate, timeout: 240000, log: "binding.log" });
  const binding = JSON.parse(raw.match(/^\{\n[\s\S]*?^\}/m)?.[0] ?? "null");
  assert.ok(binding?.reviewOnly); assert.equal(binding.results.length, 7);
  assert.ok(binding.results.every((r) => r.passed));
  const cleanupLine = raw.split("\n").find((s) => s.startsWith('{"reviewOnly":true,"cleanup":'));
  const cleanup = JSON.parse(cleanupLine ?? "null");
  assert.deepEqual(cleanup.cleanup, { container: true, network: true, image: true, fixture: true });
  record.checks.bindingPassed = 7; record.binding = binding; record.fixtureCleanup = cleanup.cleanup;
} catch (error) {
  failure = error; record.failure = error.message;
} finally {
  try {
    for (const c of residual("containers")) run("docker", ["rm", "-f", "-v", c.split(" ")[0]]);
    for (const n of residual("networks")) run("docker", ["network", "rm", n]);
    for (const i of residual("images")) run("docker", ["image", "rm", i]);
    for (const image of [oldImage, newImage]) {
      if (run("docker", ["images", "-q", image])) run("docker", ["image", "rm", image]);
    }
    if (record.postgresPrepared) run("docker", ["image", "rm", postgres]);
    for (const dir of readdirSync("/tmp").filter((n) => n.startsWith("ledgerly-binding-review-")))
      rmSync(path.join("/tmp", dir), { recursive: true, force: true });
    for (const directory of [original, candidate, producer]) {
      rmSync(path.join(directory, ".ci/ledgerly-canonical/source-manifest.json"), { force: true });
      assert.equal(run("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: directory }), "");
    }
    record.finalCleanup = {
      containers: residual("containers").length === 0, networks: residual("networks").length === 0,
      derivedImages: residual("images").length === 0,
      temporaryFixturesAndCredentials: !readdirSync("/tmp").some((n) => n.startsWith("ledgerly-binding-review-")),
      reviewImages: [oldImage, newImage].every((i) => run("docker", ["images", "-q", i]) === ""),
      preparedPostgresImage: !record.postgresPrepared || run("docker", ["images", "-q", postgres]) === "",
    };
    assert.ok(Object.values(record.finalCleanup).every(Boolean));
  } catch (error) { record.cleanupFailure = error.message; failure ??= error; }
  record.logSha256 = {};
  for (const file of readdirSync(output).filter((n) => n.endsWith(".log")))
    record.logSha256[file] = sha(readFileSync(path.join(output, file)));
  record.result = failure ? "failed" : "passed";
  writeFileSync(path.join(output, "result.json"), JSON.stringify(record, null, 2) + "\n");
}
if (failure) { console.error(failure.message); process.exitCode = 1; }
else console.log("PASS C6 module-resolution repair diagnostics; NOT canonical qualification");
