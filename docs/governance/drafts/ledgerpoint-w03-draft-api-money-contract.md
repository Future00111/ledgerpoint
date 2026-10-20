# W03 proposed financial-draft API and money contract

**Unapproved exact contract for review, not a live endpoint specification.**
See [authority and decisions](ledgerpoint-w03-contract-review-package.md).

## 1. Resource/operation boundary

Proposed namespace `/api/companies/:companyId/financial-drafts`.
Use `/invoices` for SalesInvoice and `/bills` for PurchaseBill. No payments,
credits, allocation, reconciliation, posting, issue/send, approval or VAT
return operation is added. Old generic financial mutation routes must use
the same service or explicitly reject; no alternate permissive API remains.
Company is authenticated path scope; reject any conflicting body/query/header
tenant context. Record ID alone is not authorization. Cross-company/private
missing targets return the same safe 404 after actor scope validation.

| Operation | Request | Success |
| --- | --- | --- |
| POST `/:kind` | complete create body below | 201 view + `ETag` |
| PATCH `/:kind/:id` | nonempty subset of allowed editable fields + contract | 200 full view + new `ETag`; `If-Match` required |
| DELETE `/:kind/:id` | no body, `If-Match` and `X-Change-Reason` required | 200 `{"data":{"id":"...","deleted":true},"request_id":"..."}` |
| POST `/:kind/bulk` | atomic envelope below | 200 indexed result array |

`:kind` is literally `invoices` or `bills`, not arbitrary entities.
No PUT full-replacement semantics are introduced at this namespace.
Delete is proposed only for unposted, unissued, unapproved, unallocated,
unmatched pure drafts; keep deletion audit/source identity evidence.
If durable evidence cannot survive physical delete, stop and review storage;
do not silently add a soft-delete column or weaken retention.

### Exact create body

Invoice example (all UUIDs synthetic):

```json
{
  "contract":"w03.draft.v1",
  "currency":"GBP",
  "customer_id":"11111111-1111-4111-8111-111111111111",
  "invoice_number":"DRAFT-001",
  "issue_date":"2026-10-20",
  "due_date":"2026-11-19",
  "payment_terms":30,
  "reference":"",
  "notes":"",
  "line_items":[{"description":"Service","quantity":"1","unit_price":"10.00","tax_code":"<approved-standard-20-code>"}]
}
```

This tax-code token is a **review placeholder**, not a deployed catalogue code.
Bill uses `supplier_id,bill_number,bill_date` in place of the three
customer/invoice/issue fields. No other field difference. Bill `category`
and line categories are deliberately not authorized here until their
classification-to-account policy is reviewed; record compatibility impact.

Exact required create keys: `contract,currency,customer_id|supplier_id,
invoice_number|bill_number,issue_date|bill_date,due_date,payment_terms,line_items`.
Optional `reference,notes` default to empty strings.
On PATCH, `contract` required exactly; editable subset is party, number, source
date, due date, payment terms, reference, notes, line_items.
`currency` immutable and rejected on PATCH, including same-value attempts.
At least one editable field required. Omitted preserves; null is rejected.
Replacing `line_items` replaces the entire array, never merges hidden fields.
Validate the **effective full document**, not just supplied fields.

| Field | Proposed validation |
| --- | --- |
| IDs | UUID string; active same-company reference of the correct kind; no empty-string-to-null normalization |
| Number | 1–64 characters after trim, no controls; company + kind duplicate blocked, including concurrent create/update |
| Dates | exact valid Gregorian `YYYY-MM-DD`, 1900-01-01…2199-12-31; due date >= source date; no timezone coercion |
| payment_terms | JSON integer 0…365; informational agreed terms, not auto-derived due date; explicit due date authoritative |
| notes/reference | strings, <=4000/200 characters; plain text, no controls except newline/tab in notes |
| line_items | 1…200 objects, ordered, each **exactly** description/quantity/unit_price/tax_code |
| description | nonblank string <=500 characters, trim; no controls |
| tax_code | nonblank string <=64 characters resolved server-side as below |
| Request | JSON object, application/json, <=1 MiB UTF-8; duplicate JSON keys rejected before ordinary object parsing; arrays/unknown keys rejected except declared arrays |

