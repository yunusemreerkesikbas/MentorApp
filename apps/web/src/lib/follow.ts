import type { FollowList, FollowUserRef } from "@mentor/types";
import { http } from "@mentor/api-client";

/**
 * Typed wrappers over the social follow graph (identity `/v1/users/:username/*`). One-way, public,
 * instant follow; the toggle mirrors the forum bookmark PUT/DELETE semantics.
 */

export async function followUser(username: string): Promise<void> {
  await http(`/v1/users/${encodeURIComponent(username)}/follow`, { method: "PUT" });
}

export async function unfollowUser(username: string): Promise<void> {
  await http(`/v1/users/${encodeURIComponent(username)}/follow`, { method: "DELETE" });
}

export async function getFollowers(username: string, before?: string): Promise<FollowList> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : "";
  return (await http<FollowList>(
    `/v1/users/${encodeURIComponent(username)}/followers${qs}`,
  )) as FollowList;
}

export async function getFollowing(username: string, before?: string): Promise<FollowList> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : "";
  return (await http<FollowList>(
    `/v1/users/${encodeURIComponent(username)}/following${qs}`,
  )) as FollowList;
}

/** "Kimi takip et" — people to follow (active authors in your zones + cohort fallback). */
export async function getFollowSuggestions(): Promise<FollowUserRef[]> {
  return (await http<FollowUserRef[]>("/v1/forum/follow-suggestions")) as FollowUserRef[];
}
