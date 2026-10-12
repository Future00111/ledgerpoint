// Diagnostic only. No Environment, status writer or qualification dispatch.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";

const candidate = "3a5c6e1318b49edcdc7f0f918d3a01813f960e71";
const tree = "3f2e22ccceb70ea50034b41af352a125b63cf127";
const parent = "6e8255949c3da130561f781614785f692796b621";
const source = path.resolve(process.argv[2]);
const output = path.resolve("generated-artifacts/c5-binding-diagnostic");
const image = "ledgerly-c5-binding-diagnostic:3a5c6e1";
const postgres = "postgres:16.15-bookworm@sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825";
const env = { PATH: process.env.PATH, HOME: process.env.HOME };
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
mkdirSync(output, { recursive: true });
const record = {
  diagnosticOnly: true, qualificationSuccess: false,
  candidate, tree, parent, workflowSha: process.env.GITHUB_SHA,
  workflowRef: process.env.GITHUB_WORKFLOW_REF,
  runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  controls: { internalOnly: true, nonRoot: true, readOnly: true,
    noNewPrivileges: true, noEnvironment: true, contentsReadOnly: true },
};
let error;
function run(command, args, { cwd = source, input, timeout = 60000, log } = {}) {
  const result = spawnSync(command, args, {
    cwd, env, input, encoding: "utf8", timeout, killSignal: "SIGKILL",
    maxBuffer: 12 * 1024 * 1024,
  });
  if (log) writeFileSync(path.join(output, log), result.stdout + result.stderr);
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${command} failed; see ${log ?? "diagnostic evidence"}`);
  return result.stdout.trim();
}
function list(kind) {
  if (kind === "containers") return run("docker", ["ps", "-a", "--format", "{{.ID}} {{.Names}} {{.Image}}"])
    .split("\n").filter((s) => /ledgerly-binding-review/.test(s));
  return run("docker", kind === "networks"
    ? ["network", "ls", "--format", "{{.Name}}"]
    : ["images", "--format", "{{.Repository}}:{{.Tag}}"])
    .split("\n").filter((s) => s.startsWith("ledgerly-binding-review"));
}
try {
  assert.equal(process.env.GITHUB_REPOSITORY, "Future00111/ledgerpoint");
  assert.equal(process.env.GITHUB_REF, "refs/heads/review/tr01-c5-binding-diagnostic");
  assert.equal(process.env.GITHUB_EVENT_NAME, "push");
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, "1");
  for (const key of ["DATABASE_URL", "LEDGERLY_CANONICAL_TEST_DATABASE_URL",
    "LEDGERLY_API_PASSWORD", "OPENAI_API_KEY", "CLERK_SECRET_KEY", "PGHOST",
    "PGPASSWORD", "REPLIT_DEV_DOMAIN", "REPLIT_DOMAINS", "GITHUB_TOKEN", "GH_TOKEN"]) {
    assert.ok(!(key in process.env), `Forbidden credential/target variable present: ${key}`);
  }
  record.parentCredentialExclusion = true;
  assert.equal(run("git", ["rev-parse", "HEAD"]), candidate);
  assert.equal(run("git", ["rev-parse", "HEAD^{tree}"]), tree);
  assert.equal(run("git", ["show", "-s", "--format=%P", "HEAD"]), parent);
  assert.equal(run("git", ["status", "--porcelain", "--untracked-files=all"]), "");
  for (const kind of ["containers", "networks", "images"]) assert.deepEqual(list(kind), []);
  const scope = [".dockerignore", ".ci/ledgerly-canonical/Dockerfile.test", ".github",
    "artifacts", "lib", "scripts", "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json",
    "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json", "tsconfig.json"];
  const files = run("git", ["ls-files", "-z", "--", ...scope]).split("\0").filter(Boolean).sort();
  const fileSha256 = {};
  const aggregate = createHash("sha256");
  for (const f of files) {
    const bytes = readFileSync(path.join(source, f));
    assert.equal(sha(bytes), sha(spawnSync("git", ["show", `${candidate}:${f}`],
      { cwd: source, env, maxBuffer: 12 * 1024 * 1024 }).stdout), `Source differs: ${f}`);
    fileSha256[f] = sha(bytes);
    aggregate.update(f).update("\0").update(bytes).update("\0");
  }
  record.sourceTreeSha256 = aggregate.digest("hex");
  record.sourceFileSha256 = fileSha256;
  writeFileSync(path.join(source, ".ci/ledgerly-canonical/source-manifest.json"), JSON.stringify({
    fixturePurpose: "offline-build-only", notQualificationEvidence: true,
    version: 1, sourceCommit: candidate, files, fileSha256,
  }));
  run("docker", ["build", "-f", ".ci/ledgerly-canonical/Dockerfile.test", "-t", image, "."],
    { timeout: 420000, log: "docker-build.log" });
  record.imageId = run("docker", ["image", "inspect", image, "--format", "{{.Id}}"]);
  assert.equal(run("docker", ["image", "inspect", image, "--format", "{{.Config.User}}"]), "node");
  const imageCheck = `
    import assert from "node:assert/strict";
    import { createHash } from "node:crypto";
    import { readFileSync } from "node:fs";
    assert.equal(process.getuid(), 1000);
    for (const [f,h] of Object.entries(${JSON.stringify(fileSha256)})) {
      assert.equal(createHash("sha256").update(readFileSync("/workspace/"+f)).digest("hex"),h,f);
    }
    const manifest=JSON.parse(readFileSync("/workspace/.ci/ledgerly-canonical/source-manifest.json"));
    assert.equal(manifest.notQualificationEvidence,true);
    assert.equal(manifest.version,1);
    console.log("PASS exact C5 image/source hashes; build-only invalid qualification fixture");
  `;
  run("docker", ["run", "--rm", "-i", "--network", "none", "--read-only",
    "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--tmpfs", "/tmp:rw,noexec,nosuid,nodev", image,
    "node", "--input-type=module", "-"], { input: imageCheck, log: "image-source-verification.log" });
  record.imageSourceVerified = true;
  // Exact C5 deliberately uses --pull=never during the isolated DB phase.
  // Prepare that pinned dependency before isolation on the fresh hosted VM.
  run("docker", ["pull", postgres], { timeout: 90000, log: "postgres-image-preparation.log" });
  record.postgresImageDigests = JSON.parse(run("docker", ["image", "inspect", postgres,
    "--format", "{{json .RepoDigests}}"]));
  assert.ok(record.postgresImageDigests.some((d) => d.endsWith(
    "@sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825")));
  const raw = run("node", ["scripts/ci/ledgerly-external-binding-regression.test.mjs",
    "--disposable-review", "--base-image", image], { timeout: 240000, log: "binding.log" });
  const result = JSON.parse(raw.match(/^\{\n[\s\S]*?^\}/m)?.[0] ?? "null");
  assert.ok(result?.reviewOnly);
  assert.equal(result.results.length, 6);
  assert.ok(result.results.every((r) => r.passed), "Six binding cases must all pass");
  const cleanupLine = raw.split("\n").find((s) => s.startsWith('{"reviewOnly":true,"cleanup":'));
  const cleanup = JSON.parse(cleanupLine ?? "null");
  assert.deepEqual(cleanup.cleanup, { container: true, network: true, image: true, fixture: true });
  record.bindingResult = result;
  record.fixtureCleanup = cleanup.cleanup;
  record.bindingPassed = true;
} catch (failure) {
  error = failure;
  record.failure = failure.message;
  record.bindingPassed = false;
} finally {
  // Exact regression owns its resources; remove only its residual prefix if a
  // bounded outer kill occurred. Never operate on unrelated Docker resources.
  try {
    record.residualBeforeCleanup = {
      containers: list("containers"), networks: list("networks"), images: list("images"),
    };
    for (const c of record.residualBeforeCleanup.containers) run("docker", ["rm", "-f", "-v", c.split(" ")[0]]);
    for (const n of record.residualBeforeCleanup.networks) run("docker", ["network", "rm", n]);
    for (const i of record.residualBeforeCleanup.images) run("docker", ["image", "rm", i]);
    run("docker", ["image", "rm", image]);
    if (record.postgresImageDigests) run("docker", ["image", "rm", postgres]);
    const dirs = readdirSync("/tmp").filter((n) => n.startsWith("ledgerly-binding-review-"));
    for (const dir of dirs) rmSync(path.join("/tmp", dir), { recursive: true, force: true });
    rmSync(path.join(source, ".ci/ledgerly-canonical/source-manifest.json"), { force: true });
    record.finalCleanup = {
      containers: list("containers").length === 0,
      networks: list("networks").length === 0,
      derivedImages: list("images").length === 0,
      temporaryFixturesAndCredentials: !readdirSync("/tmp").some((n) => n.startsWith("ledgerly-binding-review-")),
      reviewImage: run("docker", ["images", "-q", image]) === "",
      preparedPostgresImage: !record.postgresImageDigests || run("docker", ["images", "-q", postgres]) === "",
    };
    assert.ok(Object.values(record.finalCleanup).every(Boolean));
    assert.equal(run("git", ["status", "--porcelain", "--untracked-files=all"]), "");
  } catch (cleanupFailure) {
    record.cleanupFailure = cleanupFailure.message;
    error ??= cleanupFailure;
  }
  record.logSha256 = {};
  for (const f of readdirSync(output)) if (f.endsWith(".log")) {
    record.logSha256[f] = sha(readFileSync(path.join(output, f)));
  }
  writeFileSync(path.join(output, "result.json"), JSON.stringify(record, null, 2) + "\n");
}
if (error) { console.error(error.message); process.exitCode = 1; }
else console.log("PASS six-case exact-C5 disposable binding diagnostic; NOT canonical qualification");
