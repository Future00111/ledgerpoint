/**
 * Small, process-local task scheduler for the API server.
 *
 * Replit runs one API workflow for this product. The in-flight guard prevents
 * startup and interval runs from overlapping; each run is safe to repeat
 * because the task engine uses company-scoped dedupe keys.
 */
import { logger } from "../../lib/logger.js";
import {
  listActiveCompanyIds,
  runBackgroundAITaskAnalysis,
} from "./taskEngine.js";
import { createCompanyJobContext } from "../../middlewares/companyScope.js";

const INTERVAL_MS = 15 * 60 * 1000;
let interval: NodeJS.Timeout | undefined;
let running = false;

export async function runScheduledAITaskAnalysis(): Promise<void> {
  if (running) {
    logger.debug("AI task scheduler skipped an overlapping run");
    return;
  }
  running = true;
  try {
    const companyIds = await listActiveCompanyIds();
    const results = await Promise.allSettled(
      companyIds.map((companyId) =>
        runBackgroundAITaskAnalysis(createCompanyJobContext(companyId)),
      ),
    );
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length > 0) {
      logger.warn({ failed: failed.length, companies: companyIds.length }, "AI task scheduler completed with failures");
    } else {
      logger.info({ companies: companyIds.length }, "AI task scheduler completed");
    }
  } catch (err) {
    logger.error({ err }, "AI task scheduler failed");
  } finally {
    running = false;
  }
}

export function startAITaskScheduler(): void {
  if (interval) return;
  // Start after the listener is ready, without delaying API availability.
  const initial = setTimeout(() => void runScheduledAITaskAnalysis(), 2_000);
  initial.unref();
  interval = setInterval(() => void runScheduledAITaskAnalysis(), INTERVAL_MS);
  interval.unref();
  logger.info({ interval_minutes: INTERVAL_MS / 60_000 }, "AI task scheduler started");
}