// Sentry instrumentation — MUST be imported first (before any instrumented module).
// dotenv runs here too so a local `.env` SENTRY_DSN is available before Nest loads.
import "dotenv/config";
import * as Sentry from "@sentry/nestjs";
import { scrubSentryEvent } from "./observability/sentry-scrubber";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    sendDefaultPii: false,
    // Automatic HTTP/SQL instrumentation can collect URLs, queries and provider payloads.
    defaultIntegrations: false,
    integrations: [Sentry.onUncaughtExceptionIntegration(), Sentry.onUnhandledRejectionIntegration()],
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: () => null,
    beforeBreadcrumb: () => null,
  });
}
