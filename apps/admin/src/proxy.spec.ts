import { afterEach, describe, expect, it, vi } from "vitest";
import { contentSecurityPolicy } from "./proxy";

describe("admin Content-Security-Policy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("allows fake review images only from the configured API origin", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3001/v1");
    const images = contentSecurityPolicy("image-nonce").split("; ").find((part) => part.startsWith("img-src"));
    expect(images).toContain("http://localhost:3001");
    expect(images?.split(" ")).not.toContain("http:");
    expect(images).not.toContain("*");
  });

  it("requires a per-request nonce for scripts and blocks framing/plugins", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.mentor.test/v1");

    const policy = contentSecurityPolicy("nonce-value");

    expect(policy).toContain("script-src 'self' 'nonce-nonce-value' 'strict-dynamic'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("connect-src 'self' https://api.mentor.test");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("allows the development runtime evaluator without weakening production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(contentSecurityPolicy("dev-nonce")).toContain("'unsafe-eval'");
  });
});
