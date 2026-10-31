// Run a corrupt-restore negative control without committing the altered fixture.
// Only the caller's proved disposable connection is used; no connection is opened.
export async function proveRecoveryControl(client, baseline, sql, fingerprint) {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    // The reused database verifier owns BEGIN/COMMIT. Map that inner transaction
    // to a savepoint so its COMMIT cannot persist this deliberately corrupt state.
    const scoped = { query: async (query, ...args) => {
      if (query === 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY') return client.query('SAVEPOINT recovery_fingerprint');
      if (query === 'COMMIT') return client.query('RELEASE SAVEPOINT recovery_fingerprint');
      if (query === 'ROLLBACK') {
        await client.query('ROLLBACK TO SAVEPOINT recovery_fingerprint');
        return client.query('RELEASE SAVEPOINT recovery_fingerprint');
      }
      return client.query(query, ...args);
    } };
    if (await fingerprint(scoped) === baseline) throw new Error('Recovery control corruption escaped fingerprint.');
  } finally { await client.query('ROLLBACK'); }
  if (await fingerprint(client) !== baseline) throw new Error('Recovery negative control did not preserve restored fixture.');
}
