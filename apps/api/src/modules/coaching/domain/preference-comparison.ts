import type { PreferenceComparisonDto } from "@mentor/types";

export function comparePreferenceRank(
  userRank: number | null,
  cutoffRank: number | null,
): PreferenceComparisonDto {
  if (userRank === null) {
    return {
      status: "NOT_COMPARABLE" as const,
      reason: "MISSING_USER_RANK" as const,
      userRank,
      cutoffRank,
      delta: null,
      direction: null,
    };
  }

  if (cutoffRank === null) {
    return {
      status: "NOT_COMPARABLE" as const,
      reason: "MISSING_PLACEMENT_RANK" as const,
      userRank,
      cutoffRank,
      delta: null,
      direction: null,
    };
  }

  const delta = cutoffRank - userRank;
  return {
    status: "COMPARED" as const,
    userRank,
    cutoffRank,
    delta,
    direction:
      delta === 0
        ? ("EQUAL" as const)
        : delta > 0
          ? ("AHEAD" as const)
          : ("BEHIND" as const),
  };
}
