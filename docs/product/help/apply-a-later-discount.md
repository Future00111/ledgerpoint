# Apply a discount after posting an invoice or bill

Draft help checked against development commit
`12b31286277683071804101fe3fc7b778d15fc98`. Authenticated browser acceptance and
customer onboarding remain pending. Availability depends on the environment.

1. Select the company and open the original posted invoice or bill. Choose
   **Apply discount**. This prepares a linked credit; it does not edit the
   original posted amounts. The action can be available after partial or full
   payment while original credit capacity remains.
2. Confirm the original document, reason and **Effective adjustment date**.
   Under **Discount adjustment**, choose **Percentage (%)** or **Fixed amount (£)**.
   A percentage uses the original total including VAT, not the unpaid balance.
   A fixed amount is the total reduction including VAT.
3. Check **Original items · reference only**. Original quantities, unit prices
   and VAT evidence are retained. The saved discount determines the credit
   amounts; do not interpret the original line references as another full credit.
4. Choose **Save draft** and inspect the calculated totals and **Effect on the
   original balance**. Saving does not post the credit. After editing, save again
   before relying on the totals or requesting posting review.
5. Choose **Review & post** if your permissions allow it. Review the actual
   credit, remaining original balance and any released payment allocation before
   confirming. Current credit limits and payment allocations are checked again.
   If you can prepare drafts but cannot post, an owner or accountant must review.

For a supported synthetic £120 invoice with £100 already paid, a 10% later
discount is a £12 credit. After posting, £8 remains payable. The percentage is
not 10% of the £20 unpaid balance. If that same £120 invoice is fully paid, a
valid £12 credit can instead release £12 from the original payment allocation
into an unapplied balance, where the environment supports that protected flow.
The original cash payment stays recorded. Reuse or refund is a separate reviewed
action; posting the credit does not move cash. See [Credit after payment](credit-after-payment.md).

If **Apply discount** is missing, check the company, permissions and current
balance availability. Exhausted credit capacity, corrected originals and
unavailable settlement data prevent this entry path. Do not create an unrelated
replacement document to bypass those checks. A posting review that says payment
allocation release is unavailable must be resolved before an excess credit can
be posted in that environment.

This manual later-discount journey does not implement conditional early-payment
discounts or automatically apply a discount when a payment arrives. Those rules
remain development work. A public human-support destination is not yet configured.
