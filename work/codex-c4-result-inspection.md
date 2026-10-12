# C4 failed qualification evidence

{
  "schemaVersion": 2,
  "result": "failed",
  "failurePhase": "test",
  "ci": {
    "provider": "github-actions",
    "repository": "Future00111/ledgerpoint",
    "workflow": "Ledgerly canonical PostgreSQL qualification",
    "workflowRef": "Future00111/ledgerpoint/.github/workflows/ledgerly-canonical-postgresql.yml@refs/heads/tr01/implementation-identity-successor-c4",
    "runId": "37677799309",
    "runAttempt": "1",
    "job": "canonical-postgresql",
    "workflowSourceCommit": "273f714c876260636346b7fbcc588224e9795141",
    "implementationSourceCommit": "273f714c876260636346b7fbcc588224e9795141",
    "identityMode": "candidate",
    "sourceRef": "refs/heads/tr01/implementation-identity-successor-c4",
    "refProtected": true,
    "ancestryVerified": true,
    "workflowCheckoutClean": true,
    "implementationCheckoutClean": true
  },
  "images": {
    "postgres": {
      "tag": "postgres:16.15-bookworm",
      "digest": "sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825"
    },
    "node": {
      "tag": "node:24.13.0-bookworm-slim",
      "digest": "sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f"
    }
  },
  "cleanup": {
    "logicalDrop": true,
    "databaseAbsent": true,
    "containerRemoved": true,
    "networkRemoved": true,
    "credentialMaterialRemoved": true
  },
  "isolation": {
    "parentDatabaseUrlAbsent": true,
    "replitVariablesAbsent": true,
    "noPublishedPorts": true,
    "internalNetwork": true,
    "testContainerNoSocket": true,
    "testContainerNoExternalRoute": true,
    "heliumdbContacted": false,
    "productionContacted": false,
    "secretScanPassed": true
  }
}

