import type {
  AdPlacementId,
  AdPlacementView,
  AdRewardCompletionView,
  AdRewardOfferView,
  AdRewardSessionView,
  ExamType,
} from "@mentor/types";
import { http } from "@mentor/api-client";

export function fetchPublicAdPlacement(placementId: AdPlacementId, examType?: ExamType) {
  const query = examType ? `?examType=${encodeURIComponent(examType)}` : "";
  return http<AdPlacementView>(`/v1/ads/public/placements/${placementId}${query}`);
}
export function fetchAdPlacement(placementId: AdPlacementId) {
  return http<AdPlacementView>(`/v1/ads/placements/${placementId}`);
}
export function fetchRewardOffer(placementId: AdPlacementId) {
  return http<AdRewardOfferView>(`/v1/ads/reward-offers/${placementId}`);
}
export function createRewardSession(placementId: AdPlacementId) {
  return http<AdRewardSessionView>("/v1/ads/reward-sessions", {
    method: "POST",
    body: JSON.stringify({ placementId }),
  });
}
export function completeRewardSession(id: string) {
  return http<AdRewardCompletionView>(`/v1/ads/reward-sessions/${id}/complete`, { method: "POST" });
}
export function closeRewardSession(id: string) {
  return http<AdRewardSessionView>(`/v1/ads/reward-sessions/${id}/close`, { method: "POST" });
}
