import { afterEach, describe, expect, it, vi } from "vitest";
import { InvalidMobilePushTokenError } from "../../ports/mobile-push.port";
import { ExpoPushAdapter } from "./expo-push.adapter";

const VALID_TOKEN = "ExponentPushToken[abcdefghijklmnopqrstuv]";

function createAdapter(accessToken?: string) {
  const config = {
    get: vi.fn((key: string) => (key === "EXPO_ACCESS_TOKEN" ? accessToken : undefined)),
  };
  const registry = {
    get: vi.fn().mockResolvedValue(10_000),
  };
  return new ExpoPushAdapter(config as never, registry as never);
}

describe("ExpoPushAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts payload to Expo Push API with default url and optional bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: "ok", id: "ticket-1" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createAdapter("expo-secret-token");
    await adapter.send({ token: VALID_TOKEN, title: "Merhaba", body: "Plan hazır" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer expo-secret-token");
    expect(JSON.parse(String(init.body))).toEqual({
      to: VALID_TOKEN,
      title: "Merhaba",
      body: "Plan hazır",
      sound: "default",
      data: { url: "/dashboard" },
    });
  });

  it("omits Authorization header when EXPO_ACCESS_TOKEN is unset and passes custom url", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: "ok", id: "ticket-2" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createAdapter(undefined);
    await adapter.send({ token: VALID_TOKEN, title: "Hatırlatma", body: "Ders", url: "/plan" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
    expect(JSON.parse(String(init.body)).data).toEqual({ url: "/plan" });
  });

  it("rejects malformed tokens without making an outbound request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createAdapter();
    await expect(
      adapter.send({ token: "https://evil.example/webhook", title: "T", body: "B" }),
    ).rejects.toBeInstanceOf(InvalidMobilePushTokenError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws InvalidMobilePushTokenError on DeviceNotRegistered ticket", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: "error",
          message: "Device not registered",
          details: { error: "DeviceNotRegistered" },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createAdapter();
    await expect(
      adapter.send({ token: VALID_TOKEN, title: "T", body: "B" }),
    ).rejects.toBeInstanceOf(InvalidMobilePushTokenError);
  });

  it("throws a retryable error on HTTP 503 or transient ticket errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            status: "error",
            message: "Rate limit exceeded",
            details: { error: "MessageRateExceeded" },
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createAdapter();

    const first = adapter.send({ token: VALID_TOKEN, title: "T", body: "B" });
    await expect(first).rejects.toThrow("HTTP 503");

    const second = adapter.send({ token: VALID_TOKEN, title: "T", body: "B" });
    await expect(second).rejects.toThrow("MessageRateExceeded");
  });
});
