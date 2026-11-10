import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

// Never persist raw request targets: even a path segment can carry a token or
// personal data. Correlate diagnostics by the generated request id instead.
export const httpLogSerializers = {
  req(req: { id?: unknown; method?: unknown }) {
    return { id: req.id, method: req.method };
  },
  res(res: { statusCode?: unknown }) {
    return { statusCode: res.statusCode };
  },
};

export const securityLogOptions = {
  hooks: {
    logMethod(args, method) {
      const first = args[0];
      // Pino infers msg from err.message BEFORE applying its err serializer.
      // Supply a fixed message for implicit error logging as well as redacting
      // the structured error. Explicit application messages remain unchanged.
      if (args[1] === undefined && (first instanceof Error ||
        (first !== null && typeof first === "object" && ("err" in first || "error" in first)))) {
        args[1] = "Request failed";
      }
      method.apply(this, args);
    },
  },
  // Errors may carry tokens, provider bodies and SQL/financial values in their
  // messages, stacks or causes. Preserve only a fixed diagnostic category.
  serializers: { err: () => ({ type: "RedactedError" }), error: () => ({ type: "RedactedError" }) },
  redact: [
    "req.body", "req.query", "body", "token", "access_token", "refresh_token",
    "password", "secret", "response", "providerResponse",
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
} satisfies pino.LoggerOptions;

export const logger = pino({
  ...securityLogOptions,
  level: process.env.LOG_LEVEL ?? "info",
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
