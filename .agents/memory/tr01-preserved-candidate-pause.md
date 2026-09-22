---
name: TR-01 preserved-candidate pause
description: Deliberate pause boundary, frozen accounting-core scope, and required resumption sequence for TR-01.
---

TR-01 is deliberately paused with immutable candidate `d292f3a64c6253e022b40de8cf055f3e722ff1ea` preserved in two verified, complete-history Git bundles. Candidate pre-validation and independent implementation/security review passed, but external exact-SHA publication, candidate qualification, final identity approval, governance activation, activated qualification, and Phase A have not run. This is not completion, and the candidate is not authoritative.

**Why:** Workspace GitHub authentication could not publish the exact immutable candidate. The preserved candidate must not be reconstructed or replaced, and downstream gates cannot run before exact-SHA publication succeeds.

**How to apply:** Keep canonical posting, double-entry persistence, authority-provider architecture, financial-year and period authorities, configuration-version authorities, canonical mappings, journal immutability, transition-principal/protected-owner controls, migration/cutover architecture, and canonical-posting database security frozen unless a separately approved change requires otherwise. Normal product development may continue outside that boundary. Resume from the preserved candidate and bundles in this order: exact-SHA publication, protection/environment setup, candidate PostgreSQL qualification, final identity approval, governance activation, then activated qualification. Keep 48-B open and deferred until pre-production.