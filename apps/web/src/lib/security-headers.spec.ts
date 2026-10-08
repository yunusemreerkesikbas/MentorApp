import { describe, expect, it, vi } from "vitest";
import { webSecurityHeaders } from "./security-headers";
import nextConfig from "../../next.config";

// The locale plugin's filesystem watcher is unrelated to response-header configuration.
vi.mock("next-intl/plugin", () => ({ default: () => (config: unknown) => config }));

describe("web security headers", () => {
  it("wires the headers to every Next.js response without advertising the framework", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(await nextConfig.headers?.()).toEqual([
      { source: "/:path*", headers: webSecurityHeaders(process.env.NODE_ENV === "production") },
    ]);
  });
  it("blocks framing, content sniffing and unnecessary device access without blocking uploads or sharing", () => {
    const headers = Object.fromEntries(webSecurityHeaders(false).map(({ key, value }) => [key, value]));
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("geolocation=()");
    expect(headers["Permissions-Policy"]).not.toMatch(/camera|clipboard|web-share/);
  });

  it("enforces HTTPS in production without applying a blanket policy to other subdomains", () => {
    const production = Object.fromEntries(webSecurityHeaders(true).map(({ key, value }) => [key, value]));
    expect(production["Strict-Transport-Security"]).toBe("max-age=31536000");
    expect(webSecurityHeaders(false).some(({ key }) => key === "Strict-Transport-Security")).toBe(false);
  });
});
