import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it, vi } from "vitest";
import { config } from "./proxy";

vi.mock("next-intl/middleware", () => ({
  default: () => () => undefined,
}));

describe("proxy matcher", () => {
  it.each(["/", "/en/login", "/blog/kpss-basvuru"])(
    "matches localized HTML route %s",
    (url) => {
      expect(
        unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }),
      ).toBe(true);
    },
  );

  it.each([
    "/api/health",
    "/_next/static/chunk.js",
    "/_vercel/insights/script.js",
    "/favicon.ico",
    "/img/logo.svg",
  ])("excludes infrastructure or static route %s", (url) => {
    expect(
      unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }),
    ).toBe(false);
  });

  // Only explicit static namespaces bypass the proxy; /images is not one, so it gets security headers.
  it("proxies paths outside the static allowlist, dotted or not", () => {
    expect(
      unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/images/logo.svg" }),
    ).toBe(true);
  });
});
