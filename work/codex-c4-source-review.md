## scripts/ci/run-ledgerly-canonical-postgresql.mjs
```text
6: import Ajv2020 from "ajv/dist/2020.js";
7: 
8: const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
9: const workflowRoot = path.resolve(process.env.LEDGERLY_WORKFLOW_ROOT ?? root);
10: const implementationRoot = root;
11: const candidateRef = "refs/heads/tr01/implementation-identity-successor-c3";
12: const mainRef = "refs/heads/main";
13: const fullShaPattern = /^[0-9a-f]{40}$/;
14: const postgresImage =
15:   "postgres:16.15-bookworm@sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825";
16: const postgresTag = "postgres:16.15-bookworm";
232:   ) {
233:     throw new Error("TI-03 requires the exact approved workflow identity");
234:   }
235:   assertFullSha(environment.GITHUB_SHA, "GITHUB_SHA");
236:   assertFullSha(
237:     environment.LEDGERLY_APPROVED_CANDIDATE_SHA,
238:     "LEDGERLY_APPROVED_CANDIDATE_SHA",
239:   );
240:   const implementationSha =
241:     environment.LEDGERLY_IMPLEMENTATION_SOURCE_SHA ??
242:     environment.LEDGERLY_APPROVED_CANDIDATE_SHA;
243:   assertFullSha(implementationSha, "LEDGERLY_IMPLEMENTATION_SOURCE_SHA");
244:   if (mode === "candidate" && implementationSha !== environment.GITHUB_SHA) {
245:     throw new Error("Candidate mode requires workflow and implementation SHA equality");
246:   }
247:   if (mode === "candidate" &&
248:       environment.LEDGERLY_APPROVED_CANDIDATE_SHA !== environment.GITHUB_SHA) {
249:     throw new Error("Candidate mode requires the exact approved candidate SHA");
250:   }
251:   if (mode === "activated" && implementationSha !== environment.LEDGERLY_APPROVED_CANDIDATE_SHA) {
252:     throw new Error("Activated mode requires the protected candidate SHA");
253:   }
254:   if (environment.DATABASE_URL) {
255:     throw new Error("DATABASE_URL must be absent from the external CI parent environment");
256:   }
```
## artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs
```text
436:       "LEDGERLY_CANONICAL_TEST_IMPLEMENTATION_CHECKOUT_CLEAN",
437:     ),
438:   };
439:   if (
440:     !["candidate", "activated"].includes(ci.identityMode) ||
441:     !["refs/heads/tr01/implementation-identity-successor-c3", "refs/heads/main"].includes(
442:       ci.ciSourceRef,
443:     ) ||
444:     !/^[0-9a-f]{40}$/.test(ci.workflowSourceCommit) ||
445:     !/^[0-9a-f]{40}$/.test(ci.implementationSourceCommit) ||
446:     (ci.identityMode === "candidate" &&
447:       (ci.ciSourceRef !== "refs/heads/tr01/implementation-identity-successor-c3" ||
448:         ci.workflowSourceCommit !== ci.implementationSourceCommit)) ||
449:     (ci.identityMode === "activated" && ci.ciSourceRef !== "refs/heads/main")
450:   ) {
451:     throw new Error("The external-CI identity binding is not exact");
452:   }
```
## scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql
```text
79:     AND workflow_checkout_clean
80:     AND implementation_checkout_clean
81:     AND (
82:       (
83:         identity_mode = 'candidate'
84:         AND ci_source_ref = 'refs/heads/tr01/implementation-identity-successor-c3'
85:         AND ci_workflow_ref ~ '/\.github/workflows/ledgerly-canonical-postgresql\.yml@refs/heads/tr01/implementation-identity-successor-c3$'
86:         AND workflow_source_commit = implementation_source_commit
87:       )
88:       OR (
89:         identity_mode = 'activated'
90:         AND ci_source_ref = 'refs/heads/main'
```
## docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json
```text
48:         "workflowSourceCommit": { "type": "string", "pattern": "^[0-9a-f]{40}$" },
49:         "implementationSourceCommit": { "type": "string", "pattern": "^[0-9a-f]{40}$" },
50:         "identityMode": { "enum": ["candidate", "activated"] },
51:         "sourceRef": {
52:           "enum": [
53:             "refs/heads/tr01/implementation-identity-successor-c3",
54:             "refs/heads/main"
55:           ]
56:         },
57:         "refProtected": { "const": true },
58:         "ancestryVerified": { "const": true },
101:         "creatorIdentity": { "const": "postgres" },
102:         "runtimeIdentity": { "const": "ledgerly_api" },
103:         "identityMode": { "enum": ["candidate", "activated"] },
104:         "ciSourceRef": {
105:           "enum": [
106:             "refs/heads/tr01/implementation-identity-successor-c3",
107:             "refs/heads/main"
108:           ]
109:         },
110:         "ciRefProtected": { "const": true },
111:         "workflowSourceCommit": { "type": "string", "pattern": "^[0-9a-f]{40}$" },
254:       "then": {
255:         "properties": {
256:           "ci": {
257:             "type": "object",
258:             "properties": {
259:               "sourceRef": { "const": "refs/heads/tr01/implementation-identity-successor-c3" },
260:               "workflowRef": {
261:                 "type": "string",
262:                 "pattern": "/\\.github/workflows/ledgerly-canonical-postgresql\\.yml@refs/heads/tr01/implementation-identity-successor-c3$"
263:               }
264:             }
265:           }
266:         }
267:       }
```
## scripts/ci/run-ledgerly-canonical-postgresql.test.mjs
```text
6: import path from "node:path";
7: import { fileURLToPath, pathToFileURL } from "node:url";
8: import Ajv2020 from "ajv/dist/2020.js";
9: 
10: const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
11: const candidateRef = "refs/heads/tr01/implementation-identity-successor-c3";
12: const mainRef = "refs/heads/main";
13: const sha = "a".repeat(40);
14: 
15: const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
16: const {
226:     GITHUB_WORKFLOW_REF: `example/repository/.github/workflows/ledgerly-canonical-postgresql.yml@${sourceRef}`,
227:     GITHUB_JOB: "canonical-postgresql",
228:     GITHUB_RUN_ID: "1",
229:     GITHUB_RUN_ATTEMPT: "1",
230:     LEDGERLY_IDENTITY_MODE: mode,
231:     LEDGERLY_APPROVED_CANDIDATE_SHA: fixtureC2,
232:     LEDGERLY_IMPLEMENTATION_SOURCE_SHA: fixtureC2,
233:   };
234: }
235: 
236: function fixtureCi(environment) {
263: const candidateTrusted = await candidateModule.buildTrustedEvidenceContext(
264:   fixtureCi(candidateEnvironment), candidateManifest,
265: );
266: for (const [label, overrides, rejection] of [
267:   ["old C2 ref", {
268:     GITHUB_REF: "refs/heads/tr01/implementation-identity-successor-c2",
269:   }, /identity mode requires/],
270:   ["old C2 workflow alias", {
271:     GITHUB_WORKFLOW_REF: "example/repository/.github/workflows/ledgerly-canonical-postgresql.yml@refs/heads/tr01/implementation-identity-successor-c2",
272:   }, /exact approved workflow identity/],
273:   ["stale C2 candidate pin", {
274:     LEDGERLY_APPROVED_CANDIDATE_SHA: "3ab9edc28b4922ad82e68afb7b049d69514f91e1",
275:   }, /exact approved candidate SHA/],
276: ]) {
277:   process.env = { PATH: savedEnvironment.PATH, HOME: savedEnvironment.HOME,
278:     ...candidateEnvironment, ...overrides };
279:   await assert.rejects(
464: rejectMutation("v1", (value) => { value.schemaVersion = 1; });
465: rejectMutation("wrong candidate ref", (value) => {
466:   value.ci.sourceRef = "refs/heads/tr01/implementation-identity-candidate";
467: });
468: rejectMutation("old C2 candidate evidence", (value) => {
469:   value.ci.sourceRef = "refs/heads/tr01/implementation-identity-successor-c2";
470:   value.ci.workflowRef = "example/repository/.github/workflows/ledgerly-canonical-postgresql.yml@" +
471:     value.ci.sourceRef;
472:   value.binding.ciSourceRef = value.ci.sourceRef;
473: });
474: rejectMutation("wrong workflow ref", (value) => {
594:   "LEDGERLY_CANONICAL_TEST_IMPLEMENTATION_CHECKOUT_CLEAN",
595: ]) {
596:   assert.match(disposableRunner, new RegExp(environmentName));
597: }
598: assert.match(disposableRunner, /must equal the literal string true/);
599: assert.match(disposableRunner, /refs\/heads\/tr01\/implementation-identity-successor-c3/);
600: assert.doesNotMatch(disposableRunner, /refs\/heads\/tr01\/implementation-identity-successor-c2/);
601: assert.match(disposableRunner, /Object\.hasOwn\(process\.env, "LEDGERLY_CANONICAL_TEST_SOURCE_COMMIT"\)/);
602: assert.doesNotMatch(disposableRunner, /sourceCommit:\s*ci\.sourceCommit/);
603: const externalDigests = disposableRunner.slice(
604:   disposableRunner.indexOf("function externalSourceDigests"),
605:   disposableRunner.indexOf("function assertSafeConnectionUrl"),
644:   assert.match(sql, new RegExp(`\\b${column}\\b`));
645: }
646: assert.doesNotMatch(sql, /\bsource_commit\b/);
647: assert.match(sql, /identity_mode = 'candidate'/);
648: assert.match(sql, /identity_mode = 'activated'/);
649: assert.match(sql, /refs\/heads\/tr01\/implementation-identity-successor-c3/);
650: assert.doesNotMatch(sql, /refs\/heads\/tr01\/implementation-identity-successor-c2/);
651: assert.match(sql, /refs\/heads\/main/);
652: 
653: const workflow = await read(".github/workflows/ledgerly-canonical-postgresql.yml");
654: assert.match(workflow, /fetch-depth: 0/);
655: assert.match(workflow, /path: candidate/);
656: assert.match(workflow, /LEDGERLY_APPROVED_CANDIDATE_SHA/);
657: assert.match(workflow, /LEDGERLY_IDENTITY_MODE/);
658: assert.match(workflow, /refs\/heads\/tr01\/implementation-identity-successor-c3/);
659: assert.doesNotMatch(workflow, /refs\/heads\/tr01\/implementation-identity-successor-c2/);
660: assert.match(workflow, /candidate\/scripts\/ci\/run-ledgerly-canonical-postgresql\.mjs/);
661: assert.match(workflow, /\*\*\/docs\/governance\/evidence\/ledgerly-44-ti-03-\*\.json/);
662: 
663: await rm(fixtureDirectory, { recursive: true, force: true });
664: console.log("TR-01 identity and acceptance tests passed");
```
## .github/workflows/ledgerly-canonical-postgresql.yml
```text
14:   canonical-postgresql:
15:     if: >-
16:       github.event_name == 'workflow_dispatch' &&
17:       github.ref_protected == true &&
18:       (github.ref == 'refs/heads/main' ||
19:       github.ref == 'refs/heads/tr01/implementation-identity-successor-c3')
20:     name: Disposable canonical PostgreSQL qualification
21:     runs-on: ubuntu-24.04
22:     timeout-minutes: 20
23:     environment:
24:       name: ledgerly-canonical
33:       - name: Checkout approved implementation source
34:         if: github.ref == 'refs/heads/main'
35:         uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
36:         with:
37:           persist-credentials: false
38:           ref: ${{ vars.LEDGERLY_APPROVED_CANDIDATE_SHA }}
39:           fetch-depth: 1
40:           path: candidate
41: 
42:       - name: Install pinned evidence validator
43:         run: |
48:       - name: Run TI-03 qualification
49:         env:
50:           CI: true
51:           DOCKER_BUILDKIT: "1"
52:           LEDGERLY_IDENTITY_MODE: ${{ github.ref == 'refs/heads/main' && 'activated' || 'candidate' }}
53:           LEDGERLY_APPROVED_CANDIDATE_SHA: ${{ vars.LEDGERLY_APPROVED_CANDIDATE_SHA }}
54:           LEDGERLY_IMPLEMENTATION_SOURCE_SHA: ${{ github.ref == 'refs/heads/main' && vars.LEDGERLY_APPROVED_CANDIDATE_SHA || github.sha }}
55:           LEDGERLY_WORKFLOW_ROOT: ${{ github.workspace }}
56:         run: >-
57:           ${{ github.ref == 'refs/heads/main'
58:           && 'node candidate/scripts/ci/run-ledgerly-canonical-postgresql.mjs'
59:           || 'node scripts/ci/run-ledgerly-canonical-postgresql.mjs' }}
```
## scripts/ci/ledgerly-tr01-c3-identity-status.mjs
```text
// C3 identity validation only; this is not PostgreSQL or accounting qualification.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const identity = Object.freeze({
  repository: "Future00111/ledgerpoint",
  workflowRef: "Future00111/ledgerpoint/.github/workflows/ledgerly-tr01-c3-identity-status.yml@refs/heads/main",
  ref: "refs/heads/tr01/implementation-identity-successor-c3",
  sha: "1c26be19295902a38e1939b56ff99ae9a195d3de",
  parent: "e7f43c70e45c068971aeb241ce1b01a30bb01e37",
  tree: "beb56d35539d81636b609602b3c57d167bc88888",
  context: "tr01/c3-identity-validation",
});

export function assertTrustedInvocation(env) {
  if (
    env.GITHUB_REPOSITORY !== identity.repository ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_REF_PROTECTED !== "true" ||
    env.GITHUB_WORKFLOW_REF !== identity.workflowRef ||
    env.GITHUB_JOB !== "identity" ||
    env.GITHUB_RUN_ATTEMPT !== "1" ||
    env.TR01_VALIDATION_RESULT !== "success" ||
    !/^[a-f0-9]{40}$/.test(env.TR01_C3_APPROVED_WORKFLOW_SHA ?? "") ||
    env.GITHUB_WORKFLOW_SHA !== env.TR01_C3_APPROVED_WORKFLOW_SHA ||
    env.GITHUB_SHA !== env.TR01_C3_APPROVED_WORKFLOW_SHA
  ) {
    throw new Error("Identity validation requires the approved C3 workflow SHA, successful dependency, and protected-main dispatch");
  }
}

export async function validateAndPublishIdentity(env, request) {
  assertTrustedInvocation(env);
  const branchPath = `/repos/${identity.repository}/git/ref/heads/${identity.ref.slice("refs/heads/".length)}`;
  const commitPath = `/repos/${identity.repository}/git/commits/${identity.sha}`;
  const branch = await request("GET", branchPath);
  if (
    branch?.ref !== identity.ref ||
    branch?.object?.type !== "commit" ||
    branch?.object?.sha !== identity.sha
  ) {
    throw new Error("Protected successor ref does not point to the pinned C3 identity");
  }
  const commit = await request("GET", commitPath);
  if (
    commit?.sha !== identity.sha ||
    commit?.tree?.sha !== identity.tree ||
    commit?.parents?.length !== 1 ||
    commit.parents[0]?.sha !== identity.parent
  ) {
    throw new Error("C3 commit parent or tree differs from the pinned review-package identity");
  }
  // Check the ref again so a changed tip cannot receive success based only on
  // the first read. Ruleset update restrictions remain essential.
  const confirmed = await request("GET", branchPath);
  if (
    confirmed?.ref !== identity.ref ||
    confirmed?.object?.type !== "commit" ||
    confirmed?.object?.sha !== identity.sha
  ) {
    throw new Error("Successor ref changed during identity validation");
  }
  const posted = await request("POST", `/repos/${identity.repository}/statuses/${identity.sha}`, {
    state: "success",
    context: identity.context,
    description: "C3 identity and non-DB checks; pinned review-package identity; NOT TI-03 qualification",
  });
  if (
    posted?.state !== "success" ||
    posted?.context !== identity.context
  ) {
    throw new Error("GitHub did not confirm the C3 validation status response");
  }
}

async function githubRequest(method, path, body) {
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GitHub Actions token unavailable");
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok || (method === "POST" && response.status !== 201)) {
    throw new Error(`GitHub ${method} ${path} failed (HTTP ${response.status})`);
  }
  return response.json();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  validateAndPublishIdentity(process.env, githubRequest).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
```
## .github/workflows/ledgerly-tr01-c3-identity-status.yml
```text
name: TR-01 C3 identity validation

on:
  workflow_dispatch:

permissions: {}

jobs:
  validate:
    if: >-
      github.repository == 'Future00111/ledgerpoint' &&
      github.ref == 'refs/heads/main' &&
      github.ref_protected == true
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    permissions:
      contents: read
    steps:
      - name: Checkout exact immutable C3 without persisted credentials
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          ref: 1c26be19295902a38e1939b56ff99ae9a195d3de
          persist-credentials: false
          fetch-depth: 0
      - name: Checkout same-event protected-main producer tests
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          ref: ${{ github.sha }}
          path: .local/tr01-c3-producer
          persist-credentials: false
          fetch-depth: 1
      - name: Validate C3 and run upstream non-database checks
        env:
          DOCKER_BUILDKIT: "1"
          COREPACK_ENABLE_AUTO_PIN: "0"
          COREPACK_DEFAULT_TO_LATEST: "0"
        run: |
          test "$(git rev-parse HEAD)" = "1c26be19295902a38e1939b56ff99ae9a195d3de"
          test "$(git rev-parse HEAD^{tree})" = "beb56d35539d81636b609602b3c57d167bc88888"
          test "$(git rev-parse HEAD^)" = "e7f43c70e45c068971aeb241ce1b01a30bb01e37"
          test "$(git rev-list --parents -n 1 HEAD | wc -w)" -eq 2
          git diff --quiet
          git diff --cached --quiet
          source_pathspecs=(
            ".dockerignore"
            ".ci/ledgerly-canonical/Dockerfile.test"
            ".github"
            "artifacts"
            "lib"
            "scripts"
            "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json"
            "package.json"
            "pnpm-lock.yaml"
            "pnpm-workspace.yaml"
            "tsconfig.base.json"
            "tsconfig.json"
          )
          test -z "$(git status --porcelain --untracked-files=all -- "${source_pathspecs[@]}")"
          corepack enable
          corepack prepare pnpm@10.26.1 --activate
          pnpm install --frozen-lockfile --ignore-scripts
          LEDGERLY_C3_VALIDATION_ROOT="$GITHUB_WORKSPACE" node --test .local/tr01-c3-producer/scripts/ci/ledgerly-tr01-c3-identity-status.test.mjs
          node --check scripts/ci/run-ledgerly-canonical-postgresql.mjs
          node --check artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs
          pnpm run typecheck:libs
          pnpm run typecheck
          node --test scripts/ci/run-ledgerly-canonical-postgresql.test.mjs
          git diff --quiet
          git diff --cached --quiet
          test -z "$(git status --porcelain --untracked-files=all -- "${source_pathspecs[@]}")"
          node --input-type=module <<'NODE'
          import { createHash } from "node:crypto";
          import { readFile, writeFile } from "node:fs/promises";
          import { execFileSync } from "node:child_process";

          const expectedCommit = "1c26be19295902a38e1939b56ff99ae9a195d3de";
          const qualificationWorkflow = ".github/workflows/ledgerly-canonical-postgresql.yml";
          const pathspecs = [
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
          const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
          if (head !== expectedCommit) throw new Error("Offline smoke fixture requires the exact C3 checkout");
          const files = execFileSync("git", ["ls-files", "-z", "--", ...pathspecs], { encoding: "utf8" })
            .split("\0").filter(Boolean).sort();
          for (const required of [
            ".dockerignore",
            ".ci/ledgerly-canonical/Dockerfile.test",
            qualificationWorkflow,
            "package.json",
            "pnpm-lock.yaml",
            "pnpm-workspace.yaml",
          ]) {
            if (!files.includes(required)) throw new Error(`Tracked C3 source is missing ${required}`);
          }
          const hashes = {};
          const treeHash = createHash("sha256");
          for (const file of files) {
            const bytes = await readFile(file);
            hashes[file] = createHash("sha256").update(bytes).digest("hex");
            treeHash.update(file);
            treeHash.update("\0");
            treeHash.update(bytes);
            treeHash.update("\0");
          }
          const fixture = {
            fixturePurpose: "offline-build-only",
            notQualificationEvidence: true,
            sourceCommit: head,
            version: 1,
            files,
            fileSha256: hashes,
            sourceTreeSha256: treeHash.digest("hex"),
            qualificationWorkflow,
            qualificationWorkflowSha256: hashes[qualificationWorkflow],
          };
          await writeFile(
            ".ci/ledgerly-canonical/source-manifest.json",
            `${JSON.stringify(fixture)}\n`,
            { mode: 0o644 },
          );
          NODE
          image="ledgerly-tr01-c3-offline-pnpm-smoke:local"
          docker build \
            --file .ci/ledgerly-canonical/Dockerfile.test \
            --tag "$image" \
            .
          LEDGERLY_OFFLINE_PNPM_TEST_IMAGE="$image" \
            node --test scripts/ci/ledgerly-offline-pnpm.test.mjs

  identity:
    needs: validate
    if: >-
      github.repository == 'Future00111/ledgerpoint' &&
      github.ref == 'refs/heads/main' &&
      github.ref_protected == true &&
      needs.validate.result == 'success'
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    environment:
      name: ledgerly-canonical
    permissions:
      contents: read
      statuses: write
    steps:
      - name: Checkout protected-main validation code
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          ref: ${{ github.sha }}
          persist-credentials: false
      - name: Verify exact remote C3 and publish validation status
        env:
          GH_TOKEN: ${{ github.token }}
          TR01_VALIDATION_RESULT: ${{ needs.validate.result }}
          TR01_C3_APPROVED_WORKFLOW_SHA: ${{ vars.TR01_C3_APPROVED_WORKFLOW_SHA }}
        run: node scripts/ci/ledgerly-tr01-c3-identity-status.mjs
```
## scripts/ci/ledgerly-tr01-c3-identity-status.test.mjs
```text
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertTrustedInvocation,
  identity,
  validateAndPublishIdentity,
} from "./ledgerly-tr01-c3-identity-status.mjs";

const workflowPath = fileURLToPath(
  new URL("../../.github/workflows/ledgerly-tr01-c3-identity-status.yml", import.meta.url),
);
const workflowSource = await readFile(workflowPath, "utf8");
const validationRoot = process.env.LEDGERLY_C3_VALIDATION_ROOT;

const env = {
  GITHUB_REPOSITORY: identity.repository,
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/main",
  GITHUB_REF_PROTECTED: "true",
  GITHUB_WORKFLOW_REF: identity.workflowRef,
  GITHUB_JOB: "identity",
  GITHUB_RUN_ATTEMPT: "1",
  GITHUB_WORKFLOW_SHA: "a".repeat(40),
  GITHUB_SHA: "a".repeat(40),
  TR01_C3_APPROVED_WORKFLOW_SHA: "a".repeat(40),
  TR01_VALIDATION_RESULT: "success",
};
const ref = {
  ref: identity.ref,
  object: { sha: identity.sha, type: "commit" },
};
const commit = {
  sha: identity.sha,
  tree: { sha: identity.tree },
  parents: [{ sha: identity.parent }],
};

function stub(first = ref, object = commit, second = first, status = {
  context: identity.context,
  state: "success",
}) {
  const calls = [];
  // Create-a-commit-status does not echo the target SHA.
  const values = [first, object, second, status];
  return {
    calls,
    request: async (...args) => {
      calls.push(args);
      return values[calls.length - 1];
    },
  };
}

test("the status producer is pinned to the exact C3 review-package identity", () => {
  assert.deepEqual(identity, {
    repository: "Future00111/ledgerpoint",
    workflowRef: "Future00111/ledgerpoint/.github/workflows/ledgerly-tr01-c3-identity-status.yml@refs/heads/main",
    ref: "refs/heads/tr01/implementation-identity-successor-c3",
    sha: "1c26be19295902a38e1939b56ff99ae9a195d3de",
    parent: "e7f43c70e45c068971aeb241ce1b01a30bb01e37",
    tree: "beb56d35539d81636b609602b3c57d167bc88888",
    context: "tr01/c3-identity-validation",
  });
});

test("only the approved protected-main manual invocation is trusted", () => {
  for (const [key, value] of [
    ["GITHUB_REPOSITORY", "attacker/fork"],
    ["GITHUB_EVENT_NAME", "pull_request"],
    ["GITHUB_REF", identity.ref],
    ["GITHUB_REF_PROTECTED", "false"],
    ["GITHUB_WORKFLOW_REF", "Future00111/ledgerpoint/.github/workflows/ledgerly-tr01-c2-identity-status.yml@refs/heads/main"],
    ["GITHUB_WORKFLOW_REF", "Future00111/ledgerpoint/.github/workflows/other.yml@refs/heads/main"],
    ["GITHUB_JOB", "validate"],
    ["GITHUB_RUN_ATTEMPT", "2"],
    ["TR01_VALIDATION_RESULT", "skipped"],
    ["TR01_VALIDATION_RESULT", "failure"],
    ["TR01_C3_APPROVED_WORKFLOW_SHA", ""],
    ["TR01_C3_APPROVED_WORKFLOW_SHA", "not-a-sha"],
    ["TR01_C3_APPROVED_WORKFLOW_SHA", "b".repeat(40)],
    ["GITHUB_WORKFLOW_SHA", "b".repeat(40)],
    ["GITHUB_SHA", "b".repeat(40)],
  ]) {
    assert.throws(() => assertTrustedInvocation({ ...env, [key]: value }));
  }
  assert.throws(
    () => assertTrustedInvocation({ ...env, TR01_C2_APPROVED_WORKFLOW_SHA: "a".repeat(40), TR01_C3_APPROVED_WORKFLOW_SHA: undefined }),
  );
});

test("valid pinned C3 identity posts only the named success on the exact SHA", async () => {
  const { calls, request } = stub();
  await validateAndPublishIdentity(env, request);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.slice(0, 3).map(([method]) => method), ["GET", "GET", "GET"]);
  assert.deepEqual(calls[3], [
    "POST",
    `/repos/${identity.repository}/statuses/${identity.sha}`,
    {
      state: "success",
      context: "tr01/c3-identity-validation",
      description: "C3 identity and non-DB checks; pinned review-package identity; NOT TI-03 qualification",
    },
  ]);
});

for (const [name, first, object, second] of [
  ["missing branch", null, commit, ref],
  ["C2 successor ref", { ...ref, ref: "refs/heads/tr01/implementation-identity-successor-c2" }, commit, ref],
  ["wrong branch tip including C2 SHA", { ...ref, object: { sha: "3ab9edc28b4922ad82e68afb7b049d69514f91e1", type: "commit" } }, commit, ref],
  ["noncommit tip", { ...ref, object: { sha: identity.sha, type: "tag" } }, commit, ref],
  ["wrong commit SHA including C2 SHA", ref, { ...commit, sha: "3ab9edc28b4922ad82e68afb7b049d69514f91e1" }, ref],
  ["wrong parent including C2 parent", ref, { ...commit, parents: [{ sha: "d292f3a64c6253e022b40de8cf055f3e722ff1ea" }] }, ref],
  ["extra parent", ref, { ...commit, parents: [commit.parents[0], commit.parents[0]] }, ref],
  ["wrong tree including C2 tree", ref, { ...commit, tree: { sha: "365303e152430560b828c88165dd8f4d03f2a4fc" } }, ref],
  ["ref changes during validation", ref, commit, { ...ref, object: { sha: "3ab9edc28b4922ad82e68afb7b049d69514f91e1", type: "commit" } }],
  ["ref changes type during validation", ref, commit, { ...ref, object: { sha: identity.sha, type: "tag" } }],
]) {
  test(`${name} cannot publish success`, async () => {
    const { calls, request } = stub(first, object, second);
    await assert.rejects(validateAndPublishIdentity(env, request));
    assert.ok(calls.every(([method]) => method === "GET"));
    assert.equal(calls.some(([method]) => method === "POST"), false);
  });
}

test("an upstream API failure cannot publish success", async () => {
  const calls = [];
  await assert.rejects(
    validateAndPublishIdentity(env, async (method) => {
      calls.push(method);
      throw new Error("HTTP 403");
    }),
  );
  assert.deepEqual(calls, ["GET"]);
});

for (const [name, status] of [
  ["C2 identity context", { context: "tr01/c2-identity-validation", state: "success" }],
  ["unauthorized context", { context: "other/status", state: "success" }],
  ["failure state", { context: identity.context, state: "failure" }],
  ["missing status fields", {}],
]) {
  test(`a ${name} status response is rejected`, async () => {
    const { calls, request } = stub(ref, commit, ref, status);
    await assert.rejects(validateAndPublishIdentity(env, request), /did not confirm/);
    assert.equal(calls.filter(([method]) => method === "POST").length, 1);
  });
}

test("untrusted invocation makes no API calls", async () => {
  for (const change of [
    { GITHUB_REF_PROTECTED: "false" },
    { GITHUB_WORKFLOW_REF: "Future00111/ledgerpoint/.github/workflows/ledgerly-tr01-c2-identity-status.yml@refs/heads/main" },
    { TR01_VALIDATION_RESULT: "skipped" },
    { TR01_C3_APPROVED_WORKFLOW_SHA: "" },
    { GITHUB_WORKFLOW_SHA: "b".repeat(40) },
    { GITHUB_SHA: "b".repeat(40) },
  ]) {
    const { calls, request } = stub();
    await assert.rejects(validateAndPublishIdentity({ ...env, ...change }, request));
    assert.equal(calls.length, 0);
  }
});

test("workflow is manual-only and limits validation to protected main", () => {
  const triggers = workflowSource.match(/^on:\n([\s\S]*?)(?=^permissions:)/m)?.[1];
  const validateJob = workflowSource.match(/^  validate:\n([\s\S]*?)(?=^  identity:)/m)?.[1];
  assert.ok(triggers);
  assert.match(triggers, /^\s+workflow_dispatch:\s*$/m);
  assert.doesNotMatch(triggers, /^\s+(?:push|pull_request|schedule|workflow_call):/m);
  assert.ok(validateJob);
  assert.match(validateJob, /github\.repository == 'Future00111\/ledgerpoint'/);
  assert.match(validateJob, /github\.ref == 'refs\/heads\/main'/);
  assert.match(validateJob, /github\.ref_protected == true/);
});

test("workflow separates read-only validation from the protected status writer", () => {
  const validateJob = workflowSource.match(/^  validate:\n([\s\S]*?)(?=^  identity:)/m)?.[1];
  const identityJob = workflowSource.match(/^  identity:\n([\s\S]*)$/m)?.[1];
  assert.ok(validateJob);
  assert.ok(identityJob);
  assert.match(validateJob, /permissions:\n\s+contents: read/);
  assert.doesNotMatch(validateJob, /statuses:\s*write/);
  assert.match(identityJob, /needs: validate/);
  assert.match(identityJob, /needs\.validate\.result == 'success'/);
  assert.match(identityJob, /github\.repository == 'Future00111\/ledgerpoint'/);
  assert.match(identityJob, /github\.ref == 'refs\/heads\/main'/);
  assert.match(identityJob, /github\.ref_protected == true/);
  assert.match(identityJob, /environment:\n\s+name: ledgerly-canonical/);
  assert.match(identityJob, /permissions:\n\s+contents: read\n\s+statuses: write/);
});

test("workflow pins immutable C3 and both checkout paths disable credential persistence", () => {
  const identityJob = workflowSource.match(/^  identity:\n([\s\S]*)$/m)?.[1];
  assert.match(workflowSource, /ref: 1c26be19295902a38e1939b56ff99ae9a195d3de/);
  assert.match(workflowSource, /git rev-parse HEAD\^\{tree\}.*beb56d35539d81636b609602b3c57d167bc88888/);
  assert.match(workflowSource, /git rev-parse HEAD\^.*e7f43c70e45c068971aeb241ce1b01a30bb01e37/);
  assert.match(workflowSource, /git rev-list --parents -n 1 HEAD \| wc -w.*-eq 2/);
  assert.match(workflowSource, /persist-credentials: false/);
  assert.match(workflowSource, /ref: \$\{\{ github\.sha \}\}/);
  assert.ok(identityJob);
  assert.match(identityJob, /persist-credentials: false/);
  assert.match(identityJob, /TR01_C3_APPROVED_WORKFLOW_SHA: \$\{\{ vars\.TR01_C3_APPROVED_WORKFLOW_SHA \}\}/);
  assert.doesNotMatch(workflowSource, /TR01_C2_APPROVED_WORKFLOW_SHA/);
});

test("workflow runs pinned-source non-DB checks and an offline-build-only Docker smoke", () => {
  const fixture = workflowSource.match(/const fixture = \{([\s\S]*?)\n\s+\};/)?.[1];
  assert.match(workflowSource, /node --check scripts\/ci\/run-ledgerly-canonical-postgresql\.mjs/);
  assert.match(workflowSource, /pnpm run typecheck:libs/);
  assert.match(workflowSource, /pnpm run typecheck/);
  assert.match(workflowSource, /pnpm install --frozen-lockfile --ignore-scripts/);
  assert.match(workflowSource, /DOCKER_BUILDKIT: "1"/);
  assert.match(workflowSource, /--file \.ci\/ledgerly-canonical\/Dockerfile\.test/);
  assert.match(workflowSource, /--tag "\$image"/);
  assert.match(workflowSource, /ledgerly-tr01-c3-offline-pnpm-smoke:local/);
  assert.match(workflowSource, /LEDGERLY_OFFLINE_PNPM_TEST_IMAGE="\$image"\s+\\\s*node --test scripts\/ci\/ledgerly-offline-pnpm\.test\.mjs/);
  assert.match(workflowSource, /"\.dockerignore"[\s\S]*"\.github"[\s\S]*"scripts"[\s\S]*"pnpm-lock\.yaml"/);
  assert.ok(fixture);
  assert.match(fixture, /fixturePurpose: "offline-build-only"/);
  assert.match(fixture, /notQualificationEvidence: true/);
  assert.match(fixture, /version: 1/);
  assert.match(fixture, /qualificationWorkflowSha256: hashes\[qualificationWorkflow\]/);
  assert.doesNotMatch(fixture, /\b(?:schemaVersion|result|ci)\s*:/);
});

test("workflow wires this contract suite against same-event protected-main code after C3 install", () => {
  const producerCheckout = workflowSource.match(
    /- name: Checkout same-event protected-main producer tests\n([\s\S]*?)(?=\n      - name: Validate C3)/,
  )?.[1];
  assert.ok(producerCheckout);
  assert.match(producerCheckout, /uses: actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683/);
  assert.match(producerCheckout, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(producerCheckout, /path: \.local\/tr01-c3-producer/);
  assert.match(producerCheckout, /persist-credentials: false/);
  assert.match(workflowSource, /pnpm install --frozen-lockfile --ignore-scripts[\s\S]*?LEDGERLY_C3_VALIDATION_ROOT="\$GITHUB_WORKSPACE" node --test \.local\/tr01-c3-producer\/scripts\/ci\/ledgerly-tr01-c3-identity-status\.test\.mjs/);
});

test("offline-build-only source fixture is rejected by actual C3 validation before hashing or qualification", {
  skip: !validationRoot,
}, async () => {
  const root = resolve(validationRoot);
  const modulePath = resolve(root, "scripts/ci/run-ledgerly-canonical-postgresql.mjs");
  const expectedSha = "1c26be19295902a38e1939b56ff99ae9a195d3de";
  assert.equal(execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), expectedSha);
  const c3Source = await readFile(modulePath, "utf8");
  const fixtureGuardOffset = c3Source.indexOf("manifest?.version !== 2");
  const sourceHashOffset = c3Source.indexOf("const sourceTree = await sha256Files");
  const databaseStartOffset = c3Source.indexOf("await startPostgres(credentials.postgresPassword)");
  assert.ok(fixtureGuardOffset >= 0);
  assert.ok(sourceHashOffset > fixtureGuardOffset);
  assert.ok(databaseStartOffset > sourceHashOffset);

  const { buildTrustedEvidenceContext } = await import(pathToFileURL(modulePath).href);
  const branch = "refs/heads/tr01/implementation-identity-successor-c3";
  const environment = {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: branch,
    GITHUB_REF_PROTECTED: "true",
    GITHUB_REPOSITORY: identity.repository,
    GITHUB_WORKFLOW: "Ledgerly canonical PostgreSQL qualification",
    GITHUB_WORKFLOW_REF: `${identity.repository}/.github/workflows/ledgerly-canonical-postgresql.yml@${branch}`,
    GITHUB_JOB: "canonical-postgresql",
    GITHUB_SHA: expectedSha,
    GITHUB_RUN_ID: "offline-fixture-regression",
    GITHUB_RUN_ATTEMPT: "1",
    LEDGERLY_IDENTITY_MODE: "candidate",
    LEDGERLY_APPROVED_CANDIDATE_SHA: expectedSha,
    LEDGERLY_IMPLEMENTATION_SOURCE_SHA: expectedSha,
    LEDGERLY_WORKFLOW_ROOT: root,
  };
  const previousEnvironment = new Map(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, environment);
  const ci = {
    provider: "github-actions",
    repository: identity.repository,
    workflow: "Ledgerly canonical PostgreSQL qualification",
    workflowRef: environment.GITHUB_WORKFLOW_REF,
    runId: environment.GITHUB_RUN_ID,
    runAttempt: "1",
    job: "canonical-postgresql",
    workflowSourceCommit: expectedSha,
    implementationSourceCommit: expectedSha,
    identityMode: "candidate",
    sourceRef: branch,
    refProtected: true,
    ancestryVerified: true,
    workflowCheckoutClean: true,
    implementationCheckoutClean: true,
  };
  const offlineBuildFixture = {
    version: 1,
    fixturePurpose: "offline-build-only",
    notQualificationEvidence: true,
    sourceCommit: expectedSha,
    files: [],
    sourceTreeSha256: "0".repeat(64),
  };
  try {
    await assert.rejects(
      buildTrustedEvidenceContext(ci, offlineBuildFixture),
      /Trusted implementation source manifest is unavailable or invalid/,
    );
  } finally {
    for (const [key, value] of previousEnvironment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
```