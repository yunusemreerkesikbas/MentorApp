import { describe, expect, it } from "vitest";
import {
  adminForumTagCreateSchema,
  forumFeedQuerySchema,
  forumSearchQuerySchema,
  setFeaturedThreadSchema,
  updateForumPostSchema,
  updateForumThreadSchema,
} from "@mentor/validation";

describe("forum discovery request contracts", () => {
  it("applies the relevant/trending defaults and accepts discovery filters", () => {
    expect(forumFeedQuerySchema.parse({})).toEqual({
      scope: "relevant",
      sort: "trending",
      limit: 20,
    });
    expect(
      forumFeedQuerySchema.parse({
        scope: "following",
        sort: "top",
        tag: "calisma-ipuclari",
        zoneType: "QA",
        cursor: "opaque",
      }),
    ).toMatchObject({
      scope: "following",
      sort: "top",
      tag: "calisma-ipuclari",
      zoneType: "QA",
      cursor: "opaque",
    });
  });

  it("limits global search input and rejects blank queries", () => {
    expect(forumSearchQuerySchema.parse({ q: "  geometri " })).toEqual({ q: "geometri" });
    expect(forumSearchQuerySchema.safeParse({ q: " " }).success).toBe(false);
  });

  it("requires at least one thread patch field and caps curated tags at three", () => {
    expect(updateForumThreadSchema.safeParse({}).success).toBe(false);
    expect(
      updateForumThreadSchema.safeParse({
        body: "Güncellenen içerik",
        tagIds: [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
          "33333333-3333-4333-8333-333333333333",
        ],
      }).success,
    ).toBe(true);
    expect(
      updateForumThreadSchema.safeParse({
        tagIds: [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
          "33333333-3333-4333-8333-333333333333",
          "44444444-4444-4444-8444-444444444444",
        ],
      }).success,
    ).toBe(false);
  });

  it("accepts a body-only post edit and rejects an empty body", () => {
    expect(updateForumPostSchema.parse({ body: "Daha açık bir yanıt." })).toEqual({
      body: "Daha açık bir yanıt.",
    });
    expect(updateForumPostSchema.safeParse({ body: " " }).success).toBe(false);
  });

  it("normalizes an admin tag and requires a future featured expiry when provided", () => {
    expect(
      adminForumTagCreateSchema.parse({
        slug: "  Calisma-Ipuclari ",
        nameTr: " Çalışma İpuçları ",
        nameEn: " Study Tips ",
      }),
    ).toEqual({
      slug: "calisma-ipuclari",
      nameTr: "Çalışma İpuçları",
      nameEn: "Study Tips",
      isActive: true,
    });
    expect(
      setFeaturedThreadSchema.safeParse({
        threadId: "11111111-1111-4111-8111-111111111111",
        featuredUntil: "not-a-date",
      }).success,
    ).toBe(false);
  });
});
