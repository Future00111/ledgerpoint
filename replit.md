# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Ledgerly governance

For Ledgerly product and implementation decisions, use the active governance documents under `artifacts/ledgerly/src/docs/` and the planning records under `docs/`.

Authority order:

1. `artifacts/ledgerly/src/docs/00-ledgerly-manifesto.md`
2. Product Principles
3. PRD / Product Scope
4. Technical Architecture
5. `docs/ledgerly-product-gap-analysis.md` and `docs/ledgerly-feature-matrix.md`
6. `docs/ledgerly-master-backlog.md`
7. `docs/ledgerly-product-decisions.md`
8. An approved implementation task
9. Existing code

The Manifesto is the highest authority. Product Principles, PRD/Product Scope, and Technical Architecture are currently referenced governance inputs but are not present as active documents; do not infer them or silently replace them. The Living Product Decisions Register records explicit, revisitable product direction but does not authorise implementation. Do not choose roadmap scope or silently change a recorded decision autonomously. Before implementation, also review the Core Maxims, Design System, Definition of Done, Product Development Workflow, and Workspace Framework.

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
