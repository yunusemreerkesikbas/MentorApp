import type {
  CoachAccessDto,
  CoachChatReplyDto,
  CoachChatStreamEvent,
  CoachConversationDto,
  CoachMemoryDto,
  CoachMessageDto,
  CoachPlanDraftDto,
  DailyGreetingDto,
  Paginated,
  SessionReflectionDto,
} from "@mentor/types";
import type { PlanDraftInput } from "@mentor/validation";
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

export function buildCoachMockExamHref(
  seed: string,
  contextMockExamId: string,
) {
  return {
    pathname: "/koc/chat" as const,
    query: { seed, contextMockExamId },
  };
}

export function resolvePendingMockExamContext(
  contextMockExamId: string | null,
  appliedContextMockExamId: string | null,
): string | undefined {
  return contextMockExamId && contextMockExamId !== appliedContextMockExamId
    ? contextMockExamId
    : undefined;
}

export function removeMockExamContextFromUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("contextMockExamId");
  return `${url.pathname}${url.search}${url.hash}`;
}

export async function fetchCoachAccess(): Promise<CoachAccessDto> {
  return (await http<CoachAccessDto>("/v1/coach/access")) as CoachAccessDto;
}

/** Premium 7-day coach draft preview; persistence happens only after the separate W2 bulk confirm. */
export async function requestCoachPlanDraft(
  input: PlanDraftInput,
): Promise<CoachPlanDraftDto> {
  return (await http<CoachPlanDraftDto>("/v1/coach/plan-draft", {
    method: "POST",
    body: JSON.stringify(input),
  })) as CoachPlanDraftDto;
}

export async function sendCoachMessage(
  message: string,
  clientMessageId?: string,
  conversationId?: string,
  contextMockExamId?: string,
): Promise<CoachReply> {
  return (await http<CoachReply>("/v1/coach/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      ...(clientMessageId ? { clientMessageId } : {}),
      ...(conversationId ? { conversationId } : {}),
      ...(contextMockExamId ? { contextMockExamId } : {}),
    }),
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
  conversationId?: string,
  contextMockExamId?: string,
): Promise<CoachReply> {
  const res = await httpRaw("/v1/coach/chat/stream", {
    method: "POST",
    body: JSON.stringify({
      message,
      ...(clientMessageId ? { clientMessageId } : {}),
      ...(conversationId ? { conversationId } : {}),
      ...(contextMockExamId ? { contextMockExamId } : {}),
    }),
  });
  if (!res.ok) await throwApiClientError(res);
  if (!res.body) {
    return sendCoachMessage(message, clientMessageId, conversationId, contextMockExamId);
  }
  return readCoachSseStream(res.body, onDelta);
}

/**
 * Regenerate the LAST coach reply of a thread (SSE over POST, no body). Same spend semantics as a
 * normal message. Pre-stream gating errors throw the usual localized ApiClientError.
 */
export async function streamRegenerate(
  conversationId: string,
  onDelta: (delta: string) => void,
): Promise<CoachReply> {
  const res = await httpRaw(`/v1/coach/conversations/${conversationId}/regenerate/stream`, {
    method: "POST",
  });
  if (!res.ok) await throwApiClientError(res);
  if (!res.body) throw new CoachStreamError("AI_PROVIDER_ERROR");
  return readCoachSseStream(res.body, onDelta);
}

/** Shared SSE parse loop: deltas → onDelta, resolves with the terminal `done` payload. */
async function readCoachSseStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void,
): Promise<CoachReply> {
  const reader = body.getReader();
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

/** The user's chat threads, most-recently-active first ("Son sohbetler"). */
export async function listCoachConversations(
  page = 1,
  pageSize = 20,
): Promise<Paginated<CoachConversationDto>> {
  return (await http<Paginated<CoachConversationDto>>(
    `/v1/coach/conversations?page=${page}&pageSize=${pageSize}`,
  )) as Paginated<CoachConversationDto>;
}

/** One thread's persisted history, newest-first. */
export async function listCoachMessages(
  conversationId: string,
  page = 1,
  pageSize = 30,
): Promise<Paginated<CoachMessageDto>> {
  return (await http<Paginated<CoachMessageDto>>(
    `/v1/coach/conversations/${conversationId}/messages?page=${page}&pageSize=${pageSize}`,
  )) as Paginated<CoachMessageDto>;
}

/** Delete one thread (its messages cascade). The memory profile is kept. */
export async function deleteCoachConversation(conversationId: string): Promise<void> {
  await http<void>(`/v1/coach/conversations/${conversationId}`, { method: "DELETE" });
}

/** Rate a coach message: 1 = 👍, -1 = 👎, null = clear. */
export async function setCoachMessageFeedback(
  messageId: string,
  feedback: 1 | -1 | null,
): Promise<void> {
  await http<void>(`/v1/coach/messages/${messageId}/feedback`, {
    method: "PATCH",
    body: JSON.stringify({ feedback }),
  });
}

/** The coach's distilled profile of the user (null until the memory job builds one). */
export async function fetchCoachMemory(): Promise<CoachMemoryDto | null> {
  return (await http<CoachMemoryDto | null>("/v1/coach/memory")) as CoachMemoryDto | null;
}

/** Reset the memory profile (user-controlled, KVKK). */
export async function clearCoachMemory(): Promise<void> {
  await http<void>("/v1/coach/memory", { method: "DELETE" });
}

/** Premium proactive daily greeting on the /koc hub; 403 for free — caller should stay silent. */
export async function fetchDailyGreeting(): Promise<DailyGreetingDto> {
  return (await http<DailyGreetingDto>("/v1/coach/daily-greeting", {
    method: "POST",
  })) as DailyGreetingDto;
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
