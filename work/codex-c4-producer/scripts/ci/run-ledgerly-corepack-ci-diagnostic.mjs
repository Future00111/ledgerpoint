import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  chmod,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const evidenceSchemaPath =
  "docs/governance/evidence/ledgerly-44-ti-03-corepack-ci-diagnostic.schema.json";
const dockerfilePath = ".ci/ledgerly-canonical/Dockerfile.test";
const expectedWorkflow = "Ledgerly Corepack CI diagnostic only";
const expectedJob = "corepack-diagnostic";
const expectedSourceRef = "refs/heads/main";
const expectedPnpmVersion = "10.26.1";
const testImagePrefix = "ledgerly-corepack-diagnostic";
const artifactSizeLimitBytes = 64 * 1024;
const commandOutputLimit = 32 * 1024;
const sourceManifestPath = ".ci/ledgerly-canonical/source-manifest.json";
const executionTreePathspecs = [
  ".dockerignore",
  ".ci/ledgerly-canonical/Dockerfile.test",
  ".github",
  "artifacts",
  "lib",
  "scripts",
  "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "tsconfig.json",
];

const state = {
  source: {
    sourceSha: process.env.GITHUB_SHA ?? null,
    workflow: process.env.GITHUB_WORKFLOW ?? null,
    workflowRef: process.env.GITHUB_WORKFLOW_REF ?? null,
    ref: process.env.GITHUB_REF ?? null,
    protected: process.env.GITHUB_REF_PROTECTED === "true",
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    job: process.env.GITHUB_JOB ?? null,
  },
  image: null,
  probes: [],
  containerNames: [],
  imageName: null,
  manifestCreated: false,
  envFilePath: null,
  cleanup: {
    containersRemoved: true,
    networkRemoved: true,
    envFileRemoved: true,
    temporaryMaterialRemoved: true,
    imageRemoved: true,
  },
  security: {
    environmentAllowlist: true,
    noArbitraryEnvironmentDump: true,
    noCredentials: true,
    noDockerSocket: true,
    networkDisabled: false,
    hardeningReproduced: false,
    noDatabaseTargets: true,
    secretScanPassed: false,
    artifactSizeBoundPassed: false,
  },
};

class DiagnosticError extends Error {
  constructor(phase, message) {
    super(message);
    this.name = "DiagnosticError";
    this.phase = phase;
  }
}

function bounded(value, maxLength = commandOutputLimit) {
  const text = String(value ?? "");
  return text.length > maxLength ? text.slice(-maxLength) : text;
}

function safeFailureMessage(error) {
  return bounded(
    error instanceof DiagnosticError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error),
    240,
  ).replaceAll(/\s+/g, " ");
}

function commandError(phase, command, args, result) {
  const detail = result.signal ? `signal ${result.signal}` : `exit ${result.exitCode}`;
  return new DiagnosticError(
    phase,
    `${command} ${args[0] ?? ""} failed with ${detail}`.trim(),
  );
}

function runCommand(
  command,
  args,
  {
    cwd = root,
    env = process.env,
    timeoutMs = 120_000,
    allowFailure = false,
    phase = "preflight",
  } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let killTimer;
    const append = (current, chunk) => {
      const next = current + chunk.toString();
      return next.length > commandOutputLimit
        ? next.slice(-commandOutputLimit)
        : next;
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      resolve({ ...result, stdout, stderr });
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      reject(error);
    };
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {}
      killTimer = setTimeout(() => {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {}
      }, 2_000);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = append(stderr, chunk);
    });
    child.on("error", (error) => {
      if (allowFailure) finish({ exitCode: null, signal: error.code ?? "error" });
      else fail(new DiagnosticError(phase, `${command} could not start`));
    });
    child.on("close", (exitCode, signal) => {
      const result = { exitCode, signal };
      if (!allowFailure && (exitCode !== 0 || signal)) {
        fail(commandError(phase, command, args, result));
      } else {
        finish(result);
      }
    });
  });
}

async function requireCommand(command, args, options = {}) {
  return runCommand(command, args, { ...options, allowFailure: false });
}

