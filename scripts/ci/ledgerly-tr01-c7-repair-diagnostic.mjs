// Review-only diagnostic. No Environment, status writer or qualification dispatch.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const original = path.resolve(".local/c6-original");
const candidate = path.resolve(".local/c7-candidate");
const producer = path.resolve(".local/c7-producer");
const output = path.resolve("generated-artifacts/c7-repair-diagnostic");
const oldImage = "ledgerly-c6-canonical-reproduction:99f5d97";
const newImage = "ledgerly-c7-canonical-review:50a286d";
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
    .split("\n").filter((s) => /ledgerly-binding-review|ledgerly-ti03-(?:pg|test|bootstrap)-/.test(s));
  return run("docker", kind === "networks"
    ? ["network", "ls", "--format", "{{.Name}}"]
    : ["images", "--format", "{{.Repository}}:{{.Tag}}"])
    .split("\n").filter((s) => s.startsWith("ledgerly-binding-review") || s.startsWith("ledgerly-ti03-net-"));
}
try {
  assert.equal(process.env.GITHUB_REPOSITORY, "Future00111/ledgerpoint");
  assert.equal(process.env.GITHUB_REF, "refs/heads/review/tr01-c7-repair-diagnostic");
  assert.equal(process.env.GITHUB_EVENT_NAME, "push");
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, "1");
  for (const key of ["DATABASE_URL", "LEDGERLY_CANONICAL_TEST_DATABASE_URL", "GH_TOKEN", "GITHUB_TOKEN",
    "PGPASSWORD", "PGHOST", "REPLIT_DEV_DOMAIN", "OPENAI_API_KEY", "CLERK_SECRET_KEY"])
    assert.ok(!(key in process.env), "Forbidden parent credential/target: " + key);
  record.parentCredentialExclusion = true;
  for (const kind of ["containers", "networks", "images"]) assert.deepEqual(residual(kind), []);
  const c6Source = verifySource(original, "99f5d97b96f7065d08f3ac09627cceea0398ebcc", "97adb531740e91c1084993a7a27d55138ec93888", "bae76f712fa16cdd1a51cc1c1375adee0241fc7c", "c6");
  const c7Source = verifySource(candidate, "50a286dcd6cfae1963540ee2d0aec9f445abccc5", "a0b44185958bf36e4285b601a43a13777a3b0a2e", "cddffd97e57ed7cbc6153f8ff74c5ed9d1d4bf67", "c7");
  const producerSource = verifySource(producer, "264110aa0db844a7582819756dce06ceb8c75d34", "3d2b7e871fce3c21c28eaa63db3579540877c837", "fdb4e2af7168e52dafde04d003f498ed76489206", "producer");
  run("corepack", ["enable"]);
  run("corepack", ["prepare", "pnpm@10.26.1", "--activate"], { timeout: 90000, log: "pinned-toolchain.log" });
  for (const [label, directory] of [["candidate",candidate],["producer",producer],["original",original]])
    run("pnpm", ["install", "--frozen-lockfile", "--ignore-scripts"],
      { cwd: directory, timeout: 180000, log: label + "-install.log" });
  const schema = run("node", ["--test", "scripts/ci/ledgerly-schema-push-regression.test.mjs"],
    { cwd: candidate, timeout: 120000, log: "schema-push-tests.log" });
  assert.match(schema, /pass 19/); assert.match(schema, /fail 0/); assert.match(schema, /skipped 0/);
  record.checks.schemaPushPassed = 19;
  run("node", ["--test", "scripts/ci/run-ledgerly-canonical-postgresql.test.mjs"],
    { cwd: candidate, timeout: 120000, log: "c7-identity-acceptance.log" });
  record.checks.identityAcceptancePassed = true;
  for (const [label, directory] of [["candidate",candidate],["producer",producer]]) {
    run("pnpm", ["run", "typecheck:libs"], { cwd: directory, timeout: 180000, log: label + "-typecheck-libs.log" });
    run("pnpm", ["run", "typecheck"], { cwd: directory, timeout: 180000, log: label + "-typecheck.log" });
    record.checks[label + "TypechecksPassed"] = true;
  }
  const contracts = run("node", ["--test", "scripts/ci/ledgerly-tr01-c7-identity-status.test.mjs"],
    { cwd: producer, env: { ...host, LEDGERLY_C7_VALIDATION_ROOT: candidate }, timeout: 120000, log: "producer-tests.log" });
  assert.match(contracts, /pass 29/); assert.match(contracts, /fail 0/); assert.match(contracts, /skipped 0/);
  record.checks.producerTestsPassed = 29;
  build(original, oldImage, c6Source, "c6");
  build(candidate, newImage, c7Source, "c7");
  const offline = run("node", ["--test", "scripts/ci/ledgerly-offline-pnpm.test.mjs"],
    { cwd: candidate, env: { ...host, LEDGERLY_OFFLINE_PNPM_TEST_IMAGE: newImage }, timeout: 300000, log: "c7-offline-tests.log" });
  assert.match(offline, /pass 7/); assert.match(offline, /fail 0/); assert.match(offline, /skipped 0/);
  record.checks.offlinePassed = 7;
  run("docker", ["pull", postgres], { timeout: 90000, log: "postgres-image-preparation.log" });
  record.postgresPrepared = true;
  assert.ok(JSON.parse(run("docker", ["image", "inspect", postgres, "--format", "{{json .RepoDigests}}"])).some(
    (s) => s.endsWith("@sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825")));
  for (const [label, directory, image] of [["c6",original,oldImage],["c7",candidate,newImage]]) {
    const args = ["scripts/ci/ledgerly-canonical-repair-review.mjs", "--source-root", directory,
      "--base-image", image, "--output", path.join(output, label + "-canonical-review.json")];
    if (label === "c6") args.push("--expected-c6-failure");
    const logged = run("node", args, { timeout: 480000, log: label + "-canonical-review.log", includeStderr: true });
    const review = JSON.parse(readFileSync(path.join(output,label + "-canonical-review.json")));
    assert.equal(review.reviewOnly, true); assert.equal(review.qualificationSuccess, false);
    assert.equal(review.result, "passed"); assert.ok(Object.values(review.cleanup).every((v)=>v===true));
    assert.equal(review.sourceTreeSha256, record.sources[label].sourceTreeSha256);
    if (label === "c6") {
      assert.equal(review.expectedC6Failure,true);
      assert.match(logged,/pass 2/); assert.match(logged,/fail 3/);
      assert.match(logged,/An authoritative account row was not found/);
      assert.match(logged,/permission denied for table canonical_journal_entries/);
      record.checks.exactC6CanonicalFailuresReproduced = true;
    } else {
      assert.match(logged,/tests 6/); assert.match(logged,/pass 6/); assert.match(logged,/fail 0/); assert.match(logged,/skipped 0/);
      record.checks.canonicalReviewPassed = 6;
      record.checks.negativeControlsPassed = 18;
      record.checks.journalLockProofPassed = true;
      record.checks.bootstrapConvergencePassed = true;
    }
    record[label + "ReviewCleanup"] = review.cleanup;
  }
  const raw = run("node", ["scripts/ci/ledgerly-external-binding-regression.test.mjs", "--disposable-review", "--base-image", newImage],
    { cwd: candidate, timeout: 240000, log: "binding.log" });
  const binding = JSON.parse(raw.match(/^\{\n[\s\S]*?^\}/m)?.[0] ?? "null");
  assert.ok(binding?.reviewOnly); assert.equal(binding.results.length, 8); assert.ok(binding.results.every((r) => r.passed));
  const cleanup = JSON.parse(raw.split("\n").find((s)=>s.startsWith('{"reviewOnly":true,"cleanup":')) ?? "null");
  assert.ok(Object.values(cleanup.cleanup).every((v)=>v===true));
  record.checks.bindingPassed = 8; record.binding = binding; record.fixtureCleanup = cleanup.cleanup;
} catch (error) { failure = error; record.failure = error.message; }
finally {
  try {
    for (const c of residual("containers")) run("docker", ["rm", "-f", "-v", c.split(" ")[0]]);
    for (const n of residual("networks")) run("docker", ["network", "rm", n]);
    for (const i of residual("images")) run("docker", ["image", "rm", i]);
    for (const i of [oldImage,newImage,"ledgerly-canonical-test:24.13.0-bookworm-slim"])
      if (run("docker",["images","-q",i])) run("docker",["image","rm",i]);
    if (record.postgresPrepared) run("docker",["image","rm",postgres]);
    const ownedTemp = (n) => /^(ledgerly-binding-review-|ledgerly-ti-03-|ledgerly-canonical-repair-review-)/.test(n);
    for (const dir of readdirSync("/tmp").filter(ownedTemp)) rmSync(path.join("/tmp",dir),{recursive:true,force:true});
    for (const directory of [original,candidate,producer]) {
      rmSync(path.join(directory,".ci/ledgerly-canonical/source-manifest.json"),{force:true});
      rmSync(path.join(directory,"scripts/ci/review-canonical-coordinator.mjs"),{force:true});
      for (const file of ["artifacts/api-server/.tsbuildinfo","lib/api-client-react/tsconfig.tsbuildinfo",
        "lib/api-zod/tsconfig.tsbuildinfo","lib/db/tsconfig.tsbuildinfo","scripts/tsconfig.tsbuildinfo"])
        if (run("git",["ls-files","--",file],{cwd:directory}) === "") rmSync(path.join(directory,file),{force:true});
      assert.equal(run("git",["status","--porcelain","--untracked-files=all"],{cwd:directory}),"");
    }
    record.finalCleanup = { containers: residual("containers").length === 0, networks: residual("networks").length === 0,
      derivedImages: residual("images").length === 0,
      temporaryFixturesAndCredentials: !readdirSync("/tmp").some(ownedTemp),
      reviewImages: [oldImage,newImage,"ledgerly-canonical-test:24.13.0-bookworm-slim"].every((i)=>run("docker",["images","-q",i]) === ""),
      preparedPostgresImage: !record.postgresPrepared || run("docker",["images","-q",postgres]) === "" };
    assert.ok(Object.values(record.finalCleanup).every(Boolean));
  } catch (error) { record.cleanupFailure = error.message; failure ??= error; }
  record.logSha256 = {};
  for (const file of readdirSync(output).filter((n)=>n.endsWith(".log"))) record.logSha256[file]=sha(readFileSync(path.join(output,file)));
  record.result = failure ? "failed" : "passed";
  writeFileSync(path.join(output,"result.json"),JSON.stringify(record,null,2)+"\n");
}
if (failure) { console.error(failure.message); process.exitCode = 1; }
else console.log("PASS C7 canonical repair review; NOT live qualification");
