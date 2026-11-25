import app from "./app";
import { logger } from "./lib/logger";
import { startAITaskScheduler } from "./services/ai-accountant/scheduler";
import { checkAmendmentRelease } from "./services/accountingDocuments/checkAmendmentRelease";
import { pool, assertIsolatedInvoiceDemoDatabase, isInvoiceDemoModeEnabled } from "@workspace/db";

async function startServer() {
  const checkOnly = process.argv.slice(2).includes('--check-amendment-schema');
  await assertIsolatedInvoiceDemoDatabase();
  if (checkOnly || process.argv.slice(2).includes('--require-amendment-schema')) {
    await checkAmendmentRelease(pool);
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
