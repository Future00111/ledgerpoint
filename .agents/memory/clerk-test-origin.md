---
name: Clerk testing callback origin
description: Supported programmatic login returns to the Replit development domain.
---

The tester's documented signInClerkUser helper uses a relative basePath appended
to the Replit development domain, not an arbitrary loopback callback origin.
Its generated authentication URL is on the official Clerk development origin.

**Why:** A real full-App loopback setup rendered Clerk and denied anonymous API
access correctly, but the helper could not return its login to that loopback
origin. This is a testing transport limitation, not evidence of faulty Clerk
configuration. Never log or persist the generated token-bearing URL.

**How to apply:** Before starting real-auth automated acceptance, verify both
the Clerk authentication transport and the application's callback origin are
allowed. If the development preview is restricted, obtain a narrow exception
for a separately routed isolated test path; do not follow the callback into
the existing demo or replace authentication with injected headers.

A dedicated managed test path subsequently worked with the documented relative
basePath. When testing a root-mounted app there, isolate root-relative API URLs
as well as page routes; otherwise test traffic can reach the existing demo API.
Keep any launch-only transport adapter explicit in the evidence.

Programmatic login with an explicit callback does not establish that normal UI
logout or sign-in fallback navigation respects a mounted app's base path.
**Why:** Those UI paths can call Clerk independently and retain a root redirect
even when the shared authentication helper has been corrected.
**How to apply:** Verify the actual customer-facing sign-out action and its
destination, not merely the helper or a programmatic sign-out override.
