import { http } from "@mentor/api-client";
import type { BuddySuggestionRef, BuddyViewDto } from "@mentor/types";

/** The web's `lib/buddy.ts`: the mutual-consent study buddy (`/v1/buddy`). */
export async function getBuddy(): Promise<BuddyViewDto> {
  return (await http<BuddyViewDto>("/v1/buddy")) as BuddyViewDto;
}

export async function getBuddySuggestions(): Promise<BuddySuggestionRef[]> {
  return (await http<BuddySuggestionRef[]>("/v1/buddy/suggestions")) as BuddySuggestionRef[];
}

export async function sendBuddyRequest(username: string): Promise<void> {
  await http(`/v1/buddy/requests/${encodeURIComponent(username)}`, { method: "POST" });
}

export async function acceptBuddyRequest(id: string): Promise<void> {
  await http(`/v1/buddy/requests/${encodeURIComponent(id)}/accept`, { method: "POST" });
}

export async function deleteBuddyRequest(id: string): Promise<void> {
  await http(`/v1/buddy/requests/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function endBuddy(): Promise<void> {
  await http("/v1/buddy", { method: "DELETE" });
}

export async function nudgeBuddy(): Promise<void> {
  await http("/v1/buddy/nudge", { method: "POST" });
}
