import pino from "pino";

const REDACT_PATHS = [
  "password",
  "passwordHash",
  "token",
  "cardToken",
  "authorization",
  "cookie",
  "cpf",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.cardToken",
  "*.authorization",
  "*.cookie",
  "*.cpf",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
  base: {
    service: "modelo-loja-online",
    env: process.env.NODE_ENV ?? "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
});

export function createRequestLogger(requestId: string, context?: Record<string, unknown>) {
  return logger.child({
    requestId,
    ...context,
  });
}
