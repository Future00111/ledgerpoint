---
name: VAT Assistant calculation boundary
description: The VAT Assistant only prepares deterministic standard-scheme, invoice-basis returns in this phase.
---
Only the standard VAT scheme on an invoice basis is enabled for VAT Assistant calculations. Cash accounting and flat-rate schemes are deliberately blocked in both the UI and API until their distinct deterministic rules are implemented.

**Why:** Presenting those modes while applying ordinary invoice-date VAT arithmetic could produce materially incorrect return figures.

**How to apply:** Keep unsupported VAT treatments unavailable or fail explicitly; do not reuse the existing standard calculation engine as a silent fallback for a different scheme or accounting basis.

Create one base return for each company and VAT period. Once it is approved and locked, corrections must be represented by a separately numbered revision linked back to that locked return; never overwrite the original.

**Why:** Multiple independently lockable returns for a single period could result in duplicate filing preparation and would break the audit trail.

**How to apply:** Reject duplicate base-return creation at the database and service layers, and use the explicit revision flow for subsequent work on a locked period.

Company VAT tax rules are advisory until each document line stores a definitive tax-rule or tax-code association. Do not use a date-effective company rule as an assumed rate for every document.

**Why:** A company can legitimately issue standard-, reduced-, and zero-rated documents at the same time; a single reference rule cannot classify all of them.

**How to apply:** Keep rules visible for review, but only validate a document against a rule when the source record explicitly identifies that rule or tax code.