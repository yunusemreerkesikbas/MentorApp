import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchExamCalendarByFamily } from "./content-api";

afterEach(() => vi.unstubAllGlobals());
describe("public calendar reads", () => {
  it.each(["", "null"])("treats a successful empty calendar response %j as missing dates", async (body) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200 })));
    expect(await fetchExamCalendarByFamily("LGS")).toBeNull();
  });
  it("keeps an actual service failure distinct from a missing calendar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    await expect(fetchExamCalendarByFamily("LGS")).rejects.toThrow("Calendar fetch failed: 503");
  });
  it("does not silently treat malformed provider JSON as missing dates", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("invalid", { status: 200 })));
    await expect(fetchExamCalendarByFamily("LGS")).rejects.toThrow();
  });
});
