# Job 3 — corrected-original cumulative credit capacity

Local unintegrated candidate, based on Job2 d683645072a174c7de6de0b1a54e00a3a3fb9223.
Depends on the UNREVIEWED compensation candidate; no queue lease or acceptance.
Shared source remains 6ebee0fd204b1d9434fd349f6d0c850d57a3e0bc, coordinator268.

Implements the corrected-original example already specified by P01-00:
original120, correction108, paid50, then ordinary credit12 => open46.
A later credit96 releases the remaining50 atomically, leaves open0 and
unapplied50; cash remains50. Both customer and supplier flows use the normal
credit form, saved/reopened native document and reviewed paid-credit transaction.
Each credit retains its own effective-date VAT adjustment and original tax rate.

The complete amendment chain is validated before using its current projection.
Stable original ID/line refs/accounts/tax context remain; the credit freezes the
current corrected revision and canonical financial hash. Original documents,
amendments and journals are immutable. Credit date must not precede the latest
correction, prior credit or relevant settlement activity. Drafts reserve nothing.

A shared check sums posted linked credit net/VAT/gross independently per line.
Each dimension must fit the effective corrected line; no borrowing between VAT
lines. Validated compensation history determines effective linked credits, not
status edits or caller vectors. Review includes linked records in freshness hash.
Company locks serialize correction, payment and credit writers; no new lock or
allocation/refund engine. Posting rechecks capacity and existing source freshness.
No schema/migration/grant change.

Existing credits (including drafts) still block a subsequent original correction.
Corrected supplier return claims remain blocked. These are distinct dependent
operations, not permission to silently reduce an already used credit.
Frozen conditional agreements with prior-credit/corrected-original combinations
remain rejected by the unchanged admission/compensation gates. The existing
agreement promises D against frozen G and threshold G-D; no approved rule here
defines whether/how a later commercial correction changes that promise or
qualifying cash. Rebase versus preserve requires an explicit terms-amendment
contract and its own original-posting/witness evidence; simply subtracting prior
credits from the threshold would weaken the present contract.

Thus this package implements eligible ordinary-credit/corrected-original
combinations, not all of P01-03/P01-04. Conditional compensation regressions run
unchanged; they do not establish acceptance of unsupported combined cases.
Job4 remains the next reconciliation package; unresolved conditional combination
semantics must be resolved before enabling that dependent scope.
