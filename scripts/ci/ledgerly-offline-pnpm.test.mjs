import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const dockerfile = await readFile(
  fileURLToPath(new URL("../../.ci/ledgerly-canonical/Dockerfile.test", import.meta.url)),
  "utf8",
);
const image = process.env.LEDGERLY_OFFLINE_PNPM_TEST_IMAGE;
const nestedFixture = await readFile(
  fileURLToPath(new URL("./ledgerly-nested-offline-review.mjs", import.meta.url)), "utf8",
);

test("the production image pins a shared cache and tests the final user offline", () => {
  assert.match(dockerfile, /COREPACK_HOME=\/opt\/corepack/);
  assert.match(dockerfile, /COREPACK_DEFAULT_TO_LATEST=0/);
  assert.match(dockerfile, /COREPACK_ENABLE_AUTO_PIN=0/);
  assert.match(dockerfile, /corepack prepare pnpm@10\.26\.1 --activate/);
  assert.match(dockerfile, /chmod -R a\+rX "\$COREPACK_HOME"/);
  assert.match(dockerfile, /COREPACK_ENABLE_NETWORK=0\s+USER node/);
  assert.match(dockerfile, /USER node[\s\S]*RUN --network=none test "\$\(pnpm --version\)" = "10\.26\.1"/);
  assert.match(dockerfile, /pnpm --filter @workspace\/db exec drizzle-kit --version/);
});

function offlineContainer(command, extraArgs = [], input) {
  return spawnSync("docker", [
    "run", "--rm", "--pull=never",
    ...(input === undefined ? [] : ["-i"]),
    "--network", "none", "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--tmpfs", "/tmp:rw,noexec,nosuid,nodev",
    ...extraArgs,
    "--entrypoint", "/bin/sh", image, "-ec", command,
  ], { encoding: "utf8", timeout: 75_000, input });
}

test("pinned pnpm and the bootstrap CLI work as node on a read-only, offline image",
  { skip: !image }, () => {
    const result = offlineContainer(`
      test "$(id -u)" = "1000"
      test "$COREPACK_HOME" = "/opt/corepack"
      test "$COREPACK_ENABLE_NETWORK" = "0"
      test "$COREPACK_DEFAULT_TO_LATEST" = "0"
      test "$COREPACK_ENABLE_AUTO_PIN" = "0"
      before="$(sha256sum /workspace/package.json)"
      test "$(pnpm --version)" = "10.26.1"
      pnpm --filter @workspace/db exec drizzle-kit --version
      test "$(sha256sum /workspace/package.json)" = "$before"
    `);
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });

test("an empty runtime cache fails closed rather than fetching a replacement",
  { skip: !image }, () => {
    const result = offlineContainer("pnpm --version", [
      "--env", "COREPACK_HOME=/tmp/empty-corepack-cache",
    ]);
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /[Nn]etwork access disabled/);
  });

test("actual sanitized child compiles canonical source and runs nested pnpm/node tests offline",
  { skip: !image }, () => {
    const result = offlineContainer(
      'test "$(id -u)" = 1000; node --input-type=module - --inside', [], nestedFixture);
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /NESTED_OFFLINE_PASS/);
    assert.match(result.stdout, /NESTED_FIXTURE_CLEANUP_PASS/);
    assert.doesNotMatch(result.stderr, /pnpm\/latest|EAI_AGAIN/);
  });

test("actual sanitized nested invocation with missing cache fails without registry access",
  { skip: !image }, () => {
    const result = offlineContainer('node --input-type=module - --inside --missing-cache',
      ["--tmpfs", "/opt/corepack:rw,noexec,nosuid,nodev,mode=1777"], nestedFixture);
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /EXPECTED_MISSING_CACHE_FAILURE/);
    assert.match(result.stdout, /NESTED_FIXTURE_CLEANUP_PASS/);
    assert.match(result.stderr, /[Nn]etwork access disabled/);
    assert.doesNotMatch(result.stderr, /pnpm\/latest|EAI_AGAIN/);
  });

test("a missing read-only cache also rejects the real nested invocation locally",
  { skip: !image }, () => {
    const result = offlineContainer('node --input-type=module - --inside --missing-cache',
      ["--tmpfs", "/opt/corepack:ro,noexec,nosuid,nodev"], nestedFixture);
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /EXPECTED_MISSING_CACHE_FAILURE/);
    assert.match(result.stdout, /NESTED_FIXTURE_CLEANUP_PASS/);
    assert.match(result.stderr, /ENOENT|EROFS|EACCES/);
    assert.doesNotMatch(result.stderr, /pnpm\/latest|EAI_AGAIN/);
  });