Reject `id,company_id,customer_name,supplier_name,status,amount_paid,
balance_due,subtotal,vat_total,total,amount,vat_amount,line_total,currency`
where not explicitly allowed; reject actor/created_by/updated_by/timestamps,
audit/journal/posting/settlement/revision/tax-rate authority fields and all
unknown keys, including nested/prototype-pollution keys. `revision` is a
server response field; mutation precondition comes from If-Match, not mass
assignment. Error for forbidden/unknown field is 422; do not silently strip.
`contract` must match; no fallback when version missing.

## 2. Exact arithmetic proposal — accounting review required

GBP only, prices VAT-exclusive. Quantity and unit price are **JSON decimal
strings**, not numbers. Grammar `^(0|[1-9][0-9]*)([.][0-9]{1,4})?$`.
Reject signs, spaces, exponent notation, empty string, booleans, commas, NaN/
Infinity, leading zeros and >4 decimal places. Never recover via parseFloat.
Quantity **>0 and <=999999.9999**; unit price **>=0 and <=99999999.9999**.
Store/compute exact base-10 integers (e.g. BigInt), not binary floats.

Scale source quantity Q and price P to 1/10000 units. Proposed positive
half-up integer function `roundHalfUp(n,d)=floor((n+floor(d/2))/d)` for the
even denominators used here, `n>=0,d>0`.

- line net pence = `roundHalfUp(Q*P,1000000)` (10^8 source scale / 100 pence).
- authoritative VAT adapter resolves treatment/rate from company, document
  kind, source date, source evidence and effective policy version.
- for an approved ordinary rate `r` in {0,5,20}, proposed line VAT pence =
  `roundHalfUp(lineNetPence*r,100)`.
- line gross = line net + VAT; document net/VAT/gross are sums of those
  **rounded line** values. No second whole-document VAT rounding, balancing
  residual or silent VAT-inclusive conversion.

The line VAT formula is a proposed golden-case requirement for the
**existing deterministic VAT authority/adapter**, not permission to build a
parallel tax engine in draft CRUD. Current vatMath sums integer-pence box
contributions; it is not evidence that four-decimal line input rounding is
already implemented. Preserve DEC-03 and invoice/bill source evidence.
Purchases cannot infer recoverability merely from the displayed nominal rate.

Each line and each document net, VAT and gross must be nonnegative and
<=**999,999,999,999 pence** (£9,999,999,999.99), matching existing NUMERIC(12,2)
totals. Check after each intermediate operation and after aggregation;
large Q/P can be grammatically valid yet exceed monetary bounds: reject,
never clip, wrap or rely on database rounding. JSON pence values are canonical
unsigned integer **strings**, avoiding precision loss in consumers.

Zero price and zero-total **drafts** are proposed allowed; quantity zero is
rejected. All-zero documents receive no payment/paid/issued status from this
fact. Tiny nonzero lines rounding to zero are permitted and visibly retain
source precision. Negative quantities/prices, discount percentages/amounts,
negative lines and credit-note substitutes are rejected. If discounts are
needed, review a separate explicit pre-tax discount contract; do not invent a
negative line or silently lower source price. Credit/refund/payment work stays
outside W03.

### Treatment allowlist and fail-closed behavior

