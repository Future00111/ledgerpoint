# Current next actions — local C7 workspace integration completed

The owner-authorized selective sync has completed on
`integration/tr01-c7-workspace` from the preserved current workspace HEAD.
All seventeen source imports are byte-exact, full typechecks passed, and all
56 non-database regressions passed without skips. See the
[integration record](ledgerly-tr01-c7-workspace-integration.md).
The following sync sequence is preserved as historical preparation, not a
request to reapply patches or repeat checks.

Exact C7 development qualification is verified; do **not** repeat the earlier
C5 protection/publication/dispatch sequence or rerun qualification.
See [verification report](ledgerly-tr01-c7-verification-report.md).

## Historical workspace sync preparation

1. Preserve the current workspace, including these new status notes, as a
   checkpoint/local backup ref. Inventory ignored review worktrees and generated
   evidence separately: a clean Git status does not cover ignored files.
   Save raw evidence outside this workspace before relocating it.
2. Create a **new local integration branch** from that checkpoint, not from
   remote main or a frozen candidate. Verify worktree root and `.git` linkage
   before edits; an ignored worktree may silently resolve to the parent repo.
3. Freshly verify exact C7
   `787d76decfa345e3c1104231e08d5ab00bc90259` and exact main producer
   `0da401737f35d68b9404982baad7405fe997636a`. Review and selectively apply:
   - `generated-artifacts/ledgerly-c7-verification/workspace-to-c7-runtime.patch`
     (14 exact candidate source/test/schema files).
   - `generated-artifacts/ledgerly-c7-verification/workspace-to-main-c7-producer.patch`
     (three producer files absent from the initial workspace).
   The current patches passed applicability checks but remain **unapplied**.
4. Review the final diff for only intended imports plus retained status notes.
   Preserve local package/config/app changes, historical C4 report, attachments,
   original evidence and all old candidate/producer controls.
5. Run scoped offline, schema-push, binding/identity/acceptance regressions and
   applicable typechecks on the integration branch. Use synthetic disposable
   PostgreSQL only if needed and verify cleanup. No hosted qualification or
   production database access is authorized by this sync assessment.
6. Record integration SHA/tree/file hashes and unresolved differences. Do not
   label composite workspace code as byte-exact qualified C7. Do not push,
   merge, publish a successor or change live pins/admission/protections without
   the appropriate separate authorization.

## What is not a next action here

No new qualification dispatch, candidate alteration, production deployment,
Helium access, activated qualification, governance activation or Phase A.
Existing frozen candidates stay unchanged. Normal owner review remains distinct
from independent-human approval.
