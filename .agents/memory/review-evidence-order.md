---
name: Review evidence ordering
description: Stable ordering for database row arrays included in financial review hashes.
---

Order database row arrays by stable identity before including them in a review
hash. Canonical JSON sorts object keys, not array elements.

**Why:** A rolled-back financial operation can change PostgreSQL's subsequent
physical row order without changing any committed financial values. Unordered
query arrays can therefore invalidate an otherwise unchanged review on retry.

**How to apply:** Preserve all financial freshness fields; make ordering
deterministic instead of weakening the review-token comparison or refreshing
approval automatically.
