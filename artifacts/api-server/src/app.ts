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
import { verifyDraftBody, draftParserErrors } from "./services/financialDrafts/jsonBoundary";
import { RejectedOriginError, safeAppErrors } from "./security/appErrors";
import { apiResponseHeaders, rejectCrossSiteUnsafeRequest } from "./security/requestLimits";

export interface ApiAppOptions {
  /**
   * Optional middleware installed before Clerk. This is only used by isolated
   * integration tests that provide an already-authenticated Clerk request.
   */
  beforeClerkMiddleware?: RequestHandler;
}

export function createApp({ beforeClerkMiddleware }: ApiAppOptions = {}): Express {
const app: Express = express();
app.disable("x-powered-by");

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

// Apply financial response headers after the Clerk streaming proxy so its session
// and asset transport remain unchanged. Admission is not enabled until the trusted
// edge/client identity and distributed quota policy are verified for deployment.
app.use("/api", apiResponseHeaders);

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allow only known Ledgerly origins. Never reflect arbitrary Origin headers for
// credentialed requests — that allows cross-site reads of the Clerk session.
const ALLOWED_ORIGINS = new Set<string>(
  [
    process.env.ALLOWED_ORIGIN,          // set in production (e.g. https://ledgerly.example.com)
    process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : undefined,
    ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173", "http://localhost:3000"]),
  ].filter(Boolean) as string[],
);

app.use(
  cors({
    credentials: true,
    origin(requestOrigin, callback) {
      // Same-origin / server-to-server requests have no Origin header — allow.
      if (!requestOrigin) return callback(null, true);
      if (ALLOWED_ORIGINS.has(requestOrigin)) return callback(null, requestOrigin);
      callback(new RejectedOriginError());
    },
  }),
);

// CORS validates every supplied Origin above. Fetch Metadata also identifies
// browser cross-site writes that arrive without an Origin header. Keep clients
// without browser metadata supported; this is defence in depth, not a substitute
// for Clerk authentication and protected financial action authorization.
app.use(rejectCrossSiteUnsafeRequest);

app.use(cookieParser());
app.use(express.json({ limit: "10mb", verify: verifyDraftBody }));
app.use(draftParserErrors);
app.use(express.urlencoded({ extended: false, limit: "100kb", parameterLimit: 100 }));

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
app.use(safeAppErrors);

return app;
}

const app = createApp();

export default app;
