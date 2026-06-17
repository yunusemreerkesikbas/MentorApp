import { aiChatControllerReply } from "@mentor/api-client";

/**
 * Typed wrapper over the generated AI coach client. The API returns `{ reply, model }` from an inline
 * object (no DTO class), so the orval client types it loosely — we assert the known shape here, in one
 * place (mirrors the `study-sessions.ts` wrapper). Single-turn: each call is independent.
 */
export interface CoachReply {
  reply: string;
  model: string;
}

export async function sendCoachMessage(message: string): Promise<CoachReply> {
  return (await aiChatControllerReply({ message })) as unknown as CoachReply;
}
