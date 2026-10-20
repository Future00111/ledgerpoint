import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, Request } from "express";
import { checkDraftJson, DraftError } from "./contract";

const applies = (req: Request) => req.path.includes("/financial-drafts/");
export function verifyDraftBody(req: Request, _res: unknown, buffer: Buffer) {
  if (!applies(req)) return;
  if (buffer.length > 1024 * 1024) throw new DraftError(413, "BODY_TOO_LARGE");
  checkDraftJson(buffer.toString("utf8"));
}
export const draftParserErrors: ErrorRequestHandler = (error, req, res, next) => {
  if (!applies(req)) return next(error);
  const safe = error instanceof DraftError ? error : new DraftError(
    (error as { status?: number }).status === 413 ? 413 : 400,
    (error as { status?: number }).status === 413 ? "BODY_TOO_LARGE" : "MALFORMED_JSON");
  res.status(safe.status).set("Cache-Control", "no-store").json({ error: {
    code: safe.code, message: "Invalid draft request.", request_id: randomUUID(), issues: [] } });
};
