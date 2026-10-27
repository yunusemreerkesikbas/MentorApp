import type {
  AdPlacementId,
  AdPlacementView,
  AdQuestionContext,
  AdAnnouncementContext,
  AdRewardCompletionView,
  AdRewardOfferView,
  AdRewardSessionView,
  ExamType,
} from "@mentor/types";
import { http } from "@mentor/api-client";
import type { AdBlogListContext } from "@mentor/validation";

function placementQuery(contentSlug?: string, examType?: ExamType, blogList?: AdBlogListContext, question?: AdQuestionContext, hubRevision?: string, announcement?: AdAnnouncementContext) {
  const query = new URLSearchParams();
  if (hubRevision) query.set("contentRevision", hubRevision);
  if (announcement) { query.set("threadId", announcement.threadId); query.set("contentRevision", announcement.contentRevision); }
  if (contentSlug) query.set("contentSlug", contentSlug);
  if (examType) query.set("examType", examType);
  if (question) {
    query.set("questionId", question.questionId);
    query.set("contentRevision", question.contentRevision);
  }
  if (blogList) {
    query.set("family", blogList.family);
    query.set("page", String(blogList.page));
    if (blogList.category) query.set("category", blogList.category);
  }
  return query.size > 0 ? `?${query.toString()}` : "";
}

export function fetchPublicAdPlacement(
  placementId: AdPlacementId,
  contentSlug?: string,
  examType?: ExamType,
  blogList?: AdBlogListContext,
  question?: AdQuestionContext,
) {
  const suffix = placementQuery(contentSlug, examType, blogList, question);
  return http<AdPlacementView>(`/v1/ads/public/placements/${placementId}${suffix}`);
}
export function fetchAdPlacement(placementId: AdPlacementId, contentSlug?: string, blogList?: AdBlogListContext, question?: AdQuestionContext, hubRevision?: string, announcement?: AdAnnouncementContext) {
  const query = placementQuery(contentSlug, undefined, blogList, question, hubRevision, announcement);
  return http<AdPlacementView>(`/v1/ads/placements/${placementId}${query}`);
}
export function fetchRewardOffer(placementId: AdPlacementId) {
  return http<AdRewardOfferView>(`/v1/ads/reward-offers/${placementId}`);
}
export function createRewardSession(placementId: AdPlacementId, idempotencyKey: string) {
  return http<AdRewardSessionView>("/v1/ads/reward-sessions", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ placementId }),
  });
}
export function completeRewardSession(id: string) {
  return http<AdRewardCompletionView>(`/v1/ads/reward-sessions/${id}/complete`, { method: "POST" });
}
export function closeRewardSession(id: string) {
  return http<AdRewardSessionView>(`/v1/ads/reward-sessions/${id}/close`, { method: "POST" });
}
