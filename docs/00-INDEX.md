# Project Atlas

The permanent documentation workspace for **Ledgerly**.

Project Atlas is the single source of truth for Ledgerly. Every page, feature, workflow and future enhancement must comply with the documents below. Before implementing any new feature, read the Product Principles first.

## Documents

| # | Document | Purpose |
|---|----------|---------|
| 01 | [Product Principles](./01-product-principles.md) | The principles every feature must follow. Mandatory reading before any new feature. |
| 02 | [Product Requirements Document (PRD)](./02-prd.md) | Every feature, with purpose, business value, user stories, acceptance criteria, future enhancements and dependencies. |
| 03 | [Technical Architecture](./03-technical-architecture.md) | Overall system architecture: frontend, backend, database, auth, permissions, AI, open banking, HMRC, email, notifications, dashboard, Ask. |
| 04 | [Future Ideas](./04-future-ideas.md) | Ideas not part of Version 1, so nothing is ever lost. |
| 05 | [UI / UX Design System](./05-design-system.md) | Consistent visual and interaction standards. |
| 06 | [Database Standards](./06-database-standards.md) | Naming conventions and database rules. |
| 07 | [API Standards](./07-api-standards.md) | Consistent API conventions. |
| 08 | [Security Standards](./08-security-standards.md) | Security requirements. |
| 09 | [Testing Standards](./09-testing-standards.md) | How every feature is tested. |
| 10 | [Release Roadmap](./10-release-roadmap.md) | Future releases and feature assignments. |
| 11 | [Calm Computing](./11-calm-computing.md) | Permanent UX principle: reduce stress, surface only what matters, use colour and motion carefully, keep the user calm and in control. |

## How to use Project Atlas

1. **Before building** — read **01 Product Principles**.
2. **Define the feature** — add or update its entry in **02 PRD**.
3. **Assign a release** — record it in **10 Release Roadmap**.
4. **Check the design** — follow **05 Design System**.
5. **Check the standards** — database (06), API (07), security (08), testing (09).
6. **Park future ideas** — never delete them; record in **04 Future Ideas**.

## Final test for every feature

> Does this make running a business easier?
>
> If the answer is no, redesign the feature before implementing it.