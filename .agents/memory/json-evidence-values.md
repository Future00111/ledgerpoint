---
name: JSON evidence values
description: Normalize database Date objects before canonical review-receipt hashing.
---

Hash plain JSON values at both review and recovery boundaries. Normalize driver
Date objects before passing them to the shared canonical hash function.

**Why:** Recursively sorting enumerable object keys can treat a Date as an empty
object, while JSON persistence converts it to an ISO string. The same apparent
evidence then hashes differently before and after storage.

**How to apply:** When review evidence includes raw database rows, convert them
to a consistent JSON representation first; preserve the shared canonical hash
algorithm rather than replacing it with database JSON text.
