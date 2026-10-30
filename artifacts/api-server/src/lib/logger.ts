import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const securityLogOptions = {
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
