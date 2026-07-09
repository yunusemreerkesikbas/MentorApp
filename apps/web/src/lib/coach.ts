import type { CoachAccessDto, CoachChatReplyDto, SessionReflectionDto } from "@mentor/types";
import { http } from "@mentor/api-client";

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

/** Premium session reflection after micro check-in; 403 for free — caller should stay silent. */
export async function requestSessionReflection(
  sessionId: string,
): Promise<SessionReflectionDto> {
  return (await http<SessionReflectionDto>("/v1/coach/session-reflection", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  })) as SessionReflectionDto;
}
