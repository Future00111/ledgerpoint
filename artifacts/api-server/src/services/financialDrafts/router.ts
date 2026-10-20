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
      if (Object.keys(req.query).length || req.headers["x-company-id"]) fail(400, "CONTEXT_CONFLICT");
      if (["POST", "PATCH"].includes(req.method) && !req.is("application/json")) fail(415, "UNSUPPORTED_MEDIA_TYPE");
      next();
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
        ? "Draft saving is held until approved VAT and lifecycle providers are connected."
        : safe.code === "LEGACY_DRAFT_REVIEW_REQUIRED"
        ? "This older invoice needs reviewed source and tax mapping before it can be edited here. No legacy data was changed."
        : "Draft request could not be completed.", request_id: randomUUID(),
      issues: safe.path ? [{ path: safe.path, code: safe.code }] : [] } });
  }) as import("express").ErrorRequestHandler);
  return router;
}
