import * as Sentry from "@sentry/nestjs";

/**
 * Re-export of the Sentry SDK for use in app code (e.g. the exception filter).
 * Initialisation lives in `src/instrument.ts` (imported first in main.ts).
 * `Sentry.captureException` is a no-op when Sentry was not initialised (no DSN).
 */
export { Sentry };
