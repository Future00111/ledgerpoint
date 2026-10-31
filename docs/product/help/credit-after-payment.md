# Review a credit after payment

Draft help checked against development commit
`854c4c5478a0dacb79701f1c62ca49512d5b5c4e`. This journey still needs authenticated
browser acceptance before customer onboarding. Availability depends on the
selected environment; do not assume that a development result enables the demo.

1. Select the company that owns the original posted document. Start a
   [supplier credit](/supplier-credit-notes/new) for a bill or a
   [customer credit](/sales-credit-notes/new) for an invoice.
2. Select the **Original bill (posted)** or **Original invoice (posted)**.
   Enter the reason and effective adjustment date. Review the copied original
   lines and VAT basis; reduce the quantity or amount for a partial credit.
   Corrected originals are not yet supported by this credit journey.
3. Save the draft to calculate its totals. Saving a draft does not affect the
   accounts. Review and post only after checking the saved amounts.
4. In **How this credit will be applied**, check **Full credit**, **Offsets
   outstanding balance**, **Released to reusable or refundable payment balances**,
   and **Original balance remaining**. Review the listed original payments and
   their unapplied balances before confirming posting.
5. After successful posting, inspect [Payments](/payments) and the original
   document's history. Use **Unapplied money → Amount left to allocate** to find
   payment balances available for later use. Allocation or recording a refund
   is a separate reviewed action; posting the credit does not send a refund.

For example, a supported synthetic £120 bill paid in full can receive a valid
£12 supplier credit. The original £120 cash payment stays recorded, £12 becomes
unapplied on the original payment, and the bill has no amount left to pay.
Do not delete or reverse the original cash payment merely to add the credit.

If the posting review says **Payment allocation release is unavailable in this
environment**, only credits within the original outstanding balance can be posted
there. Stop if a valid credit needs a payment release; do not reduce its genuine
amount to bypass that restriction or repeat a posting whose result is unknown.

A stale review, permission failure, unsupported corrected original, or cumulative
credit limit needs resolution before posting. Recheck the selected company and
refresh the document; do not create a replacement financial record to bypass it.
A public support destination and response commitment remain unconfigured.
