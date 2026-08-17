# 09 — Testing Standards

Ensure every feature is properly tested before release.

---

## Unit Tests

- Test pure functions and utilities in isolation (e.g. VAT calculation, formatting, suggestion priority logic).
- Keep business logic in `base44/shared/` so it is unit-testable without UI/backend coupling.

## Integration Tests

- Test backend functions via `test_backend_function` with realistic payloads.
- Verify entity CRUD and journal posting balance for accounting flows.

## Regression Tests

- Protect critical flows: invoice posting, bill posting, VAT box calculation, bank matching, credit note application.
- Re-run regression tests on any change to posting, VAT, or reports.

## Accessibility Tests

- Keyboard-only navigation through every screen.
- Screen-reader review of forms, tables and notifications.
- Colour contrast and visible focus checks.

## Performance Tests

- Dashboard widgets load independently; no single widget blocks the page.
- Large lists paginate; no unbounded queries.
- Optimistic updates where safe; background processing for heavy work.

## Security Tests

- Company scoping: a user must never see another company's data.
- Role checks: `read_only` cannot mutate; non-owners cannot manage users.
- Customer Safe Mode: confirm no technical content leaks to non-developer users.

## Acceptance Tests

- Use Base44's Testing Agent (test-tube icon, side panel) to run end-to-end goals in plain English (e.g. "Create and approve a sales invoice").
- Each PRD feature must have a passing acceptance test before release.
- Acceptance criteria come directly from the PRD entry (see [02 PRD](./02-prd.md)).