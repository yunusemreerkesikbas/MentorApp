import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/forum-public", () => ({
  fetchDiscoveryQuestions: vi.fn(async (): Promise<Array<{ id: string; title: string; examType: null; updatedAt: string }>> => []),
  communityDiscoveryUrl: () => "https://mentor.example/topluluk",
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
import { fetchDiscoveryQuestions } from "@/lib/forum-public";

describe("metadata routes", () => {
  it("allows crawlers to read route-level noindex directives", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://mentor.example/sitemap.xml",
    });
  });

  it("lists the landing and each exam's blog hub", async () => {
    expect(await sitemap()).toEqual([
      { url: "https://mentor.example/", changeFrequency: "weekly", priority: 1 },
      { url: "https://mentor.example/koclar", changeFrequency: "monthly", priority: 0.8 },
      { url: "https://mentor.example/blog", changeFrequency: "weekly", priority: 0.6 },
      { url: "https://mentor.example/blog?family=YKS", changeFrequency: "weekly", priority: 0.6 },
      { url: "https://mentor.example/blog?family=LGS", changeFrequency: "weekly", priority: 0.6 },
      { url: "https://mentor.example/blog?family=ALES", changeFrequency: "weekly", priority: 0.6 },
      { url: "https://mentor.example/blog?family=DGS", changeFrequency: "weekly", priority: 0.6 },
    ]);
  });

  it("advertises the community directory and only its selected questions", async () => {
    vi.mocked(fetchDiscoveryQuestions).mockResolvedValueOnce([
      { id: "selected", title: "Question", examType: null, updatedAt: "2026-10-01T00:00:00.000Z" },
    ]);
    expect((await sitemap()).map(({ url }) => url)).toEqual(expect.arrayContaining([
      "https://mentor.example/topluluk", "https://mentor.example/forum/question/selected",
    ]));
  });
});
