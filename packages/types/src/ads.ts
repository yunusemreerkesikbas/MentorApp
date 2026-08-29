export const AdPlacementId = {
  KNOWLEDGE_ARTICLE_END: "knowledge.article.end",
  DASHBOARD_REWARDED_COIN: "dashboard.rewarded.coin",
} as const;
export type AdPlacementId = (typeof AdPlacementId)[keyof typeof AdPlacementId];

export const AdAudienceTreatment = { NONE: "NONE", CHILD: "CHILD", TEEN: "TEEN" } as const;
export type AdAudienceTreatment = (typeof AdAudienceTreatment)[keyof typeof AdAudienceTreatment];

export type AdEligibilityReason =
  | "ELIGIBLE"
  | "GLOBAL_DISABLED"
  | "FORMAT_DISABLED"
  | "PLACEMENT_DISABLED"
  | "PREMIUM_AD_FREE"
  | "REGION_REQUIRES_CONSENT"
  | "ROLLOUT_EXCLUDED"
  | "PROVIDER_NOT_CONFIGURED"
  | "DAILY_LIMIT_REACHED"
  | "COOLDOWN_ACTIVE"
  | "ACTIVE_SESSION_EXISTS";

export interface AdPlacementView {
  id: AdPlacementId;
  format: "DISPLAY" | "REWARDED";
  enabled: boolean;
  reason: AdEligibilityReason;
  provider: "GOOGLE_AD_MANAGER";
  adUnitPath: string | null;
  audienceTreatment: AdAudienceTreatment;
  limitedAds: true;
  sizes: ReadonlyArray<readonly [number, number]>;
}

export interface AdRewardOfferView extends AdPlacementView {
  eligible: boolean;
  rewardCoin: number;
  dailyRemaining: number;
  cooldownEndsAt: string | null;
}

export interface AdRewardSessionView {
  id: string;
  status: "CREATED" | "REWARDED" | "CLOSED" | "EXPIRED" | "REJECTED";
  rewardCoin: number;
  expiresAt: string;
}

export interface AdRewardCompletionView extends AdRewardSessionView {
  balance: number;
}
