import { randomUUID } from "node:crypto";
import type { Params } from "nestjs-pino";
import { safeLogRecord, safeRequest, safeResponse } from "./log-record";
import { safeErrorMetadata, validRequestId } from "./safe-diagnostics";

/**
 * Structured logging (pino) with a correlation/request id.
 *
 * - `genReqId`: reuse only an unambiguous UUID `x-request-id` or generate one;
 *   echo it back on the response so clients/traces can correlate.
 * - Request/response, error and application records are allowlisted in every environment.
 * - Freeform messages are omitted because legacy callers interpolate private provider data.
 */
export function buildLoggerConfig(nodeEnv: string): Params {
  const isProd = nodeEnv === "production";
  return {
    pinoHttp: {
      level: isProd ? "info" : "debug",
      genReqId: (req, res) => {
        const incoming = req.headers["x-request-id"];
        const id = validRequestId(incoming) ?? randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      wrapSerializers: false,
      serializers: { req: safeRequest, res: safeResponse, err: safeErrorMetadata },
      formatters: { bindings: safeLogRecord },
      hooks: {
        logMethod(args, method) {
          const record = safeLogRecord(args[0]);
          // Do not forward format strings or their extra arguments to pino interpolation.
          method.call(this, record, record.res ? "http request completed" : "application log");
        },
      },
      // JSON logs in every env (robust + parseable). For pretty local logs, pipe the
      // process through the pino-pretty CLI: `pnpm --filter @mentor/api dev | pino-pretty`.
      // (A pino-pretty worker transport hangs bootstrap on Windows, so we avoid it.)
    },
  };
}
