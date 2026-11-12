import { EXAM_TYPES } from "@mentor/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { fetchDiscoveryQuestions } from "./forum-public";
import { fetchInfoArticlesByFamily } from "./content-api";

vi.mock("./forum-public", () => ({
  siteUrl: () => "https://puhukoc.com",
  fetchDiscoveryQuestions: vi.fn().mockResolvedValue([]),
  questionUrl: vi.fn(),
}));
vi.mock("./content-api", () => ({
  fetchInfoArticlesByFamily: vi.fn().mockResolvedValue({ items: [] }),
  infoArticleUrl: vi.fn(),
}));

afterEach(() => vi.clearAllMocks());

describe("production indexing", () => {
  it("advertises the owned domain sitemap and canonical public pages", async () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://puhukoc.com/sitemap.xml",
    });
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(({ url }) => url.startsWith("https://puhukoc.com/"))).toBe(true);
    expect(fetchDiscoveryQuestions).toHaveBeenCalledOnce();
    const requestedFamilies = vi.mocked(fetchInfoArticlesByFamily).mock.calls.map(([family]) => family);
    expect(requestedFamilies.sort()).toEqual([...EXAM_TYPES].sort());
  });
});
