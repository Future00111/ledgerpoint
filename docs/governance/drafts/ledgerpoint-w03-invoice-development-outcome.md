# W03 — first draft-invoice development slice

Recorded 2026-10-20 UTC. **Development implementation with explicit holds; W03 is not complete.**

## Identity and authorization

- Local branch: `dev/w03-draft-invoice-slice`.
- Exact starting HEAD: `840fbec9f098403c5b3ee27b692a55781c602752`, from `records-planning/w03-contract-review`.
- Authorization: `attached_assets/Pasted-Continue-W03-The-user-has-now-explicitly-asked-Codex-to_1792528315480.txt`, SHA-256 `80573d1c02268a5df8518bfd166cb4ad8be3db239d7fda9fbfc2f2b0f8004744`.
- The commit containing this record identifies the saved implementation; obtain its full file inventory with `git show --stat` and compare it with the starting HEAD.
- G7 acceptance records were checked unchanged against the starting HEAD. Existing G7 acceptance is preserved; it does **not** qualify this development branch or its new invoice workflow.
- No push, merge, hosted qualification, GitHub control write, Environment release, deployment, publishing or Phase A was performed.

## Implemented boundary

Protected create/read-for-edit/edit endpoints:

`/api/companies/:companyId/financial-drafts/invoices[/:id]`

- Owner/Admin/Accountant are the finite active-membership write roles. Manager has no implicit permission; without an implemented approved scope-grant provider it denies. Read-only, unknown, legacy aliases, inactive and duplicate memberships deny.
- Explicit source-only DTOs and strict nested keys; no caller totals, paid amounts, status, tenant, actor or audit identity. GBP quantity and unit-price strings remain exact; decimal grammar and bounds reject numeric JSON and excess precision.
- Server computes net pence using the proposed development rounding contract and composes money only with VAT supplied through a transaction-bound authority interface. No VAT eligibility or tax-rate inference from a label, amount or legacy bank feed.
- Company, membership, customer, invoice and revision checks occur in the transaction. Customer must be active and same-company. Source/lifecycle authority must perform its own approved transaction-bound locks/checks.
- Lifecycle authority is called for creation and the proposed edited source/dates, not just the persisted target. Malformed runtime tax-context identities fail closed. Synthetic closed-period create/edit and malformed-provider controls passed; they do not establish a real period policy.
- Fresh revisions and mandatory `If-Match` for edits. Old revisions conflict rather than overwrite. Atomic invoice/state/audit writes; synthetic audit failure rolls back the invoice write.
- Non-draft/paid documents reject. Missing source-management state returns explicit `LEGACY_DRAFT_REVIEW_REQUIRED`; old invoices are **not** silently adopted.
- Generic SalesInvoice writes, including bulk/delete paths, deny through a shared admission guard and existing per-operation checks.
- The shared single/batch reconciliation settlement sink now rejects draft invoice targets before settlement writes.
- Legacy invoice status-only posting, direct payment updates and development demo generation/document-reset bypasses are held rather than treated as canonical posting.
- The existing form now sends source fields only, uses protected draft APIs and revisions, prevents unsafe retries/stale company responses, removes issue/post/payment authority, and displays explicit holds. Invoice navigation says “Review draft edit”; legacy review does not change historical rows.

## Deliberate holds and schema source

**The application's production-wired service has no VAT/lifecycle authority adapter. It returns `AUTHORITY_UNAVAILABLE` before acquiring a database connection. There is no runtime fixture switch or dummy-success tax provider.**

`lib/db/migrations/w03-invoice-drafts.review.sql` is review-only source for managed draft revisions, tax-context references and append-only audit records. It includes a composite invoice/company reference and a unique active-membership index. Pre-existing duplicate active memberships must cause review failure, not automatic cleanup.

This SQL was applied only to a newly initialized private synthetic PostgreSQL cluster. It was **not** applied to an existing/shared database. Schema-export integration, ownership, least-privilege runtime grants, rollout and legacy-data handling need separate review; do not use an unreviewed schema push to activate it.

The net-rounding contract is labelled `w03.money.dev.v1`, accounting acceptance pending. Synthetic tax/lifecycle providers are test-only fixtures, not an approved accounting authority. Real saving remains held pending those providers and schema/grant acceptance.

## Changed files

The receipt manifest below lists all **47 application/package files**, with SHA-256 per file:

- API: `artifacts/api-server/package.json`; `src/app.ts`; `src/routes/{index,entities,entityWritePolicy,functions,financialDrafts}.ts`; `src/services/ai-accountant/{approval,vat.scenarios.test}.ts`.
- New API service/test directory: `artifacts/api-server/src/services/financialDrafts/` — contract, service, router, JSON boundary, settlement boundary, contract tests, private HTTP/SQL tests and sanitized pure-regression preload.
- Client: `artifacts/ledgerly/src/api/invoiceDrafts.{mjs,test.mjs}` and `src/pages/{InvoiceForm,Invoices}.jsx`.
- API specification/code generation: `lib/api-spec/{openapi.yaml,orval.config.ts}`, generated React client/schema files and generated Zod files/types. Zod generation is explicitly compatible with the existing major version; no major library upgrade.
- Review-only migration source above and `pnpm-lock.yaml`. Only an exact development typing dependency was added; existing runtime dependencies were not upgraded.
- This outcome record and an agent-memory clarification about inherited test preloads are additional non-runtime records.

## Verification results

