import { http } from "@mentor/api-client";
import type {
  CoachPlanAdaptationBriefDto,
  PlanPreviewAccessDto,
  SavedPlanPreviewDto,
} from "@mentor/types";
import type { CoinPlanPreviewInput } from "@mentor/validation";

const base = "/v1/coach/plan-previews";
export const fetchPlanPreviewAccess = () =>
  http<PlanPreviewAccessDto>(`${base}/access`);
export const fetchCoinPlanBrief = () =>
  http<CoachPlanAdaptationBriefDto>(`${base}/brief`);
export const fetchSavedPlanPreview = (id: string) =>
  http<SavedPlanPreviewDto>(`${base}/${id}`);
export const createCoinPlanPreview = (body: CoinPlanPreviewInput) =>
  http<SavedPlanPreviewDto>(base, {
    method: "POST",
    headers: { "Idempotency-Key": body.clientRequestId },
    body: JSON.stringify(body),
  });
export const confirmCoinPlanPreview = (id: string, expectedCost: number) =>
  http<SavedPlanPreviewDto>(`${base}/${id}/confirm`, {
    method: "POST",
    headers: { "Idempotency-Key": id },
    body: JSON.stringify({ expectedCost }),
  });
