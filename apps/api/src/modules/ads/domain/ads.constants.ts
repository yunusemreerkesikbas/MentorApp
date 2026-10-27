import { AdPlacementId, type AdPlacementView } from "@mentor/types";
import type { ConfigKey } from "../../../common/config/config.catalog";
import type { Env } from "../../../config/env.validation";

export const ADS_REWARD_SOURCE = "ad_reward";
export const ADS_REWARD_REASON = "ad.reward.completed";
// Official sample inventory, never the publisher's revenue inventory.
export const GOOGLE_DISPLAY_TEST_AD_UNIT = "/6355419/Travel/Europe/France/Paris";
export const PUBLIC_DISPLAY_PLACEMENTS: ReadonlySet<AdPlacementId> = new Set([
  AdPlacementId.KNOWLEDGE_ARTICLE_END, AdPlacementId.KNOWLEDGE_INDEX, AdPlacementId.FORUM_QUESTION_END,
]);

export const AD_PLACEMENTS: Record<
  AdPlacementId,
  Pick<AdPlacementView, "id" | "format" | "sizes"> & {
    configKey: Extract<ConfigKey, `ads.placement.${string}.enabled`>;
    unitConfigKey: Extract<ConfigKey, `ads.placement.${string}.ad_unit_path`> | null;
    envKey: keyof Env | null;
  }
> = {
  [AdPlacementId.COMMUNITY_ANNOUNCEMENT_END]: {
    id: AdPlacementId.COMMUNITY_ANNOUNCEMENT_END, format: "DISPLAY", sizes: [[250, 250], [300, 250]],
    configKey: "ads.placement.community_announcement_end.enabled", unitConfigKey: "ads.placement.community_announcement_end.ad_unit_path", envKey: null,
  },
  [AdPlacementId.COMMUNITY_OVERVIEW]: {
    id: AdPlacementId.COMMUNITY_OVERVIEW, format: "DISPLAY", sizes: [[250, 250], [300, 250]],
    configKey: "ads.placement.community_overview.enabled",
    unitConfigKey: "ads.placement.community_overview.ad_unit_path", envKey: null,
  },
  [AdPlacementId.COMMUNITY_QUESTION_END]: {
    id: AdPlacementId.COMMUNITY_QUESTION_END,
    format: "DISPLAY",
    sizes: [[250, 250], [300, 250]],
    configKey: "ads.placement.community_question_end.enabled",
    unitConfigKey: "ads.placement.community_question_end.ad_unit_path",
    envKey: null,
  },
  [AdPlacementId.FORUM_QUESTION_END]: {
    id: AdPlacementId.FORUM_QUESTION_END,
    format: "DISPLAY",
    sizes: [[250, 250], [300, 250]],
    configKey: "ads.placement.forum_question_end.enabled",
    unitConfigKey: "ads.placement.forum_question_end.ad_unit_path",
    envKey: null,
  },
  [AdPlacementId.KNOWLEDGE_ARTICLE_END]: {
    id: AdPlacementId.KNOWLEDGE_ARTICLE_END,
    format: "DISPLAY",
    sizes: [[320, 100], [300, 250], [728, 90]],
    configKey: "ads.placement.knowledge_article_end.enabled",
    unitConfigKey: "ads.placement.knowledge_article_end.ad_unit_path",
    envKey: "GAM_KNOWLEDGE_ARTICLE_END_AD_UNIT",
  },
  [AdPlacementId.DASHBOARD_REWARDED_COIN]: {
    id: AdPlacementId.DASHBOARD_REWARDED_COIN,
    format: "REWARDED",
    sizes: [],
    configKey: "ads.placement.dashboard_rewarded_coin.enabled",
    unitConfigKey: null,
    envKey: "GAM_DASHBOARD_REWARDED_COIN_AD_UNIT",
  },
  [AdPlacementId.KNOWLEDGE_INDEX]: {
    id: AdPlacementId.KNOWLEDGE_INDEX,
    format: "DISPLAY",
    sizes: [[250, 250], [300, 250]],
    configKey: "ads.placement.knowledge_index.enabled",
    unitConfigKey: "ads.placement.knowledge_index.ad_unit_path",
    envKey: null,
  },
  [AdPlacementId.NOTEBOOKS_OVERVIEW]: {
    id: AdPlacementId.NOTEBOOKS_OVERVIEW,
    format: "DISPLAY",
    sizes: [[250, 250], [300, 250]],
    configKey: "ads.placement.notebooks_overview.enabled",
    unitConfigKey: "ads.placement.notebooks_overview.ad_unit_path",
    envKey: null,
  },
  [AdPlacementId.VISION_OVERVIEW]: {
    id: AdPlacementId.VISION_OVERVIEW,
    format: "DISPLAY",
    sizes: [[250, 250], [300, 250]],
    configKey: "ads.placement.vision_overview.enabled",
    unitConfigKey: "ads.placement.vision_overview.ad_unit_path",
    envKey: null,
  },
};