Resolve only a reviewed active company-owned server catalogue entry, eligible
for this document kind/date and supported DEC-03 standard invoice-basis setup.
The nominal ordinary rates 20/5/0 are not permission to choose tax eligibility.
Retain resolved code, rate, treatment, recoverability decision and policy/
catalogue revision in source evidence. Zero-rated, exempt, outside-scope and
nonregistered are **not interchangeable**.
The legacy UI's `exempt` and `no_vat` strings are not automatically mapped.
Special schemes, unsupported adjustments, unknown/expired codes, missing
catalogue authority or unreconciled purchase recovery require explicit review/
typed failure. Do not use bank-feed VAT metadata as document authority.
If W03 cannot persist the required tax/version context safely in existing
approved storage, hold and rescope; no unapproved schema expansion.

### Proposed worked golden examples

| Case | Quantity × VAT-exclusive unit price | Rate | Line net/VAT/gross pence |
| --- | --- | --- | --- |
| Ordinary | 1 × 10.00 | 20% | 1000 / 200 / 1200 |
| Net tie rounds up | 1 × 0.0050 | 20% | 1 / 0 / 1 |
| VAT tie rounds up | 1 × 0.10 | 5% | 10 / 1 / 11 |
| Fractional quantity | 1.2345 × 2.3456 | 20% | 290 / 58 / 348 |
| Tiny source preserved | 0.0001 × 0.0001 | 20% | 0 / 0 / 0 |
| Zero price | 2 × 0 | 20% | 0 / 0 / 0 |
| Eligible zero rate | 2 × 12.3456 | 0% | 2469 / 0 / 2469 |
| Storage maximum at zero rate | 100 × 99999999.9999 | 0% | 999999999999 / 0 / 999999999999 |

Three separate 1 × £0.03 lines at 20% produce **net9/VAT3/gross12 pence**.
Computing 20% on combined net9 would give VAT2: **not** this proposal.
1 × £0.025 at20% yields line net3 then VAT1 then gross4 pence; computing
VAT on unrounded source net is not the rule. Multiple lines do not share
rounding residuals. All examples are proposal fixtures, not tax-policy approval.

## 3. Success and safe errors

Create/update view:

```json
{"data":{"id":"22222222-2222-4222-8222-222222222222","kind":"invoice","company_id":"33333333-3333-4333-8333-333333333333","status":"draft","revision":"opaque-server-etag","source":{"currency":"GBP","customer_id":"11111111-1111-4111-8111-111111111111","invoice_number":"DRAFT-001","issue_date":"2026-10-20","due_date":"2026-11-19","payment_terms":30,"reference":"","notes":"","line_items":[{"description":"Service","quantity":"1","unit_price":"10.00","tax_code":"<approved-standard-20-code>"}]},"money":{"currency":"GBP","net_pence":"1000","vat_pence":"200","gross_pence":"1200","lines":[{"net_pence":"1000","vat_pence":"200","gross_pence":"1200"}]},"calculation":{"contract":"w03.money.v1","policy_revision":"server-resolved","tax_context_revision":"server-resolved"}},"request_id":"server-correlation-id"}
```

Response `ETag` equals quoted opaque revision; no client-supplied revision
authority. Persisted source precision may be returned normalized without
trailing-zero loss changing semantics. Draft response intentionally omits
editable settlement amounts. Generic read compatibility projections may show
existing settlement data read-only; W03 does not invent payment history.
No success implies issued, approved, posted, journaled or paid.
All error responses have `Cache-Control: no-store`; public details never echo
submitted values, SQL, stack traces, tokens, identities or foreign existence.

Exact error envelope:

```json
{"error":{"code":"FIELD_INVALID","message":"Request contains unsupported fields.","request_id":"server-correlation-id","issues":[{"path":"/line_items/0/unit_price","code":"DECIMAL_REQUIRED"}]}}
```

