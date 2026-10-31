import { describe, expect, it } from "vitest";
import { safeRequest } from "./log-record";
import { scrubSentryEvent } from "./sentry-scrubber";

describe("media capability diagnostics", () => {
  it.each([
    "private%2Fopaque-grant-secret",
    "unknown/opaque-grant-secret",
    "public/opaque-grant-secret",
  ])("redacts media fallbacks before a route matches: %s", (suffix) => {
    expect(
      JSON.stringify(
        safeRequest({ method: "GET", url: `/v1/storage/media/${suffix}` }),
      ),
    ).not.toContain("opaque-grant-secret");
  });
  it.each([
    undefined,
    "/v1/storage/media/private",
    "/v1/storage/media/{*path}",
  ])("redacts matched and unmatched media paths (%s)", (route) => {
    const value = safeRequest({
      method: "GET",
      url: "/v1/storage/media/private/opaque-grant-secret?grant=query-secret",
      route: route ? { path: route } : undefined,
    });
    expect(JSON.stringify(value)).not.toContain("secret");
  });
  it("drops capability URLs from Sentry requests, transactions and errors", () => {
    const value = scrubSentryEvent({
      request: {
        url: "https://api.test/v1/storage/media/private?grant=capability-secret",
      },
      transaction: "/media/capability-secret",
      exception: { values: [{ type: "Error", value: "capability-secret" }] },
      breadcrumbs: [{ data: { url: "capability-secret" } }],
    });
    expect(JSON.stringify(value)).not.toContain("capability-secret");
  });
});
