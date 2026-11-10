import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, Request } from "express";
import { checkDraftJson, DraftError } from "./contract";

const intake = (req: Request) => /(?:^|\/)document-intake(?:\/|$)/i.test(req.path);
const applies = (req: Request) => req.path.toLowerCase().includes("/financial-drafts/") || intake(req);
export function verifyDraftBody(req: Request, _res: unknown, buffer: Buffer) {
  if (!applies(req)) return;
  // Base64 capture uploads have a 5 MiB decoded bound checked before decoding.
  // Reviews and native drafts retain the smaller financial-payload boundary.
  const limit = /\/document-intake\/upload\/?$/i.test(req.path) ? 8 * 1024 * 1024 : 1024 * 1024;
  if (buffer.length > limit) throw new DraftError(413, "BODY_TOO_LARGE");
  checkDraftJson(buffer.toString("utf8"));
}
export const draftParserErrors: ErrorRequestHandler = (error, req, res, next) => {
  if (!applies(req)) return next(error);
  const safe = error instanceof DraftError ? error : new DraftError(
    (error as { status?: number }).status === 413 ? 413 : 400,
    (error as { status?: number }).status === 413 ? "BODY_TOO_LARGE" : "MALFORMED_JSON");
  res.status(safe.status).set("Cache-Control", "no-store").json({ error: {
    code: safe.code, message: intake(req) ? "Invalid document capture request." : "Invalid draft request.", request_id: randomUUID(), issues: [] } });
};
