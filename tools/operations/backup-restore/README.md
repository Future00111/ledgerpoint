# Synthetic encrypted archive rehearsal

`archive.mjs` wraps an existing synthetic file (including a disposable `pg_dump`
archive) using Node's AES-256-GCM implementation. It opens no database/network
connection. Current limit: 64 MiB plaintext, buffered in memory. This is not a
production backup service, retention system or off-site destination.

Provide a separate file containing exactly 32 cryptographically random key bytes.
Do not put key bytes in arguments, logs, source control or the archive. Keep the
key outside the backup destination; operational custody/rotation remain unresolved.
Both input and key must be regular files without final-component symlinks.
Use parent directories controlled exclusively by the rehearsal operator. This
utility does not secure attacker-writable parent directories or prevent parent
symlink/path replacement races; it is not a multi-user upload endpoint.

```sh
node tools/operations/backup-restore/archive.mjs encrypt synthetic.dump synthetic.dump.enc /secure/separate-key --synthetic-only
node tools/operations/backup-restore/archive.mjs decrypt synthetic.dump.enc fresh-restored.dump /secure/separate-key --synthetic-only
node --test tools/operations/backup-restore/*.test.mjs
```

Outputs must not exist. Decryption authenticates before creating restored bytes.
An error never substitutes a new key, overwrites the source, or treats an unknown
outcome as success. The source plaintext is intentionally retained: the caller
owns its isolated rehearsal cleanup. Wrapper tests use a synthetic JSON bundle
containing role, job, audit and original attachment bytes; they do not restore
PostgreSQL roles/schema or prove full database recovery.

The separate-cluster rehearsal below connects encryption to PostgreSQL.
Extending it to the complete populated application schema and validating
representative recovery time are still required. See `docs/operations/recovery-targets.json` for unresolved targets,
ownership and external provisioning gates.

## Separate-cluster encrypted PostgreSQL rehearsal

Run `node tools/operations/backup-restore/rehearsal.mjs` as a non-root development
user with PostgreSQL binaries on PATH. The CLI accepts no arguments, ignores
ambient database credentials, and creates two fresh socket-only clusters. It
backs up representative synthetic binary attachment, pending job and audit tables,
encrypts the pg_dump, authenticates and decrypts it, and feeds only recovered bytes
to pg_restore in the second cluster. An explicit synthetic least-privilege role is
recreated. Rows, constraints, indexes, triggers, functions, ownership, grants and
role memberships must match. Three negative controls deliberately remove a source
foreign key, add a role membership, or grant audit deletion; each must change the
fingerprint and roll back to the original recovered state. An attempted audit
deletion under the restored reader must remain denied. Both clusters and the temporary key/archive directory are
removed before success. CI checks the current-commit receipt at
`generated-artifacts/encrypted-recovery.json`.

This executable verifies the encryption/restore connection and fresh-cluster role
and grant restoration for representative fixtures. It does not replace the full
application restore drill, restore real customers, establish operational RTO/RPO,
or qualify off-site storage, custody, retention or production recovery. The
recorded elapsed duration is only the complete tiny synthetic rehearsal duration.
