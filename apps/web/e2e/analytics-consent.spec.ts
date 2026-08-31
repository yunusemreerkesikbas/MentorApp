import { expect, test } from "@playwright/test";

test.describe("GA4 açık rıza sözleşmesi", () => {
  test.skip(
    !process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    "GA4 E2E production build'i NEXT_PUBLIC_GA_MEASUREMENT_ID ile hazırlanmalı.",
  );

  test("reddetmeden önce ve reddettikten sonra Google etiketi yüklenmez", async ({
    page,
  }) => {
    let googleRequests = 0;
    page.on("request", (request) => {
      if (/google(tagmanager|analytics)\.com/.test(request.url())) googleRequests += 1;
    });

    await page.goto("/yasal/kvkk-aydinlatma");
    await expect(
      page.getByRole("dialog", { name: "Analitik çerez tercihin" }),
    ).toBeVisible();
    expect(googleRequests).toBe(0);
    await expect(page.locator("script#mentor-ga4")).toHaveCount(0);

    await page.getByRole("button", { name: "Reddet" }).click();
    await page.waitForTimeout(100);

    expect(googleRequests).toBe(0);
    await expect(page.locator("script#mentor-ga4")).toHaveCount(0);
  });

  test("kabulden sonra etiketi bir kez yükler ve GA4 config kuyruğunu kurar", async ({
    page,
  }) => {
    let scriptRequests = 0;
    await page.route("https://www.googletagmanager.com/gtag/js**", async (route) => {
      scriptRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "/* GA4 E2E stub */",
      });
    });

    await page.goto("/yasal/kvkk-aydinlatma");
    await page.getByRole("button", { name: "Kabul et" }).click();

    await expect(page.locator("script#mentor-ga4")).toHaveCount(1);
    await expect.poll(() => scriptRequests).toBe(1);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window.dataLayer ?? []).map((entry) =>
            Array.isArray(entry) ? String(entry[0]) : "",
          ).slice(0, 2),
        ),
      )
      .toEqual(["js", "config"]);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window.dataLayer ?? [])
            .filter(
              (entry): entry is unknown[] =>
                Array.isArray(entry) && entry[0] === "event",
            )
            .map((entry) => String(entry[1])),
        ),
      )
      .toContain("web_vital");
  });
});
