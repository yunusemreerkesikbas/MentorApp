import type {
  AchievementCelebrationsDto,
  AchievementCollectionDto,
  AchievementId,
  CommunitySummary,
  LeaderboardView,
  LeaderboardWindow,
  PublicProfile,
} from "@mentor/types";
import { http } from "@mentor/api-client";

/**
 * Typed wrapper over the community effort-board endpoint (mirrors lib/forum.ts). One call feeds the
 * whole right column. Economy-gated fields (xp/level/leaderboard) come back null when the economy is
 * off — the UI degrades on the `economyEnabled` flag rather than on an error.
 */
export async function getCommunitySummary(): Promise<CommunitySummary> {
  return (await http<CommunitySummary>("/v1/community/summary")) as CommunitySummary;
}

/** Public profile header (identity + gamification) of another user, by username. 404 → throws. */
export async function getPublicProfile(username: string): Promise<PublicProfile> {
  return (await http<PublicProfile>(
    `/v1/community/profile/${encodeURIComponent(username)}`,
  )) as PublicProfile;
}

export async function getProfileAchievements(
  username: string,
): Promise<AchievementCollectionDto> {
  return (await http<AchievementCollectionDto>(
    `/v1/community/profile/${encodeURIComponent(username)}/achievements`,
  )) as AchievementCollectionDto;
}

export async function getUnseenAchievements(): Promise<AchievementCelebrationsDto> {
  return (await http<AchievementCelebrationsDto>(
    "/v1/community/achievements/unseen",
  )) as AchievementCelebrationsDto;
}

export async function markAchievementsCelebrated(
  achievementIds: AchievementId[],
): Promise<void> {
  await http<void>("/v1/community/achievements/celebrated", {
    method: "POST",
    body: JSON.stringify({ achievementIds }),
  });
}

/** Effort ranking for a time window (full-page tabs: today / weekly / all_time). */
export async function getCommunityLeaderboard(
  window: LeaderboardWindow,
): Promise<LeaderboardView> {
  return (await http<LeaderboardView>(
    `/v1/community/leaderboard?window=${window}`,
  )) as LeaderboardView;
}
