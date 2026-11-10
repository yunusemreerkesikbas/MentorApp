import { expect, test } from "@playwright/test";

test("liveness stays outside localized documents and cannot be cached", async ({ request }) => {
  const variants: Record<string, string>[] = [{}, { rsc: "1", "accept-language": "en" }];
  for (const headers of variants) {
    const response = await request.get("/healthz", { headers });
    expect(response.status()).toBe(204);
    expect(await response.body()).toHaveLength(0);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["location"]).toBeUndefined();
    expect(response.headers()["set-cookie"]).toBeUndefined();
  }
});
