import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const demoMode = process.env.W03_INVOICE_DEMO_MODE;
if (demoMode !== undefined && demoMode !== "1") {
  throw new Error("W03 invoice demo mode must be either unset or explicitly enabled.");
}

if (demoMode === "1" && process.env.NODE_ENV !== "development") {
  throw new Error("The W03 invoice demo database is available only in development.");
}

export const isInvoiceDemoModeEnabled = demoMode === "1";

if (!isInvoiceDemoModeEnabled && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// This dedicated Unix socket is intentionally fixed and has no password or TCP
// listener. Enabling demo mode never falls back to the configured DATABASE_URL.
export const pool = isInvoiceDemoModeEnabled
  ? new Pool({
      host: "/tmp/ledgerly-w03-invoice-demo/socket",
      port: 55440,
      database: "ledgerly_w03_invoice_demo",
      user: "ledgerly_api",
      password: "",
      ssl: false,
      options: "",
      application_name: "ledgerly-w03-invoice-demo",
      connectionTimeoutMillis: 5000,
    })
  : new Pool({ connectionString: process.env.DATABASE_URL });

export async function assertIsolatedInvoiceDemoDatabase(): Promise<void> {
  if (!isInvoiceDemoModeEnabled) return;
  const result = await pool.query(
    "SELECT current_database() AS database_name, current_user AS role_name, inet_server_addr() AS server_address",
  );
  const identity = result.rows[0];
  if (
    identity?.database_name !== "ledgerly_w03_invoice_demo" ||
    identity?.role_name !== "ledgerly_api" ||
    identity?.server_address !== null
  ) {
    throw new Error("W03 invoice demo database isolation check failed.");
  }
}

export const db = drizzle(pool, { schema });

export * from "./schema";