function parseJsonLines(output, expectedCount) {
  const lines = output.trim().split("\n");
  if (lines.length < expectedCount) {
    throw new DiagnosticError("image-inspect", "Filtered Docker inspection was incomplete");
  }
  return lines.slice(-expectedCount).map((line) => JSON.parse(line));
}

function selectedEnvironment(env) {
  const result = {
    PATH: null,
    HOME: null,
    COREPACK_HOME: null,
    XDG_CACHE_HOME: null,
  };
  for (const entry of env ?? []) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    const name = entry.slice(0, separator);
    if (Object.hasOwn(result, name)) result[name] = entry.slice(separator + 1);
  }
  return result;
}

async function inspectImage(imageName) {
  const result = await requireCommand("docker", [
    "image",
    "inspect",
    imageName,
    "--format",
    "{{json .Id}}\n{{json .RepoDigests}}\n{{json .Config.User}}\n{{json .Config.WorkingDir}}\n{{json .Config.Entrypoint}}\n{{json .Config.Cmd}}\n{{json .Config.Env}}",
  ]);
  const [id, repoDigests, user, workingDir, entrypoint, cmd, env] =
    parseJsonLines(result.stdout, 7);
  if (typeof id !== "string" || !/^sha256:[0-9a-f]{64}$/.test(id)) {
    throw new DiagnosticError("image-inspect", "Built image ID was not captured");
  }
  return {
    id,
    repoDigests: Array.isArray(repoDigests) ? repoDigests : [],
    config: {
      User: user ?? null,
      WorkingDir: workingDir ?? null,
      Entrypoint: entrypoint ?? null,
      Cmd: cmd ?? null,
      Env: selectedEnvironment(env),
    },
  };
}

async function inspectContainerImage(containerName) {
  const result = await requireCommand("docker", [
    "inspect",
    containerName,
    "--format",
    "{{json .Image}}",
  ]);
  const imageId = JSON.parse(result.stdout.trim());
  if (typeof imageId !== "string" || !/^sha256:[0-9a-f]{64}$/.test(imageId)) {
    throw new DiagnosticError("image-inspect", "Launched image ID was not captured");
  }
  return imageId;
}

function parseKeyValueOutput(output) {
  const allowed = new Set([
    "uid",
    "gid",
    "HOME",
    "COREPACK_HOME",
    "XDG_CACHE_HOME",
    "PATH",
    "pwd",
    "pnpmCommand",
    "pnpmShimTarget",
    "corepackCommand",
    "corepackImplementationTarget",
    "optCorepackExists",
    "optCorepackStat",
    "preparedPnpm10126Present",
    "userCacheBefore",
    "pnpmVersion",
    "pnpmExitStatus",
    "userCacheAfter",
  ]);
  const values = {};
  for (const line of output.split("\n")) {
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator);
    if (allowed.has(key)) values[key] = line.slice(separator + 1);
  }
  return values;
}

function nullableValue(values, key) {
  const value = values[key];
  return value === undefined || value === "<unset>" ? null : value;
}

