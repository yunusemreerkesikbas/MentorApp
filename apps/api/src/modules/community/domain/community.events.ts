import type { AchievementId, AchievementSource } from "@mentor/types";

export const CommunityEventTopic = {
  ACHIEVEMENT_AWARDED: "community.achievement.awarded",
  JOURNEY_LEVEL_UNLOCKED: "community.journey-level.unlocked",
} as const;

export interface AchievementAwarded {
  userId: string;
  username: string | null;
  achievementId: AchievementId;
  source: AchievementSource;
}

export interface JourneyLevelUnlocked {
  celebrationId: string;
  userId: string;
  tier: number;
  unlockedAt: Date;
}
