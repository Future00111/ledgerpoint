import type { ErrorRequestHandler } from "express";

/** Only our origin decision may produce this response; never include the supplied origin. */
export class RejectedOriginError extends Error {
  constructor() {
    super("Request origin is not permitted.");
    this.name = "RejectedOriginError";
  }
}

type SafeAppError = Readonly<{ status: number; error_code: string; message: string }>;

const unexpected: SafeAppError = Object.freeze({
  status: 500,
  error_code: "unexpected_error",
  message: "Unable to complete this request. Please try again.",
});

const parserErrors: Readonly<Record<string, SafeAppError>> = Object.freeze({
  "entity.parse.failed": { status: 400, error_code: "invalid_body", message: "The request body is invalid." },
  "request.size.invalid": { status: 400, error_code: "invalid_body", message: "The request body is invalid." },
  "request.aborted": { status: 400, error_code: "incomplete_body", message: "The request body was not received completely." },
  "entity.too.large": { status: 413, error_code: "body_too_large", message: "The request body is too large." },
  "parameters.too.many": { status: 413, error_code: "body_too_large", message: "The request body is too large." },
  "charset.unsupported": { status: 415, error_code: "unsupported_encoding", message: "The request encoding is not supported." },
  "encoding.unsupported": { status: 415, error_code: "unsupported_encoding", message: "The request encoding is not supported." },
});

/** Ignore arbitrary messages/statuses, stacks, causes, headers, bodies and provider payloads. */
export function appErrorResponse(error: unknown): SafeAppError {
  if (error instanceof RejectedOriginError) {
    return { status: 403, error_code: "origin_not_permitted", message: "Request origin is not permitted." };
  }
  if (error instanceof Error) {
    const candidate = error as Error & { type?: unknown; status?: unknown };
    // body-parser's fixed type and status must agree. A generic SyntaxError or arbitrary
    // HTTP-like Error is not proof that the caller sent an invalid request.
    if (typeof candidate.type === "string" && Object.hasOwn(parserErrors, candidate.type)) {
      const known = parserErrors[candidate.type as keyof typeof parserErrors];
      if (candidate.status === known.status) return known;
    }
  }
  return unexpected;
}

/** Last in the app stack, after parsers, Clerk and routers. Domain handlers run first. */
export const safeAppErrors: ErrorRequestHandler = (error, req, res, _next) => {
  const safe = appErrorResponse(error);
  req.log?.error({ error_code: safe.error_code }, "Request failed");
  if (res.headersSent) {
    // A partial response cannot become JSON. Close it without passing the original
    // error to Express's default handler, which logs raw diagnostics in development.
    res.destroy();
    return;
  }
  res.status(safe.status)
    .set("Cache-Control", "no-store")
    .set("X-Content-Type-Options", "nosniff")
    .json({ error: safe.message });
};
