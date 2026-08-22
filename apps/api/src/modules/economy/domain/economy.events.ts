import type { CommunityLevelView } from "@mentor/types";

export const EconomyEventTopic = {
  XP_CHANGED: "economy.xp.changed",
} as const;

export interface EconomyXpChanged {
  userId: string;
  level: CommunityLevelView;
  occurredAt: Date;
}
