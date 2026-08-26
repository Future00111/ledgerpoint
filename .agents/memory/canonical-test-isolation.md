---
name: Canonical test isolation
description: Safety rule for testing append-only canonical accounting tables after database immutability is enabled.
---

Canonical integration tests must use transaction rollback isolation or a disposable development database once append-only triggers and restricted runtime grants are active. Never broaden the API role or bypass triggers solely to let test teardown delete canonical records.

**Why:** A suite designed around committed fixtures plus direct DELETE cleanup can exercise valid posting behavior but then fail teardown under the intended immutability boundary, leaving its committed fixtures behind.

**How to apply:** Before running canonical integration suites against a shared development database, verify that every fixture is rollback-isolated or created in an approved disposable database. Treat cleanup that requires canonical DELETE, trigger disabling, or superuser bypass as separate governance work.