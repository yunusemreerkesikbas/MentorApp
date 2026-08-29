import { AdPlacementId, type AdPlacementView } from "@mentor/types";

export const ADS_REWARD_SOURCE = "ad_reward";
export const ADS_REWARD_REASON = "ad.reward.completed";

export const AD_PLACEMENTS: Record<
  AdPlacementId,
  Pick<AdPlacementView, "id" | "format" | "sizes"> & { configKey: string; envKey: string }
> = {
  [AdPlacementId.KNOWLEDGE_ARTICLE_END]: {
    id: AdPlacementId.KNOWLEDGE_ARTICLE_END,
    format: "DISPLAY",
    sizes: [[320, 100], [728, 90]],
    configKey: "ads.placement.knowledge_article_end.enabled",
    envKey: "GAM_KNOWLEDGE_ARTICLE_END_AD_UNIT",
  },
  [AdPlacementId.DASHBOARD_REWARDED_COIN]: {
    id: AdPlacementId.DASHBOARD_REWARDED_COIN,
    format: "REWARDED",
    sizes: [],
    configKey: "ads.placement.dashboard_rewarded_coin.enabled",
    envKey: "GAM_DASHBOARD_REWARDED_COIN_AD_UNIT",
  },
};
