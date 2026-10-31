import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_AVAILABILITY_KEYS } from "@mentor/types";
import { fetchAppAvailability } from "./app-availability-server";

afterEach(() => vi.unstubAllGlobals());

describe("server-loaded public availability", () => {
  it("reads a fresh allowlisted snapshot and strips unexpected response fields", async () => {
    const values = Object.fromEntries(APP_AVAILABILITY_KEYS.map(key => [key, true]));
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...values, secret: "not-for-client" })));
    vi.stubGlobal("fetch", fetch);
    expect(await fetchAppAvailability()).toEqual(values);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/v1/app/availability"), expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
  });

  it.each([null, {}, { social: "false" }])("returns an explicit unavailable snapshot for malformed data %j", async body => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    expect(await fetchAppAvailability()).toBeNull();
  });

  it("does not silently enable features after an HTTP or network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    expect(await fetchAppAvailability()).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchAppAvailability()).toBeNull();
  });
});
