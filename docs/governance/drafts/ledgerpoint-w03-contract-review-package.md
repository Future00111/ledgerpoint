# W03 contract/review package — 2026-10-20

**PROPOSED CONTRACTS. PREPARATION ONLY. NOT IMPLEMENTATION AUTHORITY.**

Acceptance owner: **Lee**. Security reviewer: **TBD**, not assigned by this
package. Build capacity, pilot scope and review availability remain W01
decisions. No runtime, schema, workflow or GitHub-control change is made.

## 1. Review documents and evidence

1. [Authority, roles and membership transitions](ledgerpoint-w03-role-and-membership-contract.md).
2. [Exact draft API, money and bulk contracts](ledgerpoint-w03-draft-api-money-contract.md).
3. [Transactions, client compatibility, implementation boundaries and tests](ledgerpoint-w03-transaction-compatibility-review.md).
4. [Machine-readable proposed golden cases](ledgerpoint-w03-contract-review/money-golden-cases.json).
5. [Baseline/source hashes](ledgerpoint-w03-contract-review/baseline-source-evidence.json)
   and [offline package checks](ledgerpoint-w03-contract-review/package-checks.json).

Repository baseline **`f968280e99efe34573ce80c339540f89a622d0c0`**,
tree **`cbf389b303d95364e22813cd671a6d77cd5a3870`**.
Local records branch: `records-planning/w03-contract-review`.
Initial dirty state comprised the attached W03 instruction and **untracked
concurrent G7 acceptance documents/evidence**. Their hashes were captured
before editing. They remain untouched and are not swept into this commit.
Consequently a checkout of this commit alone is not a backup of that
untracked G7 package; its existing workspace copies remain preserved.
Runtime source bytes were inspected directly and hashed, not inferred from
the launch workbook or the older W03 source baseline.

## 2. G7 accepted; no gate replay

The current recorded owner acceptance supersedes older PENDING wording:
`ledgerly-tr01-c7-g7-acceptance/owner-acceptance.md` and `.json`.
It records the owner's **“can you sign of G7”**, recorded by Codex at
**2026-10-20T19:02:25.181504Z**: G7 **ACCEPTED**, qualification stage complete,
run **38621069723 attempt 1**, workflow source G
`706dc6a31f85733ba0c251f40b2c09f5a9312269`, implementation C7
`787d76decfa345e3c1104231e08d5ab00bc90259`.
Recorded results: six accounting tests, concurrency/locks, 18 negative controls,
five cleanup checks and source-bound archive verification.
Recorded artifact SHA-256
`41ccf0941649ffd35e9e1e5e5d588e46f3a2b3579af943fffe2f720e7fdd048f`;
evidence SHA-256
`1ed8e4b18f0a3809230ba0715eef9f10640e36ba1101f4a2f8dce57998a73c1a`.
The accepted bootstrap ordering recovery and cleanup/per-probe evidence
granularity limits are retained, not erased or reinterpreted.

This package reads that accepted record; it does not independently replay G7,
re-query GitHub or re-qualify the workspace. G7 acceptance does not authorize
W03 implementation, production or Phase A, nor prove any separate closure/
control-restoration action. W02's exact qualification acceptance is satisfied;
W01 capacity/reviewer decisions and any separately required closure evidence
must be checked before an implementation start. Do not reopen G7 to do so.

## 3. Approved foundations versus proposed details

| Authority read | Established boundary | Not settled by it |
| --- | --- | --- |
| DEC-03 VAT scope review; current register | Standard UK VAT, invoice basis; bounded corrections/preparation; special schemes out | Exact line-rounding API, treatment eligibility of a particular sale/purchase |
| DEC-04/accounting-core architecture review | Exact minor-unit journal authority; deterministic VAT adapter; immutable posted journals; transactional tenant/audit boundaries | Physical draft API/schema, independent second VAT calculator |
| DEC-05 capability approval review, especially approved matrix | Owner/Admin/Accountant draft creation/edit; Manager scoped; Read-only no mutation; AI inherits operation capability; immediate prospective role changes | Draft deletion preset, Manager grant representation, Admin membership powers, last-owner mechanics |
| DEC-11/12/22 in current register | Configuration/version context, derived settlement/payment distinction, evidence-based compatibility/cutover | Rounding approval, authorization waiver, automatic role aliases or migration |
| Safety-rule ownership / implementation approval records | Preserve existing guarded posting/reconciliation/AI/VAT boundaries | Permission to broaden those services or enable posting from draft save |

