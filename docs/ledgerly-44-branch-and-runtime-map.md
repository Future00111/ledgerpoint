# Ledgerly branch/runtime map — current qualification and backup

**2026-10-12 read-only source/control snapshot.** Current status supersedes
pending C2/C5 operational statements. The older runtime/deployment observations
are preserved below with their original date, not claimed as fresh tests.

| Surface | Exact current identity | Meaning |
| --- | --- | --- |
| Qualified C7 | 787d76decfa345e3c1104231e08d5ab00bc90259 | Protected candidate; final designation pending |
| Protected main B | 0da401737f35d68b9404982baad7405fe997636a | C7 producer source; older main qualification workflow; not C7 runtime |
| Replit integration / GitHub backup I | 085b7e0491d9adbbebcc7e8db384c575bcfa2aca | Preserved composite, 17 byte-exact imports; not separately qualified |
| Candidate qualification | 38284785813 attempt 1 | Passed with S=C7 and implementation C7 |
| Activation A / G | Not created | Need C7 and B ancestry, constrained diff, approvals and ordinary merge |

C7 is not an ancestor of B or I; B is not an ancestor of I. B/C7 differ on
1,113 paths. A future main activation must retain B outside ten approved paths
and execute the detached C7 implementation. Review the
[activation proposal](governance/drafts/ledgerly-tr01-c7-protected-main-activation-proposal.md)
and [exact evidence index](governance/drafts/ledgerly-tr01-c7-acceptance/evidence-index.json).
No frozen source, main or live control was changed by this update.

## Historical 2026-09-29 map — preserved

### Ledgerly branch and runtime evidence map

**Snapshot:** 2026-09-29, read-only Git/artifact inspection and Replit
deployment-metadata lookup. No production endpoint or database was contacted.
These facts are point-in-time; recheck before a protected operation.

## Git identities

| Surface | Observed identity | Interpretation |
| --- | --- | --- |
| Workspace HEAD | `audit/replit-2026-09-25` at `bf81705a359f25be290f5146cf4f15cfd016b7a3` | Current editable audit branch; **not** C2 or GitHub main. New `docs/` material is untracked until reviewed. |
| Local main | `e37d6b617d4f17a3d112300e8f2129773785ed5c` | Does not equal remote main. Do not infer current default-branch contents from this local ref. |
| Remote main | `94cbb98f36a61d2cdb954745a2dff4a1fbfe754c` | `git ls-remote --heads origin`; protected default branch identity at this snapshot. |
| Local and remote C | `d292f3a64c6253e022b40de8cf055f3e722ff1ea` | Remote `refs/heads/tr01/implementation-identity-candidate` exists; historically preserved and unqualified. |
| Local C2 | `3ab9edc28b4922ad82e68afb7b049d69514f91e1` | Direct child of C; tree `365303e152430560b828c88165dd8f4d03f2a4fc`; exact six-path correction. Inspect with `git show <full C2 SHA>:<path>` rather than the audit worktree. |
| Remote C2 | **Absent** | No `refs/heads/tr01/implementation-identity-successor-c2` in `ls-remote`; GitHub ref API also returned 404. No accepted protected run exists for C2. |

Source: Git refs/objects, GitHub ruleset/ref API read-back, C2 correction package
`docs/ledgerly-44-tr-01-successor-candidate-c2-evidence-correction-implementation-approval-package.md`.
The current audit branch's `.github/workflows/ledgerly-canonical-postgresql.yml`
is **not** the immutable C2 workflow: use C2's Git blob for C2's runtime contract.

## Development runtime and Base44 boundary

