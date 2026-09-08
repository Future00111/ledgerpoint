import assert from "node:assert/strict";
import test from "node:test";
import { externalCiChildEnvironment } from "./runCanonicalPostingDisposable.mjs";

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