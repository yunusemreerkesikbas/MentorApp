import { afterEach, describe, expect, it, vi } from "vitest";
import { contentSecurityPolicy } from "./content-security-policy";
import proxy, { config } from "../proxy";
import { NextRequest } from "next/server";

afterEach(() => vi.unstubAllEnvs());

describe("document CSP", () => {
  it("blocks script injection and eval in production while preserving required integrations", () => {
    const policy = contentSecurityPolicy("YWJjZGVmZ2hpamtsbW5vcA==", {
      production: true, apiUrl: "https://api.mentor.example/v1",
      storageOrigins: "https://media.mentor.example,https://tenant.eu.r2.cloudflarestorage.com",
    });
    const script = policy.split(";").map((part) => part.trim()).find((part) => part.startsWith("script-src "))!;
    expect(script).toContain("'nonce-YWJjZGVmZ2hpamtsbW5vcA==' 'strict-dynamic'");
    expect(script).not.toMatch(/'unsafe-inline'|'unsafe-eval'| https:/);
    expect(script).toContain("'wasm-unsafe-eval'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    expect(policy).toContain("https://api.mentor.example");
    expect(policy).not.toContain("https://api.mentor.example/v1");
    expect(policy).toContain("https://tenant.eu.r2.cloudflarestorage.com");
    expect(policy).toContain("frame-src https://challenges.cloudflare.com");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("only relaxes eval for development, with an explicit loopback API allowed for CI", () => {
    const dev = contentSecurityPolicy("YWJjZGVmZ2hpamtsbW5vcA==", { production: false });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(() => contentSecurityPolicy("YWJjZGVmZ2hpamtsbW5vcA==", { production: true })).toThrow();
    expect(contentSecurityPolicy("YWJjZGVmZ2hpamtsbW5vcA==", { production: true, apiUrl: "http://localhost:3001/v1" })).toContain("http://localhost:3001");
  });

  it.each([
    "https://*.example.com", "https://a.example/path", "https://user:pass@a.example",
    "https://a.example?token=x", "https://a.example#fragment", "http://a.example",
    "https://a.example;script-src *", "https://a.example\nhttps://b.example",
  ])("rejects invalid storage configuration without silently broadening the policy: %s", (storageOrigins) => {
    expect(() => contentSecurityPolicy("YWJjZGVmZ2hpamtsbW5vcA==", { production: true, apiUrl: "https://api.example/v1", storageOrigins })).toThrow();
  });

  it("rejects invalid nonces and insecure non-loopback API origins", () => {
    expect(() => contentSecurityPolicy("abc'; script-src *", { production: false })).toThrow();
    expect(() => contentSecurityPolicy("YWJjZGVmZ2hpamtsbW5vcA==", { production: true, apiUrl: "http://api.example/v1" })).toThrow();
  });

  it("replaces spoofed request headers and keeps locale rewrites and per-request nonces", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example/v1");
    vi.stubEnv("NODE_ENV", "production");
    const request = () => new NextRequest("https://mentor.example/giris", {
      headers: { "x-nonce": "attacker", "content-security-policy": "script-src *", "x-custom": "preserved" },
    });
    const response = proxy(request());
    const nonce = response.headers.get("x-middleware-request-x-nonce")!;
    expect(Buffer.from(nonce, "base64")).toHaveLength(16);
    expect(nonce).not.toBe("attacker");
    expect(response.headers.get("content-security-policy")).toContain(`'nonce-${nonce}'`);
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(response.headers.get("content-security-policy"));
    expect(response.headers.get("x-middleware-request-x-custom")).toBe("preserved");
    expect(response.headers.get("x-middleware-rewrite")).toContain("/tr/login");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(proxy(request()).headers.get("x-middleware-request-x-nonce")).not.toBe(nonce);
    expect(proxy(new NextRequest("https://mentor.example/en/reset-password?token=dummy")).headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("protects dotted page URLs and prefetches while excluding only known asset/infrastructure paths", () => {
    const matches = (path: string) => new RegExp(`^${config.matcher[0]}$`).test(path);
    expect(matches("/en/knowledge/a.topic")).toBe(true);
    expect(matches("/en/login")).toBe(true);
    for (const path of ["/api/test", "/_next/static/app.js", "/sw.js", "/mascot/puhu/auth/hang-rest.png", "/video/puhu-fire.mp4"]) expect(matches(path)).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example/v1");
    const prefetch = proxy(new NextRequest("https://mentor.example/en/login", { headers: { "next-router-prefetch": "1" } }));
    expect(prefetch.headers.get("content-security-policy")).toContain("'strict-dynamic'");
  });
});
