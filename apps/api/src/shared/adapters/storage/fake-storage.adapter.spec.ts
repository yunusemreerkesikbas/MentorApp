import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeStorageAdapter } from "./fake-storage.adapter";

afterEach(() => vi.useRealTimers());

describe("FakeStorageAdapter private read URL", () => {
  it("accepts its signature only until the requested expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T09:00:00.000Z"));
    const config = { get: () => "qa-only-signing-secret" };
    const storage = new FakeStorageAdapter(config as never);
    const url = new URL(await storage.createReadUrl("notebook/qa-user/photo.png", 60), "http://localhost");
    const key = url.searchParams.get("key")!;
    const expires = Number(url.searchParams.get("expires"));
    const signature = url.searchParams.get("signature")!;

    expect(storage.verifyReadSignature(key, expires, signature)).toBe(true);
    vi.setSystemTime(new Date("2026-09-24T09:01:01.000Z"));
    expect(storage.verifyReadSignature(key, expires, signature)).toBe(false);
  });
});
