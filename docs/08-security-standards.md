# 08 — Security Standards

Security requirements for Ledgerly.

---

## Encryption

- Rely on platform-managed encryption at rest and TLS in transit.
- Never store secrets, API keys, or tokens in entity fields or frontend code — use `set_secrets` for backend function secrets.

## Authentication

- Platform-owned auth: tokens, sessions, email verification, OTP, password reset.
- Hard redirects (not SPA navigation) after auth state changes so the provider re-initialises.
- Google OAuth supported on login/register.

## Permissions

- **App roles:** `admin`, `user`, `developer` (User entity).
- **Company roles:** `owner`, `accountant`, `staff`, `read_only` (CompanyUser).
- Data is scoped by the active `company_id`; users only see companies they belong to.
- Use Row-Level Security (`rls`) on entity schemas to enforce access at the data layer.

## Audit Logging

- Significant actions recorded in `AuditLog`.
- Every accounting movement recorded in `JournalEntry` with `source_type` and `source_record_id`.
- Audit records are append-only and never hard-deleted.

## Session Management

- Sessions managed by the platform; `isAuthenticated()` and `logout()` via the auth SDK.
- On auth errors, redirect to login; never leave a broken session.

## GDPR

- Collect only data necessary for accounting and contact.
- Provide export (reports/data export) and deletion pathways.
- Respect data retention (see below).

## Data Retention

- Accounting records are retained for the statutory UK period (typically 6 years).
- Soft-delete via status flags; never hard-delete posted accounting entries.
- Personal data deletions handled case-by-case with audit trail.

## Password Policies

- Enforced by the platform auth backend (registration, reset).
- Account lockout and rate limiting handled platform-side.

## Developer Access

- Developer features gated by `src/lib/devAccess.js` (dev environment or `developer` role).
- Developer information (JSON, IDs, stack traces, logs) only visible when Developer Mode is enabled — enforced centrally by `src/lib/safeMessages.js`.
- Development Tools page is hidden from non-developers.