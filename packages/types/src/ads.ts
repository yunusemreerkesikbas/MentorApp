export const AdPlacementId = {
  COMMUNITY_ANNOUNCEMENT_END: "community.announcement.end",
  COMMUNITY_OVERVIEW: "community.overview",
  KNOWLEDGE_ARTICLE_END: "knowledge.article.end",
  KNOWLEDGE_INDEX: "knowledge.index",
  FORUM_QUESTION_END: "forum.question.end",
  COMMUNITY_QUESTION_END: "community.question.end",
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
  | "TEST_INVENTORY_NOT_ALLOWED"
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

export type AdReadinessIssue = "GLOBAL_DISABLED" | "DISPLAY_DISABLED" | "PLACEMENT_DISABLED" | "UNIT_MISSING" | "TEST_UNIT" | "COUNTRIES_EMPTY" | "DISCOVERY_REVIEW_PENDING";
export interface AdReadinessPlacement {
  id: AdPlacementId;
  enabled: boolean;
  unitSource: "CONFIG" | "ENV" | "NONE";
  unitStatus: "MISSING" | "TEST_UNIT" | "CONFIGURED";
  authenticatedOnly: boolean;
  contentCheck: "PUBLISHED_CONTENT" | "PROFILE" | "REVIEWED_VIEW" | "PUBLIC_DISCOVERY";
  issues: AdReadinessIssue[];
}
/** Configuration diagnostics only. No Google/site/content/legal approval is inferred. */
export interface AdReadinessReport {
  checkedAt: string;
  environment: "development" | "staging" | "production";
  siteOrigin: string | null;
  localTestActive: boolean;
  globalEnabled: boolean;
  displayEnabled: boolean;
  allowedCountries: string[];
  externalVerification: "NOT_CHECKED";
  placements: AdReadinessPlacement[];
}

export interface AdQuestionContext {
  questionId: string;
  contentRevision: string;
}

export interface AdAnnouncementContext { threadId: string; contentRevision: string }
export interface AnnouncementAdPost {
  id: string; body: string; createdAt: string; editedAt: string | null;
  author: CommunityQuestionAdAuthor; attachments: import("./forum.js").Attachment[];
}
export interface AnnouncementAdSnapshot {
  contentRevision: string;
  examType: import("./index.js").ExamType;
  zone: import("./forum.js").ZoneView;
  sidebarRooms: import("./forum.js").ZoneView[];
  thread: AnnouncementAdPost & { title: string | null; isPinned: boolean; commenterNames: string[]; tags: { slug: string; name: string }[] };
  comments: (AnnouncementAdPost & { replyCount: number })[];
}
export interface AnnouncementAdReviewView {
  snapshot: AnnouncementAdSnapshot | null;
  approved: boolean;
  approval: AdQuestionReviewView["approval"];
}

export interface AdQuestionReviewView {
  question: import("./forum.js").PublicQuestionView | null;
  approval: { contentRevision: string; reviewedAt: string; reviewedBy: string | null } | null;
  approved: boolean;
}

export interface CommunityQuestionAdAuthor {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

export interface CommunityQuestionAdSnapshot {
  contentRevision: string;
  publicContentRevision: string;
  examType: import("./index.js").ExamType;
  zone: { id: string; title: string; slug: string };
  question: { id: string; title: string; body: string; createdAt: string; author: CommunityQuestionAdAuthor; attachments: import("./forum.js").Attachment[]; tags: string[] };
  answers: { id: string; body: string; isAccepted: boolean; createdAt: string; author: CommunityQuestionAdAuthor; attachments: import("./forum.js").Attachment[] }[];
  waitingQuestions: { id: string; title: string; authorName: string; zoneTitle: string; zoneSlug: string; createdAt: string }[];
}

export interface CommunityQuestionAdReviewView {
  snapshot: CommunityQuestionAdSnapshot | null;
  publicApproved: boolean;
  approved: boolean;
  approval: { contentRevision: string; reviewedAt: string; reviewedBy: string | null } | null;
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
