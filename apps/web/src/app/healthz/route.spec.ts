import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

it("checks the web process without fetching API data or rendering a document", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const response = GET();
  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.has("set-cookie")).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});
