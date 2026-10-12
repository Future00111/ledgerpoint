---
name: Ledgerly migration architecture
description: Durable decisions from the Base44-to-Replit port of Ledgerly.
---

# Ledgerly migration architecture

## Auth — Clerk
- Clerk (not Replit Auth) chosen for auth.
- `AuthContext.jsx` wraps Clerk's `useUser`/`useClerk` in a compatibility layer so existing `useAuth()` calls keep working without touching the 40+ consumer files.
- `useAuth()` returns a safe default instead of throwing when called outside the provider — required because `NotificationStack` renders above `AuthProvider`.
- Auth routes: `/sign-in/*` and `/sign-up/*` use Clerk `<SignIn>`/`<SignUp>` components embedded in the app's own layout.

## Authorization model — tenant isolation
- Every entity except `Company` has a `company_id` column.
- Authorized companies = `company_users` rows where `user_id = clerkUserId`.
- `POST /api/companies` creates both the Company and its owner CompanyUser in a single transaction using the server-verified Clerk userId — never trusting the client-supplied user_id.
- Generic CRUD router enforces: list scoped to authorized companies, get/update/delete check record ownership before acting, writes require an authorized `company_id`.
- `CompanyUser` is read-only via generic CRUD; mutations go through `/api/companies` routes.

**Why:** Accounting data is highly sensitive. Without per-record ownership checks, any authenticated user could enumerate or modify another tenant's records by guessing UUIDs.

## API entity proxy
- `base44.entities.X.method()` pattern preserved via a shim in `src/api/entities.js` (factory function `entity(name)` calling `/api/entities/:name`).
- This avoided touching 40+ page/component files that call `SalesInvoice.filter(...)`, etc.

## Routing
- App uses react-router-dom throughout (not wouter). `ClerkProvider` wraps `BrowserRouter`.
- `basename` and Vite `base` both use `import.meta.env.BASE_URL`.
