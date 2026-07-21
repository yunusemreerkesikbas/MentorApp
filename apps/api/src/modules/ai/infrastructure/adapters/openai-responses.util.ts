/**
 * Shared helpers for the OpenAI Responses API adapters (LLM + vision). Both call POST /v1/responses
 * with the fetch client (no SDK) and must parse the same envelope, so the walk + error redaction
 * live here once.
 */

/** Redacted provider-error log line: status + request id only, never the response body. */
export function providerErrorLog(operation: string, response: Response): string {
  const requestId = response.headers.get("x-request-id");
  return `OpenAI ${operation} ${response.status}${requestId ? ` request_id=${requestId}` : ""}`;
}

/** Raw-HTTP shape: `output_text` is an SDK convenience only — walk the output items instead. */
export function collectOutputText(output: unknown): string {
  if (!Array.isArray(output)) return "";
  return output
    .filter((item): item is { type: string; content?: unknown[] } =>
      typeof item === "object" && item !== null && (item as { type?: string }).type === "message",
    )
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .filter(
      (part): part is { type: string; text: string } =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: string }).type === "output_text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("");
}