| HTTP | Codes/meaning |
| --- | --- |
| 400 | `MALFORMED_JSON`, `DUPLICATE_KEY`, `INVALID_REQUEST_SHAPE`, `CONTEXT_CONFLICT` |
| 401 | `AUTHENTICATION_REQUIRED` |
| 403 | `CAPABILITY_DENIED`, `GRANT_FORBIDDEN`; no mutation/AI persistence |
| 404 | `RESOURCE_NOT_FOUND`; company-private inaccessible/missing same public result |
| 409 | `REVISION_CONFLICT`, `DOCUMENT_NOT_DRAFT`, `DOCUMENT_REFERENCED`, `NUMBER_CONFLICT`, `AUTHORITY_CONFLICT` |
| 413/415 | `BODY_TOO_LARGE` / `UNSUPPORTED_MEDIA_TYPE` |
| 422 | `FIELD_INVALID`, `MONEY_LIMIT`, `TAX_TREATMENT_UNSUPPORTED`, `REFERENCE_INVALID`, `ROLE_INVALID` |
| 428 | `REVISION_REQUIRED` |
| 503 | `AUTHORITY_UNAVAILABLE`, `WRITE_BUSY`; no fallback or automatic retry |
| 500 | `INTERNAL_ERROR`; generic safe message/correlation, rollback including audit |

Field `issues` array always present (empty if no safe field issue); maximum
50 issues sorted by input order/path, with `ISSUES_TRUNCATED` marker if needed.
Codes are enumerated server constants, not exception strings. Unknown field
paths are replaced with fixed `/unknown_field` if not on the contract's
known-safe field-name list, avoiding attacker-controlled text reflection.
For validation of inaccessible references, public `REFERENCE_INVALID` reveals
neither company nor actual record existence.

## 4. Atomic financial bulk

POST `/invoices/bulk` or `/bills/bulk`, body:

```json
{"contract":"w03.bulk.v1","operations":[{"op":"create","value":{"contract":"w03.draft.v1","currency":"GBP","customer_id":"11111111-1111-4111-8111-111111111111","invoice_number":"DRAFT-001","issue_date":"2026-10-20","due_date":"2026-11-19","payment_terms":30,"line_items":[{"description":"Service","quantity":"1","unit_price":"10","tax_code":"<approved-standard-20-code>"}]}},{"op":"update","id":"22222222-2222-4222-8222-222222222222","revision":"opaque","value":{"contract":"w03.draft.v1","notes":"Revised"}}]}
```

Only exact union keys: create=`op,value`; update=`op,id,revision,value`;
delete=`op,id,revision,reason`. Revision in this explicit union is a conditional
precondition, never persisted from body. Same rules as single operations.
1…100 operations; <=1000 resulting lines evaluated over supplied/touched
documents; <=1 MiB; one path company and one kind. Repeated target IDs
rejected, including update-then-delete; no intra-batch reference to generated
create IDs or sequential mini-workflow. Duplicate document numbers rejected.

All-or-nothing transaction: every capability, reference, revision, money,
state and audit must pass; else **zero mutations/audits committed**. Error
auditing, if required, is a separate safe security log, not a fake committed
business audit. No silent skip or partial 200/207. Input order determines
output index, independent of lock acquisition order.

Success: `{"data":{"atomic":true,"results":[{"index":0,"op":"create","data":"<full view>"},{"index":1,"op":"update","data":"<full view>"}]},"request_id":"..."}`.
Here `<full view>` denotes the full object specified above, not a string in
the real response.
Failure uses the same error envelope; `error.code="BULK_REJECTED"`,
adds `atomic:true`, `committed:false`, and `failures` containing
`{"index":1,"code":"REVISION_CONFLICT","issues":[]}`. `failures` is bounded
to50, sorted by index; public message generic. Global auth/scope failures
return their normal status with no per-index existence enumeration.
Otherwise choose HTTP409 if any conflict, else422 for element validation/
capability/reference failure; retain each safe element code. Transaction
unavailability/internal failure yields503/500 and committed:false, not an
invented item index. Do not claim errors from elements never safely checked.

No request trace ID is an idempotency key. Network uncertainty does not permit
automatic create/bulk retries. Durable deduplication storage/semantics need
separate design approval; current recommendation is surface an uncertain-save
state, review readback before any intentional resubmission.
