import { expect, test, type Page } from "@playwright/test";

/** No session: the refresh call answers 401, so the page treats the visitor as anonymous. */
async function asVisitor(page: Page) {
  await page.route("http://localhost:3001/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3100",
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({ code: "AUTH_INVALID_REFRESH", message: "Oturum bulunamadı." }),
    }),
  );
}

test("landing hero'yu gösterir, Ücretsiz başla tanıtıma götürür", async ({ page }) => {
  await asVisitor(page);
  await page.addInitScript(() => window.localStorage.removeItem("mentor_welcome_seen"));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Bu gece ışığı yanan tek pencere seninki değil." }),
  ).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "Ücretsiz başla" }).first().click();
  await expect(page).toHaveURL(/\/hosgeldin$/);
  await expect(page.getByRole("heading", { name: "Selam, ben Puhu." })).toBeVisible();
});

test("zil, kamerayı o dairenin penceresine götürür", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop"), "the doorbell panel is desktop only");
  await asVisitor(page);
  await page.goto("/");
  const scene = page.locator(".lc-root[data-ready]");
  await expect(scene).toHaveAttribute("data-stop", "0");

  const bell = page.getByRole("link", { name: "Daire 6, Masa: pencereye git" });
  await bell.click();
  await expect(scene).toHaveAttribute("data-stop", "4", { timeout: 10_000 });
  await expect(bell).toHaveAttribute("aria-current", "location");
  await expect(page.locator('.lc-panel[data-stop="4"]')).toHaveCSS("opacity", "1");
});

test("koç notunda bir his seçilince örnek cevap gelir", async ({ page }) => {
  await asVisitor(page);
  // A stop anchor: the browser lands the camera on the coach's window.
  await page.goto("/#durak-2");
  await expect(page.locator(".lc-root[data-ready]")).toHaveAttribute("data-stop", "2");
  // Arriving by link, before any scroll event, still loads the room behind the glass.
  await expect(page.locator('.lc-win[data-stop="2"] img')).toHaveAttribute("src", /room-koc/);

  const chip = page.getByRole("button", { name: "Netlerim düştü" });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Son üç denemene bakalım/)).toBeVisible();
  await expect(page.getByText("Bu bir örnek cevap. Yapay zekâ koç Premium'da.")).toBeVisible();
});

test("alan seçimi pencereyi yakar ve onboarding'e taşınır", async ({ page }) => {
  await asVisitor(page);
  await page.addInitScript(() => window.localStorage.removeItem("mentor_landing_career"));
  await page.goto("/#durak-7");
  const scene = page.locator(".lc-root[data-ready]");
  await expect(scene).toHaveAttribute("data-stop", "7");
  await expect(page.getByRole("heading", { name: "Bu pencere boş. Senin olsun mu?" })).toBeAttached();

  await page.getByRole("radio", { name: "Yazılım & Bilişim" }).check();
  await expect(scene).toHaveAttribute("data-career", "YAZILIM");
  await expect(page.getByRole("heading", { name: "Penceren yandı." })).toBeAttached();
  expect(await page.evaluate(() => window.localStorage.getItem("mentor_landing_career"))).toBe("YAZILIM");

  await page.getByRole("link", { name: "Bu alanla başla" }).click();
  await expect(page).toHaveURL(/\/hosgeldin$/);
});

test("SSS, arama motorlarına FAQPage olarak da yayınlanır", async ({ request }) => {
  const html = await (await request.get("/")).text();
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/g)].map(
    ([, json]) => JSON.parse(json) as { "@type": string; mainEntity?: { name: string }[] },
  );
  const faq = blocks.find((block) => block["@type"] === "FAQPage");
  expect(faq?.mainEntity?.map((q) => q.name)).toContain("PuhuKoç ücretsiz mi?");
});

test("koç sayfası menüden açılır ve sabah turunu anlatır", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop"), "the section links are desktop only");
  await asVisitor(page);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Ana menü" }).getByRole("link", { name: "Koçlar için" }).click();
  await expect(page).toHaveURL(/\/koclar$/);
  await expect(page.getByRole("heading", { level: 1, name: "Dün gece kim çalıştı, bir bakışta gör." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bugün kime bakmalısın?" })).toBeAttached();
  await expect(page.getByRole("heading", { name: "Koçların sorduğu sorular" })).toBeAttached();
});

test("koç sayfası indekslenir, İngilizcesi indekslenmez", async ({ request }) => {
  const tr = await (await request.get("/koclar")).text();
  expect(tr).not.toMatch(/<meta name="robots" content="noindex/i);
  expect(tr).toMatch(/<link rel="canonical" href="https?:\/\/[^"]+\/koclar"/i);
  expect(tr).toContain('"@type":"FAQPage"');
  const en = await (await request.get("/en/coaches")).text();
  expect(en).toMatch(/<meta name="robots" content="noindex, follow"/i);
});

test("azaltılmış harekette notlar kamera olmadan alt alta görünür", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await asVisitor(page);
  await page.goto("/");
  await expect(page.locator(".lc-root[data-ready]")).toBeAttached();
  // At the top of the page, with no scrolling: every note is already laid out at full opacity.
  await expect(page.locator('.lc-panel[data-stop="4"]')).toHaveCSS("opacity", "1");
  await expect(page.getByRole("heading", { name: "Aynı masada, herkes kendi saatinde." })).toBeAttached();
});

test("tanıtımı görmüş ziyaretçi Ücretsiz başla ile kayda gider", async ({ page }) => {
  await asVisitor(page);
  await page.addInitScript(() => window.localStorage.setItem("mentor_welcome_seen", "1"));
  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: "Ücretsiz başla" }).first().click();
  await expect(page).toHaveURL(/\/kayit$/);
});
