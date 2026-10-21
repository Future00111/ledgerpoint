# Ledgerly

Ledgerly is UK accounting software for sole traders and small businesses.

## Active delivery direction

Use [the active product plan](docs/ledgerly-active-product-plan.md) as the
single current delivery plan. The owner reset on 2026-10-21 supersedes older
product-scope and sequencing plans for delivery. Those records remain available
as history. Existing accounting, access, security, audit, and deployment
policies remain in force; a product target does not silently settle an
unresolved calculation or authorize an external action.

The current implementation uses native invoice, bill and credit workflows,
protected journal posting and connected reports. Make small changes that work in the
preview, run focused checks, then provide a concise commit/PR summary. Avoid
planning-only cycles and repeated approval requests for already-authorized
reversible development. Preserve authentication, company isolation, protected
financial write boundaries, repository protections, and frozen candidate
evidence. Do not force-push, rewrite history, auto-merge, deploy, or publish
without the required action-specific authorization.

## Preserved qualification record

Frozen C7 `787d76decfa345e3c1104231e08d5ab00bc90259` passed the recorded
development qualification, run `38284785813` attempt 1. Its 6 accounting
tests, 18 negative controls, and five cleanup checks are evidence for that
exact C7 source only. The accepted G7 record and frozen candidates remain
historical evidence; neither is changed or extended by current workspace work.

## Existing policy boundaries

- Clerk authentication, active company membership, tenant isolation, and
  company-scoped roles/capabilities stay enabled.
- Invoice drafts never imply posting, payment, reconciliation, or issuance.
  Posting, payment, reconciliation, VAT return changes, and other consequential
  writes use their dedicated protected server workflows.
- Standard-scheme invoice-basis VAT and explicit effective-dated tax rules are
  the current calculation boundary. Do not infer VAT from company defaults or
  bank-feed metadata. Exact-pence results are supported; fractional-penny cases
  fail safely pending DEC-04's remaining rounding decision.
- Use synthetic data and disposable development databases. Do not write to an
  existing/shared or production database, submit to HMRC, move money, or connect
  a provider as part of the current implementation.

Approved DEC-01–DEC-22 records and the existing G7 evidence remain preserved
under `docs/` and the governance drafts. Earlier phase/PRD/backlog plans are
historical; they do not compete with the active product plan.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

See `README.md` for the native application map. Historical migration and C3/C4
source copies are retained in Git history and excluded from the active workspace.

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
