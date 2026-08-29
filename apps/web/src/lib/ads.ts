import type {
  AdPlacementId,
  AdPlacementView,
  AdRewardCompletionView,
  AdRewardOfferView,
  AdRewardSessionView,
  ExamType,
} from "@mentor/types";
import { http } from "@mentor/api-client";

export function fetchPublicAdPlacement(
  placementId: AdPlacementId,
  contentSlug?: string,
  examType?: ExamType,
) {
  const query = new URLSearchParams();
  if (contentSlug) query.set("contentSlug", contentSlug);
  if (examType) query.set("examType", examType);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return http<AdPlacementView>(`/v1/ads/public/placements/${placementId}${suffix}`);
}
export function fetchAdPlacement(placementId: AdPlacementId, contentSlug?: string) {
  const query = contentSlug ? `?contentSlug=${encodeURIComponent(contentSlug)}` : "";
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
