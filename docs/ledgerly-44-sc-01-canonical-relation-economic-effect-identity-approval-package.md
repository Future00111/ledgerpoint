# #44-SC-01 Canonical Relation Economic-Effect Identity — Implementation Approval Package

**Status:** PLANNING / APPROVAL ONLY — NO IMPLEMENTATION AUTHORISED  
**Proposed sub-task:** `#44-SC-01 — Canonical Relation Economic-Effect Identity`  
**Parent:** `#44 — Canonical Posting Safety Enforcement`  
**Dependency:** `#44-RS-01 — Development Database Role Separation`  
**Scope:** Development schema and canonical posting service only  
**Governance baseline:** DEC-01 through DEC-22 APPROVED  
**Decision requested:** Approval to implement this exact schema/service amendment

> This document is planning and approval material only. It does not modify
> application code, schema, data, roles, secrets, `DATABASE_URL`, workflows,
> deployments, production, or project-task state.

## 1. Purpose

#44-SC-01 resolves the confirmed schema mismatch between the approved #44
correction/reversal identity contract and the current canonical relation table.

The approved #44 identity requires each correction or reversal relation to carry
the same company-scoped `economic_effect_id` as its posting effect. The current
relation table does not contain that field, so the approved correction/reversal
identity index cannot yet be created exactly as designed.

This is a narrow schema/service amendment. It is not a new accounting policy,
does not create DEC-23, and does not authorize any unrelated workflow,
role-separation change, production change, or historical migration.

## 2. Verified current development state

The following state was confirmed through read-only inspection.

### 2.1 Posting-effect identity

`accounting_posting_effects.economic_effect_id` is:

- SQL type: `text`;
- PostgreSQL type: `pg_catalog.text`;
- `NOT NULL`;
- no default; and
- covered by the existing non-partial unique index
  `accounting_posting_effects_company_effect_idx` on
  `(company_id, economic_effect_id)`.

The existing effect table also has:

- primary key `accounting_posting_effects_pkey` on `id`;
- unique index on `(company_id, idempotency_key)`;
- non-unique index on `(company_id, source_type, source_id)`; and
- a status check allowing only `pending`, `posted`, or `uncertain`.

`journal_id` is nullable and is finalized later in the posting transaction. It
is not a suitable identity reference for this amendment.

### 2.2 Current relation identity

`canonical_journal_relations` currently contains:

| Column | SQL type | PostgreSQL type | Nullability | Default |
|---|---|---|---|---|
| `company_id` | `uuid` | `pg_catalog.uuid` | `NOT NULL` | none |
| `original_journal_id` | `uuid` | `pg_catalog.uuid` | `NOT NULL` | none |
| `related_journal_id` | `uuid` | `pg_catalog.uuid` | `NOT NULL` | none |
| `relation_type` | `text` | `pg_catalog.text` | `NOT NULL` | none |
| `idempotency_key` | `text` | `pg_catalog.text` | `NOT NULL` | none |

It does not currently contain `economic_effect_id`.

Current relation constraints and indexes are:

- primary key on `id`;
- foreign key `canonical_journal_relations_original_fk` from
  `original_journal_id` to `canonical_journal_entries(id)`;
- foreign key `canonical_journal_relations_related_fk` from
  `related_journal_id` to `canonical_journal_entries(id)`;
- check constraint requiring `relation_type` to be `reversal` or `correction`;
- unique index on `(company_id, related_journal_id)` named
  `canonical_journal_relations_company_effect_idx`; and
- non-unique index on `(company_id, original_journal_id)` named
  `canonical_journal_relations_company_original_idx`.

The existing `(company_id, related_journal_id)` unique index remains valid and
must be retained. It prevents one related journal from being linked through
multiple relation rows.

### 2.3 Current relation data

The current development row count is:

```text
canonical_journal_relations: 0
```

There are no relation rows requiring historical backfill. This empty-table
assumption must be verified again immediately before implementation DDL.

## 3. Selected schema design

Add the following column to `canonical_journal_relations`:

```sql
economic_effect_id TEXT NOT NULL
```

The field is an identity/provenance field, not caller-provided metadata. Its
value must be the exact `economic_effect_id` stored on the same
company-scoped `accounting_posting_effects` row used by the canonical
correction or reversal transaction.

The field must not be replaced by:

- `idempotency_key`;
- `related_journal_id`;
- `journal_id`;
- a caller-supplied identity; or
- a newly invented relation-specific identity.

