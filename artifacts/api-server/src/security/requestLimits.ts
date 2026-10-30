import type { RequestHandler } from "express";
import { RejectedOriginError } from "./appErrors";

// UNENABLED policy utility: app.ts deliberately does not mount this limiter.
// A shared reverse-proxy socket would otherwise throttle all users as one client.
// Process-local admission protection, not a distributed/per-user quota. Use the
// socket identity, never caller-supplied forwarding headers. A trusted deployment
// edge must enforce its own limits before proxying traffic to this process.
export function requestAdmission({ limit = 600, windowMs = 60_000, maxClients = 10_000,
  now = Date.now }: { limit?: number; windowMs?: number; maxClients?: number; now?: () => number } = {}): RequestHandler {
  if (![limit, windowMs, maxClients].every(value => Number.isSafeInteger(value) && value > 0)) {
    throw new Error("Invalid request admission policy");
  }
  const clients = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    const at = now();
    // Bounded storage: remove expired entries before admitting a new identity;
    // never evict a live counter, which would let rotating clients bypass limits.
    const key = req.socket.remoteAddress ?? "unknown";
    let counter = clients.get(key);
    if (counter && at >= counter.until) { clients.delete(key); counter = undefined; }
    if (!counter) {
      for (const [id, entry] of clients) if (at >= entry.until) clients.delete(id);
      if (clients.size >= maxClients) {
        res.status(503).set("Retry-After", String(Math.ceil(windowMs / 1000)))
          .set("Cache-Control", "no-store").json({ error: "Request capacity is temporarily unavailable. Please try again." });
        return;
      }
      counter = { count: 0, until: at + windowMs }; clients.set(key, counter);
    }
    if (counter.count >= limit) {
      res.status(429).set("Retry-After", String(Math.max(1, Math.ceil((counter.until - at) / 1000))))
        .set("Cache-Control", "no-store").json({ error: "Too many requests. Please try again later." });
      return;
    }
    counter.count++; next();
  };
}

/** API responses contain financial/personal data, including successful reads. */
export const apiResponseHeaders: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "no-store").set("X-Content-Type-Options", "nosniff")
    .set("Referrer-Policy", "no-referrer");
  next();
};

/** Run after the allowlist CORS check and after the isolated Clerk proxy. */
export const rejectCrossSiteUnsafeRequest: RequestHandler = (req, _res, next) => {
  const unsafe = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  // An explicit Origin already passed the allowlist. A missing Origin must not
  // erase the browser's explicit cross-site signal (for example a stripped
  // Origin at an intermediary). These headers are not authentication evidence.
  const fetchSite = req.headers["sec-fetch-site"];
  if (unsafe && !req.headers.origin && typeof fetchSite === "string" && fetchSite.toLowerCase() === "cross-site") {
    next(new RejectedOriginError());
    return;
  }
  next();
};
