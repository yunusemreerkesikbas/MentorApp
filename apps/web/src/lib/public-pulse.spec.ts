import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStudiedLast24h } from "./public-pulse";

function answer(body: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({ ok, json: async () => body }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchStudiedLast24h", () => {
  it("returns the count when the API shows one", async () => {
    answer({ studiedLast24h: 1284 });
    expect(await fetchStudiedLast24h()).toBe(1284);
  });

  it("returns null below the threshold", async () => {
    answer({ studiedLast24h: null });
    expect(await fetchStudiedLast24h()).toBeNull();
  });

  it("returns null when the API fails or answers something else", async () => {
    answer({}, false);
    expect(await fetchStudiedLast24h()).toBeNull();
    answer({ studiedLast24h: "çok" });
    expect(await fetchStudiedLast24h()).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await fetchStudiedLast24h()).toBeNull();
  });

  it("is cached for five minutes", async () => {
    const fetchMock = answer({ studiedLast24h: 200 });
    await fetchStudiedLast24h();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/v1\/coaching\/public\/pulse$/),
      expect.objectContaining({ next: { revalidate: 300 } }),
    );
  });
});