The selected `NOT NULL` definition is safe for the current development table
because its row count is zero. It is not safe to apply unless the zero-row
assumption is rechecked immediately before DDL.

## 4. Authoritative identity source

The authoritative value is:

```text
accounting_posting_effects.economic_effect_id
```

from the same posting-effect record used by the canonical transaction.

The current canonical service already inserts or resolves the posting effect
before inserting the relation:

1. the effect is claimed or inserted;
2. the canonical journal header is inserted;
3. canonical lines are inserted;
4. the correction/reversal relation is inserted;
5. audit evidence is inserted; and
6. the posting effect is finalized.

The minimum writer change is therefore to populate the new relation field from
the resolved effect record, not directly from an independent relation input:

```text
economic_effect_id = input.effect.economic_effect_id
```

The service must continue to validate the command/effect identity through the
existing effect-resolution and retry-identity checks. The relation writer must
not accept a separate `economic_effect_id` argument from a caller.

The canonical journal header may continue to use the command identity because
the command is validated against the resolved effect identity. For the relation
specifically, the resolved effect record is the authoritative source.

## 5. Referential-integrity design

### 5.1 Exact relationship

The new relation field will participate in this company-scoped relationship:

```text
canonical_journal_relations(company_id, economic_effect_id)
  REFERENCES
accounting_posting_effects(company_id, economic_effect_id)
```

The exact foreign-key columns are:

```text
canonical_journal_relations.company_id
canonical_journal_relations.economic_effect_id
```

The exact referenced columns are:

```text
accounting_posting_effects.company_id
accounting_posting_effects.economic_effect_id
```

### 5.2 Supporting unique key

The existing non-partial unique index
`accounting_posting_effects_company_effect_idx` on
`(company_id, economic_effect_id)` is the supporting referenced key.

The implementation must verify that PostgreSQL accepts this existing
non-partial unique index as the referenced key for the composite foreign key.
If the actual database requires a declared unique constraint instead, stop:
converting or replacing the existing key requires an explicit implementation
decision and must not be improvised.

No duplicate supporting index may be added.

### 5.3 Update and delete behavior

The selected foreign-key behavior is:

```text
ON UPDATE RESTRICT
ON DELETE RESTRICT
```

This makes effect identity changes or effect deletion unavailable while a
relation references the effect. It is compatible with append-only accounting:

- effect identity is immutable;
- relation identity is immutable;
- corrections and reversals are additive;
- no relation is repaired by changing its effect identity; and
- no posting effect is deleted to remove a historical relation.

If PostgreSQL rejects the explicit `RESTRICT` action for the selected DDL
shape, implementation must stop rather than silently use a different
referential behavior.

### 5.4 Insert ordering

The canonical transaction must insert or resolve the posting effect before
inserting the relation. The required order is:

1. claim or insert the company-scoped posting effect;
2. obtain the resolved effect row and its authoritative
   `economic_effect_id`;
3. insert the canonical journal header;
4. insert canonical journal lines;
5. insert the relation with the resolved effect identity;
6. insert audit evidence; and
7. finalize the posting effect.

The relation and effect are part of the same transaction. A relation cannot
reference an effect created in a separate committed transaction as a fallback.

### 5.5 Why `journal_id` is excluded

`accounting_posting_effects.journal_id` may be null until finalization. Using it
would make relation identity dependent on a later mutable lifecycle field and
would not enforce the approved company-scoped economic-effect identity.

The composite `(company_id, economic_effect_id)` key exists before finalization
and remains stable through the append-only lifecycle.

## 6. Exact correction/reversal indexes

### 6.1 One reversal per original

Add this partial unique index:

```sql
CREATE UNIQUE INDEX
  canonical_journal_relations_one_reversal_per_original_idx
ON public.canonical_journal_relations (company_id, original_journal_id)
WHERE relation_type = 'reversal';
```

This enforces one reversal relation per company-scoped original journal.

### 6.2 Correction/reversal identity

Add this unique index:

```sql
CREATE UNIQUE INDEX
  canonical_journal_relations_identity_idx
ON public.canonical_journal_relations
  (company_id, original_journal_id, economic_effect_id, relation_type);
```

This enforces one relation for each company, original journal,
economic-effect identity, and relation type.

The existing unique index on `(company_id, related_journal_id)` must be
retained. It remains a separate invariant and is not silently removed,
renamed, or repurposed.