# Final log section

Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.2528081Z 
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.2529009Z > @workspace/api-server@0.0.0 test:canonical-posting /workspace/artifacts/api-server
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.2529951Z > node scripts/runCanonicalPostingDisposable.mjs
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.2530441Z 
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4528295Z /usr/local/lib/node_modules/corepack/dist/lib/corepack.cjs:22063
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4529207Z     throw new Error(
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4529505Z           ^
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4529659Z 
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4530487Z Error: Error when performing the request to https://registry.npmjs.org/pnpm/latest; for troubleshooting help, see https://github.com/nodejs/corepack#troubleshooting
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4531837Z     at fetch (/usr/local/lib/node_modules/corepack/dist/lib/corepack.cjs:22063:11)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4532641Z     at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4533610Z     at async fetchAsJson (/usr/local/lib/node_modules/corepack/dist/lib/corepack.cjs:22077:20)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4534310Z     ... 5 lines matching cause stack trace ...
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4535153Z     at async Object.runMain (/usr/local/lib/node_modules/corepack/dist/lib/corepack.cjs:23684:7) {
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4536754Z   [cause]: TypeError: fetch failed
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4537216Z       at node:internal/deps/undici/undici:16416:13
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4538165Z       at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4539118Z       at async fetch (/usr/local/lib/node_modules/corepack/dist/lib/corepack.cjs:22057:16)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4540085Z       at async fetchAsJson (/usr/local/lib/node_modules/corepack/dist/lib/corepack.cjs:22077:20)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4541200Z       at async fetchLatestStableVersion (/usr/local/lib/node_modules/corepack/dist/lib/corepack.cjs:21999:20)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4542424Z       at async fetchLatestStableVersion2 (/usr/local/lib/node_modules/corepack/dist/lib/corepack.cjs:22174:14)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4543526Z       at async Engine.getDefaultVersion (/usr/local/lib/node_modules/corepack/dist/lib/corepack.cjs:22855:23)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4544646Z       at async Engine.findProjectSpec (/usr/local/lib/node_modules/corepack/dist/lib/corepack.cjs:22924:40)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4546069Z       at async Engine.executePackageManagerRequest (/usr/local/lib/node_modules/corepack/dist/lib/corepack.cjs:22978:24)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4547194Z       at async Object.runMain (/usr/local/lib/node_modules/corepack/dist/lib/corepack.cjs:23684:7) {
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4548201Z     [cause]: Error: getaddrinfo EAI_AGAIN registry.npmjs.org
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4548887Z         at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26) {
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4549511Z       errno: -3001,
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4549847Z       code: 'EAI_AGAIN',
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4550209Z       syscall: 'getaddrinfo',
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4550606Z       hostname: 'registry.npmjs.org'
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4551013Z     }
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4551281Z   }
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4551543Z }
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4551688Z 
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4551821Z Node.js v24.13.0
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4588246Z file:///workspace/artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs:191
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4589559Z         reject(new Error(`${command} exited with status ${code}`));
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4590288Z                ^
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4590641Z 
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4590936Z Error: pnpm exited with status 1
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4591602Z     at ChildProcess.<anonymous> (file:///workspace/artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs:191:16)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4592215Z     at ChildProcess.emit (node:events:508:28)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4592551Z     at maybeClose (node:internal/child_process:1101:16)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4592952Z     at ChildProcess._handle.onexit (node:internal/child_process:305:5)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4593237Z 
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4593326Z Node.js v24.13.0
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4742111Z /workspace/artifacts/api-server:
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4743740Z  ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @workspace/api-server@0.0.0 test:canonical-posting: `node scripts/runCanonicalPostingDisposable.mjs`
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.4744600Z Exit status 1
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.5444280Z TI-03 failed during test: docker exited with status 1: e/artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs:191
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.5445520Z         reject(new Error(`${command} exited with status ${code}`));
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.5446094Z                ^
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.5446313Z 
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.5446500Z Error: pnpm exited with status 1
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.5447409Z     at ChildProcess.<anonymous> (file:///workspace/artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs:191:16)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.5448696Z     at ChildProcess.emit (node:events:508:28)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.5449279Z     at maybeClose (node:internal/child_process:1101:16)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.5449986Z     at ChildProcess._handle.onexit (node:internal/child_process:305:5)
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.5450488Z 
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:11.5450632Z Node.js v24.13.0
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:12.1335690Z LEDGERLY_TI03_FAILURE_EVIDENCE {"path":"docs/governance/evidence/ledgerly-44-ti-03-failed-37677799309-1.json","sha256":"36be537831cce910ddfc5b4ca1b7d217c85fb8d00178322e9f4c9bf41c9beaae"}
Disposable canonical PostgreSQL qualification	Run TI-03 qualification	2026-10-07T19:54:12.1399884Z ##[error]Process completed with exit code 1.
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	﻿2026-10-07T19:54:12.1501957Z ##[group]Run actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.1502399Z with:
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.1502607Z   name: ledgerly-ti-03-37677799309-1
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.1502968Z   path: **/docs/governance/evidence/ledgerly-44-ti-03-*.json
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.1503327Z   if-no-files-found: error
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.1503557Z   retention-days: 30
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.1503769Z   compression-level: 6
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.1503980Z   overwrite: false
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.1504200Z   include-hidden-files: false
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.1504439Z ##[endgroup]
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.3171645Z (node:4922) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.3172557Z (Use `node --trace-deprecation ...` to show where the warning was created)
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.5042283Z With the provided path, there will be 2 files uploaded
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.5049196Z Artifact name is valid!
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.5050086Z Root directory input is valid!
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.7112196Z Beginning upload of artifact content to blob storage
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.7319242Z (node:4922) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized and prone to errors that have security implications. Use the WHATWG URL API instead. CVEs are not issued for `url.parse()` vulnerabilities.
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.7823823Z Uploaded bytes 3264
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.7995579Z Finished uploading artifact content to blob storage!
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.7996711Z SHA256 digest of uploaded artifact zip is 1581afdc2b5efaa9fbee78fdc39fbbd37dc8c2337b13643cb163266adf9d5cff
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:12.7998807Z Finalizing artifact upload
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:13.0087666Z Artifact ledgerly-ti-03-37677799309-1.zip successfully finalized. Artifact ID 11508320322
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:13.0089621Z Artifact ledgerly-ti-03-37677799309-1 has been successfully uploaded! Final size is 3264 bytes. Artifact ID is 11508320322
Disposable canonical PostgreSQL qualification	Upload non-secret TI-03 evidence	2026-10-07T19:54:13.0095552Z Artifact download URL: https://github.com/Future00111/ledgerpoint/actions/runs/37677799309/artifacts/11508320322
Disposable canonical PostgreSQL qualification	Post Checkout reviewed source	﻿2026-10-07T19:54:13.0320019Z Post job cleanup.
Disposable canonical PostgreSQL qualification	Post Checkout reviewed source	2026-10-07T19:54:13.1186579Z [command]/usr/bin/git version
Disposable canonical PostgreSQL qualification	Post Checkout reviewed source	2026-10-07T19:54:13.1232350Z git version 2.55.0
Disposable canonical PostgreSQL qualification	Post Checkout reviewed source	2026-10-07T19:54:13.1273675Z Temporarily overriding HOME='/home/runner/work/_temp/7c258dac-4ae0-4373-b09a-9d4e63a05006' before making global git config changes
Disposable canonical PostgreSQL qualification	Post Checkout reviewed source	2026-10-07T19:54:13.1274992Z Adding repository directory to the temporary git global config as a safe directory
Disposable canonical PostgreSQL qualification	Post Checkout reviewed source	2026-10-07T19:54:13.1279453Z [command]/usr/bin/git config --global --add safe.directory /home/runner/work/ledgerpoint/ledgerpoint
Disposable canonical PostgreSQL qualification	Post Checkout reviewed source	2026-10-07T19:54:13.1321322Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
Disposable canonical PostgreSQL qualification	Post Checkout reviewed source	2026-10-07T19:54:13.1358938Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
Disposable canonical PostgreSQL qualification	Post Checkout reviewed source	2026-10-07T19:54:13.1608430Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/github\.com\/\.extraheader
Disposable canonical PostgreSQL qualification	Post Checkout reviewed source	2026-10-07T19:54:13.1669619Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/github\.com\/\.extraheader' && git config --local --unset-all 'http.https://github.com/.extraheader' || :"
Disposable canonical PostgreSQL qualification	Complete job	﻿2026-10-07T19:54:13.2136181Z Cleaning up orphan processes
Disposable canonical PostgreSQL qualification	Complete job	2026-10-07T19:54:13.2577451Z ##[warning]Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683, actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/