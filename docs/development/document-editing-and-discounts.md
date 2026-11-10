# Document editing and discounts

Owner-requested development follow-up, 30 October 2026. This extends the
current draft editor and linked-credit workflow; it does not permit changes
to immutable posted sources or qualify tax filing.

## Customer behavior

- Saved invoices, bills and both credit-note types expose **Edit draft** and
  **Save changes**. Server-derived capabilities distinguish draft preparation
  from financial posting. Read-only users can still read documents.
- Draft invoices and bills support one document-wide percentage or fixed
  discount. A fixed amount follows the entered price basis: before VAT for
  exclusive prices, including VAT for inclusive prices. Original unit prices
  and the discount intent are retained. Saving recalculates authoritative totals.
- **Apply discount** on a posted invoice or bill prepares a linked credit,
  including when a native payment has already been allocated. The percentage
  is of the original gross value; a fixed amount is a gross reduction. The
  original lines identify the supply and remain locked in this adjustment mode.
- The user supplies a credit number, reason and effective date, saves the draft,
  then explicitly reviews and posts. Original documents and recorded payments
  remain unchanged. The existing credit transaction updates settlement and
  reporting together.
- A commercial discount is not a receipt for a returned part. It is excluded
  from awaiting-return-credit candidates. Returns on an already discounted bill
  use the original discounted value.

## Coordinated interfaces

No SQL schema change is required. The existing JSON source carries optional
fields; absent fields stay absent so earlier source fingerprints remain stable.

| Field | Applies to | Meaning |
|---|---|---|
| `source.discount` | Draft invoice/bill | `{type: 'percentage' or 'amount', value: decimal string}` |
| `source.discount_adjustment` | Linked later-discount credit | Same type/value plus `original_revision`; amount always includes VAT |
| `money.discount` | Discounted invoice/bill | Saved basis, original base, discount and after-discount amounts, plus allocations per line |
| `money.discount_adjustment` | Later-discount credit | Original gross base, credit gross and remaining original gross, plus allocations per line |
| `context.capabilities` | Document screens | `{edit_drafts, post_documents}` derived from current membership and posting policy |

Explicit `null` clears either source field during a draft PATCH; returned
canonical source omits cleared fields. Both cannot be set together. Ordinary
discounts cannot be attached to a credit, and adjustment discounts cannot be
attached to an invoice/bill. All money in summaries is integer pence in strings.

## Calculation and integration

The calculation engine uses integer arithmetic, half-up final-penny rounding
and deterministic largest-remainder allocation, with original line order
breaking ties. Draft discounts reduce rounded entered line amounts before VAT
is calculated. Mixed VAT treatments retain their separate original lines.
Later discounts use immutable original gross weights and original tax rates;
full credits retain exact stored original net and VAT. Original line caps,
outstanding balance and current settlement are checked inside protected posting.

Existing create/edit source audits, If-Match revisions, company isolation,
canonical posting permissions, open periods, immutable journals, retry identity
and atomic rollback remain in force. The legacy draft service uses the same
discount authority, so recognizing the new source fields never silently ignores
their effect.

Coordinator ownership covers capability contracts, integration, regression
tests and review. Calculation and interface work use separate Git worktrees.
Agents do not independently alter schemas or canonical posting behavior.

## Verification and limits

The regression suite adds all four draft edit/reopen journeys; capability and
inactive-membership checks; mixed 20%, 5% and 0% VAT in both price bases; clearing
discounts; discounted returns; later percentage/fixed discounts after partial
payments; original tax evidence across dates; competing excessive credits;
rollback, stale revisions, closed periods, tenant isolation and audit checks;
discounted return tracking; and legacy draft compatibility.

The full build, current-source tests and disposable PostgreSQL suite must pass
for the exact branch head before refreshing the isolated synthetic demo.
Preserve existing samples and use new synthetic records for the walkthrough.
No production data, migration, provider connection, publication or deployment.

General financial edits to posted documents and corrections to posted credit
notes remain a separate coordinated workflow. Do not expose raw canonical
reversal: settlement, reports, dependent credits and return claims need a common
correction relationship first. Discounts exceeding the remaining balance are
blocked; a credit-balance/refund flow must be designed explicitly. Conditional
prompt-payment discounts, automatic supplier agreement, VAT return amendments
and filing are not implemented by this change. Zero-value posting is still
subject to the canonical engine's existing journal validation.

Interactive preview acceptance is pending: the preview origin's automatic
approval review previously failed due service capacity. No alternate browser,
iframe inspection or indirect UI capture is authorized by that failure.
