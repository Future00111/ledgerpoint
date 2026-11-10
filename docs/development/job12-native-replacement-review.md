# Job 12 — isolated native replacement review candidate

Base: cffe2a17630d8f673d58fe7acc6e0b1c6ac7e024 (Job 11).
Branch: replit/four-day-job12. Depends on the unreviewed compensation and
replacement candidate chain; local validation is not coordinator acceptance.

Posted invoice/bill screens now connect to authenticated, company-scoped native
replacement history, explicit terms capture/review, observation and unknown-result
recovery. Viewer controls remain read-only. Pending requests are scoped to company
and document; recovery confirms from history or explicitly retries the identical
request, never silently generates a second command.

History, observation and consumption are read within one repeatable-read snapshot.
Routes return public projections, not frozen financial payloads or commit tokens.
No financial algorithm, schema, public posting gate or authentication flow changed.
Conditional credit posting and internal financial commit commands remain unavailable
through these new routes.

Validation at a6f5a1212e43afea32c47e563fe48ef50e07e651:
- 304/304 disposable-suite tests, including customer/supplier native HTTP cases,
  anonymous/outsider/viewer denial, replay/conflict/stale predecessor, observation,
  consumed state, incomplete schema and both public posting gates.
- 882/882 source/UI tests, including recovery/company-switch action tests and
  static component rendering.
- Full build/typecheck passed; populated restore, encrypted recovery and cleanup
  passed. Final later change is recovery notice copy only: it no longer assumes
  a recovered historical version is current or unobserved.

Limits: no signed-in click-level browser acceptance or visual preview inspection
was performed. HTTP tests use the isolated synthetic authentication harness, not
actual Clerk sign-in. DOM-free action tests are not browser tests. Existing demo,
databases, startup pointers, shared queue and GitHub controls were untouched.
No push, merge, deployment or conditional public-posting activation.

Incremental patch/bundle, hashes, logs and cleanup/restore receipts are retained in
the sibling job12-evidence directory. Jobs 13 and 14 remain in the existing owner
backlog; no competing queue or independent approval is claimed.
