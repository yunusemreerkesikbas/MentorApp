import { safeApiCode, safeErrorMetadata, validRequestId } from "./safe-diagnostics";

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE"]);
const EVENTS = new Set(["http.exception", "turnstile.verify_failed", "database.idle_client_error"]);

export function safeRequest(value: unknown): Record<string, unknown> {
  const req = (value ?? {}) as { id?: unknown; method?: unknown; url?: unknown; path?: unknown; route?: { path?: unknown } };
  const route = typeof req.route?.path === "string" && !/[{}*]/.test(req.route.path)
    ? req.route.path : undefined;
  const raw = route ?? (typeof req.url === "string" ? req.url : req.path);
  const path = typeof raw === "string" && raw.startsWith("/")
    ? stripControlCharacters(raw.split(/[?#]/, 1)[0] ?? "")
      .replace(/^(\/v1\/storage\/uploads)\/[^/]+/, "$1/:ticket").slice(0, 512)
    : undefined;
  return { id: validRequestId(req.id), method: typeof req.method === "string" && METHODS.has(req.method) ? req.method : "UNKNOWN", path };
}

function stripControlCharacters(value: string): string {
  return [...value].filter((character) => {
    const code = character.charCodeAt(0);
    return code > 31 && code !== 127;
  }).join("");
}

export function safeResponse(value: unknown): { statusCode?: number } {
  const status = (value as { statusCode?: unknown } | undefined)?.statusCode;
  return { statusCode: typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined };
}

/** Final allowlist also covers legacy module logs which interpolate provider errors into prose. */
export function safeLogRecord(value: unknown): Record<string, unknown> {
  if (value instanceof Error) return { err: safeErrorMetadata(value) };
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  if (record.req) result.req = safeRequest(record.req);
  if (record.res) result.res = safeResponse(record.res);
  if (record.err) result.err = safeErrorMetadata(record.err);
  const requestId = validRequestId(record.requestId ?? record.reqId);
  if (requestId) result.requestId = requestId;
  const code = safeApiCode(record.code);
  if (code) result.code = code;
  const status = safeResponse(record).statusCode;
  if (status) result.statusCode = status;
  if (typeof record.responseTime === "number" && Number.isFinite(record.responseTime) && record.responseTime >= 0) result.responseTime = record.responseTime;
  if (typeof record.context === "string" && /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(record.context)) result.context = record.context;
  if (typeof record.event === "string" && EVENTS.has(record.event)) result.event = record.event;
  return result;
}
