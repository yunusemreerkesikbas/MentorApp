// Sentry instrumentation — MUST be imported first (before any instrumented module).
// dotenv runs here too so a local `.env` SENTRY_DSN is available before Nest loads.
import "dotenv/config";
import * as Sentry from "@sentry/nestjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
  });
}
