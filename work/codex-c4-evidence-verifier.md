## package.json

{
  "name": "workspace",
  "version": "0.0.0",
  "license": "MIT",
  "scripts": {
    "preinstall": "sh -c 'rm -f package-lock.json yarn.lock; case \"$npm_config_user_agent\" in pnpm/*) ;; *) echo \"Use pnpm instead\" >&2; exit 1 ;; esac'",
    "build": "pnpm run typecheck && pnpm -r --if-present run build",
    "typecheck:libs": "tsc --build",
    "typecheck": "pnpm run typecheck:libs && pnpm -r --filter \"./artifacts/**\" --filter \"./scripts\" --if-present run typecheck"
  },
  "private": true,
  "dependencies": {
    "@replit/connectors-sdk": "^0.4.1",
    "ajv": "8.20.0"
  },
  "devDependencies": {
    "prettier": "^3.9.6",
    "typescript": "~5.9.3"
  }
}

## scripts/ci/run-ledgerly-canonical-postgresql.mjs

1: import { createHash, randomBytes, randomUUID } from "node:crypto";
2: import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
3: import path from "node:path";
4: import { fileURLToPath } from "node:url";
5: import { spawn } from "node:child_process";
6: import Ajv2020 from "ajv/dist/2020.js";
8: const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
27: const approvedWorkflowName = "Ledgerly canonical PostgreSQL qualification";
36:   "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json",
58:   "cleanupBindingMismatch",
59:   "evidenceCredentialPattern",
74:   evidenceSchema: "docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json",
106:   evidence: null,
368:     sourcePaths.evidenceSchema,
483:   state.credentialDirectory = await import("node:fs/promises").then(({ mkdtemp }) =>
936:   const cleanupMismatch = await adminSql(
943:   expectReject("cleanupBindingMismatch", () =>
944:     assertSingleCleanupBinding(cleanupMismatch.stdout.trim()),
946:   expectReject("evidenceCredentialPattern", () =>
959:     throw new Error("The qualification network is not internal-only");
1049:   if (!completionLine) throw new Error("Canonical test completion evidence was not emitted");
1057:     throw new Error("Canonical test evidence did not satisfy TI-03 isolation requirements");
1062: async function cleanupDatabase() {
1063:   state.phase = "cleanup";
1064:   let cleanupFailure = null;
1078:           throw new Error("The canonical test container still exists after cleanup");
1114:     cleanupFailure = error;
1122:         throw new Error("The PostgreSQL container still exists after cleanup");
1127:       cleanupFailure ??= error;
1135:         throw new Error("The internal Docker network still exists after cleanup");
1140:       cleanupFailure ??= error;
1143:   if (cleanupFailure) throw cleanupFailure;
1174: const evidenceSchema = JSON.parse(
1175:   await readFile(path.join(implementationRoot, sourcePaths.evidenceSchema), "utf8"),
1177: const evidenceAjv = new Ajv2020({
1184: const validateEvidenceSchema = evidenceAjv.compile(evidenceSchema);
1187:   if (!validateEvidenceSchema(value)) {
1188:     const diagnostics = (validateEvidenceSchema.errors ?? [])
1264: function validateEvidenceContract(evidence, trusted = null) {
1265:   assertJsonSchemaEvidence(evidence);
1266:   const mode = evidence?.ci?.identityMode;
1269:     evidence?.schemaVersion !== 2 ||
1270:     !["passed", "failed"].includes(evidence.result) ||
1272:     typeof evidence.ci?.workflowRef !== "string" ||
1273:     evidence.ci.sourceRef !== expectedRef ||
1274:     evidence.ci.refProtected !== true ||
1275:     !evidence.ci.workflowRef.endsWith(`/${workflowPath}@${expectedRef}`) ||
1276:     !fullShaPattern.test(evidence.ci.workflowSourceCommit ?? "") ||
1277:     !fullShaPattern.test(evidence.ci.implementationSourceCommit ?? "") ||
1278:     evidence.ci.ancestryVerified !== true ||
1279:     evidence.ci.workflowCheckoutClean !== true ||
1280:     evidence.ci.implementationCheckoutClean !== true ||
1282:       evidence.ci.workflowSourceCommit !== evidence.ci.implementationSourceCommit) ||
1283:     typeof evidence.images?.postgres?.digest !== "string" ||
1284:     typeof evidence.images?.node?.digest !== "string" ||
1285:     typeof evidence.cleanup !== "object" ||
1286:     typeof evidence.isolation !== "object"
1290:   if (evidence.result === "passed") {
1301:       Object.keys(trusted.ci).some((key) => evidence.ci[key] !== trusted.ci[key]) ||
1305:           evidence.binding?.sourceDigests?.[key] !== trusted.sourceDigests[key],
1307:       evidence.binding?.sourceTreeSha256 !== trusted.sourceTreeSha256
1309:       throw new Error("Passed evidence digests or identity differ from verified S/C2 checkouts");
1312:       evidence.failurePhase !== null ||
1313:       !Array.isArray(evidence.bootstrap?.roleSeparation) ||
1314:       !Array.isArray(evidence.bootstrap?.ownership) ||
1315:       !Array.isArray(evidence.bootstrap?.constraints) ||
1316:       !Array.isArray(evidence.bootstrap?.indexes) ||
1317:       !Array.isArray(evidence.bootstrap?.triggers) ||
1318:       evidence.binding?.workflowSourceCommit !== evidence.ci.workflowSourceCommit ||
1319:       evidence.binding?.implementationSourceCommit !== evidence.ci.implementationSourceCommit ||
1320:       evidence.binding?.identityMode !== evidence.ci.identityMode ||
1321:       evidence.binding?.ciSourceRef !== evidence.ci.sourceRef ||
1322:       evidence.binding?.ciRefProtected !== evidence.ci.refProtected ||
1323:       evidence.binding?.ancestryVerified !== true ||
1324:       evidence.binding?.workflowCheckoutClean !== true ||
1325:       evidence.binding?.implementationCheckoutClean !== true ||
1326:       evidence.runtime?.currentUser !== "ledgerly_api" ||
1327:       evidence.runtime?.sessionUser !== "ledgerly_api" ||
1328:       evidence.runtime?.privateBindingVerified !== true ||
1330:         (control) => evidence.negativeControls?.[control] !== true,
1332:       Object.values(evidence.cleanup).some((value) => value !== true) ||
1333:       evidence.isolation.parentDatabaseUrlAbsent !== true ||
1334:       evidence.isolation.replitVariablesAbsent !== true ||
1335:       evidence.isolation.noPublishedPorts !== true ||
1336:       evidence.isolation.internalNetwork !== true ||
1337:       evidence.isolation.testContainerNoSocket !== true ||
1338:       evidence.isolation.testContainerNoExternalRoute !== true ||
1339:       evidence.isolation.heliumdbContacted !== false ||
1340:       evidence.isolation.productionContacted !== false
1342:       throw new Error("Passed evidence does not satisfy the TI-03 acceptance contract");
1344:   } else if (typeof evidence.failurePhase !== "string" || evidence.failurePhase.length === 0) {
1345:     throw new Error("Failed evidence must identify its failure phase");
1349: async function writeEvidence(evidence, fileIdentity = state.runId, trusted = null) {
1350:   const directory = path.join(implementationRoot, "docs/governance/evidence");
1353:   validateEvidenceContract(evidence, trusted);
1354:   const serialized = `${sanitizeEvidence(evidence)}\n`;
1403:     throw new Error("API-role negative privilege evidence was incomplete");
1407:   await cleanupDatabase();
1409:   const evidence = {
1465:     cleanup: {
1472:     isolation: {
1485:   state.evidence = await writeEvidence(evidence, state.runId, trusted);
1489:       path: path.relative(implementationRoot, state.evidence.file),
1490:       sha256: state.evidence.sha256,
1495: export { buildTrustedEvidenceContext, validateEvidenceContract };
1508:     await cleanupDatabase();
1509:   } catch (cleanupError) {
1511:       failure = cleanupError;
1512:       failurePhase = "cleanup";
1514:     console.error(`TI-03 cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
1521:       failurePhase = "credential-cleanup";
1524:       `TI-03 credential cleanup failed: ${
1541:       cleanup: {
1548:       isolation: {
1561:       state.evidence = await writeEvidence(
1568:           path: path.relative(implementationRoot, state.evidence.file),
1569:           sha256: state.evidence.sha256,
1572:     } catch (evidenceError) {
1574:         `TI-03 failure evidence write failed: ${
1575:           evidenceError instanceof Error ? evidenceError.message : String(evidenceError)
1584: if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {

## Evidence files

