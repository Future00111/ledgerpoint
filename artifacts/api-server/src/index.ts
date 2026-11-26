import app from "./app";
import { logger } from "./lib/logger";
import { startAITaskScheduler } from "./services/ai-accountant/scheduler";
import { checkAmendmentRelease } from "./services/accountingDocuments/checkAmendmentRelease";
import { pool, assertIsolatedInvoiceDemoDatabase, isInvoiceDemoModeEnabled } from "@workspace/db";

async function startServer() {
  const checkOnly = process.argv.slice(2).includes('--check-amendment-schema');
  const requirePayRevisions = process.argv.slice(2).includes('--require-pay-revision-schema');
  await assertIsolatedInvoiceDemoDatabase();
  if (process.env.NODE_ENV === 'production' || checkOnly || requirePayRevisions || process.argv.slice(2).includes('--require-amendment-schema')) {
    try {
      await checkAmendmentRelease(pool, requirePayRevisions);
      app.locals.payRevisionReviewEnabled = requirePayRevisions;
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? error.code : undefined;
      const reason = ['MIGRATION_HISTORY_INCOMPATIBLE','MIGRATION_HISTORY_LEGACY_DEPENDENCIES','CORRECTION_SCHEMA_INCOMPLETE','PAY_REVISION_SCHEMA_INCOMPLETE']
        .find(known => known === code) ?? 'AMENDMENT_SCHEMA_CHECK_FAILED';
      logger.error({ reason }, 'Amendment schema release check failed');
      throw error;
    }
    if (checkOnly) {
      logger.info('Amendment schema release check passed');
      await pool.end();
      return;
    }
  }
  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    if (isInvoiceDemoModeEnabled) {
      logger.info("AI task scheduler disabled for isolated invoice demo");
    } else {
      startAITaskScheduler();
    }
  });
}

void startServer().catch((err: unknown) => {
  logger.error({ err }, "API startup failed");
  process.exit(1);
});
