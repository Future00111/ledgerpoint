import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { InvoiceDraftService } from "../services/financialDrafts/invoiceService";
import { invoiceDraftRouter } from "../services/financialDrafts/router";

// No approved transaction-bound VAT/lifecycle provider is configured yet.
// Do NOT replace this hold with a nominal-rate fallback or environment toggle.
export default invoiceDraftRouter(new InvoiceDraftService(pool), requireAuth);
