// NON-QUALIFICATION fixture: compile real canonical tests but never open a DB.
// Run from stdin in the actual production/review image; writes only to /tmp.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

assert.ok(process.argv.includes("--inside"), "Disposable image --inside required");
const original = process.argv.includes("--expect-c4");
const missing = process.argv.includes("--missing-cache");
const root = "/workspace";
const api = path.join(root, "artifacts/api-server");
const source = await readFile(path.join(api, "scripts/runCanonicalPostingDisposable.mjs"), "utf8");
// Extract the exact existing external-CI child allowlist, not a parallel mock.
const block = source.match(/const childEnvironment = (\{[\s\S]*?\n  \});/);
assert.ok(block, "Actual external-CI child environment must be found");
Object.assign(process.env, {
  LEDGERLY_CANONICAL_TEST_DATABASE_URL: "postgresql://ledgerly_api:synthetic-only@ledgerly-postgres:5432/ledgerly_canonical_test_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?sslmode=disable",
  DATABASE_URL: "synthetic-parent-must-not-be-inherited",
  GITHUB_TOKEN: "synthetic-credential-exclusion-marker",
  OPENAI_API_KEY: "synthetic-credential-exclusion-marker",
  REPLIT_DEV_DOMAIN: "synthetic-exclusion-marker",
  PGHOST: "synthetic-exclusion-marker",
});
const env = new Function("process", "databaseName", "runId", "environment", "targetClass",
  `return ${block[1]}`)(process, "ledgerly_canonical_test_" + "a".repeat(32),
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "external-ci-disposable-test",
  "external-ci-postgresql-service-container");
assert.equal(env.NODE_ENV, "test");
assert.equal(env.DATABASE_URL, process.env.LEDGERLY_CANONICAL_TEST_DATABASE_URL);
for (const key of ["GITHUB_TOKEN", "OPENAI_API_KEY", "REPLIT_DEV_DOMAIN", "PGHOST", "HOME"])
  assert.equal(env[key], undefined, `Credential/target exclusion: ${key}`);
if (!original) {
  assert.equal(env.COREPACK_HOME, "/opt/corepack");
  for (const key of ["COREPACK_DEFAULT_TO_LATEST", "COREPACK_ENABLE_AUTO_PIN", "COREPACK_ENABLE_NETWORK"])
    assert.equal(env[key], "0");
}
const temp = await mkdtemp(path.join(tmpdir(), "ledgerly-nested-offline-"));
try {
  // Test-only import seam; production source and its CLI remain untouched.
  const module = path.join(temp, "runtime-access.mjs");
  await writeFile(module, source.replace('import pg from "pg";',
    `import pg from ${JSON.stringify(pathToFileURL(path.join(api, "node_modules/pg/lib/index.js")).href)};`) +
    "\nexport { runProcess };\n");
  const { runProcess } = await import(pathToFileURL(module).href);
  const before = await readFile(path.join(root, "package.json"));
  const output = path.join(temp, "actual-canonical-tests.cjs");
  try {
    // Same real source, flags, cwd, executor and sanitized environment as C4.
    await runProcess("pnpm", ["exec", "esbuild",
      "src/services/accounting/canonicalPosting.integration.test.ts",
      "--bundle", "--platform=node", "--format=cjs",
      "--external:pg", "--external:pino", "--external:pino-http",
      "--external:pino-pretty", "--external:thread-stream", `--outfile=${output}`],
      { cwd: api, env, timeoutMs: 45000 });
    assert.equal(original || missing, false, "Original/missing-cache invocation must fail closed");
  } catch (error) {
    if (!original && !missing) throw error;
    assert.match(error.message, /pnpm exited with status/);
    console.log(original ? "EXPECTED_C4_NESTED_FAILURE" : "EXPECTED_MISSING_CACHE_FAILURE");
    console.log(JSON.stringify({ reviewOnly: true, environmentKeys: Object.keys(env).sort(),
      credentialsExcluded: true, databaseAccessed: false }));
    process.exitCode = 0;
  }
  if (!original && !missing) {
    const fixture = path.join(temp, "nested-test.cjs");
    await writeFile(fixture, `
const test = require("node:test"), assert = require("node:assert/strict");
const {spawnSync} = require("node:child_process");
test("real nested pinned pnpm/test invocation under sanitized environment", () => {
  assert.equal(process.getuid(), 1000);
  assert.equal(process.env.COREPACK_HOME, "/opt/corepack");
  assert.equal(process.env.COREPACK_ENABLE_NETWORK, "0");
  assert.equal(process.env.GITHUB_TOKEN, undefined);
  assert.equal(process.env.REPLIT_DEV_DOMAIN, undefined);
  const version = spawnSync("pnpm", ["--version"], {encoding:"utf8",timeout:15000});
  assert.equal(version.status,0,version.stderr); assert.equal(version.stdout.trim(),"10.26.1");
  const cli = spawnSync("pnpm", ["exec","drizzle-kit","--version"],
    {cwd:"/workspace/lib/db",encoding:"utf8",timeout:15000});
  assert.equal(cli.status,0,cli.stderr); assert.match(cli.stdout,/drizzle-kit/);
});
`);
    await runProcess("node", ["--test", fixture], { cwd: api, env, timeoutMs: 45000 });
    assert.deepEqual(await readFile(path.join(root, "package.json")), before);
    console.log("NESTED_OFFLINE_PASS");
    console.log(JSON.stringify({ reviewOnly: true, credentialsExcluded: true,
      canonicalSourceCompiled: true, nestedNodeTestPassed: true, databaseAccessed: false }));
  }
} finally {
  await rm(temp, { recursive: true, force: true });
  console.log("NESTED_FIXTURE_CLEANUP_PASS");
}
