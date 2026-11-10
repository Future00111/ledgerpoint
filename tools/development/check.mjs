// Current-source checks; no credentials, shared database or provider required.
// PostgreSQL accounting integration runs separately through its disposable runner.
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { validateCatalog, validateState } from './work-queue/core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const catalog = validateCatalog(JSON.parse(readFileSync(path.join(root, 'docs/development/work-backlog.json'), 'utf8')));
validateState(catalog, JSON.parse(readFileSync(path.join(root, 'docs/development/work-state.json'), 'utf8')));
const api = path.join(root, 'artifacts/api-server');
const frontend = path.join(root, 'artifacts/ledgerly/src');
const { buildSync } = createRequire(path.join(api, 'package.json'))('esbuild');
const dir = mkdtempSync(path.join(tmpdir(), 'ledgerpoint-unit-checks-'));
const env = Object.fromEntries(['PATH', 'HOME', 'LANG', 'LC_ALL'].filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
// Some pure membership tests import the database module, but inject their lookup.
// If a test accidentally queries it, only an unusable loopback target is available.
env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/ledgerpoint_no_database';
env.NODE_ENV = 'test';
env.NODE_PATH = path.join(api, 'node_modules');
const apiTests = [
  'src/middlewares/companyScope.test.ts',
  'src/services/bankImportMoney.test.ts',
  'src/services/ai/lazy.test.ts',
  'src/services/financialDrafts/contract.test.ts',
  'src/services/financialDrafts/jsonBoundary.test.ts',
  'src/services/financialDrafts/discounts.test.ts',
  'src/services/accountingDocuments/documentEvents.test.ts',
  'src/services/accountingDocuments/vatCoverage.test.ts',
  'src/services/accountingDocuments/amendmentsMath.test.ts',
  'src/services/auditReview/contract.test.ts',
  'src/security/roles.test.ts',
  'src/security/companyPolicy.test.ts',
  'src/security/companyRoutes.test.ts',
  'src/security/publicErrors.test.ts',
  'src/security/appErrors.test.ts',
  'src/services/creditTracking/domain.test.ts',
  'src/services/documentIntake/intake.test.ts',
  'src/services/documentIntake/service.test.ts',
  'src/services/documentIntake/extraction/contract.test.ts',
  'src/services/documentIntake/extraction/worker.test.ts',
  'src/routes/legacyChartBootstrapPolicy.test.ts',
  'src/routes/conditionalReplacementRoutes.test.ts',
  'src/services/ai-accountant/matcher.scenarios.test.ts',
  'src/services/ai-accountant/collectionsAnalysis.scenarios.test.ts',
  'src/services/ai-accountant/vat.scenarios.test.ts',
];
try {
  for (const [index, entry] of apiTests.entries()) {
    const outfile = path.join(dir, `api-${index}.cjs`);
    buildSync({ entryPoints: [path.join(api, entry)], outfile, bundle: true, platform: 'node', format: 'cjs',
      external: ['pg', 'pino', 'pino-http', 'pino-pretty', 'thread-stream', '@clerk/express'], logLevel: 'warning' });
    execFileSync(process.execPath, ['--test', outfile], { cwd: api, env, stdio: 'inherit' });
  }
  const mjs = [...readdirSync(frontend, { recursive: true }).filter(file => file.endsWith('.test.mjs')).map(file => path.join(frontend, file)),
    ...readdirSync(path.join(api, 'src/services'), { recursive: true }).filter(file => file.endsWith('.test.mjs')).map(file => path.join(api, 'src/services', file)),
    ...readdirSync(path.join(root, 'tools/development/work-queue')).filter(file => file.endsWith('.test.mjs')).map(file => path.join(root, 'tools/development/work-queue', file)),
    path.join(root,'tools/accounting-flow/restore-drill.test.mjs'),
    path.join(root,'tools/payroll-specification/studentLoans.test.mjs')];
  execFileSync(process.execPath, ['--test', ...mjs], { cwd: root, env, stdio: 'inherit' });
  const renders = readdirSync(frontend, { recursive: true }).filter(file => file.endsWith('.test.jsx'));
  for (const [index, entry] of renders.entries()) {
    const outfile = path.join(dir, `ui-${index}.cjs`);
    buildSync({ entryPoints: [path.join(frontend, entry)], outfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
      alias: { '@': frontend }, logLevel: 'warning' });
    execFileSync(process.execPath, ['--test', outfile], { cwd: root, env, stdio: 'inherit' });
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
