# Current C7 next actions — acceptance and activation proposal prepared

**2026-10-12:** candidate qualification, workspace integration and ordinary
GitHub backup are complete. Review the [final acceptance proposal](ledgerly-tr01-c7-final-acceptance-proposal.md)
and [activation proposal](ledgerly-tr01-c7-protected-main-activation-proposal.md).
Neither records final approval or authorizes execution.

1. Complete fresh independent exact-C7 implementation/security review and the
   separate final identity decision. Exact evidence/hashes are retained in
   [the evidence index](ledgerly-tr01-c7-acceptance/evidence-index.json).
2. Resolve activation review policy: two fresh A/B approvals are required;
   one collaborator is available, main has no required PR approvals, and
   squash/rebase remain enabled. Supply required reviewers or obtain a
   separately reviewed governance amendment; do not inherit the development
   owner-only exception as activation authority.
3. After approval, prepare exact A from fresh B with both C7/B ancestors and
   a ten-path-only diff, retaining B elsewhere. The integration backup is
   not A and must not be merged wholesale.
4. Under separate configuration/merge/run approvals, enforce reviewed
   controls, merge ordinarily to G, verify parents/ancestry/tree, then
   qualify activated S=G with implementation C7 and review the result.

No new qualification, activation, migration, production/Helium access,
deployment or Phase A is requested by this preparation stage. Historical
C2/C5 pending action sequences are superseded and must not be replayed.

## Completed records

- C7 `787d76decfa345e3c1104231e08d5ab00bc90259`, protected immutable ref.
- Qualification `38284785813`, attempt 1: 6 accounting tests, 18 negative
  controls, concurrency and all five cleanup checks passed.
- Integration `085b7e0491d9adbbebcc7e8db384c575bcfa2aca`, ordinary branch
  `integration/tr01-c7-workspace`, pushed and independently read back.
- All 17 imports independently byte-verified. Replit reports typecheck and
  56 non-database tests passed; ignored raw logs were not retrieved here.
  The integration is not separately qualified.
- Main `0da401737f35d68b9404982baad7405fe997636a`, frozen refs, protections,
  historical pins and Environment admission/reviewer remain unchanged.

See [integration record](ledgerly-tr01-c7-workspace-integration.md) and
[candidate verification](ledgerly-tr01-c7-verification-report.md).
