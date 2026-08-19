import type { AchievementId, AchievementSource } from "@mentor/types";

export const CommunityEventTopic = {
  ACHIEVEMENT_AWARDED: "community.achievement.awarded",
} as const;

export interface AchievementAwarded {
  userId: string;
  username: string | null;
  achievementId: AchievementId;
  source: AchievementSource;
}
