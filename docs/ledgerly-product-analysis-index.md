# Ledgerly Product Analysis Documentation

## Status

This documentation is the durable record of the read-only Ledgerly product gap analysis and scope review.

**No product features, application code, database schema, dependencies, configuration, workflows, or deployment settings were changed as part of this documentation pass. Nothing was published.**

## Documents

1. [Complete product gap analysis](ledgerly-product-gap-analysis.md)
2. [Phase A–J roadmap](ledgerly-phase-a-j-roadmap.md)
3. [70-area feature matrix](ledgerly-feature-matrix.md)
4. [Master backlog](ledgerly-master-backlog.md)
5. [Living product decisions register](ledgerly-product-decisions.md)
6. [BL-06 / BL-07 accounting core architecture review](ledgerly-accounting-core-architecture-review.md)
7. [BL-06 / BL-07 pre-implementation decision pack](ledgerly-accounting-core-decision-pack.md)
8. [Product Principles](ledgerly-product-principles.md)
9. [PRD / Product Scope](ledgerly-prd-product-scope.md)
10. [Technical Architecture](ledgerly-technical-architecture.md)

## Source authority

The analysis was compared against:

- `artifacts/ledgerly/src/docs/00-ledgerly-manifesto.md`
- `artifacts/ledgerly/src/docs/14-core-maxims.md`
- `artifacts/ledgerly/src/docs/16-design-system-interaction-standards.md`
- `artifacts/ledgerly/src/docs/17-definition-of-done.md`
- `artifacts/ledgerly/src/docs/18-product-development-workflow.md`
- `artifacts/ledgerly/src/docs/19-workspace-framework.md`
- `docs/ledgerly-product-principles.md`
- `docs/ledgerly-prd-product-scope.md`
- `docs/ledgerly-technical-architecture.md`
- `docs/ledgerly-product-decisions.md`
- `docs/ledgerly-accounting-core-architecture-review.md`
- `docs/ledgerly-accounting-core-decision-pack.md`
- Attached Phase 1–6 product specifications
- The active Ledgerly frontend, API server, database schema, routes, services, and tests

## Authority hierarchy

Use the following order when documents or implementation disagree:

1. Ledgerly Manifesto
2. Product Principles
3. PRD / Product Scope
4. Technical Architecture
5. Feature Specifications / Master Backlog

The Manifesto is present and explicitly remains the highest authority. Decision
1 established the Product Principles, PRD/Product Scope, and Technical
Architecture as living governance documents. Their unresolved decisions remain
explicitly marked **REQUIRES USER DECISION**; the documents do not turn
recommendations, current code, or provisional directions into approval.

The Product Gap Analysis, Feature Matrix, Living Product Decisions Register,
approved implementation tasks, and existing code are supporting evidence,
decision records, or execution controls. They do not outrank the hierarchy
above.

## Governance use

The coding agent may identify defects, dependencies, conflicts, and recommendations. It must not choose roadmap scope autonomously, silently change an approved decision, or implement a backlog item without an approved task. Before implementation, compare the proposed work against the Manifesto, the applicable governance documents, the approved scope, the technical architecture, the backlog, the Living Product Decisions Register, and the Definition of Done.

## Completion statement

The complete feature matrix contains all 70 requested product areas from the gap-analysis brief. The master backlog contains every identified incomplete, unsafe, missing, placeholder, or scope-decision item from that analysis.

Features that were found to be sufficiently implemented for their limited current scope are marked `A` or `A*` in the matrix and are not duplicated as implementation backlog items. Scope-gated and intentionally deferred features remain represented in the backlog as decision or future-scope items.

## Current gate

Do not implement backlog items or publish Ledgerly until the product scope, unresolved decisions, accounting authority, the Living Product Decisions Register, and next build task have been reviewed and selected.