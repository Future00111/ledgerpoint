import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import entitiesRouter from "./entities";
import companiesRouter from "./companies";
import functionsRouter from "./functions";
import aiAccountantRouter from "./aiAccountant";
import financialDraftsRouter from "./financialDrafts";
import invoiceDemoRouter from "./invoiceDemo";
import accountingDocumentsRouter from "./accountingDocuments";
import accountingDemoRouter from "./accountingDemo";
import { isInvoiceDemoModeEnabled } from "@workspace/db";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use("/companies", companiesRouter);
router.use("/companies/:companyId", accountingDocumentsRouter);
router.use("/companies/:companyId/financial-drafts/invoices", financialDraftsRouter);
if (isInvoiceDemoModeEnabled) router.use("/dev/invoice-demo", invoiceDemoRouter);
if (isInvoiceDemoModeEnabled) router.use("/dev/accounting-flow", accountingDemoRouter);
router.use("/entities", entitiesRouter);
router.use("/functions", functionsRouter);
router.use("/ai", aiAccountantRouter);

export default router;
