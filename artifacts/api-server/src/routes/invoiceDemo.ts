import { createHash, randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();
router.use(requireAuth);

class DemoBootstrapError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

function deterministicUuid(namespace: string, userId: string): string {
  const bytes = Buffer.from(
    createHash("sha256").update(`ledgerly-w03-invoice-demo:${namespace}:${userId}`).digest("hex").slice(0, 32),
    "hex",
  );
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function ensureCompany(client: import("pg").PoolClient, id: string, name: string, vatRegistered: boolean) {
  const existing = await client.query(
    "SELECT name,country,base_currency,vat_registered,vat_scheme,vat_accounting_basis,status FROM companies WHERE id=$1 FOR UPDATE",
    [id],
  );
  if (existing.rowCount) {
    const row = existing.rows[0]!;
    if (
      row.name !== name || row.country !== "GB" || row.base_currency !== "GBP" ||
      row.vat_registered !== vatRegistered || row.vat_scheme !== "standard" ||
      row.vat_accounting_basis !== "invoice" || row.status !== "active"
    ) throw new DemoBootstrapError(409, "DEMO_DATA_CONFLICT");
  } else {
    await client.query(
      `INSERT INTO companies
        (id,name,country,base_currency,vat_registered,vat_scheme,vat_accounting_basis,status)
       VALUES ($1,$2,'GB','GBP',$3,'standard','invoice','active')`,
      [id, name, vatRegistered],
    );
  }
}

async function ensureOwnerMembership(client: import("pg").PoolClient, companyId: string, userId: string) {
  const existing = await client.query(
    "SELECT role,is_active FROM company_users WHERE company_id=$1 AND user_id=$2 FOR UPDATE",
    [companyId, userId],
  );
  if (existing.rowCount) {
    if (existing.rowCount !== 1 || existing.rows[0]!.role !== "owner" || existing.rows[0]!.is_active !== true) {
      throw new DemoBootstrapError(409, "DEMO_MEMBERSHIP_CONFLICT");
    }
    return;
  }
  await client.query(
    "INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'owner',true)",
    [randomUUID(), companyId, userId],
  );
}

async function ensureCustomer(client: import("pg").PoolClient, id: string, companyId: string) {
  const name = "Synthetic Demo Customer — Not a real person or business";
  const existing = await client.query(
    "SELECT company_id,name,status FROM customers WHERE id=$1 FOR UPDATE",
    [id],
  );
  if (existing.rowCount) {
    const row = existing.rows[0]!;
    if (row.company_id !== companyId || row.name !== name || row.status !== "active") {
      throw new DemoBootstrapError(409, "DEMO_DATA_CONFLICT");
    }
    return;
  }
  await client.query(
    "INSERT INTO customers(id,company_id,name,status) VALUES($1,$2,$3,'active')",
    [id, companyId, name],
  );
}

async function ensureTaxRule(
  client: import("pg").PoolClient,
  id: string,
  companyId: string,
  code: string,
  label: string,
  rate: string,
  treatment: string,
  effectiveFrom: string,
) {
  const existing = await client.query(
    `SELECT label,rate::text AS rate,treatment,effective_from::text AS effective_from,effective_to,is_active
       FROM vat_tax_rules WHERE company_id=$1 AND code=$2 AND effective_from=$3 FOR UPDATE`,
    [companyId, code, effectiveFrom],
  );
  if (existing.rowCount) {
    const row = existing.rows[0]!;
    if (
      existing.rowCount !== 1 || row.label !== label || row.rate !== rate ||
      row.treatment !== treatment || row.effective_from !== effectiveFrom ||
      row.effective_to !== null || row.is_active !== true
    ) throw new DemoBootstrapError(409, "DEMO_TAX_RULE_CONFLICT");
    return;
  }
  await client.query(
    `INSERT INTO vat_tax_rules
      (id,company_id,code,label,rate,treatment,effective_from,effective_to,is_recoverable,is_active)
     VALUES($1,$2,$3,$4,$5,$6,$7,NULL,true,true)`,
    [id, companyId, code, label, rate, treatment, effectiveFrom],
  );
}

router.post("/bootstrap", async (req: Request, res: Response) => {
  if (req.body != null && (
    typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length !== 0
  )) {
    res.status(400).json({ error: { code: "REQUEST_BODY_NOT_SUPPORTED" } });
    return;
  }

  const { userId } = req as AuthenticatedRequest;
  const vatCompanyId = deterministicUuid("company-standard-vat", userId);
  const noVatCompanyId = deterministicUuid("company-no-vat", userId);
  const vatCustomerId = deterministicUuid("customer-standard-vat", userId);
  const noVatCustomerId = deterministicUuid("customer-no-vat", userId);
  let client: import("pg").PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const identity = await client.query(
      "SELECT current_database() AS database_name, current_user AS role_name, inet_server_addr() AS server_address",
    );
    const row = identity.rows[0];
    if (
      row?.database_name !== "ledgerly_w03_invoice_demo" ||
      row?.role_name !== "ledgerly_api" ||
      row?.server_address !== null
    ) throw new DemoBootstrapError(503, "ISOLATED_DEMO_DATABASE_REQUIRED");

    await ensureCompany(client, vatCompanyId, "Ledgerly Synthetic Invoice Demo — Standard VAT", true);
    await ensureCompany(client, noVatCompanyId, "Ledgerly Synthetic Invoice Demo — No VAT", false);
    await ensureOwnerMembership(client, vatCompanyId, userId);
    await ensureOwnerMembership(client, noVatCompanyId, userId);
    await ensureCustomer(client, vatCustomerId, vatCompanyId);
    await ensureCustomer(client, noVatCustomerId, noVatCompanyId);
    await ensureTaxRule(client, deterministicUuid("vat-standard", userId), vatCompanyId,
      "DEMO_20", "Synthetic standard VAT 20%", "20.00", "standard", "2011-01-04");
    await ensureTaxRule(client, deterministicUuid("vat-reduced", userId), vatCompanyId,
      "DEMO_5", "Synthetic reduced VAT 5%", "5.00", "reduced", "1997-09-01");
    await ensureTaxRule(client, deterministicUuid("vat-no-vat", userId), noVatCompanyId,
      "DEMO_NO_VAT", "Synthetic no-VAT treatment", "0.00", "no_vat", "2026-01-01");
    await client.query("COMMIT");
    res.status(200).json({
      vatCompanyId,
      noVatCompanyId,
      label: "Synthetic development data only",
    });
  } catch (err: unknown) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    if (err instanceof DemoBootstrapError) {
      res.status(err.status).json({ error: { code: err.code } });
      return;
    }
    req.log.error({ err }, "synthetic invoice demo bootstrap failed");
    res.status(500).json({ error: { code: "DEMO_BOOTSTRAP_FAILED" } });
  } finally {
    client?.release();
  }
});

export default router;
