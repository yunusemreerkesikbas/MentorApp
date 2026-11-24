import { economyControllerSeen, economyControllerUnseen, http } from "@mentor/api-client";
import type {
  AchievementCelebrationDto,
  AchievementCelebrationsDto,
  AchievementId,
  EconomyLedgerEntryView,
  JourneyLevelCelebrationsDto,
  JourneyLevelCelebrationView,
  Paginated,
} from "@mentor/types";

/**
 * The receipts and celebrations the server is still holding for this user. Each one stays
 * "unseen" until the app acknowledges it, so a celebration missed on one device plays on the next.
 */
export async function fetchUnseenAchievements(): Promise<AchievementCelebrationDto[]> {
  const result = await http<AchievementCelebrationsDto | undefined>(
    "/v1/community/achievements/unseen",
  );
  return result?.celebrations ?? [];
}

export async function markAchievementsCelebrated(achievementIds: AchievementId[]): Promise<void> {
  await http<void>("/v1/community/achievements/celebrated", {
    method: "POST",
    body: JSON.stringify({ achievementIds }),
  });
}

export async function fetchUnseenLevelCelebrations(): Promise<JourneyLevelCelebrationView[]> {
  const result = await http<JourneyLevelCelebrationsDto | undefined>(
    "/v1/community/journey-levels/unseen",
  );
  return result?.celebrations ?? [];
}

export async function markLevelCelebrated(celebrationId: string): Promise<void> {
  await http<void>("/v1/community/journey-levels/celebrated", {
    method: "POST",
    body: JSON.stringify({ celebrationId }),
  });
}

export async function fetchUnseenRewards(): Promise<Paginated<EconomyLedgerEntryView>> {
  return (await economyControllerUnseen({ page: 1, pageSize: 20 })) as unknown as Paginated<EconomyLedgerEntryView>;
}

export async function markRewardsSeen(ledgerIds: string[]): Promise<void> {
  await economyControllerSeen({ ledgerIds });
}
