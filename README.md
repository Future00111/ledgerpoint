# Ledgerly

UK accounting software for sole traders and small businesses, built as a native
React application and Express API with PostgreSQL. Clerk handles sign-in.

## Active application

- `artifacts/ledgerly/`: customer interface and native API clients.
- `artifacts/api-server/`: authenticated, company-scoped API and accounting services.
- `lib/db/`: shared database schema and reviewable migrations.
- `lib/api-spec/`: API contracts.
- `docs/ledgerly-active-product-plan.md`: current delivery scope.
- `docs/development/isolated-invoice-demo.md`: isolated sample-data setup and limits.

## Development

Use Node.js 24 and pnpm. Install the existing lockfile with
`pnpm install --frozen-lockfile`. Run the frontend with
`pnpm --filter @workspace/ledgerly run dev` and the API with
`pnpm --filter @workspace/api-server run dev` using the documented environment.
Use the isolated development database described above for accounting walkthroughs.
Do not apply review migrations to a shared or production database automatically.

The active app uses first-party `/api` routes. Document posting uses the protected
canonical journal engine, and financial reports read its entries. Uploads,
document extraction and email delivery still require native provider integration;
removing legacy code does not make those services available.

## Historical source

The migration backup and nested C3/C4 source copies were removed from the current
branch after native migration. They remain recoverable at commit
`6c428576308de8f069b0988a5c6587573ea290b2` under `.migration-backup/` and
`work/codex-c3-repair-review`, `work/codex-c4-candidate`, `work/codex-c4-producer`.
The governance records and frozen qualification branches retain their original
history. The current build and deployment exclude historical source directories.
