// Only the restored scratch copy used by the accounting-flow rehearsal can be upgraded.
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { checkInstalledMigrationHistory, expectedMigrationHistory, loadMigrationInputs } from './registry.mjs';

async function requireDisposableCopy(client, socket, database) {
  if (!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]{6}\/socket$/.test(socket) ||
      realpathSync(socket) !== socket || realpathSync(path.dirname(socket)) !== path.dirname(socket))
    throw Error('Disposable upgrade socket required');
  const { rows:[identity] } = await client.query(`SELECT current_database() AS database,current_user AS actor,
    inet_server_addr() AS address,current_setting('data_directory') AS directory`);
  if (identity.database !== database || identity.actor !== 'w03_bootstrap' ||
      identity.address !== null || identity.directory !== path.join(path.dirname(socket),'data'))
    throw Error('Disposable upgrade copy required');
}

export async function rehearseAmendmentUpgrade(client, socket, root) {
  await requireDisposableCopy(client, socket, 'ledgerly_upgrade_copy_test');
  const inputs = loadMigrationInputs(root);
  const original = new Set(expectedMigrationHistory(inputs).map(row=>row.id));
  const additions = expectedMigrationHistory(inputs,{includeAmendments:true}).filter(row=>!original.has(row.id));
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(17428,3003)');
    await checkInstalledMigrationHistory(client,inputs);
    const { rows:[existing] } = await client.query(`SELECT to_regclass('public.accounting_document_amendments') AS amendments,
      to_regclass('public.accounting_document_amendment_heads') AS heads`);
    if (existing.amendments || existing.heads) throw Error('Unexpected partial amendment schema');
    for (const row of additions) {
      await client.query(inputs[row.id]);
      await client.query(`INSERT INTO public.schema_migrations(id,sha256,contract_version,dependencies)
        VALUES ($1,$2,$3,$4::jsonb)`,[row.id,row.sha256,row.contract_version,JSON.stringify(row.dependencies)]);
    }
    await checkInstalledMigrationHistory(client,inputs,{includeAmendments:true});
    await client.query('COMMIT');
    return additions.map(row=>row.id);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}


export async function rehearsePayRevisionUpgrade(client, socket, root) {
  await requireDisposableCopy(client, socket, 'ledgerly_pay_revision_upgrade_copy_test');
  const inputs = loadMigrationInputs(root);
  const profile = {includeAmendments:true, includePayRevisions:true};
  const migration = expectedMigrationHistory(inputs,profile).find(row => row.id === 'pay-run-draft-revisions');
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(17428,3003)');
    await checkInstalledMigrationHistory(client,inputs,{includeAmendments:true});
    await client.query(inputs[migration.id]);
    await client.query(`INSERT INTO public.schema_migrations(id,sha256,contract_version,dependencies)
      VALUES ($1,$2,$3,$4::jsonb)`,[migration.id,migration.sha256,migration.contract_version,JSON.stringify(migration.dependencies)]);
    await checkInstalledMigrationHistory(client,inputs,profile);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