function nullableBoolean(values, key) {
  const value = values[key];
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function nullableInteger(values, key) {
  const value = Number(values[key]);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function hasUserCacheFallback(output) {
  return /\/home\/node\/\.cache\/node\/corepack(?:\/|$)/.test(output);
}

function hasNetworkAttempt(output) {
  return /network access is disabled|COREPACK_ENABLE_NETWORK|registry\.npmjs\.org|https?:\/\/|ENETUNREACH|EAI_AGAIN|ECONN/i.test(
    output,
  );
}

function createProbeCommand() {
  return [
    "set -u",
    'printf "uid=%s\\n" "$(id -u)"',
    'printf "gid=%s\\n" "$(id -g)"',
    'printf "HOME=%s\\n" "${HOME-<unset>}"',
    'printf "COREPACK_HOME=%s\\n" "${COREPACK_HOME-<unset>}"',
    'printf "XDG_CACHE_HOME=%s\\n" "${XDG_CACHE_HOME-<unset>}"',
    'printf "PATH=%s\\n" "${PATH-<unset>}"',
    'printf "pwd=%s\\n" "$PWD"',
    'printf "pnpmCommand=%s\\n" "$(command -v pnpm || true)"',
    'printf "pnpmShimTarget=%s\\n" "$(readlink -f "$(command -v pnpm 2>/dev/null || printf /nonexistent)")"',
    'printf "corepackCommand=%s\\n" "$(command -v corepack || true)"',
    'printf "corepackImplementationTarget=%s\\n" "$(readlink -f "$(command -v corepack 2>/dev/null || printf /nonexistent)")"',
    'if test -d /opt/corepack; then printf "optCorepackExists=true\\n"; printf "optCorepackStat=%s\\n" "$(stat -c "%u:%g:%a" /opt/corepack)"; else printf "optCorepackExists=false\\n"; printf "optCorepackStat=<missing>\\n"; fi',
    'if test -d /opt/corepack/v1/pnpm/10.26.1; then printf "preparedPnpm10126Present=true\\n"; else printf "preparedPnpm10126Present=false\\n"; fi',
    'if test -e /home/node/.cache/node/corepack; then printf "userCacheBefore=true\\n"; else printf "userCacheBefore=false\\n"; fi',
    'DEBUG=corepack COREPACK_ENABLE_NETWORK=0 pnpm --version >/tmp/ledgerly-pnpm-version.out 2>/tmp/ledgerly-pnpm-version.err',
    "pnpmStatus=$?",
    'cat /tmp/ledgerly-pnpm-version.err',
    'cat /tmp/ledgerly-pnpm-version.out',
    'printf "pnpmVersion=%s\\n" "$(tail -n 1 /tmp/ledgerly-pnpm-version.out)"',
    'printf "pnpmExitStatus=%s\\n" "$pnpmStatus"',
    'if test -e /home/node/.cache/node/corepack; then printf "userCacheAfter=true\\n"; else printf "userCacheAfter=false\\n"; fi',
    "rm -f /tmp/ledgerly-pnpm-version.out /tmp/ledgerly-pnpm-version.err",
    "exit \"$pnpmStatus\"",
  ].join("\n");
}

async function runProbe(name, imageName, envFilePath, hardened) {
  const containerName = `${testImagePrefix}-${state.source.runId}-${state.source.runAttempt}-${name}`;
  state.containerNames.push(containerName);
  const args = ["create", "--name", containerName, "--network", "none"];
  if (hardened) {
    args.push(
      "--read-only",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,nodev",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges:true",
      "--pids-limit",
      "256",
    );
  }
  args.push(
    "--env-file",
    envFilePath,
    "--env",
    "CI=true",
    imageName,
    "sh",
    "-c",
    createProbeCommand(),
  );
  await requireCommand("docker", args);
  const imageId = await inspectContainerImage(containerName);
  const started = await runCommand("docker", ["start", "-a", containerName], {
    allowFailure: true,
    timeoutMs: 120_000,
  });
  const output = `${started.stdout}\n${started.stderr}`;
  const values = parseKeyValueOutput(output);
  const runtime = {
    uid: nullableInteger(values, "uid"),
    gid: nullableInteger(values, "gid"),
    HOME: nullableValue(values, "HOME"),
    COREPACK_HOME: nullableValue(values, "COREPACK_HOME"),
    XDG_CACHE_HOME: nullableValue(values, "XDG_CACHE_HOME"),
    PATH: nullableValue(values, "PATH"),
    pwd: nullableValue(values, "pwd"),
    pnpmCommand: nullableValue(values, "pnpmCommand"),
    pnpmShimTarget: nullableValue(values, "pnpmShimTarget"),
    corepackCommand: nullableValue(values, "corepackCommand"),
    corepackImplementationTarget: nullableValue(
      values,
      "corepackImplementationTarget",
    ),
  };
  const combinedOutput = bounded(output);
  const exitStatus =
    Number.isInteger(Number(values.pnpmExitStatus))
      ? Number(values.pnpmExitStatus)
      : started.exitCode;
  const version = nullableValue(values, "pnpmVersion");
  const preparedCache = {
    optCorepackExists: nullableBoolean(values, "optCorepackExists"),
    optCorepackStat: nullableValue(values, "optCorepackStat"),
    preparedPnpm10126Present: nullableBoolean(
      values,
      "preparedPnpm10126Present",
    ),
  };
  const packageManager = {
    exitStatus,
    version,
    expectedVersionMatch: version === expectedPnpmVersion,
    userCacheBefore: nullableBoolean(values, "userCacheBefore"),
    userCacheAfter: nullableBoolean(values, "userCacheAfter"),
    fallbackAttempted: hasUserCacheFallback(combinedOutput),
    registryNetworkAttempted: hasNetworkAttempt(combinedOutput),
  };
  const probe = {
    name,
    imageId,
    runtime,
    packageManager,
    preparedCache,
    security: {
      networkMode: "none",
      readOnlyRoot: hardened,
      tmpfs: hardened ? "/tmp:rw,noexec,nosuid,nodev" : null,
      capDropAll: hardened,
      noNewPrivileges: hardened,
      pidsLimit: hardened ? 256 : 0,
      safeEnvFile: true,
      noDockerSocket: true,
    },
    containerRemoved: false,
  };
  state.probes.push(probe);
  state.security.networkDisabled = state.probes.every(
    (record) => record.security.networkMode === "none",
  );
  if (hardened) {
    state.security.hardeningReproduced =
      probe.security.readOnlyRoot &&
      probe.security.tmpfs === "/tmp:rw,noexec,nosuid,nodev" &&
      probe.security.capDropAll &&
      probe.security.noNewPrivileges &&
      probe.security.pidsLimit === 256;
  }
  if (imageId !== state.image.id) {
    state.classification = "launched-image-mismatch";
  }
}

function classify() {
  if (!state.image) return "incomplete-evidence";
  if (
    state.image.config.Env.COREPACK_HOME !== "/opt/corepack" ||
    state.image.config.User !== "node"
  ) {
    return "image-config-mismatch";
  }
  if (state.probes.some((probe) => probe.imageId !== state.image.id)) {
    return "launched-image-mismatch";
  }
  if (
    state.probes.some(
      (probe) => probe.runtime.COREPACK_HOME !== "/opt/corepack",
    )
  ) {
    return "runtime-env-mutation";
  }
  if (state.probes.some((probe) => probe.packageManager.fallbackAttempted)) {
    return "corepack-boundary-discrepancy";
  }
  const normal = state.probes.find((probe) => probe.name === "normal");
  const hardened = state.probes.find(
    (probe) => probe.name === "hardened-env-file",
  );
  if (!normal || !hardened) return "incomplete-evidence";
  if (
    normal.packageManager.expectedVersionMatch &&
    !hardened.packageManager.expectedVersionMatch
  ) {
    return "hardening-interaction";
  }
  if (
    hardened.runtime.COREPACK_HOME !== normal.runtime.COREPACK_HOME ||
    !hardened.packageManager.expectedVersionMatch
  ) {
    return "env-file-interaction";
  }
  if (
    normal.packageManager.expectedVersionMatch &&
    hardened.packageManager.expectedVersionMatch &&
    !normal.packageManager.registryNetworkAttempted &&
    !hardened.packageManager.registryNetworkAttempted
  ) {
    return "matching-runtime";
  }
  return "incomplete-evidence";
}

async function createSourceManifest() {
  const manifestPath = path.join(root, sourceManifestPath);
  if (existsSync(manifestPath)) {
    throw new DiagnosticError(
      "manifest",
      "Source manifest already exists before diagnostic setup",
    );
  }
  const tracked = await requireCommand("git", [
    "ls-files",
    "-z",
    "--",
    ...executionTreePathspecs,
  ]);
  const files = tracked.stdout.split("\0").filter(Boolean).sort();
  if (!files.includes(dockerfilePath) || !files.includes("package.json")) {
    throw new DiagnosticError("manifest", "Protected execution tree is incomplete");
  }
  const hash = createHash("sha256");
  for (const relativePath of files) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await readFile(path.join(root, relativePath)));
    hash.update("\0");
  }
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    `${JSON.stringify({
      version: 1,
      files,
      sourceTreeSha256: hash.digest("hex"),
    })}\n`,
    { mode: 0o644 },
  );
  state.manifestCreated = true;
}