Proposed direction follows the approved capability architecture. **The
four-decimal source precision, half-up per-line net then VAT rounding, bounds,
zero/discount choices and wire contracts are not approved accounting policy.**
Accounting review must confirm these align with the deterministic VAT authority.
If that authority cannot supply the proposed source-bound tax answer, hold
that treatment/save with a typed error; do not implement a competing VAT engine.

Static inspection confirms active-membership isolation already exists, and
canonical posting already uses finite capabilities and transactional locks.
The remaining gap is the broad generic financial write path, caller-derived
money/status and inconsistent role defaults—not absence of all security.
Source evidence names exact files and SHA-256 hashes.

## 4. Outstanding decisions in plain English

| ID | Decision for Lee/reviewers | Recommendation and consequence |
| --- | --- | --- |
| W03-D1 | Who can manage members or appoint another Owner? | Only Owners appoint/remove Owners; Admins need an explicit Owner-issued membership grant and cannot grant themselves powers. Approve the last-active-Owner rule and lock protocol. |
| W03-D2 | What can a Manager edit, and how do we store grants? | No default writes. Explicit operation/document-kind/party allowlists only; no wildcard. Existing schema lacks a reviewed grant store. Approve storage scope separately, or leave configurable users denied. |
| W03-D3 | How do old `member`/`staff` labels transition? | No aliases. Inventory/review mappings without changing data now. Unknown/inactive roles cannot make financial/AI writes. Provide an Owner-led recovery queue, not automatic escalation. |
| W03-D4 | Accept the money examples, limits and zero rules? | Propose four-decimal positive quantities/nonnegative prices, line-net then line-VAT half-up, zero-price drafts allowed, no negative/discount input. Accounting reviewer must accept golden cases before implementation. |
| W03-D5 | Which VAT treatments are eligible at launch? | Approved effective-dated server catalogue only; start with evidenced standard/reduced/zero treatments. Do not interpret `exempt`/`no_vat`, nonregistered or mixed-eligibility labels automatically. Require explicit reviewed mapping or fail closed. |
| W03-D6 | How should clients move to the strict contract? | Coordinated invoice/bill form + entity-adapter update. Old numeric/computed fields must be rejected, not accepted then silently stripped. Approve the narrow expanded frontend file boundary. |
| W03-D7 | Are bulk, draft deletion and transaction/revision rules accepted? | Atomic same-company batches; server audit and lock-aware conditional revisions; draft-only delete with evidence. No success-by-skipping. Approve audit/grant persistence or stop/rescope rather than invent schema. |
| W03-D8 | Who reviews and when can work start? | Lee accepts; security reviewer TBD; accounting review needed for D4/D5. Confirm W01 capacity, exact implementation base and disposable HTTP/concurrency-test authority. No assignment/date inferred. |

All remain **proposed**, not accepted by this preparation request.
No launch date is promised; workbook forecasts still assume five focused
delivery days/week and unconfirmed capacity.

## 5. Preparation checks and handoff

Offline checks validate document links, JSON shapes, exact-decimal worked
examples, numeric storage bounds, retained baseline source/dirty G7 hashes,
and unchanged workbook checksum. They are **package consistency checks**,
not application tests, tax advice, HTTP authorization proof or concurrency
proof. Future implementation tests are enumerated separately by level.

Only this package, its local evidence and the W03 proposal link/status addendum
are prepared. No reset/discard, push, role/data migration, database connection,
new qualification, dispatch, Environment release, closure, runtime/schema/
workflow change, deployment, production/Helium access or Phase A.
