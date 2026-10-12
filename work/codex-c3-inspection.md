## scripts/ci/run-ledgerly-canonical-postgresql.mjs 620-730

```text
620:   );
621:   await adminSql(
622:     "postgres",
623:     `CREATE DATABASE "${state.databaseName}" OWNER postgres;`,
624:   );
625:   state.databaseCreated = true;
626: 
627:   const runControlSql = await readFile(
628:     path.join(implementationRoot, sourcePaths.runControlSql),
629:     "utf8",
630:   );
631:   const insert = `INSERT INTO ledgerly_test_control.run_identity (
632:       run_uuid, expected_database_name, environment, target_classification,
633:       ci_provider, ci_repository, ci_workflow, ci_workflow_ref, ci_run_id, ci_run_attempt, ci_job,
634:       identity_mode, ci_source_ref, ci_ref_protected, workflow_source_commit,
635:       implementation_source_commit, ancestry_verified, workflow_checkout_clean,
636:       implementation_checkout_clean, source_tree_sha256, application_schema_sha256, drizzle_config_sha256,
637:       security_overlay_sha256, application_schema_digest, drizzle_config_digest,
638:       security_overlay_digest, run_control_sql_sha256, coordinator_sha256, test_sources_sha256,
639:       lockfile_sha256, workflow_sha256, orchestrator_sha256, expected_test_command,
640:       creator_identity, expected_runtime_identity, run_binding_nonce, created_at, expires_at,
641:       postgres_image_tag, postgres_image_digest, node_image_tag, node_image_digest,
642:       prohibits_heliumdb, prohibits_production
643:     ) VALUES (
644:       ${sqlString(credentials.binding.runUuid)}, ${sqlString(credentials.binding.databaseName)},
645:       ${sqlString(credentials.binding.environment)}, ${sqlString(credentials.binding.targetClassification)},
646:       ${sqlString(credentials.binding.ciProvider)}, ${sqlString(credentials.binding.ciRepository)},
647:       ${sqlString(credentials.binding.ciWorkflow)}, ${sqlString(credentials.binding.ciWorkflowRef)},
648:       ${sqlString(credentials.binding.ciRunId)},
649:       ${sqlString(credentials.binding.ciRunAttempt)}, ${sqlString(credentials.binding.ciJob)},
650:       ${sqlString(credentials.binding.identityMode)}, ${sqlString(credentials.binding.ciSourceRef)},
651:       ${credentials.binding.ciRefProtected}, ${sqlString(credentials.binding.workflowSourceCommit)},
652:       ${sqlString(credentials.binding.implementationSourceCommit)},
653:       ${credentials.binding.ancestryVerified}, ${credentials.binding.workflowCheckoutClean},
654:       ${credentials.binding.implementationCheckoutClean},
655:       ${sqlString(credentials.binding.sourceTreeSha256)},
656:       ${sqlString(credentials.binding.applicationSchemaSha256)}, ${sqlString(credentials.binding.drizzleConfigSha256)},
657:       ${sqlString(credentials.binding.securityOverlaySha256)},
658:       ${sqlString(credentials.binding.applicationSchemaSha256)},
659:       ${sqlString(credentials.binding.drizzleConfigSha256)},
660:       ${sqlString(credentials.binding.securityOverlaySha256)},
661:       ${sqlString(credentials.binding.runControlSqlSha256)},
662:       ${sqlString(credentials.binding.coordinatorSha256)}, ${sqlString(credentials.binding.testSourcesSha256)},
663:       ${sqlString(credentials.binding.lockfileSha256)}, ${sqlString(credentials.binding.workflowSha256)},
664:       ${sqlString(credentials.binding.orchestratorSha256)}, ${sqlString(expectedCommand)},
665:       'postgres', 'ledgerly_api', ${sqlString(credentials.nonce)},
666:       ${sqlString(credentials.createdAt)}, ${sqlString(credentials.expiresAt)},
667:       ${sqlString(postgresTag)}, ${sqlString(postgresDigest)},
668:       ${sqlString(nodeTag)}, ${sqlString(nodeDigest)}, true, true
669:     );`;
670:   await adminSql(state.databaseName, `${runControlSql}\n${insert}`);
671: 
672:   const schemaEnv = {
673:     PATH: process.env.PATH,
674:     CI: "true",
675:     NODE_ENV: "test",
676:   };
677:   const pushArgs = [
678:     "run",
679:     "--rm",
680:     "--name",
681:     `ledgerly-ti03-bootstrap-${state.runId.replaceAll("-", "").slice(0, 24)}`,
682:     "--network",
683:     state.networkName,
684:     "--env",
685:     "CI=true",
686:     "--env-file",
687:     state.adminEnvFile,
688:     testImage,
689:     "pnpm",
690:     "--filter",
691:     "@workspace/db",
692:     "run",
693:     "push",
694:   ];
695:   let pushFailed = false;
696:   let pushOutput = "";
697:   try {
698:     const result = await docker(pushArgs, {
699:       env: schemaEnv,
700:       timeoutMs: 4 * 60 * 1000,
701:     });
702:     pushOutput = `${result.stdout}\n${result.stderr}`;
703:   } catch (error) {
704:     pushFailed = true;
705:     pushOutput = String(error);
706:   }
707:   if (pushFailed) {
708:     if (
709:       !pushOutput.includes("no unique constraint matching given keys for referenced table") ||
710:       !pushOutput.includes("accounting_posting_effects") ||
711:       !pushOutput.includes("economic_effect_id")
712:     ) {
713:       throw new Error("Drizzle bootstrap failed outside the approved FK/index ordering case");
714:     }
715:     await adminSql(
716:       state.databaseName,
717:       `CREATE UNIQUE INDEX IF NOT EXISTS accounting_posting_effects_company_effect_idx
718:        ON public.accounting_posting_effects (company_id, economic_effect_id);`,
719:     );
720:     await docker(pushArgs, { env: schemaEnv, timeoutMs: 4 * 60 * 1000 });
721:   }
722: 
723:   const overlay = await readFile(
724:     path.join(implementationRoot, sourcePaths.securityOverlay),
725:     "utf8",
726:   );
727:   await adminSql(state.databaseName, overlay);
728:   const verification = await adminSql(
729:     state.databaseName,
730:     `SELECT json_build_object(
```

## lib/db/src/schema/index.ts 330-380

```text
330: // journal_entries table above. They are written only by the canonical posting
331: // authority; generic CRUD does not expose them.
332: 
333: export const accountingPostingEffectsTable = pgTable(
334:   "accounting_posting_effects",
335:   {
336:     id: primaryId(),
337:     company_id: uuid("company_id").notNull(),
338:     source_type: text("source_type").notNull(),
339:     source_id: text("source_id").notNull(),
340:     posting_kind: text("posting_kind").notNull(),
341:     economic_effect_id: text("economic_effect_id").notNull(),
342:     idempotency_key: text("idempotency_key").notNull(),
343:     command_fingerprint: text("command_fingerprint").notNull(),
344:     source_revision: text("source_revision"),
345:     source_evidence_hash: text("source_evidence_hash"),
346:     status: text("status").notNull().default("pending"),
347:     journal_id: uuid("journal_id"),
348:     result: jsonb("result").$type<Record<string, unknown>>(),
349:     created_by_type: text("created_by_type").notNull(),
350:     created_by_id: text("created_by_id").notNull(),
351:     created_at: createdAt(),
352:     updated_at: updatedAt(),
353:   },
354:   (t) => [
355:     uniqueIndex("accounting_posting_effects_company_idempotency_idx").on(
356:       t.company_id,
357:       t.idempotency_key,
358:     ),
359:     uniqueIndex("accounting_posting_effects_company_effect_idx").on(
360:       t.company_id,
361:       t.economic_effect_id,
362:     ),
363:     index("accounting_posting_effects_company_source_idx").on(
364:       t.company_id,
365:       t.source_type,
366:       t.source_id,
367:     ),
368:     check(
369:       "accounting_posting_effects_status_check",
370:       sql`${t.status} in ('pending', 'posted', 'uncertain')`,
371:     ),
372:   ],
373: );
374: export const insertAccountingPostingEffectSchema = createInsertSchema(accountingPostingEffectsTable).omit({
375:   id: true,
376:   created_at: true,
377:   updated_at: true,
378: });
379: export type AccountingPostingEffect = typeof accountingPostingEffectsTable.$inferSelect;
380: 
```

## lib/db/src/schema/index.ts 500-535

```text
500:     index("canonical_journal_relations_company_original_idx").on(
501:       t.company_id,
502:       t.original_journal_id,
503:     ),
504:     check(
505:       "canonical_journal_relations_type_check",
506:       sql`${t.relation_type} in ('reversal', 'correction')`,
507:     ),
508:     foreignKey({
509:       columns: [t.original_journal_id],
510:       foreignColumns: [canonicalJournalEntriesTable.id],
511:       name: "canonical_journal_relations_original_fk",
512:     }),
513:     foreignKey({
514:       columns: [t.related_journal_id],
515:       foreignColumns: [canonicalJournalEntriesTable.id],
516:       name: "canonical_journal_relations_related_fk",
517:     }),
518:     foreignKey({
519:       columns: [t.company_id, t.economic_effect_id],
520:       foreignColumns: [
521:         accountingPostingEffectsTable.company_id,
522:         accountingPostingEffectsTable.economic_effect_id,
523:       ],
524:       name: "canonical_journal_relations_effect_fk",
525:     }).onUpdate("restrict").onDelete("restrict"),
526:   ],
527: );
528: export const insertCanonicalJournalRelationSchema = createInsertSchema(canonicalJournalRelationsTable).omit({
529:   id: true,
530:   created_at: true,
531: });
532: export type CanonicalJournalRelation = typeof canonicalJournalRelationsTable.$inferSelect;
533: 
534: export const accountingAuditEventsTable = pgTable(
535:   "accounting_audit_events",
```

## scripts/ci/ledgerly-external-binding-regression.test.mjs 1-280

```text
1: // Manual, NON-QUALIFICATION review fixture. Never uses managed DBs or gh.
2: // Requires a prebuilt C3 review image; uses its pinned dependencies offline.
3: import assert from "node:assert/strict";
4: import { createHash, randomBytes, randomUUID } from "node:crypto";
5: import { spawnSync } from "node:child_process";
6: import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
7: import { tmpdir } from "node:os";
8: import path from "node:path";
9: import { fileURLToPath, pathToFileURL } from "node:url";
10: 
11: const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
12: const runner = "artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs";
13: const coordinator = "scripts/ci/run-ledgerly-canonical-postgresql.mjs";
14: const workflow = ".github/workflows/ledgerly-canonical-postgresql.yml";
15: const postgres = "postgres:16.15-bookworm@sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825";
16: const sha = (b) => createHash("sha256").update(b).digest("hex");
17: 
18: if (!process.argv.includes("--inside") && !process.argv.includes("--disposable-review")) {
19:   console.log("Manual binding review only: use --disposable-review --base-image <prebuilt-C3-review-image>. No database started.");
20: } else if (process.argv.includes("--inside")) {
21:   const fixture = JSON.parse(readFileSync(0, "utf8"));
22:   const { externalSourceDigests, verifyExternalBinding } = await import(
23:     pathToFileURL(path.join(root, "artifacts/api-server/scripts/review-binding-module.mjs")).href
24:   );
25:   const results = [];
26:   async function check(name, action) {
27:     try { await action(); results.push({ name, passed: true }); }
28:     catch (error) { results.push({ name, passed: false, reason: error.message }); }
29:   }
30:   await check("source digest parity: runtime orchestrator is not coordinator", () => {
31:     const actual = externalSourceDigests();
32:     assert.notEqual(fixture.args.sourceDigests.coordinator, fixture.args.sourceDigests.orchestrator);
33:     assert.deepEqual(actual, fixture.args.sourceDigests);
34:   });
35:   await check("valid private binding passes actual PostgreSQL verifier", async () => {
36:     const actual = await verifyExternalBinding(fixture.args);
37:     assert.equal(actual.bindingVerified, true);
38:     assert.equal(actual.identity.currentUser, "ledgerly_api");
39:     assert.equal(actual.identity.sessionUser, "ledgerly_api");
40:     assert.match(actual.identity.serverVersion, /^16\.15/);
41:   });
42:   await check("forged run UUID rejected by private database binding", async () => {
43:     await assert.rejects(
44:       verifyExternalBinding({ ...fixture.args, runId: randomUUID() }),
45:       /The private external-CI run binding did not verify/,
46:     );
47:   });
48:   await check("forged nonce rejected by private database binding", async () => {
49:     await assert.rejects(
50:       verifyExternalBinding({ ...fixture.args, runNonce: randomBytes(32).toString("hex") }),
51:       /The private external-CI run binding did not verify/,
52:     );
53:   });
54:   await check("actual runner forged probe reaches intended rejection, not digest failure", () => {
55:     const result = spawnSync("node", [runner], {
56:       cwd: root, env: fixture.env, encoding: "utf8", timeout: 20000,
57:     });
58:     assert.equal(result.error, undefined);
59:     assert.notEqual(result.status, 0);
60:     assert.match(result.stderr, /The private external-CI run binding did not verify/);
61:     assert.doesNotMatch(result.stderr, /source digests do not match/);
62:   });
63:   console.log(JSON.stringify({ reviewOnly: true, results }));
64:   process.exitCode = results.every((r) => r.passed) ? 0 : 1;
65: } else {
66:   assert.ok(process.argv.includes("--disposable-review"), "Explicit --disposable-review required");
67:   const baseIndex = process.argv.indexOf("--base-image");
68:   assert.ok(baseIndex >= 0, "Explicit prebuilt review --base-image required");
69:   const base = process.argv[baseIndex + 1];
70:   assert.match(base, /^[a-zA-Z0-9._:/@-]+$/);
71:   const expectOriginal = process.argv.includes("--expect-original-defect");
72:   const temp = mkdtempSync(path.join(tmpdir(), "ledgerly-binding-review-"));
73:   const suffix = randomBytes(12).toString("hex");
74:   const network = `ledgerly-binding-review-${suffix}`;
75:   const container = `${network}-pg`;
76:   const image = `ledgerly-binding-review:${suffix}`;
77:   const hostEnv = { PATH: process.env.PATH };
78:   const cleanup = { container: false, network: false, image: false, fixture: false };
79:   function command(args, input, timeout = 60000) {
80:     const r = spawnSync("docker", args, { env: hostEnv, input, encoding: "utf8", timeout });
81:     assert.equal(r.error, undefined, `Docker command failed/timed out: ${args[0]}`);
82:     assert.equal(r.status, 0, `Docker ${args[0]} failed (credential output suppressed)`);
83:     return r.stdout;
84:   }
85:   const sourceRef = "refs/heads/tr01/implementation-identity-successor-c3";
86:   // Deliberately synthetic identity: cannot satisfy trusted GitHub provenance.
87:   const commit = "a".repeat(40);
88:   const runId = randomUUID();
89:   const databaseName = `ledgerly_canonical_test_${runId.replaceAll("-", "")}`;
90:   const password = randomBytes(32).toString("hex");
91:   const nonce = randomBytes(32).toString("hex");
92:   try {
93:     const ls = spawnSync("git", ["ls-tree", "-r", "--name-only", "1c26be19295902a38e1939b56ff99ae9a195d3de", "--",
94:       ".dockerignore", ".ci/ledgerly-canonical/Dockerfile.test", ".github", "artifacts", "lib", "scripts",
95:       "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json", "package.json", "pnpm-lock.yaml",
96:       "pnpm-workspace.yaml", "tsconfig.base.json", "tsconfig.json"],
97:       { cwd: root, env: hostEnv, encoding: "utf8", timeout: 15000 });
98:     assert.equal(ls.status, 0);
99:     const original = spawnSync("git", ["show", `1c26be19295902a38e1939b56ff99ae9a195d3de:${runner}`],
100:       { cwd: root, env: hostEnv, timeout: 15000 });
101:     assert.equal(original.status, 0);
102:     const runtimeBytes = expectOriginal ? original.stdout : readFileSync(path.join(root, runner));
103:     const sourceBytes = (f) => f === runner ? runtimeBytes : readFileSync(path.join(root, f));
104:     const files = ls.stdout.trim().split("\n").sort();
105:     const treeHash = createHash("sha256");
106:     for (const f of files) {
107:       const bytes = sourceBytes(f);
108:       treeHash.update(f).update("\0").update(bytes).update("\0");
109:       const dest = path.join(temp, "source", f);
110:       mkdirSync(path.dirname(dest), { recursive: true }); writeFileSync(dest, bytes);
111:     }
112:     const sourceTree = treeHash.digest("hex");
113:     const fileHash = (f) => sha(sourceBytes(f));
114:     const testHash = createHash("sha256");
115:     for (const f of ["artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts",
116:       "artifacts/api-server/src/services/accounting/canonicalPosting.ts"].sort()) {
117:       testHash.update(f).update("\0").update(readFileSync(path.join(root, f))).update("\0");
118:     }
119:     const digests = {
120:       applicationSchema: fileHash("lib/db/src/schema/index.ts"),
121:       drizzleConfig: fileHash("lib/db/drizzle.config.ts"),
122:       securityOverlay: fileHash("scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql"),
123:       sourceTree, runControlSql: fileHash("scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql"),
124:       coordinator: fileHash(coordinator), testSources: testHash.digest("hex"),
125:       lockfile: fileHash("pnpm-lock.yaml"), workflow: fileHash(workflow), orchestrator: fileHash(runner),
126:     };
127:     writeFileSync(path.join(temp, "source/.ci/ledgerly-canonical/source-manifest.json"), JSON.stringify({
128:       version: 2, files, sourceTreeSha256: sourceTree, workflowSourceSha256: digests.workflow,
129:       identityMode: "candidate", implementationSourceCommit: commit, reviewOnly: true,
130:     }));
131:     writeFileSync(path.join(temp, "fixture-test.mjs"), readFileSync(fileURLToPath(import.meta.url)));
132:     // Test-only access seam. Real CLI source stays byte-for-byte uninstrumented.
133:     writeFileSync(path.join(temp, "review-binding-module.mjs"), runtimeBytes +
134:       "\nexport { externalSourceDigests, verifyExternalBinding };\n");
135:     writeFileSync(path.join(temp, "Dockerfile"),
136:       `FROM ${base}\nUSER root\nCOPY source /workspace\nCOPY fixture-test.mjs /workspace/scripts/ci/ledgerly-external-binding-regression.test.mjs\nCOPY review-binding-module.mjs /workspace/artifacts/api-server/scripts/review-binding-module.mjs\nUSER node\n`);
137:     command(["build", "--network=none", "-t", image, temp], undefined, 180000);
138:     command(["network", "create", "--internal", network]);
139:     // Initializer executes administration locally in the fresh container.
140:     // No network administrator connection and no dependency on docker exec.
141:     const statements = [];
142:     const sql = (database, text) => statements.push(`\\connect ${database}\n${text}`);
143:     sql("postgres", `CREATE ROLE ledgerly_api LOGIN NOINHERIT PASSWORD '${password}';\nCREATE ROLE ledgerly_canonical_owner NOLOGIN;\nCREATE DATABASE ${databaseName};`);
144:     const ci = { provider: "github-actions", repository: "review-only/local-binding-fixture",
145:       workflow: "Ledgerly canonical PostgreSQL qualification",
146:       workflowRef: `review-only/local-binding-fixture/${workflow}@${sourceRef}`,
147:       runId: "1", runAttempt: "1", job: "canonical-postgresql", identityMode: "candidate",
148:       ciSourceRef: sourceRef, ciRefProtected: true, workflowSourceCommit: commit,
149:       implementationSourceCommit: commit, ancestryVerified: true, workflowCheckoutClean: true,
150:       implementationCheckoutClean: true };
151:     const imageBinding = { postgresTag: "postgres:16.15-bookworm", postgresDigest: postgres.split("@")[1],
152:       nodeTag: "node:24.13.0-bookworm-slim",
153:       nodeDigest: "sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f" };
154:     const values = { run_uuid: runId, expected_database_name: databaseName,
155:       environment: "external-ci-disposable-test", target_classification: "external-ci-postgresql-service-container",
156:       identity_mode: "candidate", ci_source_ref: sourceRef, ci_ref_protected: true,
157:       workflow_source_commit: commit, implementation_source_commit: commit,
158:       ancestry_verified: true, workflow_checkout_clean: true, implementation_checkout_clean: true,
159:       source_tree_sha256: sourceTree, application_schema_digest: digests.applicationSchema,
160:       drizzle_config_digest: digests.drizzleConfig, security_overlay_digest: digests.securityOverlay,
161:       expected_test_command: "pnpm --filter @workspace/api-server run test:canonical-posting",
162:       creator_identity: "postgres", expected_runtime_identity: "ledgerly_api", run_binding_nonce: nonce,
163:       created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 600000).toISOString(),
164:       prohibits_heliumdb: true, prohibits_production: true,
165:     };
166:     for (const [k, v] of Object.entries(ci)) {
167:       if (["provider", "repository", "workflow", "workflowRef", "runId", "runAttempt", "job"].includes(k))
168:         values["ci_" + k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase())] = v;
169:     }
170:     const digestColumns = { sourceTree: "source_tree", applicationSchema: "application_schema",
171:       drizzleConfig: "drizzle_config", securityOverlay: "security_overlay", runControlSql: "run_control_sql",
172:       coordinator: "coordinator", testSources: "test_sources", lockfile: "lockfile", workflow: "workflow", orchestrator: "orchestrator" };
173:     for (const [k, v] of Object.entries(digests)) values[digestColumns[k] + "_sha256"] = v;
174:     for (const [k, v] of Object.entries(imageBinding)) values[k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()).replace(/^(node|postgres)_/, "$1_image_")] = v;
175:     const literal = (x) => typeof x === "boolean" ? String(x) : "'" + x.replaceAll("'", "''") + "'";
176:     const control = readFileSync(path.join(root, "scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql"), "utf8");
177:     const overlay = readFileSync(path.join(root, "scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql"), "utf8");
178:     const verifier = overlay.slice(overlay.indexOf("CREATE OR REPLACE FUNCTION public.ledgerly_verify_external_disposable_run("),
179:       overlay.indexOf("\nDROP TRIGGER", overlay.indexOf("CREATE OR REPLACE FUNCTION public.ledgerly_verify_external_disposable_run(")));
180:     assert.match(verifier, /TO ledgerly_api;/);
181:     sql(databaseName, control + `\nINSERT INTO ledgerly_test_control.run_identity (${Object.keys(values).join(",")}) VALUES (${Object.values(values).map(literal).join(",")});\n` + verifier);
182:     const adminEnv = path.join(temp, "admin.env");
183:     const sqlFile = path.join(temp, "fixture.sql");
184:     writeFileSync(adminEnv, `POSTGRES_PASSWORD=${password}\n`, { mode: 0o600 });
185:     writeFileSync(sqlFile, "\\set ON_ERROR_STOP on\n" + statements.join("\n"), { mode: 0o600 });
186:     const bootstrap = [
187:       "set -e",
188:       "while [ ! -f /tmp/fixture.sql ]; do sleep 0.1; done",
189:       "cp /tmp/fixture.sql /docker-entrypoint-initdb.d/01-fixture.sql",
190:       "chmod 644 /docker-entrypoint-initdb.d/01-fixture.sql",
191:       "docker-entrypoint.sh postgres & server=$!",
192:       "for i in $(seq 1 120); do",
193:       "  if pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then touch /tmp/review-ready; wait \"$server\"; exit $?; fi",
194:       "  kill -0 \"$server\" || exit 1; sleep 0.5",
195:       "done", "kill \"$server\"; exit 1",
196:     ].join("\n");
197:     command(["run", "-d", "--name", container, "--network", network, "--network-alias", "ledgerly-postgres",
198:       "--pull=never", "--env-file", adminEnv, "--tmpfs", "/var/lib/postgresql/data",
199:       postgres, "bash", "-c", bootstrap]);
200:     command(["cp", sqlFile, `${container}:/tmp/fixture.sql`]);
201:     const inspect = JSON.parse(command(["inspect", container]))[0];
202:     assert.deepEqual(inspect.HostConfig.PortBindings, {});
203:     assert.equal(inspect.HostConfig.Binds, null);
204:     assert.equal(JSON.parse(command(["network", "inspect", network]))[0].Internal, true);
205:     let ready = false;
206:     for (let i = 0; i < 120; i++) {
207:       const r = spawnSync("docker", ["cp", `${container}:/tmp/review-ready`, path.join(temp, "ready")],
208:         { env: hostEnv, encoding: "utf8", timeout: 5000 });
209:       if (r.status === 0) { ready = true; break; }
210:       assert.equal(command(["inspect", "-f", "{{.State.Running}}", container]).trim(), "true",
211:         "Disposable PostgreSQL initializer must not fail");
212:       await new Promise((resolve) => setTimeout(resolve, 500));
213:     }
214:     assert.ok(ready, "Disposable PostgreSQL initializer must become ready");
215:     const args = { disposableDatabaseUrl: `postgresql://ledgerly_api:${password}@ledgerly-postgres:5432/${databaseName}?sslmode=disable`,
216:       databaseName, runId, runNonce: nonce, environment: values.environment, targetClass: values.target_classification,
217:       ci, sourceDigests: digests, imageBinding };
218:     const env = { PATH: "/usr/local/bin:/usr/bin:/bin", LEDGERLY_CANONICAL_TEST_MODE: "external-ci",
219:       LEDGERLY_CANONICAL_TEST_DATABASE_URL: args.disposableDatabaseUrl,
220:       LEDGERLY_CANONICAL_TEST_DATABASE_NAME: databaseName, LEDGERLY_CANONICAL_TEST_RUN_ID: randomUUID(),
221:       LEDGERLY_CANONICAL_TEST_RUN_NONCE: nonce, LEDGERLY_CANONICAL_TEST_ENVIRONMENT: args.environment,
222:       LEDGERLY_CANONICAL_TEST_TARGET_CLASS: args.targetClass };
223:     const names = { sourceTree: "SOURCE_TREE", applicationSchema: "SCHEMA", drizzleConfig: "CONFIG",
224:       securityOverlay: "OVERLAY", runControlSql: "RUN_CONTROL", coordinator: "COORDINATOR",
225:       testSources: "SOURCES", lockfile: "LOCKFILE", workflow: "WORKFLOW", orchestrator: "ORCHESTRATOR" };
226:     for (const [k, v] of Object.entries(digests)) env[`LEDGERLY_CANONICAL_TEST_${names[k]}_SHA256`] = v;
227:     const ciNames = { provider: "CI_PROVIDER", repository: "CI_REPOSITORY", workflow: "CI_WORKFLOW",
228:       workflowRef: "CI_WORKFLOW_REF", runId: "CI_RUN_ID", runAttempt: "CI_RUN_ATTEMPT", job: "CI_JOB",
229:       identityMode: "IDENTITY_MODE", ciSourceRef: "SOURCE_REF", ciRefProtected: "REF_PROTECTED",
230:       workflowSourceCommit: "WORKFLOW_SOURCE_COMMIT", implementationSourceCommit: "IMPLEMENTATION_SOURCE_COMMIT",
231:       ancestryVerified: "ANCESTRY_VERIFIED", workflowCheckoutClean: "WORKFLOW_CHECKOUT_CLEAN",
232:       implementationCheckoutClean: "IMPLEMENTATION_CHECKOUT_CLEAN" };
233:     for (const [k, v] of Object.entries(ci)) env[`LEDGERLY_CANONICAL_TEST_${ciNames[k]}`] = String(v);
234:     for (const [k, v] of Object.entries(imageBinding)) env[`LEDGERLY_CANONICAL_TEST_${k.replace(/[A-Z]/g, (c) => "_" + c).toUpperCase().replace(/^(NODE|POSTGRES)_/, "$1_IMAGE_")}`] = v;
235:     const execution = spawnSync("docker", ["run", "--rm", "-i", "--network", network, "--read-only",
236:       "--tmpfs", "/tmp:rw,noexec,nosuid,nodev", "--cap-drop=ALL", "--security-opt=no-new-privileges:true",
237:       image, "node", "scripts/ci/ledgerly-external-binding-regression.test.mjs", "--inside"],
238:       { env: hostEnv, input: JSON.stringify({ args, env }), encoding: "utf8", timeout: 60000 });
239:     assert.equal(execution.error, undefined);
240:     const result = JSON.parse(execution.stdout.trim());
241:     console.log(JSON.stringify({ reviewOnly: true, originalC3Executable: expectOriginal,
242:       runtimeOrchestratorSha256: sha(runtimeBytes) }));
243:     console.log(JSON.stringify(result, null, 2));
244:     if (expectOriginal) {
245:       assert.equal(execution.status, 1);
246:       assert.deepEqual(result.results.filter((r) => !r.passed).map((r) => r.name), [
247:         "source digest parity: runtime orchestrator is not coordinator",
248:         "actual runner forged probe reaches intended rejection, not digest failure",
249:       ]);
250:       console.log("PASS reproduced original defect: real SQL rejects forged identity; runner stops prematurely on wrong digest.");
251:     } else {
252:       assert.equal(execution.status, 0, "All binding regressions must pass");
253:       console.log("PASS binding-specific disposable review; NOT hosted/canonical qualification.");
254:     }
255:   } finally {
256:     for (const [key, args] of [
257:       ["container", ["rm", "-f", "-v", container]], ["network", ["network", "rm", network]],
258:       ["image", ["image", "rm", image]],
259:     ]) {
260:       const r = spawnSync("docker", args, { env: hostEnv, encoding: "utf8", timeout: 30000 });
261:       cleanup[key] = r.status === 0;
262:     }
263:     rmSync(temp, { recursive: true, force: true }); cleanup.fixture = true;
264:     console.log(JSON.stringify({ reviewOnly: true, cleanup }));
265:     assert.ok(Object.values(cleanup).every(Boolean), "Disposable review cleanup must complete");
266:   }
267: }
```
