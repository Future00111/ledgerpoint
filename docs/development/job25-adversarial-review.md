# Job 25 — adversarial review and repairs

Base: `0aacccbf364a1fea07e259de2d17a29ed5611d74` (Job24C).
Executable validation source: `92408f7d3eeb0f2b600528cc87d0a111e871ac06`.
Local branch: `replit/four-day-job25`. No push, demo change or production action.

## Findings and disposition

This is an AI adversarial review plus author regression verification, not an
independent human approval or a claim that the entire product is qualified.
The independent review of the base returned FAIL. Its unmodified report is
retained. The repaired candidate has not been independently re-reviewed.

1. **High: alternate statement import duplicated evidence.** The old
   `/bank-imports` endpoint and runtime-executable SQL command accepted identical
   content under distinct request IDs. Both HTTP entry points now use the
   reviewed service. The old SQL function is private to its existing owner;
   its replacement requires an immutable matching review receipt and checks
   exact-content duplicates under the company lock. SQL normalizes legacy
   NULL zero sides consistently. Existing committed request replay is retained.
   Regression covers HTTP alias, direct SQL, distinct reviewed requests, missing
   review, retry, and a legacy insertion after review. This prevents statement
   duplication; it does not claim the old defect created duplicate journals.
2. **High: configuration reclassified historical prepayments as cash.**
   Payment configuration now rejects using a historical pool as bank, or a
   historical bank as pool. The £60 supplier-prepayment regression proves
   cash stays −£60, rather than incorrectly becoming £0 without a journal.
3. **Medium: reversal stranded a matched statement.** Reversal of a
   matched payment now fails explicitly. A review obtained before matching
   cannot authorize reversal afterward. Regression verifies original cash,
   match and journal remain unchanged. Unmatching/correction is not invented:
   it remains unsupported until explicitly implemented.
4. **Medium: a recovery 4xx was mistaken for proof of no original write.**
   A failed GET or exact retry retains the pending request and reports an
   unconfirmed outcome. Only a verified receipt clears it during recovery.
   Current admission failure cannot disprove an earlier successful command.

The new migration is
`lib/db/migrations/bank-import-review-authority.review.sql`, SHA-256
`6c3e202b7ed3563cf15db16a2cb260f53c1084785da983e5cf19a42a7b31cbdd`.
It was installed only on fresh disposable databases. No existing migration
was edited or applied to a demo. Cancelled import review metadata may remain;
review still creates no statement/payment/journal. Old pre-migration receipts
remain readable; replay without the new review authority is not silently
permitted. UI approval is trusted application behavior, not cryptographic
proof of a human click against a compromised runtime role.

## Validation and provenance

- 949 source/UI tests, zero failures/skips; full build/typecheck passed on
  `e947079eb36520325f58ccf859646431c57e117a`. Subsequent executable changes
  only normalize SQL NULL sides and extend the corresponding PG test.
- Final API typecheck and 31 migration checks pass on `92408f7`.
- Final unchanged-source disposable run: 317 PG tests, zero failures/skips.
- Populated restore: 52 tables, 14,899 rows, matched fingerprints, encrypted
  application recovery verified. Cleanup confirms cluster stopped and removed,
  no ambient credentials and no production contact.
- Initial PG attempt is retained under `failed-source-change`: the author
  edited the migration while tests were still running, so the checksum guard
  correctly failed partial-schema cases. This is not counted as acceptance.
  Final validation ran after the source and registry were committed together.
- Synthetic loopback browser evidence confirms real commit → simulated lost
  response → simulated GET403 retains pending → real GET recovers it. The
  tester mistakenly applied response loss to the second £50 match after a
  normal £70 match. Consequently its overall verdict is **unable**, not pass:
  the planned partial-row retry-refusal check was not completed. Do not
  describe that case as accepted. Final fixture had £120 matched and exactly
  the original two journal lines, cash £120; cleanup is confirmed.
- Browser identity is injected synthetic test identity, not Clerk or a human
  sign-off. No Replit preview origin was inspected.

Commands used from the isolated checkout:

```sh
node --test tools/development/migrations/registry.test.mjs
node tools/development/check.mjs
pnpm run build
pnpm --filter @workspace/api-server run typecheck
env -i PATH="$PATH" HOME="/home/runner/workspace/.local/share/ledgerly/four-day-20261105/home" LANG=C LC_ALL=C pnpm_config_verify_deps_before_run=false node tools/accounting-flow/test.mjs
```

## Remaining existing Job26 scope

Consolidate the candidate and resolve acceptance gaps, not new invented jobs:
explicit post-restore native bank opening/import/match recovery; the missing
partial-row pending-command browser assertion; independent review of repairs;
and previously recorded real-Clerk/full-shell acceptance limitations.
Restore currently fingerprints all tables and controls; no loss was found.
Its executable application acceptance does not yet cover all new banking
recovery paths. All existing conditional/unsupported provider and financial
boundaries remain. Job25 is not production or whole-product acceptance.
