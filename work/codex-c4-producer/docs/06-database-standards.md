# 06 — Database Standards

Naming conventions and database rules for Ledgerly entities (Base44 JSON schemas in `base44/entities/`).

---

## Primary Keys

- The platform provides `id` on every record. **Never declare `id`** in entity schemas.
- Use the platform `id` for all references and links.

## Foreign Keys

- Name references as `<entity>_id`, e.g. `company_id`, `customer_id`, `supplier_id`, `bank_account_id`, `account_id`.
- Store a human-readable companion where useful for display, e.g. `customer_name`, `supplier_name`, `account_code`, `bank_account_name`, to avoid extra lookups.
- Always scope business records with `company_id`.

## Timestamps

- Built-in on every record: `created_date`, `updated_date`. **Never declare these.**
- Use `created_by_id` (built-in) to track the author.
- Business dates use `format: "date"`; audit/action timestamps use `format: "date-time"`.

## Indexes

- Index (filter) on `company_id` for every business entity.
- Filter additional hot paths: e.g. `SalesInvoice` by `status`, `BankTransaction` by `status` and `bank_account_id`.

## Soft Deletes

- Prefer status fields over hard deletes for accounting records (e.g. `status: "cancelled"`).
- Accounting entries must remain auditable; never hard-delete posted records.

## Audit Tables

- `AuditLog` entity records significant actions.
- `JournalEntry` records every accounting movement with `source_type` and `source_record_id` for full traceability.

## Relationships

- One company → many of each business entity (scoped by `company_id`).
- One invoice → many line items (embedded `line_items` array).
- One bank account → many transactions.
- One company → many `CompanyUser` (access control).

## Naming Conventions

- Entity names: `PascalCase`, singular (e.g. `SalesInvoice`, `PurchaseBill`).
- Field names: `snake_case`.
- Enums: lowercase (e.g. `draft`, `approved`, `paid`).
- Booleans: prefixed `is_` / `has_` (e.g. `is_active`, `is_applied`).

## Versioning

- Schemas evolve additively — add fields, don't remove or rename without migration.
- Avoid storing large blobs (base64, PDFs) in fields — upload via `UploadFile` and store the `file_url`.
- Build for the next ten years: keep entities extensible and loosely coupled.