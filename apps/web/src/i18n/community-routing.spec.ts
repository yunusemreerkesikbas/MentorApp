import { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { describe, expect, it } from "vitest";
import { getPathname } from "./navigation";
import { routing } from "./routing";

describe("community routing", () => {
  const rewrite = createMiddleware(routing);

  it.each([
    ["/topluluk", "/tr/discover-community"],
    ["/topluluk/uyeler/panel", "/tr/community"],
    ["/topluluk/panel", "/tr/community/panel"],
    ["/en/discover-community", "/en/discover-community"],
    ["/en/community", "/en/community"],
  ])("resolves %s to %s", (visible, internal) => {
    const request = new NextRequest(`https://puhukoc.test${visible}`);
    const response = rewrite(request);
    expect(response.headers.get("location")).toBeNull();
    expect(new URL(response.headers.get("x-middleware-rewrite") ?? request.url).pathname).toBe(internal);
  });

  it("gives account navigation and anonymous discovery distinct Turkish links", () => {
    expect(getPathname({ locale: "tr", href: "/community" })).toBe("/topluluk/uyeler/panel");
    expect(getPathname({ locale: "tr", href: "/discover-community" })).toBe("/topluluk");
  });
});
