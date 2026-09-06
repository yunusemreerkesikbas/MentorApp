import type { Event } from "@sentry/nestjs";
import { safeApiCode, safeDiagnosticCode, safeErrorType, safeFingerprint, safeSourcePath, validRequestId } from "./safe-diagnostics";

/** Rebuild the event, never mutate/denylist it: SDK integrations can attach arbitrary user data. */
export function scrubSentryEvent<T extends Event>(event: T): T {
  const tags: Record<string, string> = {};
  const code = safeApiCode(event.tags?.code);
  const requestId = validRequestId(event.tags?.requestId);
  if (code) tags.code = code;
  if (requestId) tags.requestId = requestId;
  const diagnosticCode = safeDiagnosticCode(event.tags?.diagnosticCode);
  const fingerprint = safeFingerprint(event.tags?.errorFingerprint);
  if (diagnosticCode) tags.diagnosticCode = diagnosticCode;
  if (fingerprint) tags.errorFingerprint = fingerprint;
  const result: Event = {
    event_id: event.event_id,
    timestamp: event.timestamp,
    level: event.level,
    platform: "node",
    environment: ["development", "test", "production"].includes(event.environment ?? "") ? event.environment : undefined,
    tags,
    fingerprint: fingerprint ? [code ?? "INTERNAL_ERROR", fingerprint] : undefined,
    exception: {
      values: (event.exception?.values ?? [{ type: "Error" }]).slice(0, 5).map((exception) => ({
        type: safeErrorType(exception.type),
        value: "Error details omitted",
        stacktrace: {
          frames: (exception.stacktrace?.frames ?? []).slice(-20).flatMap((frame) => {
            const filename = safeSourcePath(frame.filename);
            return filename ? [{ filename, lineno: frame.lineno, colno: frame.colno, in_app: frame.in_app }] : [];
          }),
        },
      })),
    },
  };
  return result as T;
}
