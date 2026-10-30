# Supplier document intake foundation

This module prepares source-linked supplier invoice and credit-note candidates for
review. It has no route, UI, database writes, storage adapter, OCR implementation,
email connection, provider calls or background worker. It does not save a draft or
post accounting entries. Live capture remains unavailable.

## Boundaries

- `createEvidence()` hashes actual PDF, JPEG or PNG bytes (maximum 20 MiB) and
  returns an immutable descriptor. File signatures are a format sanity check,
  **not** malware scanning or proof that a document is well formed. A future
  ingestion adapter must separately sandbox parsers and handle malicious files.
- `contentFingerprint()` compares content independently of filename or delivery
  channel. The future persistence layer must scope duplicate lookups to the
  company, enforce uniqueness/idempotency atomically, and link existing captures.
  A matching hash alone says nothing about whether an accounting entry exists.
- `createTranscript()` binds bounded parser/OCR page text to source evidence.
  `reviewCandidate()` checks that every supplied field has exact source/page/offset
  citations, validates strict decimal strings, dates and simple net/VAT/gross
  relationships, and reports missing or inconsistent data. These checks establish
  citation consistency only: they cannot establish that the OCR text is true or
  that a cited passage supports a provider's interpretation. Source review is
  always required. Document text remains data; nothing in it is executed.
- Extracted supplier names and VAT rates never select an authoritative supplier
  or tax rule. Blank, unsupported or ambiguous fields require correction. Part
  numbers may remain capture evidence but are not added to the strict native
  accounting source contract. Discounts, extra charges, foreign currencies and
  complex tax cases need explicit support before conversion.
- `reviewDraft()` validates an explicitly reviewed `w03.draft.v1` supplier draft
  using the existing `parseInvoice()` function. Credits require an original bill
  ID, unique original line references, reason and adjustment date. The review
  fingerprint binds the complete payload to the exact source evidence.
- `buildReviewedDraft()` requires explicit source/supplier/tax confirmations and
  the current fingerprint. It returns a draft **candidate**, never saved or
  posted state. This is a review-freshness check, not a security boundary.

Only the returned `envelope` belongs in the native `saveDocument()` input. The
separate evidence metadata needs a coordinator-approved persistence/audit design;
do not pass it through generic entity writes or silently drop its association.
Native saving must still enforce authentication, active company membership,
permissions, supplier ownership, accounting configuration, effective-dated tax
rules, original-credit evidence and transaction/audit guarantees. Server-calculated
saved totals must be checked against the source totals before further approval.
Posting continues through the existing separate reviewed workflow.

Evidence descriptors and transcripts intentionally cannot be supplied as arbitrary
JSON. Reconstruct descriptors from verified bytes and bind a transcript again after
a persistence boundary. `ExtractionProvider` is an interface only; adding a real
adapter requires coordinated storage, provider configuration, consent and retention
decisions. Do not replace unavailable integrations with sample extraction results.

## Tests

`intake.test.ts` is pure and uses synthetic bytes/text only. Bundle it with the
workspace's existing esbuild and run with `node --test`; it needs no database,
credentials, provider or network access. Tests cover input and citation bounds,
forged evidence, content deduplication, decimal/total/VAT rejection, prompt-like
document text, native-envelope validation, review freshness and credit requirements.