### 6.3 Supporting locked lookup

The existing non-unique index on `(company_id, original_journal_id)` supports
locked original-journal relation checks and must be retained. The partial
reversal index also supports the reversal uniqueness check.

No additional lookup index is required by this amendment unless the actual
query plan demonstrates a narrowly scoped need during implementation. A new
index for performance would require separate approval if it is not one of the
three explicitly listed indexes.

## 7. Minimum application/service change

The minimum source change is limited to identity propagation.

### 7.1 Database schema model

Add `economic_effect_id` to the Drizzle definition of
`canonicalJournalRelationsTable` as a required `text` field, matching the
database definition:

```text
economic_effect_id: text("economic_effect_id").notNull()
```

No other table or product model is changed.

### 7.2 Relation insert path

In the existing canonical relation insert path, add the field and derive it
from the resolved effect:

```text
economic_effect_id: input.effect.economic_effect_id
```

The command shape must not gain a caller-controlled relation identity field.
No route, generic CRUD path, browser state, AI output, or source adapter may
write this value independently.

### 7.3 Scope restrictions

The service change must not change:

- accounting policy;
- correction policy;
- reversal policy;
- period behavior;
- financial-year behavior;
- configuration behavior;
- source-freshness policy;
- company authorization;
- BL-01-FI membership resolution;
- VAT behavior;
- downstream workflows;
- role separation; or
- production posting status.

The existing canonical service remains the sole server-side writer for
correction and reversal relations.

### 7.4 Additional dependencies

The current relation schema change necessarily requires the corresponding
Drizzle schema and canonical service insert change. These are part of SC-01
and are not separate product work.

Any need for a new route, new product table, new provider, new authorization
rule, migration/backfill, role change, or broader service refactor is outside
SC-01 and requires a separate approval.

## 8. Transactional behavior

The new field must participate in the same canonical transaction as:

- posting-effect claim or insert;
- canonical journal header insert;
- canonical journal line inserts;
- relation insert;
- audit evidence insert; and
- posting-effect finalization.

The transaction must roll back atomically if:

- the resolved effect identity does not match the relation identity;
- `company_id` does not match;
- the referenced effect does not exist;
- the composite foreign key fails;
- either new identity index is violated;
- the existing related-journal uniqueness is violated;
- the relation insert fails; or
- audit or effect finalization fails after the relation is staged.

No partial journal, line, relation, effect, or success audit state may remain.

The relation field does not create a new transaction boundary and does not
change the existing original-journal locking requirement from #44.

## 9. Safest implementation sequence

This sequence is proposed for a future separately approved implementation. It
is not being executed by this planning package.

1. Confirm the implementation approval covers SC-01 only and does not include
   RS-01, production, or unrelated schema changes.
2. Confirm production posting remains disabled.
3. Confirm the development database is reachable.
4. Verify the current relation table row count is still exactly zero
   immediately before DDL.
5. If the relation table is not empty, stop. Do not backfill, transform, or
   reinterpret any relation rows.
6. Verify the existing posting-effect unique index has exact columns
   `(company_id, economic_effect_id)`, is non-partial, and has no expression
   columns.
7. Add `economic_effect_id TEXT NOT NULL` to
   `canonical_journal_relations`. Because the table was just verified empty,
   no default and no historical backfill are needed.
8. Add the composite foreign key from
   `(company_id, economic_effect_id)` to the same columns on
   `accounting_posting_effects`, with `ON UPDATE RESTRICT` and
   `ON DELETE RESTRICT`.
9. Add the partial one-reversal-per-original unique index.
10. Add the correction/reversal identity unique index.
11. Confirm the existing `(company_id, related_journal_id)` unique index and
    `(company_id, original_journal_id)` lookup index remain present and
    unchanged.
12. Update the Drizzle schema model with the required field.
13. Update only the canonical relation insert path to copy the resolved
    posting-effect identity.
14. Run schema validation and type checks.
15. Run focused relation/effect identity tests against an isolated development
    fixture.
16. Run existing canonical posting, correction, reversal, and company-isolation
    tests.
17. Assert final database state after successful and failed cases.
18. Verify no legacy `journal_entries` data was changed.
19. Verify no production state, role, secret, `DATABASE_URL`, workflow,
    deployment, or posting state changed.
20. Submit the implementation for independent post-implementation review.