async function createSafeEnvFile() {
  const tempDirectory = process.env.RUNNER_TEMP ?? "/tmp";
  await mkdir(tempDirectory, { recursive: true });
  state.envFilePath = path.join(
    tempDirectory,
    `ledgerly-corepack-diagnostic-${state.source.runId}-${state.source.runAttempt}.env`,
  );
  await writeFile(
    state.envFilePath,
    "LEDGERLY_COREPACK_DIAGNOSTIC_MODE=placeholder\nSAFE_DIAGNOSTIC=1\n",
    { mode: 0o600 },
  );
  await chmod(state.envFilePath, 0o600);
}

async function removeContainer(containerName) {
  try {
    await requireCommand("docker", ["rm", "--force", containerName]);
  } catch {}
  try {
    await requireCommand("docker", ["inspect", containerName]);
    return false;
  } catch {
    return true;
  }
}

async function cleanup() {
  let containersRemoved = true;
  const containerRemoval = new Map();
  for (const containerName of state.containerNames) {
    const removed = await removeContainer(containerName);
    containerRemoval.set(containerName, removed);
    if (!removed) containersRemoved = false;
  }
  state.cleanup.containersRemoved = containersRemoved;
  state.cleanup.networkRemoved = true;
  if (state.envFilePath) {
    await rm(state.envFilePath, { force: true }).catch(() => {});
    state.cleanup.envFileRemoved = !existsSync(state.envFilePath);
  }
  if (state.manifestCreated) {
    await rm(path.join(root, sourceManifestPath), { force: true }).catch(() => {});
    state.cleanup.temporaryMaterialRemoved = !existsSync(
      path.join(root, sourceManifestPath),
    );
  }
  if (state.imageName) {
    try {
      await requireCommand("docker", ["image", "rm", "--force", state.imageName]);
    } catch {}
    try {
      await requireCommand("docker", ["image", "inspect", state.imageName]);
      state.cleanup.imageRemoved = false;
    } catch {
      state.cleanup.imageRemoved = true;
    }
  }
  state.probes = state.probes.map((probe) => ({
    ...probe,
    containerRemoved:
      containerRemoval.get(
        `${testImagePrefix}-${state.source.runId}-${state.source.runAttempt}-${probe.name}`,
      ) ?? false,
  }));
}

