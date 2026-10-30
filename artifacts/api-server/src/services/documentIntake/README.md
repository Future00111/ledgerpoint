# Supplier document intake

The native API stores uploaded supplier invoices and credit notes, lets an active
company member download their original evidence, and creates a native accounting
draft after explicit review. Storage requires the coordinator-reviewed
`lib/db/migrations/document-intake.review.sql` in an isolated development database.
OCR and email are **not connected**. There is no provider call, parser, background
worker, automatic posting or simulated extraction result.

## Storage and authority

- `service.ts` accepts PDF, JPEG and PNG uploads up to **5 MiB** through strict
  canonical base64. The lower-level evidence contract allows 20 MiB, but the HTTP
  storage boundary deliberately has a smaller limit. Magic signatures are format
  sanity checks, not malware scanning or proof that a document is well formed.
- Server-generated IDs and byte-derived SHA-256 hashes identify immutable source
  evidence. Duplicate lookups are company-scoped and serialized under the company
  lock. A duplicate upload returns the original capture without another audit row.
- Active company membership is required for metadata and downloads; the existing
  owner/admin/accountant draft capability is required for upload, review and
  conversion. Metadata responses never contain file bytes. Download responses use
  attachment disposition, private no-store caching, nosniff and CSP sandbox.
- Stored bytes are rehashed before download, review and conversion. The source's
  one-way link to a native document and both creation audit records are written
  atomically with the protected native draft. No generic entity write is used.
- `saveDocumentInTransaction()` retains the same company scope, permissions,
  source validation, server money calculation, compatibility projection and audit
  as `saveDocument()`. The separate posting workflow remains unchanged.

## API contract

The router is mounted at `/api/companies/:companyId/document-intake`; JSON responses
use `{data: ...}`. `GET /` lists at most 100 newest source metadata records, accepts
an optional `document_id` filter and returns `can_manage` plus explicit unavailable
provider status. `GET /:id` returns `{source,can_manage,provider_status}`.

- `POST /upload`: `{filename,media_type,content_base64}` → `{source,duplicate}`.
- `GET /:id/content`: authenticated attachment bytes; never an inline document viewer.
- `POST /:id/review`: `{envelope}` → `{envelope,money,revision,review_fingerprint}`.
- `POST /:id/draft`: `{envelope,review_fingerprint,source_reviewed:true,
  supplier_confirmed:true,tax_treatment_confirmed:true}` and quoted capture revision
  in `If-Match` → `{source,document,duplicate}`.

Source metadata includes `id`, `revision`, `sha256`, `media_type`, `filename`,
`byte_length`, `channel`, `created_by`, `created_at`, nullable `document_id`, nullable
`document_kind` and nullable `review_fingerprint`. Upload, detail, review and draft
responses include the quoted source revision as `ETag`.

Review uses `reviewDraft()` to normalize the native supplier envelope and
`calculateDocument()` to produce authoritative money. The opaque fingerprint
`v1:<intent hash>:<native-context hash>` binds verified evidence, normalized input,
source revision, tax context, amounts and account mapping. Changed input or
accounting context requires another review. All three acknowledgements are required.
A retry with the same accepted intent returns the linked document even with the
old capture revision, after checking current authority and evidence again. Changed
intent cannot create a second document; later edits belong to the native draft.

## Extraction foundation

`createTranscript()` and `reviewCandidate()` remain pure contracts for a future
provider. They require source/page/offset citations and strict decimal/date/total
checks. Citation consistency cannot establish that OCR text or an interpretation
is true. Extracted names and VAT rates never select an authoritative supplier or
tax rule. Credits require an original bill and original line references. Document
text remains data; nothing in it is executed. Provider configuration, consent,
retention and sandboxed parsing need coordinated implementation before connection.

## Tests

`intake.test.ts` covers the evidence/candidate/review contracts. `service.test.ts`
adds synthetic upload boundaries, tamper detection, filename handling, native
review freshness, source-bound replay, tenant-local deduplication, audit cardinality
and retained authority gates. Both use no live database or provider. The disposable
PostgreSQL suite separately verifies atomic rollback, concurrent conversion,
current-role checks, immutable evidence/audit and native draft persistence. The
injected router mutation hook is available only to that test harness, not HTTP.
