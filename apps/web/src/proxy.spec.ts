import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it, vi } from "vitest";
import { config } from "./proxy";

vi.mock("next-intl/middleware", () => ({
  default: () => () => undefined,
}));

describe("proxy matcher", () => {
  it.each(["/", "/en/login", "/bilgi/kpss-basvuru"])(
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
    "/images/logo.svg",
  ])("excludes infrastructure or static route %s", (url) => {
    expect(
      unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }),
    ).toBe(false);
  });
});
