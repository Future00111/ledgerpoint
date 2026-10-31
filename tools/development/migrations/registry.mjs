// Input integrity gate for the existing disposable installer, not an installed-schema attestation.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
export const migrationOrder = Object.freeze([
  'accounting-documents', 'accounting-chart', 'accounting-payments', 'credit-tracking',
  'document-intake', 'paid-credit-operations', 'accounting-document-amendments', 'w03-invoice-drafts',
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
    const dependencies = id === 'w03-invoice-drafts' ? ['accounting-documents']
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
