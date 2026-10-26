export const AdPlacementId = {
  KNOWLEDGE_ARTICLE_END: "knowledge.article.end",
  KNOWLEDGE_INDEX: "knowledge.index",
  FORUM_QUESTION_END: "forum.question.end",
  DASHBOARD_REWARDED_COIN: "dashboard.rewarded.coin",
  NOTEBOOKS_OVERVIEW: "notebooks.overview",
  VISION_OVERVIEW: "vision.overview",
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
  | "REGION_NOT_ENABLED"
  | "ROLLOUT_EXCLUDED"
  | "PROVIDER_NOT_CONFIGURED"
  | "SERVER_VERIFICATION_UNAVAILABLE"
  | "CONTEXT_UNVERIFIED"
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

export interface AdQuestionContext {
  questionId: string;
  contentRevision: string;
}

export interface AdQuestionReviewView {
  question: import("./forum.js").PublicQuestionView | null;
  approval: { contentRevision: string; reviewedAt: string; reviewedBy: string | null } | null;
  approved: boolean;
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
