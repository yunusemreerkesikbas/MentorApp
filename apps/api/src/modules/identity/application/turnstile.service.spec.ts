import type { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../config/env.validation";
import { TurnstileService } from "./turnstile.service";

function service(overrides: Partial<Env> = {}) {
  const config = { NODE_ENV: "production", TURNSTILE_SECRET_KEY: "server-secret", TURNSTILE_EXPECTED_HOSTNAME: "app.mentor.test", TURNSTILE_EXPECTED_ACTION: "signup", TURNSTILE_VERIFY_TIMEOUT_MS: 50, ...overrides };
  return new TurnstileService({ get: (key: keyof typeof config) => config[key] } as unknown as ConfigService<Env, true>);
}

afterEach(() => vi.unstubAllGlobals());

describe("TurnstileService", () => {
  it("fails closed in production with no secret", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(service({ TURNSTILE_SECRET_KEY: undefined }).assertValid("token")).rejects.toMatchObject({ code: "AUTH_TURNSTILE_FAILED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "a".repeat(2049)])("rejects absent/oversized tokens before calling Cloudflare", async (token) => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(service().assertValid(token)).rejects.toMatchObject({ code: "AUTH_TURNSTILE_FAILED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { success: false }, { success: "true", hostname: "app.mentor.test", action: "signup" },
    { success: true }, { success: true, hostname: "evil.test", action: "signup" },
    { success: true, hostname: "app.mentor.test", action: "login" }, null,
  ])("rejects unsuccessful/malformed/wrong-site/wrong-action verification", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
    await expect(service().assertValid("token")).rejects.toMatchObject({ code: "AUTH_TURNSTILE_FAILED" });
  });

  it("rejects an HTTP failure even if a success body is returned", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ success: true, hostname: "app.mentor.test", action: "signup" }) }));
    await expect(service().assertValid("token")).rejects.toMatchObject({ code: "AUTH_TURNSTILE_FAILED" });
  });

  it("aborts timed-out verification", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("private-provider-error"))))));
    await expect(service().assertValid("token")).rejects.toMatchObject({ code: "AUTH_TURNSTILE_FAILED" });
  });

  it("accepts a successful matching verification", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, hostname: "app.mentor.test", action: "signup" }) }));
    await expect(service().assertValid("token")).resolves.toBeUndefined();
  });

  it("keeps unconfigured local development working", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(service({ NODE_ENV: "development", TURNSTILE_SECRET_KEY: undefined }).assertValid(undefined)).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
