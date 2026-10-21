import { randomUUID } from "node:crypto";
import { Router, type Request, type RequestHandler } from "express";
import { DraftError, fail } from "./contract";
import type { InvoiceDraftService } from "./invoiceService";

export function invoiceDraftRouter(service: InvoiceDraftService, auth: RequestHandler) {
  const router = Router({ mergeParams: true });
  router.use(auth);
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      if (req.path === "/context" && req.method !== "GET") fail(405, "OPERATION_NOT_SUPPORTED");
      if (Object.keys(req.query).length || req.headers["x-company-id"]) fail(400, "CONTEXT_CONFLICT");
      if (["POST", "PATCH"].includes(req.method) && !req.is("application/json")) fail(415, "UNSUPPORTED_MEDIA_TYPE");
      next();
    } catch (e) { next(e); }
  });
  router.get("/context", async (req, res, next) => {
    try {
      const data = await service.context(
        String((req.params as { companyId?: string }).companyId),
        (req as Request & { userId: string }).userId,
      );
      res.json({ data, request_id: randomUUID() });
    } catch (e) { next(e); }
  });
  const read: RequestHandler = async (req, res, next) => {
    try {
      const data = await service.get(String(req.params.companyId), (req as Request & { userId: string }).userId, String(req.params.id));
      res.set("ETag", `"${data.revision}"`).json({ data, request_id: randomUUID() });
    } catch (e) { next(e); }
  };
  router.get("/:id", read);
  const write: RequestHandler = async (req, res, next) => {
    try {
      const data = await service.save(String(req.params.companyId), (req as Request & { userId: string }).userId,
        req.body, req.params.id ? String(req.params.id) : undefined, req.get("If-Match"));
      res.set("ETag", `"${data.revision}"`).status(req.method === "POST" ? 201 : 200).json({ data, request_id: data.request_id });
    } catch (e) { next(e); }
  };
  router.post("/", write);
  router.patch("/:id", write);
  router.use((_req, _res, next) => next(new DraftError(405, "OPERATION_NOT_SUPPORTED")));
  router.use(((error, _req, res, _next) => {
    const safe = error instanceof DraftError ? error : new DraftError(500, "INTERNAL_ERROR");
    res.status(safe.status).json({ error: { code: safe.code,
      message: safe.code === "AUTHORITY_UNAVAILABLE"
        ? "The server could not verify the current draft rules. No changes were saved."
        : safe.code === "ROUNDING_POLICY_REQUIRED"
        ? "This amount cannot be safely represented by the supported development calculation. No changes were saved."
        : safe.code === "TAX_RULE_NOT_FOUND"
        ? "No active company tax rule matches this code and invoice date."
        : safe.code === "TAX_RULE_AMBIGUOUS"
        ? "More than one active company tax rule matches this code and invoice date."
        : safe.code === "TAX_RULE_UNSUPPORTED"
        ? "This company tax rule is outside the supported VAT treatments."
        : safe.code === "TAX_SETUP_MISMATCH"
        ? "This tax code does not match the company's VAT registration status."
        : safe.code === "VAT_SETUP_UNSUPPORTED"
        ? "This draft currently supports standard-scheme, invoice-basis VAT only."
        : safe.code === "VAT_SETUP_INCOMPLETE"
        ? "Complete the company's VAT registration settings before saving this draft."
        : safe.code === "DOCUMENT_HAS_FINANCIAL_LINK"
        ? "This invoice has a bank or payment link and cannot be changed as a draft."
        : safe.code === "LEGACY_DRAFT_REVIEW_REQUIRED"
        ? "This older invoice needs reviewed source and tax mapping before it can be edited here. No legacy data was changed."
        : "Draft request could not be completed.", request_id: randomUUID(),
      issues: safe.path ? [{ path: safe.path, code: safe.code }] : [] } });
  }) as import("express").ErrorRequestHandler);
  return router;
}
