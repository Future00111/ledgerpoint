# Ledgerly development

This is a native pnpm workspace. Read `README.md`, `replit.md` and
`docs/ledgerly-active-product-plan.md` for the current application and delivery
scope. Historical product plans and qualification records remain evidence for
their recorded versions.

Work in `artifacts/ledgerly`, `artifacts/api-server` and the shared `lib` packages.
Keep frontend and backend changes connected. Reuse native API clients and the
protected accounting services. Keep Clerk authentication, company isolation,
server-calculated money, audit history and protected posting boundaries intact.

Use synthetic records in the documented isolated development environment.
Preserve existing sample records during unrelated changes. Run focused checks
for the changed behavior and verify the relevant customer journey. Keep history
and frozen qualification evidence intact; do not force-push or automatically
merge, deploy or publish.

## Dynamic development queue

Use `docs/development/work-backlog.json`, derived from the owner's 18-priority
checklist, and `tools/development/work-queue/README.md`. Workers are interchangeable;
claim the highest-priority eligible task through the queue, never a permanent
product area. One coordinator owns integration, shared financial contracts and
schema changes. Start with up to six workers plus the coordinator when the host
supports seven concurrent slots; reduce concurrency for file conflicts or resources.
Read the durable coordinator checkpoint before starting a competing session.
Record tests and independent review before acceptance; a commit alone is not done.
Checkpoint/release blocked work and claim again. Never steal expired work leases.
Accounting, tax and payroll calculation engines are built in-house. Direct HMRC
and necessary external interfaces remain permitted within their existing authority.
