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

function offlineContainer(command, extraArgs = []) {
  return spawnSync("docker", [
    "run", "--rm", "--pull=never",
    "--network", "none", "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--tmpfs", "/tmp:rw,nosuid,nodev",
    ...extraArgs,
    "--entrypoint", "/bin/sh", image, "-ec", command,
  ], { encoding: "utf8", timeout: 30_000 });
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