# Ledgerly Product Development Workflow

This is the current working process for Ledgerly. The active product scope and
non-negotiable controls are maintained in `docs/ledgerly-active-product-plan.md`.

## Delivery loop

1. **Scope the user outcome.** Confirm the requested change fits the active
   product plan. Ask only for decisions that materially affect correctness,
   safety, or user experience.
2. **Inspect the live implementation.** Trace the current UI, API, storage,
   access checks, audit trail, and tests before changing behavior. Prefer direct
   native services and the existing Clerk session over compatibility shims.
3. **Implement the smallest complete slice.** Include its UI and server
   behavior, explicit loading/success/error states, tenant and role checks,
   and focused regression coverage. Do not silently substitute mock success
   for a missing provider or capability.
4. **Keep consequential accounting deterministic.** Use server-authoritative
   exact money and approved source evidence. When an unresolved policy affects
   only some cases, fail those cases explicitly while completing supported
   cases that need no policy choice.
5. **Verify locally and safely.** Run relevant typechecks, regression tests, and
   the preview. Use synthetic disposable storage for integration tests; never
   rely on production or shared financial data as a test fixture.
6. **Review and record the change.** Inspect the scoped diff for unintended
   files, secrets, and generated outputs. Commit only the intended files and
   use the normal configured Git remote when synchronization is authorized.

## Readiness labels

- **In development:** behavior or verification is incomplete; do not describe
  it as ready for customers.
- **Feature complete:** the scoped behavior works and focused checks pass, but
  broader product, operational, or release requirements remain.
- **Launch ready:** all product-plan scope, operational controls, and release
  approvals have been independently verified. Local feature checks alone do
  not establish launch readiness.

## Product quality

Prefer clear, accessible, responsive interactions; visible save and error
feedback; and one authoritative source for each consequential value. Preserve
the existing authentication, accounting, tenant-isolation, audit, and release
controls. Do not start a new project-wide review for a bounded implementation
when the required decision is already recorded.
