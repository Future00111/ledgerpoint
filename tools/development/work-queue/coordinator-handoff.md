# Coordinator handoff

Read the current work-coordinator.json from the state branch. Run `node tools/development/work-queue/coordinator-status.mjs < checkpoint.json` before dispatch. Follow the recovery procedure in README.md if the previous lease expired. Confirm the prior coordinator and its workers stopped. A PR comment alone does not dispatch a coordinator.

Before ending a run, checkpoint the verified source and queue, perform the clean release, and read back the published idle state. If release fails, report the outstanding owner and the evidence needed for recovery.
