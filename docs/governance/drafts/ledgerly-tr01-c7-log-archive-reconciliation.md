# C7 qualification log archives — provenance reconciliation

**2026-10-12. Scope:** run 38284785813, attempt 1, exact C7
`787d76decfa345e3c1104231e08d5ab00bc90259`. Read-only existing-run downloads and
documentation/evidence retention only. No workflow dispatch or control change.

The Replit AI review of PR #25 correctly identified that fresh GitHub ZIPs did
not match the recorded ZIP checksum and that the original ZIP was absent from
the PR. The original checksum was correct for its bytes, but the package did
not provide those bytes or specify the scope of that checksum clearly enough.
This update corrects that provenance gap without replacing historical hashes.

| Export | Members | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| [Retained original](ledgerly-tr01-c7-acceptance/logs/original-qualification-logs.zip) | 9 | 25,797 | `bbf0b248bde5938492a5189fd1d12d9383ab11866a2835262c38d5812c557f06` |
| [Fresh export](ledgerly-tr01-c7-acceptance/logs/fresh-qualification-logs.zip) | 2 | 11,928 | `f61c2abb73f30412af4918ab82f36c2f3a7abc804c6ebe6a0d0b344db5656b52` |

Fresh GETs of both `/actions/runs/38284785813/logs` and
`/actions/runs/38284785813/attempts/1/logs` returned the same fresh ZIP.
Run metadata confirms the original exact candidate and attempt-1 success.
The exports omit seven individual step files retained in the original.
No internal GitHub reason for that layout change is asserted.

## Content-level verification

Both shared files are byte-identical, including timestamps and BOM:

- `0_Disposable canonical PostgreSQL qualification.txt`: 40,983 bytes,
  SHA-256 `c8c6b2641a89a0172c120492e733cfcf3a7db50f403635a39704b343c2cd4e1b`.
- `Disposable canonical PostgreSQL qualification/system.txt`: 1,166 bytes,
  SHA-256 `7b798e9b9a04546b0dda3b2d6f4aa3013ec4cdf97f579a342a514c497046e6d5`.

Individual step files carry timestamp prefixes that differ from the combined
export. Removing only a UTF-8 BOM and each ISO8601 timestamp prefix, all seven
step message sequences match exact contiguous ranges in the combined log,
covering lines 1–452 in order. Messages, ANSI bytes and line ordering remain.
The original individual step files remain in the retained original ZIP; they
have not been rewritten or treated as byte-identical files to absent fresh
members. The proof records every member hash, range and normalized payload hash.

The combined log reports 6 tests, 6 passes, 0 failures and 0 skips. It also
contains exact C7 checkout and the unchanged qualification artifact digest.
Qualification evidence/schema remain byte-identical to their original retained
artifact, with 18 negative controls, concurrency and all five cleanup results.

[Full proof and download receipts](ledgerly-tr01-c7-acceptance/log-archive-reconciliation.json).
Both ZIPs pass integrity checks. Each raw ZIP checksum describes that retained
object, not an invariant expected for every future archive export. Future
verification should compare the explicit combined-log member checksum and
source/run/artifact bindings, retaining any changed response for investigation.

## Review boundary

This supplies a reproducible reconciliation of the AI review finding; the
reviewer should verify it against the updated PR head. It is not independent
human signoff, final C7 designation, activation approval, qualification of a
new commit or permission to proceed with a live run. Other review and approval
gates remain unchanged. Frozen sources, original evidence and historical
archive checksums remain preserved.
