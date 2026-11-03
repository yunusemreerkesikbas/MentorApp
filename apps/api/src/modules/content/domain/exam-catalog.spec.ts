import { describe, expect, it } from "vitest";
import {
  adminListArticlesQuerySchema,
  announcementAudienceSchema,
  examFamilyParamSchema,
  geoSearchQuerySchema,
  listInfoArticlesQuerySchema,
  updateMeSchema,
} from "@mentor/validation";

describe("shared exam family contracts", () => {
  it.each(["ALES", "DGS"])("accepts %s across profile and content boundaries", (family) => {
    expect(updateMeSchema.safeParse({ examType: family }).success).toBe(true);
    expect(examFamilyParamSchema.safeParse({ type: family }).success).toBe(true);
    expect(listInfoArticlesQuerySchema.safeParse({ family }).success).toBe(true);
    expect(adminListArticlesQuerySchema.safeParse({ family }).success).toBe(true);
    expect(geoSearchQuerySchema.safeParse({ q: "Ankara", family }).success).toBe(true);
    expect(announcementAudienceSchema.safeParse({ kind: "EXAM_TYPE", examType: family }).success).toBe(true);
  });

  it("rejects unknown families instead of treating them as another exam", () => {
    expect(updateMeSchema.safeParse({ examType: "OTHER" }).success).toBe(false);
    expect(examFamilyParamSchema.safeParse({ type: "OTHER" }).success).toBe(false);
  });
});
