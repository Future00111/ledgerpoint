# 03 — Technical Architecture

Overall system architecture for Ledgerly.

---

## Frontend

- **Stack:** React 18 + Vite (ESM), Tailwind CSS, shadcn/ui, lucide-react.
- **Routing:** `react-router-dom` (see `src/App.jsx`).
- **State/data:** `@tanstack/react-query` for query state; React Context for auth and company scope.
- **Design tokens:** `src/index.css` owns CSS variables; `tailwind.config.js` maps them to classes.
- **Layout shell:** `src/components/layout/AppLayout.jsx` — sidebar, top header, breadcrumbs, Ask provider.
- **Principle:** Customer Safe Mode enforced centrally via `src/lib/safeMessages.js` and `src/components/ErrorBoundary.jsx`.

## Backend

- **Platform:** Base44 BaaS — entities, backend functions, automations.
- **Backend functions** live in `base44/functions/<name>/entry.ts` (TypeScript, Deno-style).
- **Shared logic** lives in `base44/shared/` (imported by functions, never duplicated).
- **Built-in integrations** (Core package): InvokeLLM, UploadFile, ExtractDataFromUploadedFile, SendEmail, GenerateImage/Video/Speech, etc.

## Database

- Entities are JSON schemas in `base44/entities/<Name>.jsonc`.
- Every record has built-ins: `id`, `created_date`, `updated_date`, `created_by_id`.
- All business entities are scoped by `company_id` (see Database Standards).

## Authentication

- Platform-owned auth backend (tokens, sessions, email verification, OTP, reset).
- Auth pages: `Login`, `Register`, `ForgotPassword`, `ResetPassword` (boilerplate, translated as needed).
- `src/lib/AuthContext.jsx` exposes `user`, auth state and lifecycle.
- `src/components/ProtectedRoute.jsx` gates authenticated routes.

## Permissions

- **App roles:** `admin`, `user`, `developer` (User entity).
- **Company roles:** `owner`, `accountant`, `staff`, `read_only` (CompanyUser entity).
- **Data scoping:** every query filters by the active `company_id` and the user's authorised companies.
- **Row-Level Security (RLS):** configured per entity under the `rls` key in each schema when data must be restricted.
- **Developer access:** gated by `src/lib/devAccess.js` (env or developer role).

## AI Providers

- **LLM access** via the Core `InvokeLLM` integration (multiple models; web search only with Gemini models).
- **Used by:** AI Copilot, Ask (`askAI`), Insights (`generateInsights`), Document extraction (`extractDocumentData`), Smart Suggestions (`suggestAccount`).
- **Rule:** AI is read-only / advisory; it never posts or modifies accounting records without explicit user confirmation.

## Open Banking

- **Status:** Planned. Bank accounts already model `open_banking_status`, provider enum (plaid/truelayer/yapily/tink), consent expiry and sync dates.
- **Version 1 approach:** manual entry and CSV import; the data model is ready for a live feed.

## HMRC Integration

- **Status:** Planned for direct MTD VAT submission.
- **Version 1:** VAT returns produce the standard 9-box return with drill-down; submission is recorded manually as "filed".
- **Future:** OAuth bridge to HMRC MTD for direct filing.

## Email Processing

- **Capture entities:** `EmailAccount`, `EmailScanConfig`, `EmailRule`, `EmailCaptureLog`.
- **Functions:** `mockScanEmails`, `scanEmailsForInvoices`.
- **Flow:** inbound email → rules → captured attachment becomes a `Document` → AI extraction → review → bill.
- **Version 1:** mock scanning; OAuth mailbox polling is a future enhancement.

## Notifications

- **Store:** `src/components/notifications/notifications.js` (external store).
- **Surfaces:** `NotificationStack.jsx` (toasts) and `NotificationCentre.jsx` (history, bell icon).
- **Bridge:** `src/components/ui/use-toast.jsx` maps legacy `toast()` calls into the new system.
- **Safe Mode:** notifications are sanitised at render time via `useDevMode()` so customers never see technical content.

## Dashboard

- **Engine:** `src/pages/Dashboard.jsx` with `widgetRegistry.js` and `WidgetCard.jsx`.
- **Modes:** Business Owner, Bookkeeper, Accountant, Executive (shared engine, different presets).
- **Principle:** widgets load independently; each widget has its own error boundary and empty state.

## Ask

- **Provider:** `src/components/ask/AskProvider.jsx` (global modal, Cmd/Ctrl+K + Space shortcuts).
- **Backend:** `askAI` function (navigation, creation, actions, reporting, business Q&A) + `globalSearch`.
- **Config:** `src/components/layout/navConfig.js` is the single source of navigation truth; new modules auto-appear in the sidebar and Ask.
- **Principle:** Ask is the primary interaction point; every feature must be reachable through it.