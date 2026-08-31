import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/forum-public", () => ({
  fetchPublicQuestionRefs: vi.fn(async () => []),
  questionUrl: (id: string) => `https://mentor.example/forum/question/${id}`,
  siteUrl: () => "https://mentor.example",
}));

vi.mock("@/lib/content-api", () => ({
  fetchInfoArticlesByFamily: vi.fn(async () => ({ items: [] })),
  infoArticleUrl: (slug: string) => `https://mentor.example/knowledge/${slug}`,
}));

vi.mock("@/lib/legal", () => ({
  publishedLegalDocs: () => [],
}));

import robots from "./robots";
import sitemap from "./sitemap";

describe("metadata routes", () => {
  it("allows crawlers to read route-level noindex directives", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://mentor.example/sitemap.xml",
    });
  });

  it("does not advertise the noindex welcome page in the sitemap", async () => {
    expect(await sitemap()).toEqual([]);
  });
});
