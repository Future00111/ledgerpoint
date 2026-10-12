## scripts/ci/run-ledgerly-canonical-postgresql.mjs

1: import { createHash, randomBytes, randomUUID } from "node:crypto";
2: import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
3: import path from "node:path";
4: import { fileURLToPath } from "node:url";
5: import { spawn } from "node:child_process";
6: import Ajv2020 from "ajv/dist/2020.js";
7: 
8: const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
9: const workflowRoot = path.resolve(process.env.LEDGERLY_WORKFLOW_ROOT ?? root);
10: const implementationRoot = root;
11: const candidateRef = "refs/heads/tr01/implementation-identity-successor-c4";
12: const mainRef = "refs/heads/main";
13: const fullShaPattern = /^[0-9a-f]{40}$/;
14: const postgresImage =
15:   "postgres:16.15-bookworm@sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825";
16: const postgresTag = "postgres:16.15-bookworm";
17: const postgresDigest =
18:   "sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825";
19: const nodeBaseImage =
20:   "node:24.13.0-bookworm-slim@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f";
21: const testImage = "ledgerly-canonical-test:24.13.0-bookworm-slim";
22: const nodeTag = "node:24.13.0-bookworm-slim";
23: const nodeDigest =
24:   "sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f";
25: const expectedCommand = "pnpm --filter @workspace/api-server run test:canonical-posting";
26: const workflowPath = ".github/workflows/ledgerly-canonical-postgresql.yml";
27: const approvedWorkflowName = "Ledgerly canonical PostgreSQL qualification";
28: const sourceManifestPath = ".ci/ledgerly-canonical/source-manifest.json";
29: const executionTreePathspecs = [
30:   ".dockerignore",
31:   ".ci/ledgerly-canonical/Dockerfile.test",
32:   ".github",
33:   "artifacts",
34:   "lib",
35:   "scripts",
36:   "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json",
37:   "package.json",
38:   "pnpm-lock.yaml",
39:   "pnpm-workspace.yaml",
40:   "tsconfig.base.json",
41:   "tsconfig.json",
42: ];
43: const requiredNegativeControls = [
44:   "missingRunBinding",
45:   "forgedRunDatabaseMismatch",
46:   "malformedUri",
47:   "targetChangingQuery",
48:   "wrongHost",
49:   "wrongPort",
50:   "wrongDatabase",
51:   "wrongRole",
52:   "parentDatabaseUrl",
53:   "replitMarker",
54:   "inheritedPgOverride",
55:   "unpinnedImage",
56:   "untrustedEvent",
57:   "unauthorizedWorkflow",
58:   "cleanupBindingMismatch",
59:   "evidenceCredentialPattern",
60:   "roleEscalation",
61:   "triggerDisable",
62: ];
63: const sourcePaths = {
64:   applicationSchema: "lib/db/src/schema/index.ts",
65:   drizzleConfig: "lib/db/drizzle.config.ts",
66:   securityOverlay: "scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql",
67:   runControlSql: "scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql",
68:   coordinator: "scripts/ci/run-ledgerly-canonical-postgresql.mjs",
69:   canonicalCoordinator: "artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs",
70:   canonicalTests: "artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts",
71:   canonicalPosting: "artifacts/api-server/src/services/accounting/canonicalPosting.ts",
72:   lockfile: "pnpm-lock.yaml",
73:   workflow: workflowPath,
74:   evidenceSchema: "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json",
75: };
76: const sourceDigestKeys = [
77:   "sourceTree",
78:   "applicationSchema",
79:   "drizzleConfig",
80:   "securityOverlay",
81:   "runControlSql",
82:   "coordinator",
83:   "testSources",
84:   "lockfile",
85:   "workflow",
86:   "orchestrator",
87: ];
88: const digestPattern = /^[0-9a-f]{64}$/;
89: const authenticatedEvidenceContexts = new WeakSet();
90: 
91: const state = {
92:   phase: "preflight",
93:   runId: null,
94:   databaseName: null,
95:   networkName: null,
96:   postgresContainer: null,
97:   testContainer: null,
98:   credentialDirectory: null,
99:   adminEnvFile: null,
100:   testEnvFile: null,
101:   databaseCreated: false,
102:   containerRemoved: false,
103:   networkRemoved: false,
104:   databaseAbsent: false,
105:   credentialMaterialRemoved: false,
106:   evidence: null,
107:   ci: null,
108:   runNonce: null,
109:   observedIsolation: {
110:     noPublishedPorts: false,

1170:   }
1171:   return text;
1172: }
1173: 
1174: const evidenceSchema = JSON.parse(
1175:   await readFile(path.join(implementationRoot, sourcePaths.evidenceSchema), "utf8"),
1176: );
1177: const evidenceAjv = new Ajv2020({
1178:   strict: true,
1179:   allErrors: true,
1180:   formats: {
1181:     uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
1182:   },
1183: });
1184: const validateEvidenceSchema = evidenceAjv.compile(evidenceSchema);
1185: 
1186: function assertJsonSchemaEvidence(value) {
1187:   if (!validateEvidenceSchema(value)) {
1188:     const diagnostics = (validateEvidenceSchema.errors ?? [])
1189:       .slice(0, 8)
1190:       .map(({ instancePath, keyword }) => `${instancePath || "/"}:${keyword}`)
1191:       .join(", ");
1192:     throw new Error(`Evidence JSON Schema validation failed: ${diagnostics}`);
1193:   }
1194: }
1195: 
1196: async function buildTrustedEvidenceContext(ci, manifest) {
1197:   const context = assertTrustedWorkflowContext();
1198:   const identity = await verifyIdentityRoots(context.mode, context.implementationSha);
1199:   const verifiedCi = buildCiIdentity({ ...context, ...identity });
1200:   if (!ci || Object.keys(verifiedCi).some((key) => ci[key] !== verifiedCi[key])) {
1201:     throw new Error("Evidence source identity changed after preflight");
1202:   }
1203:   if (
1204:     manifest?.version !== 2 ||
1205:     manifest.identityMode !== ci.identityMode ||
1206:     manifest.implementationSourceCommit !== ci.implementationSourceCommit ||
1207:     !Array.isArray(manifest.files) ||
1208:     !digestPattern.test(manifest.sourceTreeSha256 ?? "") ||
1209:     !digestPattern.test(manifest.workflowSourceSha256 ?? "")
1210:   ) {
1211:     throw new Error("Trusted implementation source manifest is unavailable or invalid");
1212:   }
1213:   const status = await run(
1214:     "git",
1215:     ["status", "--porcelain", "--untracked-files=all", "--", ...executionTreePathspecs],
1216:     { cwd: implementationRoot, quiet: true },
1217:   );
1218:   if (status.stdout.trim()) {
1219:     throw new Error("Implementation execution tree changed after manifest creation");
1220:   }
1221:   const tracked = await run(
1222:     "git",
1223:     ["ls-files", "-z", "--", ...executionTreePathspecs],
1224:     { cwd: implementationRoot, quiet: true },
1225:   );
1226:   const files = tracked.stdout.split("\0").filter(Boolean).sort();
1227:   if (JSON.stringify(manifest.files) !== JSON.stringify(files)) {
1228:     throw new Error("Implementation source manifest no longer matches the verified checkout");
1229:   }
1230:   const sourceTree = await sha256Files(files, implementationRoot);
1231:   const workflow = await sha256File(sourcePaths.workflow, workflowRoot);
1232:   if (
1233:     sourceTree !== manifest.sourceTreeSha256 ||
1234:     workflow !== manifest.workflowSourceSha256
1235:   ) {
1236:     throw new Error("Verified S/C2 checkout digests differ from the source manifest");
1237:   }
1238:   const sourceDigests = Object.freeze({
1239:     sourceTree,
1240:     applicationSchema: await sha256File(sourcePaths.applicationSchema, implementationRoot),
1241:     drizzleConfig: await sha256File(sourcePaths.drizzleConfig, implementationRoot),
1242:     securityOverlay: await sha256File(sourcePaths.securityOverlay, implementationRoot),
1243:     runControlSql: await sha256File(sourcePaths.runControlSql, implementationRoot),
1244:     coordinator: await sha256File(sourcePaths.coordinator, implementationRoot),
1245:     testSources: await sha256Files(
1246:       [sourcePaths.canonicalTests, sourcePaths.canonicalPosting],
1247:       implementationRoot,
1248:     ),
1249:     lockfile: await sha256File(sourcePaths.lockfile, implementationRoot),
1250:     workflow,
1251:     orchestrator: await sha256File(sourcePaths.canonicalCoordinator, implementationRoot),
1252:   });
1253:   const trusted = Object.freeze({
1254:     ci: Object.freeze({ ...verifiedCi }),
1255:     sourceDigests,
1256:     sourceTreeSha256: sourceTree,
1257:     rootsVerified: true,
1258:     manifestVerified: true,
1259:   });
1260:   authenticatedEvidenceContexts.add(trusted);
1261:   return trusted;
1262: }
1263: 
1264: function validateEvidenceContract(evidence, trusted = null) {

1580: }
1581: if (failure) process.exitCode = 1;
1582: }
1583: 
1584: if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
1585:   await runQualification();
1586: }

## artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs

1: import { createHash } from "node:crypto";
2: import { readFileSync } from "node:fs";
3: import { rm } from "node:fs/promises";
4: import { spawn } from "node:child_process";
5: import os from "node:os";
6: import path from "node:path";
7: import { fileURLToPath } from "node:url";
8: import pg from "pg";
9: 
10: const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
11: const workspaceDirectory = path.resolve(packageDirectory, "../..");
12: const expectedCommand = "pnpm --filter @workspace/api-server run test:canonical-posting";
13: const externalMode = process.env.LEDGERLY_CANONICAL_TEST_MODE === "external-ci";
14: 
15: function requireEnvironment(names) {
16:   for (const name of names) {
17:     if (!process.env[name]) {
18:       throw new Error(`${name} is required; canonical tests have no fallback`);
19:     }
20:   }
21: }
22: 
23: function sha256File(relativePath) {
24:   return createHash("sha256")
25:     .update(readFileSync(path.join(workspaceDirectory, relativePath)))
26:     .digest("hex");
27: }
28: 
29: function sha256Files(relativePaths) {
30:   const hash = createHash("sha256");
31:   for (const relativePath of [...relativePaths].sort()) {
32:     hash.update(relativePath);
33:     hash.update("\0");
34:     hash.update(readFileSync(path.join(workspaceDirectory, relativePath)));
35:     hash.update("\0");
36:   }
37:   return hash.digest("hex");
38: }
39: 
40: const sourceFiles = {
41:   applicationSchema: "lib/db/src/schema/index.ts",
42:   drizzleConfig: "lib/db/drizzle.config.ts",
43:   securityOverlay: "scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql",
44:   runControlSql: "scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql",
45:   coordinator: "scripts/ci/run-ledgerly-canonical-postgresql.mjs",
46:   canonicalCoordinator: "artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs",
47:   canonicalTests: "artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts",
48:   canonicalPosting: "artifacts/api-server/src/services/accounting/canonicalPosting.ts",
49:   lockfile: "pnpm-lock.yaml",
50:   workflow: ".github/workflows/ledgerly-canonical-postgresql.yml",
51: };
52: const sourceManifestPath = ".ci/ledgerly-canonical/source-manifest.json";
53: 
54: export function validateExecutionSourceManifest(manifest, calculateSourceTreeDigest) {
55:   if (
56:     manifest?.version !== 2 ||
57:     !Array.isArray(manifest.files) ||
58:     !/^[0-9a-f]{64}$/.test(manifest.sourceTreeSha256) ||
59:     !/^[0-9a-f]{64}$/.test(manifest.workflowSourceSha256) ||
60:     manifest.files.length === 0 ||
61:     manifest.files.some(
62:       (file) =>
63:         typeof file !== "string" ||
64:         path.isAbsolute(file) ||
65:         file.split("/").includes(".."),
66:     ) ||
67:     new Set(manifest.files).size !== manifest.files.length ||
68:     [...manifest.files].sort().some((file, index) => file !== manifest.files[index])
69:   ) {
70:     throw new Error("The execution source manifest is invalid");

140:   }
141:   return true;
142: }
143: 
144: function requireLiteralTrue(name) {
145:   return parseLiteralTrue(process.env[name], name);
146: }
147: 
148: function extractMarker(output, marker) {
149:   const line = output
150:     .split("\n")
151:     .find((candidate) => candidate.startsWith(marker));
152:   if (!line) {
153:     throw new Error(`Canonical suite did not emit ${marker.trim()}`);
154:   }
155:   return JSON.parse(line.slice(marker.length));
156: }
157: 
158: function runProcess(command, args, { env, cwd, input, timeoutMs } = {}) {
159:   return new Promise((resolve, reject) => {
160:     const child = spawn(command, args, {
161:       cwd,
162:       env,
163:       stdio: ["pipe", "pipe", "pipe"],
164:     });
165:     let stdout = "";
166:     let stderr = "";
167:     let timedOut = false;
168:     const timer = timeoutMs
169:       ? setTimeout(() => {
170:           timedOut = true;
171:           child.kill("SIGTERM");
172:           setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
173:         }, timeoutMs)
174:       : undefined;
175:     child.stdout.on("data", (chunk) => {
176:       stdout += chunk;
177:       process.stdout.write(chunk);
178:     });
179:     child.stderr.on("data", (chunk) => {
180:       stderr += chunk;
181:       process.stderr.write(chunk);
182:     });
183:     child.on("error", reject);
184:     child.on("close", (code, signal) => {
185:       if (timer) clearTimeout(timer);
186:       if (timedOut) {
187:         reject(new Error(`${command} timed out`));
188:       } else if (signal) {
189:         reject(new Error(`${command} terminated by ${signal}`));
190:       } else if (code !== 0) {
191:         reject(new Error(`${command} exited with status ${code}`));
192:       } else {
193:         resolve({ stdout, stderr });
194:       }
195:     });
196:     if (input !== undefined) {
197:       child.stdin.end(input);
198:     } else {
199:       child.stdin.end();
200:     }

200:     }
201:   });
202: }
203: 
204: async function verifyExternalBinding({
205:   disposableDatabaseUrl,
206:   databaseName,
207:   runId,
208:   runNonce,
209:   environment,
210:   targetClass,
211:   ci,
212:   sourceDigests,
213:   imageBinding,
214: }) {
215:   const url = new URL(disposableDatabaseUrl);
216:   if (
217:     url.username !== "ledgerly_api" ||
218:     decodeURIComponent(url.pathname.slice(1)) !== databaseName ||
219:     url.hostname !== "ledgerly-postgres" ||
220:     url.port !== "5432" ||
221:     url.hash ||
222:     url.search !== "?sslmode=disable"
223:   ) {
224:     throw new Error("The external disposable target is not exact");
225:   }
226:   if (url.password.length === 0 || decodeURIComponent(url.password).length < 32) {
227:     throw new Error("The external disposable target has no per-run credential");
228:   }
229: 
230:   const client = new pg.Client({ connectionString: disposableDatabaseUrl });
231:   await client.connect();
232:   try {
233:     const identity = (
234:       await client.query(
235:         `SELECT current_database() AS database,
236:                 current_user AS "currentUser",
237:                 session_user AS "sessionUser",
238:                 current_setting('server_version') AS "serverVersion"`,
239:       )
240:     ).rows[0];
241:     if (
242:       identity?.database !== databaseName ||
243:       identity.currentUser !== "ledgerly_api" ||
244:       identity.sessionUser !== "ledgerly_api" ||
245:       !identity.serverVersion.startsWith("16.")
246:     ) {
247:       throw new Error("The external runtime identity or PostgreSQL version is not approved");
248:     }
249: 
250:     const binding = {
251:       runUuid: runId,
252:       databaseName,
253:       environment,
254:       targetClassification: targetClass,
255:       ciProvider: ci.provider,
256:       ciRepository: ci.repository,
257:       ciWorkflow: ci.workflow,
258:       ciWorkflowRef: ci.workflowRef,
259:       ciRunId: ci.runId,
260:       ciRunAttempt: ci.runAttempt,
261:       ciJob: ci.job,
262:       identityMode: ci.identityMode,
263:       ciSourceRef: ci.ciSourceRef,
264:       ciRefProtected: ci.ciRefProtected,
265:       workflowSourceCommit: ci.workflowSourceCommit,
266:       implementationSourceCommit: ci.implementationSourceCommit,
267:       ancestryVerified: ci.ancestryVerified,
268:       workflowCheckoutClean: ci.workflowCheckoutClean,
269:       implementationCheckoutClean: ci.implementationCheckoutClean,
270:       sourceTreeSha256: sourceDigests.sourceTree,
271:       applicationSchemaSha256: sourceDigests.applicationSchema,
272:       drizzleConfigSha256: sourceDigests.drizzleConfig,
273:       securityOverlaySha256: sourceDigests.securityOverlay,
274:       runControlSqlSha256: sourceDigests.runControlSql,
275:       coordinatorSha256: sourceDigests.coordinator,
276:       testSourcesSha256: sourceDigests.testSources,
277:       lockfileSha256: sourceDigests.lockfile,
278:       workflowSha256: sourceDigests.workflow,
279:       orchestratorSha256: sourceDigests.orchestrator,
280:       expectedCommand,