function buildEvidence(failure, classification) {
  const diagnosticStatus =
    !failure && classification === "matching-runtime"
      ? "diagnostic-succeeded"
      : "diagnostic-failed";
  const artifactBase = `ledgerly-44-ti-03-corepack-github-ci-diagnostic-${state.source.runId}-${state.source.runAttempt}`;
  return {
    diagnosticType: "corepack-ci-diagnostic",
    qualificationBoundary: "not-ti03-qualification",
    diagnosticStatus,
    classification,
    source: state.source,
    builtImage: state.image,
    probes: state.probes,
    cleanup: state.cleanup,
    security: state.security,
    artifact: {
      jsonFileName: `${artifactBase}.json`,
      checksumFileName: `${artifactBase}.json.sha256`,
      sizeLimitBytes: artifactSizeLimitBytes,
    },
    failure: failure
      ? {
          phase: failure.phase ?? "preflight",
          message: safeFailureMessage(failure),
        }
      : null,
  };
}

function containsSecretPattern(text) {
  return /DATABASE_URL|POSTGRES_PASSWORD|LEDGERLY_.*PASSWORD|GITHUB_TOKEN|OPENAI_API_KEY|CLERK_SECRET|SESSION_SECRET|BEGIN [^-]+ PRIVATE KEY|ghp_[A-Za-z0-9]|github_pat_[A-Za-z0-9_]|sk-[A-Za-z0-9]/i.test(
    text,
  );
}

