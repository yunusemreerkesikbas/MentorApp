import type {
  CoachAccessDto,
  CoachChatReplyDto,
  CoachChatStreamEvent,
  CoachMessageDto,
  Paginated,
  SessionReflectionDto,
} from "@mentor/types";
import { http, httpRaw, throwApiClientError } from "@mentor/api-client";

/**
 * Typed wrappers over the AI coach endpoints. Regen api-client when OpenAPI updates;
 * shapes are asserted here in one place (mirrors study-sessions pattern).
 */
export interface CoachSource {
  title: string;
  slug: string;
  url: string;
}

export type CoachReply = CoachChatReplyDto;

export async function fetchCoachAccess(): Promise<CoachAccessDto> {
  return (await http<CoachAccessDto>("/v1/coach/access")) as CoachAccessDto;
}

export async function sendCoachMessage(
  message: string,
  clientMessageId?: string,
): Promise<CoachReply> {
  return (await http<CoachReply>("/v1/coach/chat", {
    method: "POST",
    body: JSON.stringify({ message, ...(clientMessageId ? { clientMessageId } : {}) }),
  })) as CoachReply;
}

/** Mid-stream failure (SSE `error` event / truncated stream) — caller shows its own localized copy. */
export class CoachStreamError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "CoachStreamError";
  }
}

/**
 * Streaming chat (SSE over POST). Calls `onDelta` as text arrives and resolves with the full
 * reply. Pre-stream gating errors throw the usual localized ApiClientError; browsers without
 * ReadableStream fall back to the blocking endpoint.
 */
export async function streamCoachMessage(
  message: string,
  clientMessageId: string | undefined,
  onDelta: (delta: string) => void,
): Promise<CoachReply> {
  const res = await httpRaw("/v1/coach/chat/stream", {
    method: "POST",
    body: JSON.stringify({ message, ...(clientMessageId ? { clientMessageId } : {}) }),
  });
  if (!res.ok) await throwApiClientError(res);
  if (!res.body) return sendCoachMessage(message, clientMessageId);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: CoachReply | null = null;

  for (;;) {
    const { value, done: eof } = await reader.read();
    if (eof) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames end with a blank line; the trailing partial frame stays in the buffer.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("");
      if (!data) continue;
      const event = JSON.parse(data) as CoachChatStreamEvent;
      if ("delta" in event) onDelta(event.delta);
      else if ("done" in event) done = event.done;
      else if ("error" in event) throw new CoachStreamError(event.error.code);
    }
  }

  if (!done) throw new CoachStreamError("AI_PROVIDER_ERROR");
  return done;
}

/** Persisted rolling chat history, newest-first (page/pageSize appended manually — study-sessions pattern). */
export async function listCoachMessages(
  page = 1,
  pageSize = 30,
): Promise<Paginated<CoachMessageDto>> {
  return (await http<Paginated<CoachMessageDto>>(
    `/v1/coach/messages?page=${page}&pageSize=${pageSize}`,
  )) as Paginated<CoachMessageDto>;
}

/** "Yeni sohbet" — clears the persisted rolling conversation on the backend. */
export async function clearCoachHistory(): Promise<void> {
  await http<void>("/v1/coach/messages", { method: "DELETE" });
}

/** Premium session reflection after micro check-in; 403 for free — caller should stay silent. */
export async function requestSessionReflection(
  sessionId: string,
): Promise<SessionReflectionDto> {
  return (await http<SessionReflectionDto>("/v1/coach/session-reflection", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  })) as SessionReflectionDto;
}
