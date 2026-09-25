---
name: Qualification exception drafting
description: Guardrails for proposing narrow governance exceptions without implying permission to execute them.
---

For a proposed exception to a qualification approval gate, name every adjacent gate that remains intact and condition any removal of a protection on separate explicit governance and configuration approval. A design proposal alone never authorizes disabling a live control or dispatching the workflow.

**Why:** Independent review caught a development-only human-review exception that initially omitted unaffected branch and evidence gates and used wording that could be read as already authorizing removal of the reviewer rule.

**How to apply:** Check the existing approval package for separate branch-review, pre-dispatch, identity, evidence, and cleanup requirements. Distinguish a proposal, its later governance approval, live configuration approval, and qualification authorization in every exception or fallback.