async function writeEvidence(evidence) {
  const tempDirectory = process.env.RUNNER_TEMP ?? "/tmp";
  await mkdir(tempDirectory, { recursive: true });
  const artifactBase = `ledgerly-44-ti-03-corepack-github-ci-diagnostic-${state.source.runId}-${state.source.runAttempt}`;
  const jsonPath = path.join(tempDirectory, `${artifactBase}.json`);
  const checksumPath = `${jsonPath}.sha256`;
  evidence.security.secretScanPassed = true;
  evidence.security.artifactSizeBoundPassed = true;
  const serialized = `${JSON.stringify(evidence)}\n`;
  const bytes = Buffer.byteLength(serialized);
  if (bytes > artifactSizeLimitBytes) {
    throw new DiagnosticError("artifact", "Diagnostic evidence exceeded the 64 KiB bound");
  }
  if (containsSecretPattern(serialized)) {
    throw new DiagnosticError("artifact", "Diagnostic evidence failed secret scanning");
  }
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const schema = JSON.parse(
    await readFile(path.join(root, evidenceSchemaPath), "utf8"),
  );
  const validate = ajv.compile(schema);
  if (!validate(evidence)) {
    throw new DiagnosticError("artifact", "Diagnostic evidence failed schema validation");
  }
  await writeFile(jsonPath, serialized, { mode: 0o600 });
  const digest = createHash("sha256").update(serialized).digest("hex");
  await writeFile(checksumPath, `${digest}  ${path.basename(jsonPath)}\n`, {
    mode: 0o600,
  });
  console.log(
    "LEDGERLY_COREPACK_DIAGNOSTIC_EVIDENCE",
    JSON.stringify({
      path: path.basename(jsonPath),
      sha256: digest,
      bytes,
    }),
  );
}

async function execute() {
  let failure = null;
  let classification = "incomplete-evidence";
  try {
    if (
      process.env.GITHUB_ACTIONS !== "true" ||
      process.env.GITHUB_REF !== expectedSourceRef ||
      process.env.GITHUB_REF_PROTECTED !== "true" ||
      process.env.GITHUB_WORKFLOW !== expectedWorkflow ||
      process.env.GITHUB_JOB !== expectedJob
    ) {
      throw new DiagnosticError(
        "preflight",
        "Diagnostic requires the exact protected-main workflow identity",
      );
    }
    const head = await requireCommand("git", ["rev-parse", "HEAD"]);
    if (head.stdout.trim() !== state.source.sourceSha) {
      throw new DiagnosticError("preflight", "Checked-out source does not match GITHUB_SHA");
    }
    await createSourceManifest();
    await createSafeEnvFile();
    state.imageName = `${testImagePrefix}:${state.source.runId}-${state.source.runAttempt}`;
    await requireCommand("docker", [
      "build",
      "--pull",
      "--platform",
      "linux/amd64",
      "--file",
      dockerfilePath,
      "--tag",
      state.imageName,
      ".",
    ], { timeoutMs: 7 * 60 * 1000, phase: "build" });
    state.image = await inspectImage(state.imageName);
    await runProbe("normal", state.imageName, state.envFilePath, false);
    await runProbe(
      "hardened-env-file",
      state.imageName,
      state.envFilePath,
      true,
    );
    classification = classify();
  } catch (error) {
    failure = error;
    if (error instanceof DiagnosticError && error.phase) {
      failure.phase = error.phase;
    }
    classification = "incomplete-evidence";
  } finally {
    try {
      await cleanup();
    } catch {
      state.cleanup.containersRemoved = false;
      state.cleanup.temporaryMaterialRemoved = false;
    }
    if (!Object.values(state.cleanup).every((value) => value === true)) {
      failure = new DiagnosticError(
        "cleanup",
        "Required diagnostic cleanup verification failed",
      );
      classification = "incomplete-evidence";
    }
    const evidence = buildEvidence(failure, classification);
    try {
      await writeEvidence(evidence);
    } catch (error) {
      console.error(`Corepack diagnostic evidence failed: ${safeFailureMessage(error)}`);
      process.exitCode = 1;
      return;
    }
  }
  if (failure || classification !== "matching-runtime") process.exitCode = 1;
}

await execute();