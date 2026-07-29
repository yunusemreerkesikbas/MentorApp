import type { WeeklyReviewDto } from "@mentor/types";
import { http } from "@mentor/api-client";

export async function fetchWeeklyReview(
  examId: string,
): Promise<WeeklyReviewDto> {
  return (await http<WeeklyReviewDto>(
    `/v1/coaching/weekly-review?examId=${encodeURIComponent(examId)}`,
  )) as WeeklyReviewDto;
}