| Surface | Executable source | What it establishes / does not establish |
| --- | --- | --- |
| Frontend | `artifacts/ledgerly/src/main.jsx`, `src/App.jsx`, `src/lib/AuthContext.jsx`, `src/components/ProtectedRoute.jsx`; Vite settings `artifacts/ledgerly/vite.config.ts` | Replit Vite/React app, Clerk login and client routing. Its code invokes same-origin `/api`; it does not establish a published frontend. |
| Base44 compatibility | `artifacts/ledgerly/src/api/base44Client.js`, `entities.js`, `integrations.js` | `base44.*` syntax is a local compatibility adapter to Replit API routes, **not** evidence that a Base44 backend runs here. Some integration methods in `integrations.js` are empty/no-op shims; individual features must be verified rather than inferred from the old API name. |
| API | `artifacts/api-server/src/index.ts`, `src/app.ts`, `src/routes/index.ts`, `entities.ts`, `functions.ts` | Express binds to `PORT`, mounts `/api`, checks Clerk/company scope, and routes entity/business functions. Replacing the Base44 SDK does not make every legacy integration functional. |
| Auth | `artifacts/ledgerly/src/lib/AuthContext.jsx`, `artifacts/api-server/src/app.ts`, `src/middlewares/clerkProxyMiddleware.ts` | Clerk is the current app auth boundary; Base44-shaped `auth` remains a frontend compatibility layer. No live sign-in was tested in this map. |
| Database | `lib/db/src/index.ts`, `lib/db/src/schema/index.ts`, `lib/db/drizzle.config.ts` | Drizzle/pg uses `DATABASE_URL`; this map did **not** query, migrate, or identify the actual database behind that value. |
| Canonical posting | `artifacts/api-server/src/services/accounting/canonicalPosting.ts`, `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs` | The accounting service and a guarded disposable-test entrypoint exist. Source is not proof that a protected TI-03 run passed or that production posting occurred. |
| Background | `artifacts/api-server/src/index.ts`, `src/services/ai-accountant/scheduler.ts` | In-process AI task scheduler starts with the API server. Production replica/singleton behaviour is unknown. |

Registered artifact development routes and commands are specified in
`artifacts/ledgerly/.replit-artifact/artifact.toml` (web preview `/`),
`artifacts/api-server/.replit-artifact/artifact.toml` (API preview `/api`),
and `artifacts/mockup-sandbox/.replit-artifact/artifact.toml` (design
preview). The three development workflows were reported running at the
snapshot. `artifact.toml` production *build/run configuration* is not
evidence that anything was published.

## Document authority versus historical statements

- `replit.md` sets the project's governance/document hierarchy; approved
  decisions and scope records control *permission*, while checked-in source
  and Git object identity establish *implemented behaviour*. Neither
  substitutes for protected-run evidence.
- The C2 design record, C2 implementation approval package and later exact
  GitHub publication approval govern the successor's intended scope. Their
  older future-tense descriptions of C2's creation are stale: the immutable
  local C2 object exists. Their **remaining status, reviewer, Environment,
  qualification and final-identity gates are not stale**.
- The C-only solo-operator approval records name exact C and are not C2
  configuration authority. The old TI-03 report
  `docs/ledgerly-44-ti-03-external-ci-postgresql-implementation-report.md`
  records a Replit Docker qualification block and no accepted evidence; its
  old claim that no successor candidate exists predates local C2 creation.
- `docs/ledgerly-technical-architecture.md` is architecture/governance,
  not proof of deployed code. `lib/api-spec/openapi.yaml` is a small partial
  API specification, not an exhaustive contract for Express routes.
- `docs/governance/evidence/ledgerly-44-disposable-test-*.json` describes
  historical **development-disposable-test** evidence, not a C2 protected
  qualification or production deployment.

## Deployment evidence and unknowns

`getDeploymentInfo()` returned `success: true`, `isDeployed: false`,
`hasSuccessfulBuild: false`, empty production URL/type/visibility. Thus this
Replit project's deployment service reports **no active published
deployment** at the snapshot. A development preview and a configured
production command are not a release. No other hosting target was checked:
an external Base44 deployment, external production instance, deployment
history, production topology/configuration/data and production behaviour
remain **unknown**, not assumed absent. Do not construct a production URL
from a development domain and do not contact production to fill these gaps.