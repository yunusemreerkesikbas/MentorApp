import type { WeeklyReviewCompletionDto, WeeklyReviewDto } from "@mentor/types";
import { http } from "@mentor/api-client";

export async function fetchWeeklyReview(
  examId: string,
): Promise<WeeklyReviewDto> {
  return (await http<WeeklyReviewDto>(
    `/v1/coaching/weekly-review?examId=${encodeURIComponent(examId)}`,
  )) as WeeklyReviewDto;
}

export async function completeWeeklyReview(
  examId: string,
  weekStart: string,
): Promise<WeeklyReviewCompletionDto> {
  return (await http<WeeklyReviewCompletionDto>(
    "/v1/coaching/weekly-review/completion",
    { method: "PUT", body: JSON.stringify({ examId, weekStart }) },
  )) as WeeklyReviewCompletionDto;
}
