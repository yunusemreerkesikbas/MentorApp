import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { fetchPublicQuestionRefs } from "./forum-public";
import { fetchInfoArticlesByFamily } from "./content-api";

vi.mock("./forum-public", () => ({
  siteUrl: () => "https://puhukoc.com",
  fetchPublicQuestionRefs: vi.fn().mockResolvedValue([]),
  questionUrl: vi.fn(),
}));
vi.mock("./content-api", () => ({
  fetchInfoArticlesByFamily: vi.fn().mockResolvedValue({ items: [] }),
  infoArticleUrl: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("deployment indexing", () => {
  it("blocks staging crawlers and publishes no sitemap or API requests", async () => {
    vi.stubEnv("APP_ENV", "staging");
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    expect(await sitemap()).toEqual([]);
    expect(fetchPublicQuestionRefs).not.toHaveBeenCalled();
    expect(fetchInfoArticlesByFamily).not.toHaveBeenCalled();
  });

  it("advertises the production sitemap and canonical public pages", async () => {
    vi.stubEnv("APP_ENV", "production");
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://puhukoc.com/sitemap.xml",
    });
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(({ url }) => url.startsWith("https://puhukoc.com/"))).toBe(true);
    expect(fetchPublicQuestionRefs).toHaveBeenCalledOnce();
    expect(fetchInfoArticlesByFamily).toHaveBeenCalledTimes(3);
  });
});
