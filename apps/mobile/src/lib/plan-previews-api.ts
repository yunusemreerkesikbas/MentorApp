import { http } from "@mentor/api-client";
import type {
  CoachPlanAdaptationBriefDto,
  PlanPreviewAccessDto,
  SavedPlanPreviewDto,
} from "@mentor/types";
import type { CoinPlanPreviewInput } from "@mentor/validation";

/** The Coin-paid plan drafts, as the web's `lib/plan-previews.ts` calls them. */
const base = "/v1/coach/plan-previews";

export const fetchPlanPreviewAccess = async () =>
  (await http<PlanPreviewAccessDto>(`${base}/access`)) as PlanPreviewAccessDto;

/** The wizard opens without its "what Puhu knows" line when the brief fails, like the free path. */
export async function fetchCoinPlanBrief(): Promise<CoachPlanAdaptationBriefDto | null> {
  try {
    return (await http<CoachPlanAdaptationBriefDto>(`${base}/brief`)) as CoachPlanAdaptationBriefDto;
  } catch {
    return null;
  }
}

export const fetchSavedPlanPreview = async (id: string) =>
  (await http<SavedPlanPreviewDto>(`${base}/${id}`)) as SavedPlanPreviewDto;

export const createCoinPlanPreview = async (body: CoinPlanPreviewInput) =>
  (await http<SavedPlanPreviewDto>(base, {
    method: "POST",
    headers: { "Idempotency-Key": body.clientRequestId },
    body: JSON.stringify(body),
  })) as SavedPlanPreviewDto;

export const confirmCoinPlanPreview = async (id: string, expectedCost: number) =>
  (await http<SavedPlanPreviewDto>(`${base}/${id}/confirm`, {
    method: "POST",
    headers: { "Idempotency-Key": id },
    body: JSON.stringify({ expectedCost }),
  })) as SavedPlanPreviewDto;
