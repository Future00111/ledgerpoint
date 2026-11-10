// Input integrity gate for the existing disposable installer, not an installed-schema attestation.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
export const migrationOrder = Object.freeze([
  'accounting-documents', 'accounting-chart', 'accounting-payments', 'credit-tracking',
  'document-intake', 'paid-credit-operations', 'accounting-document-amendments', 'w03-invoice-drafts', 'conditional-discount-agreements',
  'conditional-discount-compensations',
  'conditional-discount-replacements',
  'conditional-discount-cash-reversal',
  'conditional-discount-replacement-observations',
  'conditional-discount-capacity-origins',
  'conditional-discount-corrected-observations',
  'conditional-discount-commercial-credits',
  'bank-imports',
  'bank-openings',
  'bank-statement-matches',
  'bank-import-review-authority',
  'bank-import-canonical-history',
  'bank-match-corrections',
]);
const fail = code => { throw Object.assign(new Error(code), { code }); };
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function validateMigrationInputs(registry, readBytes) {
  if (!registry || registry.version !== 2 || registry.authority !== 'disposable-rehearsal-only'
      || !Array.isArray(registry.migrations) || registry.migrations.length !== migrationOrder.length)
    fail('MIGRATION_REGISTRY_INCOMPATIBLE');
  const verified = {};
  for (const [index, id] of migrationOrder.entries()) {
    const item = registry.migrations[index];
    const expectedPath = `lib/db/migrations/${id}.review.sql`;
    const dependencies = id === 'bank-statement-matches' ? ['bank-imports','bank-openings'] : id === 'bank-openings' ? ['accounting-payments'] : id === 'bank-imports' ? ['accounting-documents'] : id === 'conditional-discount-corrected-observations' ? ['conditional-discount-capacity-origins','accounting-document-amendments']
      : id === 'conditional-discount-capacity-origins' ? ['conditional-discount-replacement-observations']
      : id === 'conditional-discount-replacement-observations' ? ['conditional-discount-replacements','conditional-discount-cash-reversal']
      : id === 'conditional-discount-replacements' ? ['conditional-discount-agreements']
      : id === 'conditional-discount-cash-reversal' ? ['conditional-discount-compensations']
      : id === 'conditional-discount-agreements' ? ['accounting-payments', 'paid-credit-operations'] : id === 'w03-invoice-drafts' ? ['accounting-documents']
      : index === 0 ? [] : [migrationOrder[index - 1]];
    if (!item || item.id !== id || item.path !== expectedPath || item.contractVersion !== 1
        || JSON.stringify(item.dependencies) !== JSON.stringify(dependencies)
        || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256))
      fail('MIGRATION_REGISTRY_INCOMPATIBLE');
    let bytes;
    try { bytes = readBytes(item.path); } catch { fail('MIGRATION_SOURCE_UNAVAILABLE'); }
    if (!Buffer.isBuffer(bytes) || sha256(bytes) !== item.sha256) fail('MIGRATION_CHECKSUM_MISMATCH');
    verified[id] = bytes.toString('utf8');
  }
  // Version 2 closes the unpinned security-overlay input used by both installer modes.
  // Version 1 deliberately fails closed rather than silently trusting that input.
  const overlay = registry.securityOverlay;
  if (!overlay || overlay.id !== 'canonical-security-overlay'
      || overlay.path !== 'scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql'
      || overlay.contractVersion !== 1 || typeof overlay.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(overlay.sha256)) fail('MIGRATION_REGISTRY_INCOMPATIBLE');
  let bytes;
  try { bytes = readBytes(overlay.path); } catch { fail('MIGRATION_SOURCE_UNAVAILABLE'); }
  if (!Buffer.isBuffer(bytes) || sha256(bytes) !== overlay.sha256) fail('MIGRATION_CHECKSUM_MISMATCH');
  verified[overlay.id] = bytes.toString('utf8');
  return Object.freeze(verified);
}
export function loadMigrationInputs(root) {
  let registry;
  try { registry = JSON.parse(readFileSync(path.join(root, 'lib/db/migration-registry.json'), 'utf8')); }
  catch { fail('MIGRATION_REGISTRY_UNAVAILABLE'); }
  return validateMigrationInputs(registry, relative => readFileSync(path.join(root, relative)));
}

