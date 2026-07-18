import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() =>
    JSON.stringify({
      articles: [
        {
          slug: "existing-article",
          title: "Seed title",
          body: "Seed body",
          family: "KPSS",
          category: "GENERAL",
          source: "ÖSYM",
          sourceUrl: "https://www.osym.gov.tr",
          verifiedAt: "2026-06-01T10:00:00.000Z",
          verifiedBy: "seed",
          publishedAt: "2026-06-01T10:00:00.000Z",
        },
      ],
    }),
  ),
}));

import { ArticleSeedService } from "./article-seed.service";

describe("ArticleSeedService", () => {
  it("does not overwrite an existing editorial article", async () => {
    const content = {
      hasArticle: vi.fn(async () => true),
      upsertArticle: vi.fn(),
      publishArticle: vi.fn(),
    };

    await new ArticleSeedService(content as never).onModuleInit();

    expect(content.upsertArticle).not.toHaveBeenCalled();
    expect(content.publishArticle).not.toHaveBeenCalled();
  });
});
