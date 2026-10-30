# Usability wave

The owner asked for a more modern, easier whole-product experience after the
capture/recovery task. Baseline `92cb24c` passed 306 source checks and 43 real
PostgreSQL cases, build/typecheck and cleanup in GitHub run `41101741030`.

Goal: reduce navigation and scrolling for small-business owners. Keep the
existing green brand, a quiet neutral canvas, consistent readable headings,
one clear primary action, optional detail disclosure and useful empty states.
Retain every existing route, saved dashboard layout, role boundary, explicit
review and exact server amount. No accounting calculation, schema or provider
change belongs in this wave.

## Parallel ownership

| Stream | Exclusive files / scope | Interface |
| --- | --- | --- |
| Shell and dashboard | Layout/header/sidebar/quick-create/company switcher/breadcrumbs and Dashboard/CustomDashboard presentation. | Coordinator-approved route/capability metadata; accessible mobile sheet, selected company always visible, capture/credit shortcuts. |
| Documents and capture | Shared document form/list/posted detail, document discount presentation, capture presentation modules. | Existing native payloads and review acknowledgements unchanged; direct preparation links, accurate capture progress, responsive actions and source-return links. |
| Payments and statements | Payments, Statements, paymentRecovery presentation; new paymentWorkspace helpers/components. | Existing recovery model and payment APIs unchanged; search/filter/mobile cards, validated party links and both-read retry. |
| Reports and VAT | AccountingReports, AccountingJournal, ProfitLossReport, ReportLibrary and VAT presentation. | Same canonical snapshot/amounts; current-scope response guards, correct period labels, precise exports, traceable source links and honest historical status. |

The coordinator owns shared CSS, new `components/workspace/PageHeader.jsx` and
`EmptyState.jsx`, architecture, integration and full regression. Shared helpers
contain presentation only. `PageHeader` accepts `eyebrow`, `title`,
`description`, `context`, `actions` and children. `EmptyState` accepts `icon`,
`title`, `description` and `action`. Existing primitives and brand stay in use;
no new styling framework or dependency.

Agents use isolated worktrees based on the common presentation commit. Shared
files, APIs, permissions and schemas need coordinator approval before editing.
Native money remains integer strings; filters never invent balances or VAT.
Statements accept existing `party_id` links only after validating that the
party belongs to the active company. Any payment-create shortcut must be
coordinated and respect actual posting capability.

## Integration and acceptance

Integrate the shared presentation first, then independently reviewed streams.
Run meaningful tests for keyboard/route semantics, role visibility, stale
responses, exact exports, source/line identity, capture review and payment
recovery; retain the complete accounting regression and full build.

Interactive visual acceptance remains pending because automatic approval
review denied preview-origin access due service capacity. Do not retry through
another browser, iframe or indirect capture. Source/render checks do not prove
real keyboard focus, responsive layout or user acceptance. Demonstrations use
only the authorised isolated synthetic environment and preserve prior records.
No merge, publication, deployment or production-data changes.

## Combined source verification

The four streams integrated with no shared accounting/API/schema changes.
Full local workspace typecheck/build and all 362 source, scenario, client and
rendered-UI tests passed, with no failures/skips. Independent review covered
document submitters and original-line identity, payment recovery/shortcut
gates, statement and report scope, CSV precision and capability checks.
Exact-commit GitHub/database results are recorded on draft PR 27.

The Replit connection became unavailable after the capture-demo refresh was
requested. Its completion and the later usability demo are not confirmed.
The final appearance, real keyboard focus and responsive interaction still
need authorised interactive review; source and render tests are not that review.
