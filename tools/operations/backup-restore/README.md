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
node --test tools/operations/backup-restore/archive.test.mjs
```

Outputs must not exist. Decryption authenticates before creating restored bytes.
An error never substitutes a new key, overwrites the source, or treats an unknown
outcome as success. The source plaintext is intentionally retained: the caller
owns its isolated rehearsal cleanup. Wrapper tests use a synthetic JSON bundle
containing role, job, audit and original attachment bytes; they do not restore
PostgreSQL roles/schema or prove full database recovery.

Integrating this wrapper with `tools/accounting-flow/restore-drill.mjs`, restoring
to a fresh PostgreSQL cluster, and validating representative recovery time are
still required. See `docs/operations/recovery-targets.json` for unresolved targets,
ownership and external provisioning gates.
