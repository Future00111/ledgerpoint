# Ledgerly release readiness — current C7 evidence and remaining gates

**2026-10-12: NOT RELEASE-READY.** The earlier C2 checklist is preserved below
as historical evidence. Its pending C2 steps are superseded, not instructions
for a new run. Current [acceptance](governance/drafts/ledgerly-tr01-c7-final-acceptance-proposal.md)
and [activation](governance/drafts/ledgerly-tr01-c7-protected-main-activation-proposal.md)
proposals record the remaining decisions without granting them.

| Area | Current verified/reported state | Remaining gate |
| --- | --- | --- |
| Candidate TI-03 | Exact C7 qualification 38284785813 attempt 1 passed; 6 accounting, 18 negative controls, concurrency, five cleanup results; schema/source/run/image hashes independently verified | Fresh final exact-C7 review and separate authoritative-identity approval |
| Replit sync and GitHub backup | I=085b7e0491d9adbbebcc7e8db384c575bcfa2aca backed up; 17 imports byte-exact; Replit reports typecheck and 56 non-DB tests passed | Composite I is not qualified C7 or activation A |
| Protected-main activation | Main B=0da401737f35d68b9404982baad7405fe997636a; C7 is not its ancestor | Approved ten-path A/B tree, two exact-A/B approvals, merge-only configuration, normal merge G and parent/ancestry proof |
| Review/control feasibility | One collaborator; main has no required PR approval count; squash/rebase enabled; Environment owner-only reviewer/self-review false | Resolve/approve activated review policy and separate control changes; development exception does not transfer |
| Activated qualification | No G or activated C7 run exists | Separate run approval, S=G/C=C7 bindings, full TI-03 checks/cleanup and independent result review |
| Product business journey | Last static audit found approval/payment/reporting disconnected from canonical accounting; not revalidated end-to-end here | Separate integration design/approval and isolated authenticated synthetic journey |
| Deployment / migration parity | Signed-out development preview reported working; no current deployment metadata or authenticated acceptance collected here | Separate deployment/build/user-journey and remaining migration-stub verification |
| Phase A / production | Not authorized by candidate success or this package | Complete retained activation/governance gates and separate task/release approval |

Immediate work is review of the prepared C7 acceptance/activation proposals.
No C2/C5 replay, whole-tree main merge, new qualification or deployment is
requested. DEC-01–22 and BL-06/BL-07 policy/implementation boundaries remain.

## Historical 2026-10-01 checklist — preserved

### Ledgerly release-readiness checklist — evidence snapshot

**Updated 2026-10-01; earlier product evidence dated 2026-09-29.
Verdict: NOT RELEASE-READY.** This is a review checklist, not
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
| C2 validation producer | **Merged/source-pinned; not run** | Owner reports verified Codex GitHub UI progress: user authorised PR #10 merge and resulting source pin; PR marked ready, merged normally without bypass and shown merged/closed on 2026-10-01 at `87a4ff7d44be9bc21296e9623db16924488f76ae`. Codex added/read back `TR01_C2_APPROVED_WORKFLOW_SHA=87a4ff7d44be9bc21296e9623db16924488f76ae` in ledgerly-canonical Environment variables. No workflow dispatch, C2 publication or qualification occurred; no actual C2 status or applied required-status rule is established by merge. No fresh API verification in this documentation update. |
| C2 human governance replacement | **Approved, bounded** | [Actual 2026-10-01 owner-only decision](governance/ledgerly-tr01-c2-owner-only-qualification-approval.md) replaces unavailable independent humans for C2 development candidate qualification only. Owner exact-commit confirmation and each concrete run approval remain required; none is fabricated. Not a C-only inheritance, production/main-control approval, PR #10 merge/status-write activation or specific dispatch. |
| Environment configuration and release | **Source pin complete; candidate configuration pending** | Codex UI read back the exact authorised source pin above; reviewer, self-review and branch controls unchanged. Earlier API: reviewer Future00111, self-review prevention off, admin bypass on, protected-branches-only mode (not an explicit main-only allowlist). Preserve normal reviewer release; do not remove it or use bypass. `LEDGERLY_APPROVED_CANDIDATE_SHA` and post-publication C2 eligibility remain unverified; source pin is not candidate pin or release approval. Remaining before/after diff is in the existing runbook. |
| Disposable PostgreSQL isolation | **Partial** | A throwaway no-network container supported `docker exec` today; this does not prove schema, DB/role isolation, source bindings, concurrent posting or cleanup. No DB-backed journey was run here. |
| Protected candidate TI-03 qualification | **Blocked** | Requires exact remote C2, real enforced validation status, reviewed Environment/ref/SHA, recorded owner exact-C2 confirmation and specific run approval/release (not a fabricated signed attestation), and accepted schema-v2 evidence with SHA-256 and cleanup. The immutable C2 runner requires `LEDGERLY_APPROVED_CANDIDATE_SHA` even in candidate mode; it is **not** the proposed status producer's main-workflow pin. Pure C2 tests passed without DB; hosted Corepack/install/typecheck and TI-03 remain unverified. See `docs/governance/drafts/ledgerly-tr01-c2-qualification-operator-runbook.md`. |
| Published Replit deployment | **Blocked/not published** | Deployment metadata lookup succeeded and returned `isDeployed: false`; no active production URL or successful current build. Other external deployments were not inspected. |
| Authority, activated main and Phase A | **Planned/separately gated** | Candidate qualification alone cannot designate C2 authoritative; final identity approval, activated main governance and activated qualification remain distinct (`docs/ledgerly-44-tr-01-implementation-identity-recovery-implementation-approval-package.md:320-361`). |

## Next actions in dependency order

1. **Next protection gate:** PR #10 normal merge and resulting Environment
   source-pin readback are complete under separate owner authorisation.
   Authorise and verify the proposed
   C2 ruleset `required_status_checks` addition, including creation-only
   exemption and trusted status source. No bypass or fabricated check.
2. **Publication gate:** confirm the publication instruction applies with
   the reviewed status-rule sequence; recheck exact local C2 and remote
   absence; only then normal non-force publish exact C2 and read back its
   tip, rules, unchanged C/main and publisher result.
3. **C2 owner/Environment gate:** use the actual bounded C2 replacement,
   not unavailable distinct reviewers or older C-only exceptions. Codex
   reviews the runbook's exact before/after diff and obtains configuration
   go-ahead; preserve normal owner release and unrelated main controls,
   verify Environment-level C2 SHA/ref eligibility, and record owner
   exact-C2 confirmation and approval of the concrete run. This is not a
   signed attestation or main publisher activation.
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
The true required status, Environment identity, disposable qualification,
machine-checkable evidence and distinct final approval remain mandatory.
For C2 development candidate qualification only, the recorded owner-only
decision replaces unavailable independent human reviews; owner evidence
review, exact-commit confirmation and each run approval remain required.
Main/status-producer and production approval requirements are not waived.
No passing pure test overrides the retained gates.