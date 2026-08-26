import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const required = [
  "DATABASE_URL",
  "LEDGERLY_CANONICAL_TEST_DATABASE_URL",
  "LEDGERLY_CANONICAL_TEST_DATABASE_NAME",
  "LEDGERLY_CANONICAL_TEST_RUN_ID",
  "LEDGERLY_CANONICAL_TEST_RUN_NONCE",
  "LEDGERLY_CANONICAL_TEST_ENVIRONMENT",
  "LEDGERLY_CANONICAL_TEST_SCHEMA_SHA256",
  "LEDGERLY_CANONICAL_TEST_CONFIG_SHA256",
  "LEDGERLY_CANONICAL_TEST_OVERLAY_SHA256",
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`${name} is required; normal development is not a fallback`);
  }
}

if (
  !process.env.REPLIT_DEV_DOMAIN ||
  process.env.REPLIT_DEPLOYMENT ||
  process.env.REPLIT_DEPLOYMENT_ID ||
  process.env.NODE_ENV === "production"
) {
  throw new Error("Canonical integration tests are permitted only in a Replit development workspace");
}

const normalDatabaseUrl = new URL(process.env.DATABASE_URL);
const disposableDatabaseUrl = new URL(process.env.LEDGERLY_CANONICAL_TEST_DATABASE_URL);
const databaseName = process.env.LEDGERLY_CANONICAL_TEST_DATABASE_NAME;
const runId = process.env.LEDGERLY_CANONICAL_TEST_RUN_ID;
const environment = process.env.LEDGERLY_CANONICAL_TEST_ENVIRONMENT;
const runNonce = process.env.LEDGERLY_CANONICAL_TEST_RUN_NONCE;
const expectedCommand = "pnpm --filter @workspace/api-server run test:canonical-posting";

function assertSafeConnectionUrl(url, label) {
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`${label} must use a PostgreSQL URI`);
  }
  if (!url.hostname || !url.port) {
    throw new Error(`${label} must declare its host and port in the URI authority`);
  }
  const allowedQueryKeys = new Set(["sslmode"]);
  const rejectedQueryKeys = [...new Set(url.searchParams.keys())].filter(
    (key) => !allowedQueryKeys.has(key),
  );
  if (rejectedQueryKeys.length > 0) {
    throw new Error(
      `${label} contains forbidden connection target overrides: ${rejectedQueryKeys.sort().join(",")}`,
    );
  }
}

assertSafeConnectionUrl(normalDatabaseUrl, "The normal development database URL");
assertSafeConnectionUrl(disposableDatabaseUrl, "The disposable database URL");

if (!/^ledgerly_canonical_test_[0-9a-f]{32}$/.test(databaseName)) {
  throw new Error("The disposable database name is not allowlisted");
}
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    runId,
  )
) {
  throw new Error("The disposable run UUID is invalid");
}
if (!/^[0-9a-f]{64}$/.test(runNonce)) {
  throw new Error("The disposable run nonce is invalid");
}
if (environment !== "development-disposable-test") {
  throw new Error("The disposable environment marker is invalid");
}
if (
  decodeURIComponent(normalDatabaseUrl.username) !== "ledgerly_api" ||
  normalDatabaseUrl.pathname.slice(1) !== "heliumdb"
) {
  throw new Error("The normal development identity is not the approved ledgerly_api/heliumdb boundary");
}
if (
  decodeURIComponent(disposableDatabaseUrl.username) !== "ledgerly_api" ||
  disposableDatabaseUrl.pathname.slice(1) !== databaseName ||
  databaseName === "heliumdb"
) {
  throw new Error("The disposable database identity does not match the approved API-role binding");
}
if (
  normalDatabaseUrl.protocol !== disposableDatabaseUrl.protocol ||
  normalDatabaseUrl.hostname !== disposableDatabaseUrl.hostname ||
  normalDatabaseUrl.port !== disposableDatabaseUrl.port ||
  normalDatabaseUrl.search !== disposableDatabaseUrl.search
) {
  throw new Error("The disposable database is not on the approved development database endpoint");
}

const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
const workspaceDirectory = path.resolve(packageDirectory, "../..");
const sourceDigests = {
  applicationSchema: createHash("sha256")
    .update(readFileSync(path.join(workspaceDirectory, "lib/db/src/schema/index.ts")))
    .digest("hex"),
  drizzleConfig: createHash("sha256")
    .update(readFileSync(path.join(workspaceDirectory, "lib/db/drizzle.config.ts")))
    .digest("hex"),
  securityOverlay: createHash("sha256")
    .update(
      readFileSync(
        path.join(workspaceDirectory, "scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql"),
      ),
    )
    .digest("hex"),
};
if (
  sourceDigests.applicationSchema !== process.env.LEDGERLY_CANONICAL_TEST_SCHEMA_SHA256 ||
  sourceDigests.drizzleConfig !== process.env.LEDGERLY_CANONICAL_TEST_CONFIG_SHA256 ||
  sourceDigests.securityOverlay !== process.env.LEDGERLY_CANONICAL_TEST_OVERLAY_SHA256
) {
  throw new Error("The bound bootstrap source digest changed");
}

