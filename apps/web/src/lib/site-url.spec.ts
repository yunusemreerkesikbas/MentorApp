import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "./forum-public";

describe("siteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes the configured production HTTPS origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://mentor.example/");

    expect(siteUrl()).toBe("https://mentor.example");
  });

  it("rejects a missing production origin instead of emitting localhost canonicals", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("rejects a non-HTTPS production origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://mentor.example");

    expect(() => siteUrl()).toThrow(/HTTPS/);
  });

  it.each([
    "https://mentor.example/path",
    "https://mentor.example?preview=1",
    "https://user:secret@mentor.example",
  ])("rejects a production URL that is not a bare origin: %s", (configured) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", configured);

    expect(() => siteUrl()).toThrow(/origin/);
  });

  it("keeps the localhost fallback outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
