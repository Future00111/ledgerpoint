import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { externalCiChildEnvironment } from "./runCanonicalPostingDisposable.mjs";

const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
const inputs = {
  databaseUrl:
    "postgresql://ledgerly_api:disposable@ledgerly-postgres:5432/ledgerly_canonical_test_00000000000000000000000000000000?sslmode=disable",
  databaseName: "ledgerly_canonical_test_00000000000000000000000000000000",
  runId: "00000000-0000-4000-8000-000000000000",
  environment: "external-ci-disposable-test",
  targetClass: "external-ci-postgresql-service-container",
};

for (const [name, corepackHome] of [
  ["missing", undefined],
  ["empty", ""],
  ["unexpected", "/home/node/.cache/node/corepack"],
]) {
  test(`external CI fails closed for ${name} COREPACK_HOME`, () => {
    assert.throws(
      () =>
        externalCiChildEnvironment({
          ...inputs,
          sourceEnvironment: { PATH: "/usr/bin", COREPACK_HOME: corepackHome },
        }),
      /COREPACK_HOME to equal \/opt\/corepack/,
    );
  });
}

test("external CI child receives exact prepared COREPACK_HOME", () => {
  const childEnvironment = externalCiChildEnvironment({
    ...inputs,
    sourceEnvironment: {
      PATH: "/usr/bin",
      COREPACK_HOME: "/opt/corepack",
    },
  });

  assert.equal(childEnvironment.COREPACK_HOME, "/opt/corepack");
});

test("external CI child receives exact package-local NODE_PATH", () => {
  const childEnvironment = externalCiChildEnvironment({
    ...inputs,
    sourceEnvironment: {
      PATH: "/usr/bin",
      COREPACK_HOME: "/opt/corepack",
      NODE_PATH: "/hostile/parent/node_modules",
    },
  });

  assert.equal(
    childEnvironment.NODE_PATH,
    path.join(packageDirectory, "node_modules"),
  );
  assert.notEqual(
    childEnvironment.NODE_PATH,
    "/hostile/parent/node_modules",
  );
});

test("external CI child environment remains an explicit allowlist", () => {
  const childEnvironment = externalCiChildEnvironment({
    ...inputs,
    sourceEnvironment: {
      PATH: "/usr/bin",
      COREPACK_HOME: "/opt/corepack",
      PGUSER: "forbidden",
      PGPASSWORD: "forbidden",
      PGHOST: "forbidden",
      PGPORT: "5432",
      REPLIT_DEV_DOMAIN: "forbidden.example",
      REPLIT_DEPLOYMENT: "forbidden",
      GITHUB_TOKEN: "forbidden",
      PRODUCTION_CREDENTIAL: "forbidden",
      ARBITRARY_PARENT_SECRET: "forbidden",
      HOME: "/home/node",
      XDG_CACHE_HOME: "/home/node/.cache",
      NODE_PATH: "/hostile/parent/node_modules",
    },
  });

  assert.deepEqual(Object.keys(childEnvironment).sort(), [
    "COREPACK_HOME",
    "DATABASE_URL",
    "LEDGERLY_CANONICAL_TEST_DATABASE_NAME",
    "LEDGERLY_CANONICAL_TEST_ENVIRONMENT",
    "LEDGERLY_CANONICAL_TEST_RUN_ID",
    "LEDGERLY_CANONICAL_TEST_TARGET_CLASS",
    "NODE_ENV",
    "NODE_PATH",
    "PATH",
  ]);
  for (const forbiddenName of [
    "PGUSER",
    "PGPASSWORD",
    "PGHOST",
    "PGPORT",
    "REPLIT_DEV_DOMAIN",
    "REPLIT_DEPLOYMENT",
    "GITHUB_TOKEN",
    "PRODUCTION_CREDENTIAL",
    "ARBITRARY_PARENT_SECRET",
    "HOME",
    "XDG_CACHE_HOME",
  ]) {
    assert.equal(forbiddenName in childEnvironment, false);
  }
});

test("external CI NODE_PATH resolves pg for CommonJS outside package tree", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "ledgerly-node-path-test-"),
  );
  const probePath = path.join(temporaryDirectory, "probe.cjs");
  try {
    writeFileSync(probePath, "process.stdout.write(require.resolve('pg'));\n", {
      mode: 0o600,
    });
    const childEnvironment = externalCiChildEnvironment({
      ...inputs,
      sourceEnvironment: {
        PATH: process.env.PATH,
        COREPACK_HOME: "/opt/corepack",
        NODE_PATH: "/hostile/parent/node_modules",
      },
    });
    const result = spawnSync(process.execPath, [probePath], {
      cwd: packageDirectory,
      env: childEnvironment,
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /node_modules[\\/]\.pnpm[\\/]pg@8\.22\.0[\\/]node_modules[\\/]pg[\\/]lib[\\/]index\.js$/,
    );
    assert.equal(result.stderr, "");
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});