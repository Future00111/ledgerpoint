---
name: Evidence observation clocks
description: Use a real UTC clock for recorded control readbacks rather than replay-stable callback-runtime time.
---

Capture evidence-recording timestamps from a read-only UTC shell clock when
the durable callback runtime's date helpers are unavailable or replay-stable.

**Why:** The callback runtime rejected a default Date constructor despite the
tool description advertising ordinary date helpers. Replay-stable clocks are
also unsuitable for elapsed-time measurement or proving fresh observations.

**How to apply:** Distinguish the time a snapshot was recorded from per-request
observation times. Do not call a multi-request snapshot atomic or invent an
authenticated owner-decision timestamp from local processing time.
