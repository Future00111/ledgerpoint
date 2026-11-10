---
name: Company-scoped view lifetimes
description: Authorized late responses must not populate another company's page.
---

Scope page-local asynchronous results and open forms/workspaces to the selected
company, not just the request URL. Remount the state-owning component on a company
change, or explicitly reject every completion belonging to an obsolete scope.

**Why:** A genuine authorized Customer response for A arrived after selection
changed to B and replaced B's directory. Server tenant checks were correct;
client state lifetime was the missing boundary.

**How to apply:** Test a real successful A response held until B has rendered,
then release it unchanged. Assert both the selected company and displayed rows.
Use normal browser fetch transport; replacing it with an intercepted server-side
fetch can lose session credentials and test a 401 instead of the actual race.
