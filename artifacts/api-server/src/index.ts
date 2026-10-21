import app from "./app";
import { logger } from "./lib/logger";
import { startAITaskScheduler } from "./services/ai-accountant/scheduler";
import { assertIsolatedInvoiceDemoDatabase, isInvoiceDemoModeEnabled } from "@workspace/db";

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

async function startServer() {
  await assertIsolatedInvoiceDemoDatabase();
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
