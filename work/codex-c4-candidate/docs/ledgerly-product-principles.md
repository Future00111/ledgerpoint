# Ledgerly Product Principles

**Authority level:** 2 — beneath the Ledgerly Manifesto and above the PRD /
Product Scope  
**Status:** Living governance document established by Decision 1 on 2026-08-21  
**Implementation authority:** None

## Purpose

These principles translate the Ledgerly Manifesto into practical product
decision guidance. They do not replace the Manifesto, approve a product scope,
or select a technical solution. When a principle appears to conflict with the
Manifesto, the Manifesto prevails.

The principles are derived from:

- the [Ledgerly Manifesto](../artifacts/ledgerly/src/docs/00-ledgerly-manifesto.md);
- the [Core Maxims](../artifacts/ledgerly/src/docs/14-core-maxims.md);
- the Design System and Interaction Standards;
- the Definition of Done; and
- the Product Development Workflow and Workspace Framework.

## Product principles

### 1. Make running a business easier

Every feature must reduce effort, stress, or uncertainty for the person running
the business. A feature that adds complexity without a clear business benefit
must be redesigned or not built.

### 2. Earn trust through accurate, auditable accounting

Ledgerly is accounting software first. Financial information must be accurate,
traceable, and understandable. Product convenience must not weaken accounting
integrity or the ability to explain what happened.

### 3. Keep people in control at consequential boundaries

Automation should remove repetitive work, but never remove informed control over
consequential financial or external actions. Users must be able to understand
what Ledgerly proposes, why it proposes it, and what approval will do.

### 4. Use deterministic rules before AI

Rules establish the accounting outcome where a deterministic answer exists. AI
may analyse, explain, recommend, classify, identify anomalies, and prepare
drafts within the approved boundaries; it is an assistant, not the accounting
authority.

### 5. Explain, do not obscure

Ledgerly should explain numbers, suggestions, actions, errors, and next steps in
business language. Customers must not be exposed to raw JSON, implementation
details, stack traces, or internal identifiers.

### 6. Prefer clarity and simplicity over cleverness

The obvious, comprehensible path is preferred to a technically clever or
feature-heavy one. Progressive disclosure should keep advanced capability
available without overwhelming business owners.

### 7. Design for business owners first

Business owners are the primary audience. Accountants and bookkeepers require
powerful tools, but those tools must not turn the default product experience into
an accounting training exercise.

### 8. Make Ask a universal route into the product

Records, answers, navigation, and safe actions should be reachable through Ask
as the product matures. Users should not need to remember a feature's location
to use it.

### 9. Create one calm, coherent experience

Every major object should feel part of the same product: direct interaction,
clear hierarchy, responsive layouts, accessible controls, useful empty and error
states, and a clear next step. Workspaces should gather the relevant context in
one authoritative place rather than scatter it across disconnected pages.

### 10. Build complete, durable outcomes

Build once and build properly. A feature is not complete merely because a screen
or API exists: it must satisfy the relevant accounting, workflow, interaction,
quality, responsiveness, accessibility, performance, and Ask requirements.

## Boundaries of this document

These principles do **not** decide:

- the final product name;
- launch market, currency, VAT schemes, MTD/HMRC scope, or provider choices;
- the final set of launch capabilities;
- financial-year, period, chart, payment, retention, recovery, RLS, or migration
  policy; or
- the detailed technical design for the accounting core.

Each of those areas remains governed by the PRD/Product Scope, Technical
Architecture, Living Product Decisions Register, and the accounting-core
decision pack. Where those documents do not establish a decision, it must be
marked **REQUIRES USER DECISION**.

## Applying the principles

Before approving a feature specification or implementation task:

1. Compare it with the Manifesto.
2. Apply these principles to the user outcome, accounting effect, automation,
   explanation, and experience.
3. Check that the PRD/Product Scope permits it.
4. Check that the Technical Architecture can support it safely.
5. Record any unresolved product decision before work starts.

## Amendments

This is a living document. An amendment requires an explicit, documented
decision. Its record must identify consequences for:

- existing implementation;
- accounting data;
- database/schema;
- migrations;
- backwards compatibility;
- dependent features; and
- Master Backlog items.

An amendment does not authorise application, schema, migration, UI, workflow, or
deployment work by itself.