# G7 review package

This directory preserves original evidence for GitHub run 38621069723, attempt 1.
Read the sibling ledgerly-tr01-c7-g7-acceptance-proposal.md first.

- original-artifact.zip and original-logs.zip are untouched downloads.
- members/ and logs/ are their extracted content.
- archive-and-marker-verification.json records ZIP safety/integrity checks and marker agreement.
- offline-verification-result.json records 19 passing source-bound review groups.
- verify-original-evidence.mjs is the exact verifier used for the successful review.
- retained-files-manifest.json lists SHA-256 values for the retained files (excluding itself).

The verifier accepts one argument: the absolute evidence workspace directory.
For this review it was generated-artifacts/ledgerly-c7-g7-verification-38621069723.
That directory contains verified-G/ at 706dc6a31f85733ba0c251f40b2c09f5a9312269
and verified-G/candidate/ at 787d76decfa345e3c1104231e08d5ab00bc90259.
Both are detached, tracked-clean Git worktrees; G contains C7 in ancestry.
The host resolves AJV 8.20.0 from the pre-existing preparation installation.
The verifier imports only the reviewed coordinator validation exports; it does
not invoke the coordinator main function, Docker, PostgreSQL or qualification.

It was run with a fresh environment containing only PATH, an isolated HOME and
TMPDIR, GIT_CONFIG_COUNT=0 and GIT_TERMINAL_PROMPT=0. The script supplies the exact
public run identity needed by the source-bound validator. These local environment
values are validation inputs checked against retained GitHub metadata, not a claim
that the review itself runs inside GitHub Actions.

Do not substitute mutable main or a current preparation checkout for exact G/C7.
Reproduction requires the retained original evidence files and exact detached
checkouts arranged as above, plus AJV 8.20.0. Run the script with node and the
evidence-directory argument under the sanitized environment. No credentials,
database URL, Replit variables or inherited PostgreSQL variables are required.

Historical preparation-fixture setup failure is retained in the working
generated-artifacts directory: the old host had moved, so it was not used for
source attribution. A fresh exact G/C7 pair produced the successful receipt.
No qualification rerun occurred.

Status: technical recommendation ACCEPT; owner G7 acceptance PENDING.
