import express, { type Express, type RequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

export interface ApiAppOptions {
  /**
   * Optional middleware installed before Clerk. This is only used by isolated
   * integration tests that provide an already-authenticated Clerk request.
   */
  beforeClerkMiddleware?: RequestHandler;
}

export function createApp({ beforeClerkMiddleware }: ApiAppOptions = {}): Express {
const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

if (beforeClerkMiddleware) app.use(beforeClerkMiddleware);

// Clerk proxy must come before body parsers (streams raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allow only known Ledgerly origins. Never reflect arbitrary Origin headers for
// credentialed requests — that allows cross-site reads of the Clerk session.
const ALLOWED_ORIGINS = new Set<string>(
  [
    process.env.ALLOWED_ORIGIN,          // set in production (e.g. https://ledgerly.example.com)
    process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : undefined,
    "http://localhost:5173",
    "http://localhost:3000",
  ].filter(Boolean) as string[],
);

app.use(
  cors({
    credentials: true,
    origin(requestOrigin, callback) {
      // Same-origin / server-to-server requests have no Origin header — allow.
      if (!requestOrigin) return callback(null, true);
      if (ALLOWED_ORIGINS.has(requestOrigin)) return callback(null, requestOrigin);
      callback(new Error(`CORS: origin '${requestOrigin}' not allowed`));
    },
  }),
);

// ── CSRF / origin check for unsafe methods ───────────────────────────────────
// For state-changing requests from a browser the Origin header must be present
// and must match an allowed origin. This prevents cross-site form submissions.
app.use((req, res, next) => {
  const unsafe = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!unsafe) return next();
  // Skip Clerk proxy path (handled above) and pre-flight OPTIONS
  if (req.method === "OPTIONS") return next();
  if (req.path.startsWith(CLERK_PROXY_PATH)) return next();
  const origin = req.headers["origin"] as string | undefined;
  // Non-browser (no Origin header) — allow (server-to-server, curl, etc.)
  if (!origin) return next();
  if (ALLOWED_ORIGINS.has(origin)) return next();
  res.status(403).json({ error: "CSRF: origin not permitted" });
});

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Resolve publishable key from request host (supports custom domains)
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

return app;
}

const app = createApp();

export default app;
