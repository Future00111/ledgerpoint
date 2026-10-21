---
name: Ledgerly migration architecture
description: Durable decisions from the Base44-to-Replit port of Ledgerly.
---

# Ledgerly migration architecture

## Auth — Clerk
- Clerk (not Replit Auth) is the actual authentication provider.
- `useAuth()` exposes the Clerk-backed user/session and fails fast outside its provider; there is no Base44 or fake-success auth API.
- Auth routes `/sign-in/*` and `/sign-up/*` use Clerk's embedded components.

## Authorization model — tenant isolation
- Every entity except `Company` has a `company_id` column.
- Authorized companies = `company_users` rows where `user_id = clerkUserId`.
- `POST /api/companies` creates both the Company and its owner CompanyUser in a single transaction using the server-verified Clerk userId — never trusting the client-supplied user_id.
- Generic CRUD router enforces: list scoped to authorized companies, get/update/delete check record ownership before acting, writes require an authorized `company_id`.
- `CompanyUser` is read-only via generic CRUD; mutations go through `/api/companies` routes.

**Why:** Accounting data is highly sensitive. Without per-record ownership checks, any authenticated user could enumerate or modify another tenant's records by guessing UUIDs.

## Native API access
- Frontend callers import entity services directly from `src/api/entities.js` and first-party function calls from `src/api/functions.mjs`.
- Generic CRUD remains authenticated and tenant-scoped; invoice, VAT, company, reconciliation and other protected writes must continue through their dedicated server policies/workflows.
- External provider capabilities must fail explicitly when unconfigured; never replace them with empty or fake success responses.

**Why:** A compatibility facade obscures whether a call is native, authenticated, scoped, or protected. Direct imports keep those boundaries visible without changing the server's authorization rules.

**How to apply:** Migrate callers by the underlying native entity or first-party route; preserve request payloads and rely on the existing server-side company and role checks. Treat file storage and LLM generation as unavailable until their provider services are configured.

## Routing
- App uses react-router-dom throughout (not wouter). `ClerkProvider` wraps `BrowserRouter`.
- `basename` and Vite `base` both use `import.meta.env.BASE_URL`.
