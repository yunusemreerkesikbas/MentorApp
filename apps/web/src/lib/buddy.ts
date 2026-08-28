import type { BuddySuggestionRef, BuddyViewDto } from "@mentor/types";
import { http } from "@mentor/api-client";

/**
 * Typed wrappers over the study-buddy surface (`/v1/buddy`). Mutual-consent 1-1
 * pairing; mirrors lib/follow.ts style (hand-written http calls, no orval coupling).
 */

export async function getBuddy(): Promise<BuddyViewDto> {
  return (await http<BuddyViewDto>("/v1/buddy")) as BuddyViewDto;
}

/** People the viewer has actually co-worked with at a study room, most-shared first. */
export async function getBuddySuggestions(): Promise<BuddySuggestionRef[]> {
  return (await http<BuddySuggestionRef[]>("/v1/buddy/suggestions")) as BuddySuggestionRef[];
}

export async function sendBuddyRequest(username: string): Promise<void> {
  await http(`/v1/buddy/requests/${encodeURIComponent(username)}`, { method: "POST" });
}

export async function acceptBuddyRequest(id: string): Promise<void> {
  await http(`/v1/buddy/requests/${encodeURIComponent(id)}/accept`, { method: "POST" });
}

/** Decline (as addressee) or cancel (as requester) a pending request. */
export async function deleteBuddyRequest(id: string): Promise<void> {
  await http(`/v1/buddy/requests/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function endBuddy(): Promise<void> {
  await http("/v1/buddy", { method: "DELETE" });
}

export async function nudgeBuddy(): Promise<void> {
  await http("/v1/buddy/nudge", { method: "POST" });
}
