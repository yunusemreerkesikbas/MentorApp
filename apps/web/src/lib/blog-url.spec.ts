import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blogHref, blogUrl, emptyListKind, parseBlogQuery, showsFeatured } from "./blog-url";

describe("parseBlogQuery", () => {
  it("defaults to KPSS, every topic, page 1", () => {
    expect(parseBlogQuery({})).toEqual({ family: "KPSS", category: null, page: 1 });
  });

  it("accepts known values and normalises the family's case", () => {
    expect(parseBlogQuery({ family: "yks", category: "APPLICATION", page: "3" })).toEqual({
      family: "YKS",
      category: "APPLICATION",
      page: 3,
    });
  });

  it("drops unknown or malformed values instead of failing the page", () => {
    expect(parseBlogQuery({ family: "ALES", category: "NEWS", page: "-2" })).toEqual({
      family: "KPSS",
      category: null,
      page: 1,
    });
    expect(parseBlogQuery({ family: ["LGS", "YKS"], page: "abc" })).toEqual({
      family: "LGS",
      category: null,
      page: 1,
    });
  });
});

describe("blogHref", () => {
  it("keeps the defaults out of the URL", () => {
    // No empty `query`: next-intl would print it as a bare "?" (`/blog?`).
    expect(blogHref({ family: "KPSS", category: null, page: 1 })).toEqual({ pathname: "/knowledge" });
  });

  it("carries family, topic and page", () => {
    expect(blogHref({ family: "YKS", category: "EXAM_PROCESS", page: 2 })).toEqual({
      pathname: "/knowledge",
      query: { family: "YKS", category: "EXAM_PROCESS", page: "2" },
    });
  });
});

describe("showsFeatured", () => {
  const featured = { category: "APPLICATION" };
  const first = { family: "KPSS" as const, category: null, page: 1 };

  it("heads the first unfiltered page", () => {
    expect(showsFeatured(featured, first)).toBe(true);
  });

  it("follows the topic filter", () => {
    expect(showsFeatured(featured, { ...first, category: "APPLICATION" })).toBe(true);
    expect(showsFeatured(featured, { ...first, category: "GENERAL" })).toBe(false);
  });

  it("stays off later pages and when there is none", () => {
    expect(showsFeatured(featured, { ...first, page: 2 })).toBe(false);
    expect(showsFeatured(null, first)).toBe(false);
  });
});

describe("emptyListKind", () => {
  it("says the page is past the end whenever the page is beyond the first", () => {
    // The featured post never counts in the list's `total`, so a family whose only post is the
    // featured one reports total 0 on page 2 while page 1 still has that post.
    expect(emptyListKind({ family: "YKS", category: null, page: 2 })).toBe("page");
    expect(emptyListKind({ family: "KPSS", category: "GENERAL", page: 3 })).toBe("page");
  });

  it("names the topic or the exam on the first page", () => {
    expect(emptyListKind({ family: "YKS", category: "EXAM_PROCESS", page: 1 })).toBe("topic");
    expect(emptyListKind({ family: "YKS", category: null, page: 1 })).toBe("family");
  });
});

describe("blogUrl", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is the Turkish canonical carrying only the family", () => {
    expect(blogUrl()).toBe("http://localhost:3000/blog");
    expect(blogUrl("YKS")).toBe("http://localhost:3000/blog?family=YKS");
  });
});
