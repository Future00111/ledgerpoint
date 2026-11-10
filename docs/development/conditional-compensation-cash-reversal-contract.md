# Job 2 — full payment reversal with consumed discount

Parent P01-03. Unintegrated candidate, dependent on UNREVIEWED Job 1
01c5075478d1e16be07af6b93f3f75d82f61e791 and the five-package compensation base.
Shared source remained 6ebee0fd204b1d9434fd349f6d0c850d57a3e0bc at start;
coordinator revision268 remains leased. No lease or acceptance is claimed.

The new explicit `payment_action: reverse_payment` review uses the existing
protected native reversal engine. Default allocation-only behavior is unchanged.
For customer/supplier original 120 (100 net +20 VAT), discount12 (10+2),
qualifying payment108: reverse the full discount, unallocate108, reverse cash108.
All THREE journals and immutable evidence commit together, or none commit.
Result: original outstanding120, paid0, credited0, unapplied0. Cash decreases108
for a customer receipt reversal and increases108 for a supplier payment reversal.
This records a payment reversal in the books; it does not initiate a bank transfer.

Also supports payment120 with discount-released surplus12: unallocate the
remaining108 and reverse full120. No refund may exist. No cross-document
allocations, other payments on the original, prior credits or corrected-original
expansion. The allocation amount must equal the full remaining applied amount.
Zero-applied/reversal after an earlier compensation remains unsupported.
Do not silently reverse other documents, recover a paid refund or reset permanent
discount consumption. Unsupported cases reject without financial effects.

The canonical credit reversal uses frozen original lines. Payment unallocation
and cash reversal reuse native engines with private exact-command transaction
capabilities, never caller bypass flags. Existing payment account capture,
permissions, open-period checks, review freshness and company locks still apply.
Effective dates cannot precede existing activity.

An additive fresh-schema review migration validates the third journal/event,
actor/company/parent/full amount, zero remaining allocation, no refunds,
posting effect and same top-transaction DB-owned origin receipt. Old schemas
cannot enable this action. No existing schema or grants are changed in this run.
Historical native validation checks the immutable cash child. Restore acceptance
includes recovered cash reversal IDs and dated open balances.

Normal Payments UI provides explicit cash-changing review and recovery journal
links; confirmation remains disabled and no public commit route is added.
Both existing public conditional posting gates remain unchanged.

Acceptance covers customer/supplier108/120, full outstanding and cash directions,
three balanced journals, immutable originals, duplicate/conflict, competing
allocation-only command, rollback at all five stages, refunds, direct native
bypass rejection, missing guard, role/period/date/company rejection and restore.
