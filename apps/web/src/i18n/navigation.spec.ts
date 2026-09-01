import { describe, expect, it } from "vitest";
import { getPathname } from "./navigation";

describe("localized pathname contract", () => {
  it("resolves TR and EN static and dynamic routes", () => {
    expect(getPathname({ locale: "tr", href: "/dashboard" })).toBe("/panel");
    expect(getPathname({ locale: "en", href: "/dashboard" })).toBe(
      "/en/dashboard",
    );
    expect(
      getPathname({
        locale: "tr",
        href: {
          pathname: "/knowledge/[slug]",
          params: { slug: "kpss-basvuru" },
        },
      }),
    ).toBe("/bilgi/kpss-basvuru");
    expect(
      getPathname({
        locale: "en",
        href: {
          pathname: "/community/message/[threadId]",
          params: { threadId: "thread-1" },
          query: { highlight: "comment-1" },
        },
      }),
    ).toBe("/en/community/message/thread-1?highlight=comment-1");
  });
});
