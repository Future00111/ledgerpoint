# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Ledgerly governance

For Ledgerly product and implementation decisions, use the active governance documents under `artifacts/ledgerly/src/docs/` and the planning records under `docs/`.

Authority order:

1. `artifacts/ledgerly/src/docs/00-ledgerly-manifesto.md`
2. `docs/ledgerly-product-principles.md`
3. `docs/ledgerly-prd-product-scope.md`
4. `docs/ledgerly-technical-architecture.md`
5. Feature specifications and `docs/ledgerly-master-backlog.md`

The Manifesto is the highest authority. The Product Principles, PRD/Product
Scope, and Technical Architecture are living governance documents established
by Decision 1; they do not silently approve their unresolved decisions. The
Living Product Decisions Register records explicit, revisitable product
direction but does not authorise implementation. The product gap analysis and
feature matrix are supporting evidence, not authority over this hierarchy.
Existing code is evidence of current behaviour, not product authority. DEC-04
approves the BL-06/BL-07 accounting-core architecture foundation, DEC-05
approves the capability model, DEC-06 approves the financial-year policy,
DEC-07 approves the accounting-period policy, DEC-08 approves the
reporting-only year-end policy, DEC-09 approves the Chart of Accounts and
Default Account Policy, DEC-10 approves the Control-Account Mapping Policy, and
DEC-11 approves Configuration Versioning and Effective Dating; all are
architecture/product/accounting-policy decisions only. DEC-12 approves the
Payment, Allocation and Settlement Policy; all are policy decisions only.
DEC-13 approves the Overpayments, Unapplied Cash and Excess Payment Policy;
DEC-14 approves the Unapplied Cash Workflow Policy; DEC-15 approves the Refund
Policy; DEC-16 approves no separate payment-on-account feature at launch;
DEC-17 through DEC-22 remain unresolved, and BL-06/BL-07 remain blocked
until
the applicable decisions and an implementation task are explicitly approved.
Do not choose roadmap scope or silently change a recorded decision autonomously.
Before implementation, also review the Core Maxims, Design System, Definition
of Done, Product Development Workflow, and Workspace Framework.

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

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

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
