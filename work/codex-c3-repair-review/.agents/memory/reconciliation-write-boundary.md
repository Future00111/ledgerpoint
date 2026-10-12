---
name: Reconciliation write boundary
description: Financial reconciliation requires dedicated, tenant-checked server operations rather than generic entity CRUD.
---

Bank-transaction creation, matching, categorisation, transfer, and payment allocation must run through protected server operations. Generic CRUD must not alter reconciliation state, document links, amounts, or bank-account references; matched transactions must not be deleted without a correction flow.

**Why:** Allowing generic writes around the atomic approval operation can reopen a matched bank row or change its amount/reference, causing duplicate payment allocations, stale document balances, or cross-company relationships.

**How to apply:** When adding a banking action, add or extend an authenticated server operation that locks the bank transaction, validates company ownership for every referenced record, and performs all related writes atomically. Treat generic entity routes as descriptive-field-only for existing bank transactions.