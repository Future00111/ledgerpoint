# Supplier document intake

The native API stores uploaded supplier invoices and credit notes, lets an active
company member download their original evidence, and creates a native accounting
draft after explicit review. Storage requires the coordinator-reviewed
`lib/db/migrations/document-intake.review.sql` in an isolated development database.
OCR and email are **not connected**. There is no configured provider call, parser,
application background worker, automatic posting or simulated UI extraction
result. The worker boundary below is executable only with an explicitly supplied
trusted transport and source-authority adapter.

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

**Pure adapter/job contract.**
`extraction/contract.ts` does not call a provider, parse files, run a worker,
persist jobs, change API/provider status or supply UI extraction results. OCR and
email remain **not connected**. `extraction/contract.test.ts` uses explicit
synthetic output fixtures, not an extraction simulator.

The adapter delegates to the existing `createTranscript()` and `reviewCandidate()`
validators. Source/page/offset/quote citations and strict decimal/date/total checks
establish internal consistency, not OCR truth. Every result requires source,
supplier and tax review and has `can_post:false`; candidate validation errors
remain visible in `review.issues` and `review.has_errors`. Extracted names and VAT
rates never choose native supplier IDs or tax codes. Credits still require the
user to select the original bill and original lines. Document text, including
instructions embedded in it, stays data. Only the existing native review/draft
flow can select accounting context and calculate authoritative amounts.

### Pure API

All functions below are exported from `extraction/contract.ts`. `ExtractionSource`
is `{company_id:string,evidence:EvidenceDescriptor}`: the descriptor must already
have been created from verified source bytes in this process. That verifies its
hash, **not company ownership or user authority**. `ExtractionRecipe` is
`{provider:string,version:string}`; each value is a 1–80 character identifier
containing letters, digits, dots, underscores or hyphens, beginning with a letter
or digit. The version must change when model, prompt or extraction settings change.
`ExtractionProviderOutput` reuses the existing provider interface's output type:
`{pages:readonly TranscriptPage[],candidate:unknown}`. No provider is configured.

```ts
createExtractionJob(input: ExtractionSource & {
  recipe: ExtractionRecipe; request_id: string; max_attempts?: number;
}): ExtractionJob;
startAttempt(job: ExtractionJob, expectedRevision: number, nowMs: number): {
  job: ExtractionJob; token: AttemptToken;
};
adaptExtractionResult(source: ExtractionSource, output: unknown): AdaptedExtractionResult;
completeAttempt(job: ExtractionJob, token: AttemptToken,
  result: AdaptedExtractionResult): ExtractionJob;
failAttempt(job: ExtractionJob, token: AttemptToken,
  failure: ExtractionFailure, nowMs: number): ExtractionJob;
cancelJob(job: ExtractionJob, expectedRevision: number): ExtractionJob;
supersedeJob(job: ExtractionJob, expectedRevision: number,
  replacement: ExtractionJob): ExtractionJob;
```

- UUID company/source/request IDs are canonicalized for identity. A deterministic
  job ID binds company, source ID, byte hash, provider recipe, request ID and retry
  policy. Re-delivery must reuse the original request ID and settings; an explicit
  re-extraction uses a different request or recipe and supersedes the former job.
- Jobs and adapted results are deeply frozen and verified in-process. JSON copies
  of them cannot be passed back as trusted state. An attempt token carries job,
  company, source/hash, recipe, ordinal, start revision and start timestamp.
  Forged scope, unverified results and mismatched deliveries are rejected.
- States are `queued`, `running`, `retryable`, `review_required`, `failed`,
  `cancelled` and `superseded`. Accepted attempt outcomes are immutable. Only an
  identical canonical JSON output is an idempotent completion; changed output is
  a conflict even if validation produces the same sanitized review. Exact failure
  re-delivery preserves its original retry deadline. A prior attempt's accepted
  outcome cannot overwrite a newer attempt. Cancel/supersede fence late responses
  and clear result availability; they do not undo any native accounting document.
