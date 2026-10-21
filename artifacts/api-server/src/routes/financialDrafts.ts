import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { InvoiceDraftService } from "../services/financialDrafts/invoiceService";
import { createProductionInvoiceDraftAuthority } from "../services/financialDrafts/productionAuthority";
import { invoiceDraftRouter } from "../services/financialDrafts/router";

export default invoiceDraftRouter(
  new InvoiceDraftService(pool, createProductionInvoiceDraftAuthority()),
  requireAuth,
);