The order deliberately adds the database column before the writer changes,
while the table is empty, then adds referential and uniqueness enforcement
before exercising the new writer. There is no compatibility period in which
new relation rows may omit the identity.

## 10. Mandatory test matrix

All tests must verify final database state, not merely returned errors.

### 10.1 Identity propagation

1. A correction relation stores exactly the `economic_effect_id` of its
   posting effect.
2. A reversal relation stores exactly the `economic_effect_id` of its posting
   effect.
3. A caller cannot override the server-derived relation identity.
4. A direct relation insert omitting `economic_effect_id` fails.
5. A relation with a nonexistent effect identity fails.
6. A Company A relation cannot reference a Company B posting effect.
7. A relation/effect `company_id` mismatch fails.

### 10.2 Uniqueness and relation policy

8. Retrying the same correction identity resolves safely without a second
   relation or effect.
9. Retrying the same reversal identity resolves safely without a second
   relation or effect.
10. A different identity attempting a second reversal of the same original is
    rejected.
11. Multiple distinct corrections follow the already-approved #44 policy.
12. The existing unique `(company_id, related_journal_id)` invariant remains
    enforced.
13. The existing original-journal lookup index remains present.

### 10.3 Atomicity and rollback

14. An identity mismatch causes the full transaction to roll back.
15. A failed relation insert leaves no orphan journal.
16. A failed relation insert leaves no posted posting-effect result.
17. A failed relation insert leaves no success audit evidence.
18. A foreign-key failure leaves the original journal unchanged.
19. A uniqueness failure leaves no partial correction/reversal state.

### 10.4 Regression and validation

20. Existing canonical posting tests remain passing.
21. Existing correction tests remain passing.
22. Existing reversal tests remain passing.
23. Existing Company A/B isolation tests remain passing.
24. Schema validation passes.
25. Type checks pass.
26. `git diff --check` passes.
27. Legacy JSON `journal_entries` data remains unchanged.
28. Production posting remains disabled.

## 11. Empty-table and nullability safety

The empty-table fact removes the historical backfill requirement, but it does
not remove the need for a guarded migration.

Immediately before DDL, implementation must execute a read-only count and stop
if the result is not zero. The result must be captured as non-secret
verification evidence.

The migration must not use:

- an invented placeholder identity;
- a default `economic_effect_id`;
- a backfill from `idempotency_key`;
- a backfill from `related_journal_id`;
- a backfill from `journal_id`;
- a backfill from caller input; or
- a reinterpretation of an existing relation.

If any relation row exists at execution time, return for explicit review.
Do not make the column nullable merely to avoid the stop condition.

## 12. Rollback and recovery

### 12.1 Before relation data exists

If implementation fails before any canonical relation data is created, and the
development relation table is reverified as empty, the additive schema change
may be reversed by an administrative rollback that:

1. removes the new correction/reversal identity index;
2. removes the new partial reversal index;
3. removes the new composite foreign key; and
4. removes only the newly added `economic_effect_id` column.

The existing primary key, existing foreign keys, existing unique
`(company_id, related_journal_id)` index, and existing
`(company_id, original_journal_id)` index must remain intact.

The service/schema source changes must be reverted consistently with the
database state. No canonical or legacy data may be deleted.

### 12.2 After relation data exists

Once relation rows exist under SC-01, do not casually drop the column or
indexes. A rollback must preserve the relation data and approved identity
semantics. It must use a separately reviewed forward migration or a schema
checkpoint, not destructive data removal.

If the writer fails after deployment:

- disable the affected canonical posting path;
- preserve committed canonical rows, relations, effects, and audit evidence;
- resolve uncertain outcomes through the existing effect identity;
- do not delete or rewrite accounting history; and
- keep production posting disabled.

### 12.3 Legacy and production protection

Rollback must not:

- alter legacy `journal_entries`;
- perform historical backfill;
- change production schema or data;
- change production credentials;
- enable production posting; or
- weaken the selected identity contract.

## 13. Risks and stop conditions

### Risks

- The table may no longer be empty when implementation begins.
- A referenced-key compatibility issue may prevent the existing unique index
  from supporting the composite foreign key.
- A writer path may be discovered that inserts relations outside the canonical
  service.
- A test or fixture may supply an independently controlled relation identity.
- Existing relation data may appear between the pre-DDL count and DDL.
- The existing unique index names may be relied on by tooling and must not be
  changed casually.
- A failed partial implementation could leave code and schema out of sync.

