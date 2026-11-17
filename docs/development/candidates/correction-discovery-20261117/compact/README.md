# Compact LedgerPoint checkpoint

This is the reviewed orchestration format permitted by the source work-queue README. It changes no source queue/coordinator/preflight code and no financial functionality.

The authority queueState is an immutable reference, not a runnable queue. Fetch its exact repository, branch, commit and path. Verify the archived queue-reference.mjs bytes against the helper SHA-256 recorded in queueHydration before using it. Use hydrateQueue(reference, loadExactArchivedBytes, validate, {catalogDigest: queueDigest(validateCatalog(currentCatalog))}). The catalogue must be read from the current source, not inferred from the old archive. The validation callback must call core.validateState(currentCatalog, queue).

The helper verifies raw archive SHA-256, reconstructed canonical queue SHA-256, revision, current catalogue digest, repository/path, depth/cycles and core queue validation. A delta applies only whole task replacements and ordered appended events to its pinned validated base; all other queue metadata remains identical. Any missing/malformed/mismatched archive fails closed. Never initialize the archived base alone or treat a descriptor as a queue.

Before CLI initialization, scheduling or currentView, hydrate the complete exact queue and validate it. For currentView use an in-memory authority copy with queueState replaced by the hydrated queue. Do not overwrite a running runtime; verify its exact identity and use ordinary owned transitions. A fresh runtime must initialize from the hydrated current checkpoint, not the older source seed.

Coordinator transitions and publication preflight retain the compact authority exactly: all lease/run/token verifiers, lastOwner, codeHead, checkpoint evidence and expected-head GitHub writes remain in force. Raw task tokens stay local. Existing user approval is unchanged; this format does not grant authority or disable automatic review.

Future checkpoints can build an exact-queue-delta-v1 from the pinned queue base and validated current runtime using buildQueueDelta. Publish the delta immutably, verify its bytes, hydrate it to an exact match with the current runtime, then checkpoint its queueReference under the live coordinator token. A catalogue/header/task-set change requires a new full snapshot. Keep every previous artifact and the full authority linked by historyReference.

The complete prior coordinator state and all omitted historical metadata remain at the immutable historyReference. New checkpoints keep the current run, standing approval, known follow-ups and PR identity directly accessible.
