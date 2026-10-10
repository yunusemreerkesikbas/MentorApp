import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

it("does not publish a placeholder seller", async () => {
  vi.stubEnv("GOOGLE_ADS_PUBLISHER_ID", "");
  const response = GET();
  expect(response.status).toBe(404);
  expect(await response.text()).not.toContain("pub-");
});

it("publishes the configured Google seller as plain text", async () => {
  vi.stubEnv("GOOGLE_ADS_PUBLISHER_ID", "pub-1234567890123456");
  const response = GET();
  expect(response.headers.get("Content-Type")).toContain("text/plain");
  expect(await response.text()).toBe("google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
});

it("rejects malformed publisher configuration", () => {
  vi.stubEnv("GOOGLE_ADS_PUBLISHER_ID", "pub-placeholder\nmalicious-entry");
  expect(GET).toThrow("GOOGLE_ADS_PUBLISHER_ID");
});