async function snapshotNormalDevelopment() {
  const client = new pg.Client({ connectionString: normalDatabaseUrl.toString() });
  await client.connect();
  try {
    const identity = (
      await client.query(
        `SELECT current_database() AS database, current_user AS current_user, session_user AS session_user`,
      )
    ).rows[0];
    if (
      identity?.database !== "heliumdb" ||
      identity.current_user !== "ledgerly_api" ||
      identity.session_user !== "ledgerly_api"
    ) {
      throw new Error("The normal development snapshot identity changed");
    }
    const tables = [
      "accounting_posting_effects",
      "canonical_journal_entries",
      "canonical_journal_lines",
      "canonical_journal_relations",
      "accounting_audit_events",
      "journal_entries",
    ];
    const snapshot = {};
    for (const table of tables) {
      const rows = (
        await client.query(
          `SELECT id::text AS id, to_jsonb(t)::text AS row_json
           FROM public."${table}" t
           ORDER BY id`,
        )
      ).rows;
      snapshot[table] = {
        count: rows.length,
        sha256: createHash("sha256")
          .update(rows.map((row) => `${row.id}:${row.row_json}`).join("\n"))
          .digest("hex"),
      };
    }
    return snapshot;
  } finally {
    await client.end();
  }
}

async function verifyPrivateRunBinding() {
  const client = new pg.Client({ connectionString: disposableDatabaseUrl.toString() });
  await client.connect();
  try {
    const identity = (
      await client.query(
        `SELECT current_database() AS database, current_user AS current_user, session_user AS session_user`,
      )
    ).rows[0];
    if (
      identity?.database !== databaseName ||
      identity.current_user !== "ledgerly_api" ||
      identity.session_user !== "ledgerly_api"
    ) {
      throw new Error("The disposable runtime identity does not match its binding");
    }
    const verification = await client.query(
      `SELECT public.ledgerly_verify_disposable_run(
         $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9
       ) AS verified`,
      [
        runId,
        databaseName,
        environment,
        "postgres",
        sourceDigests.applicationSchema,
        sourceDigests.drizzleConfig,
        sourceDigests.securityOverlay,
        expectedCommand,
        runNonce,
      ],
    );
    if (verification.rows[0]?.verified !== true) {
      throw new Error("The private disposable run binding did not verify");
    }
  } finally {
    await client.end();
  }
}

async function verifyNoLingeringTestSessions() {
  const client = new pg.Client({ connectionString: disposableDatabaseUrl.toString() });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT count(*)::int AS count
       FROM pg_stat_activity
       WHERE datname = current_database()
         AND usename = current_user
         AND pid <> pg_backend_pid()`,
    );
    if (result.rows[0]?.count !== 0) {
      throw new Error("The canonical test process left API-role sessions open");
    }
  } finally {
    await client.end();
  }
}

const output = path.join(packageDirectory, `.canonical-posting-${runId}.cjs`);
const childEnvironment = {
  ...process.env,
  DATABASE_URL: disposableDatabaseUrl.toString(),
};
for (const name of [
  "PGHOST",
  "PGPORT",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
  "PGSSLMODE",
  "LEDGERLY_CANONICAL_TEST_DATABASE_URL",
  "LEDGERLY_CANONICAL_TEST_RUN_NONCE",
]) {
  delete childEnvironment[name];
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: packageDirectory,
      env: childEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated by ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`${command} exited with status ${code}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

const normalBefore = await snapshotNormalDevelopment();
await verifyPrivateRunBinding();
let testOutput;
try {
  await run("pnpm", [
    "exec",
    "esbuild",
    "src/services/accounting/canonicalPosting.integration.test.ts",
    "--bundle",
    "--platform=node",
    "--format=cjs",
    "--external:pg",
    "--external:pino",
    "--external:pino-http",
    "--external:pino-pretty",
    "--external:thread-stream",
    `--outfile=${output}`,
  ]);
  testOutput = await run("node", ["--test", output]);
} finally {
  await rm(output, { force: true });
}
await verifyNoLingeringTestSessions();
const normalAfter = await snapshotNormalDevelopment();
if (JSON.stringify(normalBefore) !== JSON.stringify(normalAfter)) {
  throw new Error("The normal development canonical manifest changed during disposable tests");
}

const identityMarker = "LEDGERLY_DISPOSABLE_IDENTITY ";
const concurrencyMarker = "LEDGERLY_CONCURRENCY_EVIDENCE ";
const identityLine = testOutput.stdout
  .split("\n")
  .find((line) => line.includes(identityMarker));
const concurrencyLine = testOutput.stdout
  .split("\n")
  .find((line) => line.includes(concurrencyMarker));
if (!identityLine || !concurrencyLine) {
  throw new Error("The canonical suite did not emit its required identity and concurrency evidence");
}
const identityEvidence = JSON.parse(
  identityLine.slice(identityLine.indexOf(identityMarker) + identityMarker.length),
);
const concurrencyEvidence = JSON.parse(
  concurrencyLine.slice(
    concurrencyLine.indexOf(concurrencyMarker) + concurrencyMarker.length,
  ),
);
if (!concurrencyEvidence.overlapProven) {
  throw new Error("The concurrency barrier did not prove overlapping transactions");
}

console.log(
  "LEDGERLY_CANONICAL_TEST_COMPLETION",
  JSON.stringify({
    runId,
    databaseName,
    environment,
    privateRunBindingVerified: true,
    developmentEndpointMatched: true,
    sourceDigests,
    identityEvidence,
    concurrencyEvidence,
    normalDevelopmentBefore: normalBefore,
    normalDevelopmentAfter: normalAfter,
    normalDevelopmentUnchanged: true,
    administrativeEnvironmentRemovedFromTestProcess: true,
  }),
);