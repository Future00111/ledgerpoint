# 07 — API Standards

Ensure APIs (backend functions and integrations) remain consistent.

---

## Naming

- Backend functions live in `base44/functions/<functionName>/entry.ts` with `functionName` in `camelCase`.
- Entity SDK operations use the built-in verbs: `list`, `filter`, `get`, `create`, `update`, `delete`, `bulkCreate`, `bulkUpdate`, `updateMany`, `deleteMany`.
- HTTP-triggered functions expose a single clear intent; avoid catch-all endpoints.

## Authentication

- Functions run within the authenticated app context; use the Base44 SDK (`base44.asServiceRole` for service-role operations).
- Never trust client-supplied `company_id` blindly — verify the caller's access to that company.

## Error Responses

- Errors must be **customer-safe** at the boundary: never leak stack traces, SQL, or internal messages.
- Use `src/lib/safeMessages.js` (`friendlyError`) to produce friendly messages plus an internal `ERR-XXXX` id.
- Log the technical detail server-side / in developer mode only via `logError`.
- HTTP status semantics: 400 validation, 401/403 auth, 404 not found, 500 server.

## Versioning

- Prefer additive, backward-compatible changes to existing functions.
- Introduce new functions rather than breaking existing ones.
- Document breaking changes in the Release Roadmap.

## Pagination

- `list(sort, limit)` and `filter(query, sort, limit)` accept a limit (default 50).
- For large result sets, paginate via `skip` or cursor on the caller side; never return unbounded lists.

## Rate Limiting

- Rely on platform limits for built-in integrations.
- For AI and external calls, batch where possible and avoid tight loops; prefer one bulk operation over many single calls.

## Webhooks

- Connector automations (`automation_type="connector"`) route external webhooks to backend functions.
- Always validate webhook payloads and scope to `company_id`.
- Never auto-post accounting records from a webhook without user confirmation.