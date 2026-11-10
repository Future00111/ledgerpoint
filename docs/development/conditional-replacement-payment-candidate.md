# Job 10 — replacement payment and redemption candidate

Base: `6588db1c3e08dfcb2ff96519cc54d65a3c8305db`.
Branch: `replit/four-day-job10`. Isolated, AI-tested candidate only.
Job 9 and all previous exports remain unchanged.

## Implemented

- A database-owned origin captures the replacement's actual top transaction and
  cluster. A fresh observation rejects uncommitted or foreign-cluster history.
  Retrying returns the first immutable observation, not a new qualifying clock.
  Existing unobserved historical rows are not retroactively assigned an origin.
- The native service rechecks the original journal and posting effect, evidence
  and source identity. It uses the existing native allocation/tax helpers to freeze
  the replacement vector. Canonical bytes use the existing recursively sorted
  JSON serialization/hash, not SQL JSON serialization.
- Payment snapshots retain the original posting identity and add replacement ID,
  frozen calculation hash and observation clock. Allocations retain their parent's
  exact historical version. Cash before the replacement observation is not
  retrospectively qualified; genuine earlier versions are ineligible rather than
  relabelled. Effective dates before the replacement agreement are also ineligible.
- Native eligibility/review/redemption use that exact observed version. The existing
  paid-credit transaction, journal writer, allocation, compensation and cash engines
  remain authoritative. SQL resolves the immutable agreement supplied to the
  existing consumption guard; it does not introduce another consumption engine.
- The original binding hash remains the consumption key, so changing versions
  cannot reset consumption. Supersession invalidates review; company locking
  serializes replacement against redemption. Compensation reverses the actual
  replacement credit and never restores the ability to redeem the agreement.

Both public posting rejection gates remain unchanged. There is no new public
posting route, authentication bypass, provider connection or demo change.

## Acceptance and evidence

Real disposable PostgreSQL tests cover customers/suppliers, no-VAT and standard-VAT
replacement vectors, frozen payment versions, old and pre-observation cash,
backdated effective payments, stale reviews, concurrent same-request redemption,
conflicting requests, supersession races, permission removal, rollback, immutable
observation, same-transaction rejection and permanent consumption after compensation.
The standard-VAT fixture has original gross £120, replacement discount £24
(£20 net + £4 VAT), and qualifying cash £96. The no-VAT fixture uses £24 net/zero VAT.
Existing loopback browser tests retain synthetic test authentication; this is not
a Clerk walkthrough or human/accountant sign-off.

Retained failures: the first typecheck required explicit callback parameter types.
The first PostgreSQL run caught test assumptions: the original synthetic fixture
was no-VAT, and the new observation foreign key blocked TRUNCATE before its
immutability trigger. Explicit standard/no-VAT fixtures and a CASCADE rejection
test now exercise both protections. A subsequent run exposed an outdated unit
query stub; it now explicitly models absence of replacement history.
The populated restore check also had a fixed £22 expectation for the old £12
credit fixture. It now verifies reopened debt as the actual immutable credit plus
the linked unallocation (£34 for a £24 replacement plus £10 unallocation), retaining
the existing full-reversal check. Restored replacement observations are read back
through the native service without re-certifying their historical origin.
Exact successful counts, source identities and cleanup/restore receipts are in
the incremental export manifest.

## Remaining boundaries

Corrected originals and prior-credit combinations remain unavailable pending
Job 11; do not remove those guards without remaining-capacity calculations.
Job 12 connects replacement history, review and recovery to authenticated native
screens. Job 13 extends lifecycle report/cutoff and restored executable acceptance.
Job 14 remains the statutory-calculation prerequisite task.

No shared queue, existing database, demo startup, provider, GitHub control, merge,
push or deployment was changed. Local passing checks do not establish independent
acceptance, integration, compliance or launch readiness.
