import { createHash } from "node:crypto";
import { ErrorCode } from "../common/errors/error-code";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ERROR_TYPES = new Set(["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "AggregateError", "AbortError", "TimeoutError", "DomainError"]);
const NETWORK_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "ABORT_ERR"]);
const API_CODES = new Set<string>(Object.values(ErrorCode));

export function validRequestId(value: unknown): string | undefined {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : undefined;
}

export function safeApiCode(value: unknown): string | undefined {
  return typeof value === "string" && API_CODES.has(value) ? value : undefined;
}

export function safeErrorType(value: unknown): string {
  return typeof value === "string" && ERROR_TYPES.has(value) ? value : "Error";
}

export function safeDiagnosticCode(value: unknown): string | undefined {
  return typeof value === "string" && (/^[0-9]{2}[0-9A-Z]{3}$/.test(value) || NETWORK_CODES.has(value) || API_CODES.has(value)) ? value : undefined;
}

export function safeFingerprint(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-f0-9]{16}$/.test(value) ? value : undefined;
}

export function safeSourcePath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replaceAll("\\", "/");
  return normalized.match(/(?:^|\/)((?:src|dist|node_modules)\/[A-Za-z0-9@_+./-]+\.(?:ts|js|mjs|cjs))$/)?.[1];
}

/** Never serialize messages, causes, SQL, provider responses or enumerable Error properties. */
export function safeErrorMetadata(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") return { type: "Error" };
  const source = error as { name?: unknown; type?: unknown; code?: unknown; stack?: unknown; cause?: unknown; fingerprint?: unknown };
  const result: Record<string, unknown> = { type: safeErrorType(source.name ?? source.type) };
  const cause = source.cause && typeof source.cause === "object" ? source.cause as { code?: unknown } : undefined;
  const code = safeDiagnosticCode(source.code ?? cause?.code);
  if (code) result.code = code;
  const fingerprint = safeFingerprint(source.fingerprint);
  if (fingerprint) result.fingerprint = fingerprint;
  if (typeof source.stack === "string") {
    // The message is the first line. Hash frames for grouping without retaining arbitrary source text.
    const frames = source.stack.split("\n").filter((line) => /^\s+at /.test(line)).join("\n");
    if (frames) result.fingerprint = createHash("sha256").update(frames).digest("hex").slice(0, 16);
  }
  return result;
}
