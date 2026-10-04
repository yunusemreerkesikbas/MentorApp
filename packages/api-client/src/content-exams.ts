import type { ExamSummaryDto } from "@mentor/types";
import { http } from "./http.js";

/**
 * Current exam for a family, without requiring an upcoming EXAM_DATE.
 * Taxonomy pickers use this; countdown still uses `.../calendar`.
 *
 * Hand-written until the next OpenAPI/orval regeneration.
 */
export async function contentControllerCurrentExamByFamily(
  type: string,
  variant?: string | null,
): Promise<ExamSummaryDto> {
  const query =
    variant && variant.length > 0
      ? `?variant=${encodeURIComponent(variant)}`
      : "";
  return http<ExamSummaryDto>(
    `/v1/content/exams/by-type/${encodeURIComponent(type)}${query}`,
  );
}
