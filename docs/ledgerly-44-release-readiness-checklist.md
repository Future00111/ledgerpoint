# Ledgerly release-readiness checklist — evidence snapshot

**2026-09-29. Verdict: NOT RELEASE-READY.** This is a review checklist, not
publication, C2 authority designation or production approval. Source map:
`docs/ledgerly-44-branch-and-runtime-map.md`; protected qualification:
`docs/ledgerly-44-tr-01-c2-status-readiness.md`; synthetic-journey result:
`docs/ledgerly-44-synthetic-accounting-journey-test-report.md`.

| Area | State | Evidence / next gate |
| --- | --- | --- |
| Replit frontend, API, Clerk and Drizzle wiring | **Partial** | Executable routes and artifact configs exist (`artifacts/ledgerly/src/App.jsx`, `artifacts/api-server/src/app.ts`, `lib/db/src/index.ts`). Development services run; no deployed-user acceptance test in this pass. |
| Base44 migration | **Partial** | `artifacts/ledgerly/src/api/base44Client.js` maps calls to local API; `integrations.js` includes no-op stubs. A Base44-shaped call is not proof of feature parity. |
| Company/invoice/payment CRUD | **Partial** | Company creation, invoice entity CRUD, document status and payment-balance updates exist (`routes/companies.ts`, `routes/entities.ts`, `routes/functions.ts`). Not end-to-end accounting. |
| Isolated policy tests | **Working and tested** | Matcher 10/10, collections 3/3, VAT 25/25; synthetic in-memory legacy report arithmetic passed. These ran on the audit branch and make no DB-backed release claim. |
| Canonical posting service | **Partial** | Guarded accounting service exists (`services/accounting/canonicalPosting.ts`), but `postSalesInvoice` only updates status. No accepted protected C2 PostgreSQL run or full business E2E. |
| Invoice → approval → payment → canonical ledger → report | **Blocked** | Invoice form catches a missing journal-generation function; approval does not call canonical posting; payment changes document balances only; reports read legacy journals (`InvoiceForm.jsx:152`, `routes/functions.ts:590-613,225-291`, `Reports.jsx:32-50`). |
| C2 source and protective restrictions | **Partial** | Local exact C2 object verified; remote C2 absent. Active ruleset 24197692 protects against update/deletion/non-fast-forward but lacks required status check. |
| C2 validation producer | **Draft PR, not installed** | [PR #10](https://github.com/Future00111/ledgerpoint/pull/10) is open/draft/unmerged at `a3e486b666c0a3a90a9a6907f45326a60430807f` against `94cbb98f36a61d2cdb954745a2dff4a1fbfe754c`; four additions/348 lines, zero checks/statuses or deployments on the PR head. Local 15 mocked pure tests passed; no workflow on main, actual C2 status, verified source pin or amended ruleset. The earlier connector 403 did not prevent later Codex UI creation. |
| Human and Environment gates | **Blocked** | C-only exceptions do not apply to C2. Connector returned 403 for Environment variables; separately the owner directly inspected GitHub UI on 2026-09-29 and reported no variables or secrets, reviewer Future00111, self-review prevention off, admin bypass on, protected-branches display main only. There is no observed SHA pin and C2 is not shown eligible. Obtain original independent review path or explicit new C2 governance approval—do not silently waive controls. |
| Disposable PostgreSQL isolation | **Partial** | A throwaway no-network container supported `docker exec` today; this does not prove schema, DB/role isolation, source bindings, concurrent posting or cleanup. No DB-backed journey was run here. |
| Protected candidate TI-03 qualification | **Blocked** | Requires exact remote C2, real enforced validation status, reviewed Environment/ref/SHA, fresh human attestation, separate dispatch approval and accepted schema-v2 evidence with SHA-256 and cleanup. The immutable C2 runner requires `LEDGERLY_APPROVED_CANDIDATE_SHA` even in candidate mode; it is **not** the proposed status producer's main-workflow pin. Pure C2 tests passed without DB; hosted Corepack/install/typecheck and TI-03 remain unverified. See `docs/governance/drafts/ledgerly-tr01-c2-qualification-operator-runbook.md`. |
| Published Replit deployment | **Blocked/not published** | Deployment metadata lookup succeeded and returned `isDeployed: false`; no active production URL or successful current build. Other external deployments were not inspected. |
| Authority, activated main and Phase A | **Planned/separately gated** | Candidate qualification alone cannot designate C2 authoritative; final identity approval, activated main governance and activated qualification remain distinct (`docs/ledgerly-44-tr-01-implementation-identity-recovery-implementation-approval-package.md:320-361`). |

## Next actions in dependency order

1. **Review, do not yet apply:** independently review the C2 identity-status
   draft and exact source/check identity; approve any protected-main code and
   restricted status-write job separately. Authorise and verify the proposed
   C2 ruleset `required_status_checks` addition, including creation-only
   exemption and trusted status source. No bypass or fabricated check.
2. **Publication gate:** confirm the publication instruction applies with
   the reviewed status-rule sequence; recheck exact local C2 and remote
   absence; only then normal non-force publish exact C2 and read back its
   tip, rules, unchanged C/main and publisher result.
3. **Human/Environment gate:** use the required distinct reviewers, secure
    self-review/bypass policy and exact C2 Environment SHA/ref binding after
   separate approval; record a fresh owner pre-dispatch attestation. Do not
   apply C-only exceptions to C2.
4. **Candidate qualification gate:** separately authorise the protected
   disposable PostgreSQL run; verify complete non-secret schema-v2 evidence,
   SHA-256, negative controls, privilege isolation and cleanup. Failed or
   unavailable execution is not qualification.
5. **Product journey gate:** design and independently review the
   invoice/approval-to-canonical and canonical-to-report integrations without
   weakening source-freshness, company-role, append-only or period controls.
   Only then run a fully synthetic company/invoice/approval/payment/ledger/
   report test in a demonstrably fresh disposable database, with teardown
   evidence; fix any failure before release.
6. **Release decision:** separately approve C2 authoritative identity and
   later activated-main qualification where required. Validate remaining
   migration stubs, security and real deployment build/user journeys before
   any user-initiated publishing or production data operation.

The C2 implementation package's *future-tense local-creation text* and the
older report of *unconditionally broken Docker exec* are stale observations.
The requirements for a true required status, human review, Environment
identity, disposable qualification, independent evidence and distinct final
approval remain mandatory. No document or passing pure test overrides them.