// This attests installed history only; schema controls require separate verification.
export function expectedMigrationHistory(inputs, { includeAmendments = false } = {}) {
  return [...migrationOrder.filter(id => includeAmendments || !['accounting-document-amendments','conditional-discount-corrected-observations','conditional-discount-commercial-credits'].includes(id)),
    'canonical-security-overlay'].map(id => ({ id, sha256: sha256(Buffer.from(inputs[id])), contract_version: 1,
      dependencies: id === 'canonical-security-overlay' ? ['w03-invoice-drafts']
        : id === 'bank-statement-matches' ? ['bank-imports','bank-openings']
        : id === 'bank-openings' ? ['accounting-payments']
        : id === 'bank-imports' ? ['accounting-documents']
        : id === 'conditional-discount-corrected-observations' ? ['conditional-discount-capacity-origins','accounting-document-amendments']
        : id === 'conditional-discount-agreements' ? ['accounting-payments', 'paid-credit-operations'] : id === 'w03-invoice-drafts' ? ['accounting-documents']
        : migrationOrder.indexOf(id) === 0 ? [] : [migrationOrder[migrationOrder.indexOf(id) - 1]] }));
}
export function validateInstalledMigrationHistory(rows, expected) {
  if (!Array.isArray(rows) || rows.length !== expected.length) fail('MIGRATION_HISTORY_INCOMPATIBLE');
  const byId = new Map(rows.map(row => [row.id, row]));
  if (byId.size !== expected.length) fail('MIGRATION_HISTORY_INCOMPATIBLE');
  for (const entry of expected) {
    const row = byId.get(entry.id);
    if (!row || row.sha256 !== entry.sha256 || row.contract_version !== entry.contract_version
        || JSON.stringify(row.dependencies) !== JSON.stringify(entry.dependencies)) fail('MIGRATION_HISTORY_INCOMPATIBLE');
  }
  return true;
}
export async function checkInstalledMigrationHistory(client, inputs, options) {
  const present = await client.query("SELECT to_regclass('public.schema_migrations') present");
  if (!present.rows[0]?.present) fail('MIGRATION_HISTORY_UNAVAILABLE');
  const { rows } = await client.query('SELECT id,sha256,contract_version,dependencies FROM public.schema_migrations ORDER BY id');
  return validateInstalledMigrationHistory(rows, expectedMigrationHistory(inputs, options));
}
export async function recordInstalledMigrationHistory(client, inputs, options) {
  // Called only inside the fresh installer's transaction, after schema controls pass.
  await client.query(`CREATE TABLE public.schema_migrations (
    id text PRIMARY KEY, sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
    contract_version integer NOT NULL CHECK (contract_version > 0), dependencies jsonb NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT transaction_timestamp()
  );
  CREATE FUNCTION public.ledgerly_migration_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN RAISE EXCEPTION 'Migration history is immutable'; END $$;
  CREATE TRIGGER ledgerly_migration_history_immutable BEFORE UPDATE OR DELETE ON public.schema_migrations
    FOR EACH ROW EXECUTE FUNCTION public.ledgerly_migration_history_immutable();
  CREATE TRIGGER ledgerly_migration_history_no_truncate BEFORE TRUNCATE ON public.schema_migrations
    FOR EACH STATEMENT EXECUTE FUNCTION public.ledgerly_migration_history_immutable();
  ALTER TABLE public.schema_migrations ENABLE ALWAYS TRIGGER ledgerly_migration_history_immutable;
  ALTER TABLE public.schema_migrations ENABLE ALWAYS TRIGGER ledgerly_migration_history_no_truncate;
  REVOKE ALL ON public.schema_migrations FROM PUBLIC,ledgerly_api;
  GRANT SELECT ON public.schema_migrations TO ledgerly_api;`);
  for (const row of expectedMigrationHistory(inputs, options)) await client.query(
    'INSERT INTO public.schema_migrations(id,sha256,contract_version,dependencies) VALUES($1,$2,$3,$4::jsonb)',
    [row.id, row.sha256, row.contract_version, JSON.stringify(row.dependencies)]);
  await checkInstalledMigrationHistory(client, inputs, options);
}
