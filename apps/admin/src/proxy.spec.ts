import { afterEach, describe, expect, it, vi } from "vitest";
import { contentSecurityPolicy } from "./proxy";

describe("admin Content-Security-Policy", () => {
  afterEach(() => vi.unstubAllEnvs());

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