### Mandatory stop conditions

Stop immediately if:

- `canonical_journal_relations` has any row before DDL;
- an automatic or invented backfill appears necessary;
- the existing posting-effect unique index cannot support the selected
  composite reference without an unapproved change;
- a relation cannot be populated from the resolved posting-effect record;
- a caller can override or supply the relation identity;
- the application requires a nullable field for an unapproved compatibility
  path;
- a relation/effect company mismatch cannot be rejected by the database;
- the service needs a broader refactor than identity propagation;
- the existing unique relation index would need to be removed or repurposed;
- the implementation would require roles, `DATABASE_URL`, secrets, workflows,
  deployment, production, RLS, new product tables, or unrelated schema work;
- any canonical or legacy data would need to be changed to make the migration
  pass; or
- production posting would need to be enabled for verification.

Do not substitute `idempotency_key`, `related_journal_id`, `journal_id`, a
nullable field, an application-only check, or a broad database privilege for
the selected design.

## 14. #44-RS-01 dependency

#44-RS-01 remains blocked until all of the following are complete:

- #44-SC-01 is explicitly approved;
- #44-SC-01 is implemented within this exact scope;
- #44-SC-01 passes its schema, service, identity, integrity, and regression
  verification;
- an independent post-implementation review passes; and
- the existing RS-01 approval is separately confirmed for retry.

SC-01 and RS-01 must not be combined into one implementation. SC-01 does not
create `ledgerly_api`, does not create `ledgerly_canonical_owner`, does not
transfer ownership, does not revoke privileges, and does not change
`DATABASE_URL` or secrets.

After SC-01 passes review, RS-01 may be retried under its existing package and
approval. Its empty-table and schema verification must include the new
relation column, foreign key, and indexes.

## 15. Production boundary

SC-01 is development-only. It does not authorize:

- production schema changes;
- production data changes;
- production credentials or secrets;
- production `DATABASE_URL` changes;
- deployment or publishing;
- production posting;
- historical migration or backfill;
- cutover;
- RLS;
- source, period, financial-year, mapping, or configuration product tables;
- invoice, bill, payment, allocation, refund, bank, reconciliation, VAT,
  reporting, or year-end workflows;
- BL-06 or BL-07 implementation; or
- #41 execution.

Production posting remains disabled until the complete #44 safety boundary,
including role separation, final transactional revalidation, independent
review, and production-readiness review, is separately established.

## 16. Governance and status

- DEC-01 through DEC-22 remain approved.
- DEC-23 does not exist and is not created by SC-01.
- DEC-04 remains authoritative for immutable canonical accounting.
- DEC-12 remains exclusively the Payment, Allocation and Settlement Policy.
- Source freshness remains implementation-level and cross-cutting.
- BL-01-FI remains complete.
- #40-CF-01 remains incomplete.
- #44 remains incomplete.
- #44-RS-01 remains blocked pending SC-01 approval, implementation,
  verification, and independent review.
- BL-06 remains blocked.
- BL-07 remains blocked.
- #41 remains planning-only.
- Production posting remains disabled.

This package is an engineering/schema correction supporting the already-approved
#44 identity model. It is not a new accounting or product-policy decision.

## 17. Definition of done

SC-01 is complete only when:

- `canonical_journal_relations.economic_effect_id` exists as `TEXT NOT NULL`;
- the field is populated only from the resolved posting-effect identity;
- the composite foreign key has the exact selected columns and
  `RESTRICT` behaviors;
- the existing posting-effect company/effect unique key remains intact;
- the one-reversal-per-original partial unique index exists;
- the correction/reversal identity unique index exists;
- the existing related-journal unique index remains intact;
- the existing original-journal lookup index remains intact;
- relation and effect company mismatches fail at the database boundary;
- missing/nonexistent identities fail;
- caller override attempts cannot succeed;
- relation, effect, journal, line, and audit writes remain atomic;
- existing canonical posting, correction, reversal, and isolation tests pass;
- schema validation, type checks, and diff checks pass;
- the empty-table assumption was verified before DDL;
- no historical relation backfill was performed;
- legacy JSON journal data remains untouched;
- no role, secret, `DATABASE_URL`, workflow, production, deployment, or
  publishing state changed;
- production posting remains disabled; and
- an independent post-implementation review passes.

## 18. Final verdict

READY FOR #44-SC-01 IMPLEMENTATION APPROVAL