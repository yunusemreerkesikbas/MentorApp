import { randomUUID } from "node:crypto";
import type { Params } from "nestjs-pino";

/**
 * Structured logging (pino) with a correlation/request id.
 *
 * - `genReqId`: reuse an incoming `x-request-id` (from a gateway/proxy) or generate one;
 *   echo it back on the response so clients/traces can correlate.
 * - `redact`: never log secrets/PII (auth headers, cookies, passwords, tokens).
 * - dev: pretty single-line; prod: JSON.
 */
export function buildLoggerConfig(nodeEnv: string): Params {
  const isProd = nodeEnv === "production";
  return {
    pinoHttp: {
      level: isProd ? "info" : "debug",
      genReqId: (req, res) => {
        const incoming = req.headers["x-request-id"];
        const id = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.body.password",
          "req.body.token",
          "req.body.cardToken",
          "*.password",
          "*.secret",
        ],
        remove: true,
      },
      // JSON logs in every env (robust + parseable). For pretty local logs, pipe the
      // process through the pino-pretty CLI: `pnpm --filter @mentor/api dev | pino-pretty`.
      // (A pino-pretty worker transport hangs bootstrap on Windows, so we avoid it.)
    },
  };
}