- Retry policy defaults to three total attempts and permits one to five. Failure
  codes `TIMEOUT`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE` are transient, with an
  explicit delay of 1–300 seconds (default one second); exhausting the attempt
  budget is terminal. `UNSUPPORTED_DOCUMENT`, `ENCRYPTED_DOCUMENT`,
  `INVALID_RESPONSE`, `ACCESS_DENIED` are permanent. `ExtractionFailure` accepts
  only `{code,retry_after_ms?}`: raw provider errors, secrets and stack traces do
  not become retained outcomes. Time is a caller-supplied safe integer in
  milliseconds; failure cannot precede attempt start.
- Adaptation bounds an already-decoded JSON result to 2 MiB, 30,000 nodes and depth
  12, with at most 1,000 members per array/object. Cycles, accessors, sparse arrays
  and non-JSON values are rejected. Existing validators further limit transcripts
  to 200 unique pages, 100,000 characters per page and 1,000,000 overall; candidates
  to 200 lines and five bounded citations per field. The combined result budget
  can be tighter than any individual limit. These checks cannot bound allocation
  by an upstream JSON parser or document parser.

### In-process worker boundary

`extraction/worker.ts` adds runnable orchestration and
`worker/referenceRepository.ts` supplies an atomic **in-process reference store**.
It is not a durable database store, an OS sandbox or an enabled OCR service. No
route, background schedule, provider connection or UI availability flag uses it.
Synthetic transports in `worker.test.ts` exercise the stream/lifecycle boundary
without parsing files or sending evidence anywhere.

The source-authority adapter is required. It must load the requested tenant's
immutable source and verify the original requester still has extraction
capability. The repository checks tenant/source IDs, unconverted status, revision,
5 MiB input limit, media signature and recomputed hash before dispatch and again
before accepting an outcome. It gives transports a separate byte copy; source
bytes, native drafts and accounting records are never modified. A changed source,
revoked capability or existing conversion prevents acceptance. These checks are
not malware detection or proof that a file is safe to parse.

```ts
const repository = new InProcessExtractionRepository(resolveAuthorizedSource, {
  maxConcurrent: 2, maxJobs: 16,
});
const job = await repository.enqueue({
  company_id, source_id, actor_id, request_id, recipe, max_attempts: 3,
});
const worker = createExtractionWorker({ repository, transports: [reviewedTransport] });
const outcome = await worker.run({ company_id, job_id: job.job_id });
```

This is an interface example, not a configured adapter. Transports are explicitly
allowlisted trusted code keyed by provider/version. No document text, URL or shell
command can configure execution. A transport receives the bound source/recipe/
attempt and abort signal, and returns a UTF-8 JSON byte stream plus a `closed`
promise that must resolve only when **actual host work has stopped**. Output is
limited before parsing (2 MiB maximum, 4,096 nonempty chunks, JSON depth 12, no
duplicate keys or invalid UTF-8), then passed through existing evidence, transcript
and candidate validators. The worker's page cap may be tightened below the existing
200-page maximum. Errors remain review issues or bounded failure codes; no result
can post or select supplier/tax authority.

One shared repository serializes latest-state transitions and bounds executions
across all worker objects that use it (default two, configurable one to eight).
It binds jobs to their original requester and immutable source revision, returns
identical enqueue requests idempotently, rejects competing active source jobs and
requires explicit cancellation/supersession. Expected revisions reject stale
user operations. Leases fence expired, cancelled and superseded output; abandoned
leases can transition to bounded retry without accepting an old attempt's result.
Source-authority calls also have a timeout and a global outstanding-call bound.
The reference store retains at most 16 jobs by default, configurable up to 64;
reaching the cap fails explicitly rather than silently evicting evidence.

**A timeout is not proof that an adapter stopped.** Logical timeout/cancellation
settles or fences the attempt, but execution capacity remains occupied until both
output processing finishes and the transport confirms closure. An adapter that
ignores abort, hangs or rejects its closure promise cannot create unlimited orphan
work through retries; it can instead exhaust the bounded worker capacity. The host
must diagnose/terminate that work before capacity can safely return. Repeated
workers sharing the reference store are covered by concurrency tests. Separate
repositories/processes do not share a global capacity limit.

These in-process checks cannot interrupt synchronous CPU-bound adapter code or
prevent allocations made before a source/transport yields bytes. The future
isolated host must enforce those CPU, memory, network and parser limits itself;
an abort signal is cooperative and is not a security sandbox.

The repository deliberately keeps B1's branded objects in memory. It cannot
restore jobs across a process restart; lease recovery tests simulate an abandoned
attempt within a surviving store. There is no persisted audit/outbox or automatic
retry scheduler. No database schema was added. Diagnostics contain fixed event
codes only, excluding document contents, identifiers, provider messages, stack
traces and credentials.

### Remaining live-worker requirements

Connection requires a separately reviewed provider and authenticated persistence/
worker host. Before accepting work or a result, that boundary must verify active
company membership and capability, source ownership and current source status,
reconstruct evidence from rehashed stored bytes, and enforce company-scoped
deduplication. Job snapshots and tokens are not credentials. An authenticated,
source-bound delivery must not accept provider-supplied company or source IDs.

The future store must validate persisted state and atomically compare-and-swap the
**latest** job revision before dispatch and before every outcome, cancellation or
supersession. Pure immutable snapshots cannot themselves prevent concurrent
workers from dispatching or committing from an older snapshot. Define unique job
keys, a single active request policy, leases/timeouts, crash recovery and an
outbox/delivery mechanism; commit job outcomes and audit records atomically. A
duplicate completed delivery must return its accepted outcome without creating a
second draft. No schema change is introduced by these worker modules.

Before sending any evidence externally, implement credentials/consent and regional
retention/deletion rules, encrypted storage, redacted observability and explicit
provider availability. Enforce transport bytes, parser CPU/memory/page limits,
timeouts, cancellation, concurrency/rate limits and malware/sandbox handling
before decoding untrusted responses or parsing files. Map provider failures to
the bounded public codes; malformed adaptation is `INVALID_RESPONSE`. A timeout
must settle the attempt before retry, and late responses must use the original
token. Test the selected real provider, persistence races, permissions and worker
crash recovery in an isolated environment before enabling its UI status.

## Tests

`intake.test.ts` covers the evidence/candidate/review contracts. `service.test.ts`
adds synthetic upload boundaries, tamper detection, filename handling, native
review freshness, source-bound replay, tenant-local deduplication, audit cardinality
and retained authority gates. Both use no live database or provider. The disposable
PostgreSQL suite separately verifies atomic rollback, concurrent conversion,
current-role checks, immutable evidence/audit and native draft persistence. The
injected router mutation hook is available only to that test harness, not HTTP.