| Check | Result |
|---|---:|
| Contract, money, roles, strict fields, missing-provider no-connect and settlement guard | 8/8 |
| Explicit client DTO, envelope/revision, safe failures, no retry | 4/4 |
| Private synthetic PostgreSQL + actual protected router HTTP | 8/8 |
| Existing company-scope regression | 16/16 |
| Existing VAT scenarios | 25/25 |
| Existing phase-5 reconciliation scenarios | 14/14 |
| Existing phase-6 reconciliation scenarios | 7/7 |
| **Total** | **82/82; zero skipped in these suites** |
| OpenAPI generation and referenced library build | Passed |
| API and web typechecks | Passed |
| Frontend production build | Passed; existing chunk-size warning |
| API build / development workflow start | Passed |

The private HTTP/SQL suite exercises create/edit/read, exact server totals, audit insertion/immutability, audit-failure rollback, disallowed/inactive roles, foreign/inactive references, unsupported fixture tax, stale/missing revisions, posted linkage/status, legacy review, concurrent-edit conflict and overlapping revocation/save connections. It also exercises the shared generic admission middleware for create/update/delete/bulk requests.

Private PostgreSQL used a fresh data directory and private Unix socket, no TCP listener, a synthetic database and a separately permissioned `ledgerly_api` fixture role. The test child had a sanitized environment, used no ambient database credentials and made no production contact. Cleanup confirmed PostgreSQL stopped and its entire temporary directory was removed. The fixtures deliberately use a reduced schema, synthetic authentication and synthetic source/tax providers.

Earlier failed **harness/check attempts are retained**, not hidden: source-root path resolution, absent AI-constructor fixture key, inherited Pino-worker preload, and the old VAT test expectation that generic invoice writes were allowed. The final harness denies external HTTP, supplies only a conspicuously synthetic invalid constructor key and avoids changing directory in workers. The VAT expectation was changed to require invoice write denial, not weakened.

API/web development workflows were restarted after the initial code batch; the API alone was restarted again after the final lifecycle-context fix. API logs also show the pre-existing development scheduler starting and reporting seven companies; that normal application startup is **not** a disposable-test result or evidence that business data was untouched. No existing/shared schema migration was run.

The signed-out preview rendered the existing Clerk login gate without a fresh browser error. It did **not** inspect the changed signed-in editor. Generated output retains the generator's extra EOF blank-line warnings; the non-generated diff whitespace check passed.

## AI code/security review and remaining verification gaps

One requested architect AI review initially returned **FAIL**, identifying the shared settlement bypass, legacy edit handling and insufficient whole-app negative-path coverage. It was not independent-human review.

1. Settlement finding: added a shared draft-invoice denial at the real approval sink used by single and batch callers; guard unit regression passed. No claim that the full authenticated legacy reconciliation endpoints were exercised.
2. Legacy finding: explicit review-required response and navigation wording; real private SQL/HTTP legacy/posted/unknown-ID tests passed. No automatic adoption/migration.
3. Coverage finding: added real HTTP checks for the shared generic mutation admission guard and explicit posted/legacy cases. Full real-app routing, real Clerk sessions and all single/batch approval endpoints remain an integration-test gap.

Fixes were checked by the implementing AI and local tests; the architect was not rerun and no unconditional security sign-off is claimed. Human security/accounting reviewer assignment remains **TBD**.

No old G3 skips, canonical qualification, bill editor, membership administration, scoped Manager grants, broad invoice lifecycle or production behavior are covered by the 82 tests. No historical G3 skip was converted into a success claim. No new canonical qualification was run.

## Saved receipts and reproduction

Directory: `generated-artifacts/w03-invoice-development/`.

- `source-and-check-receipts.json` SHA-256: `7c41737adbaabeebfec97ef22a2ed1b2c461b2cb370f8b8f794a03624a502314`.
- Manifest binds the 47 exact source/package files and successful/failed check-log hashes. It also binds the signed-out screenshot and startup logs. Generated outputs remain outside Git, as required.
- Cleanup receipt: `generated-artifacts/w03-development-cleanup.json`.
- Tests are committed as source, including private PostgreSQL bootstrap/cleanup.

From the workspace root, bundle API tests using the package-local esbuild, CommonJS, then invoke the resulting absolute path with `node --test`. Unit entry: `src/services/financialDrafts/contract.test.ts`. Private SQL/HTTP entry: `src/services/financialDrafts/invoice.integration.test.ts`, with `pg` and `express` external and output under the API package's `node_modules/.cache/`. Launch that SQL/HTTP child with `env -i PATH="$PATH" HOME=/tmp W03_WORKSPACE="$PWD"`; it creates and destroys its own cluster and must never receive `DATABASE_URL`.

Client command: `node --test artifacts/ledgerly/src/api/invoiceDrafts.test.mjs`.

For existing pure scenario bundles keep Pino runtime packages external; use the committed `pureRegressionSetup.mjs` preload in a sanitized child. Their only database URL was a deliberately nonexistent private socket, not a real database. The preload supplies no usable API credential and denies external HTTP.

## Next smallest action

Review the exact VAT/lifecycle adapter and schema/grant contracts against current approved accounting/write boundaries, resolve accounting acceptance and assign the real reviewers. Then implement/verify those adapters in an isolated development fixture and close full signed-in app/approval-endpoint test gaps. Any actual schema application or workflow activation needs its own authorization. Purchase-bill work follows the invoice boundary; do not mark W03 complete or proceed to Phase A from this result.
