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

test.describe("landing first paint", () => {
  test.use({ javaScriptEnabled: false });

  test("omits the removed hero shortcuts on every viewport", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".lc-root")).not.toHaveAttribute("data-ready");
    await expect(page.locator(".lc-hero .lc-links")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Turu atla", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Ana menü" }).getByRole("link", { name: "Giriş yap", exact: true })).toBeVisible();
  });

  test("shows the city before hydration", async ({ page }, testInfo) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".lc-root")).not.toHaveAttribute("data-ready");
    await expect(page.locator(".lc-scene")).toHaveCSS("opacity", "1");
    await expect(page.locator('.lc-art[src$="city-facade.webp"]')).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath("landing-first-paint.png") });
  });
});

test("opening city geometry stays in place when hydration finishes", async ({ page }) => {
  await asVisitor(page);
  let releaseScripts = () => {};
  const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
  await page.route(/\/_next\/.*\.js(?:\?|$)/, async (route) => {
    await scriptsReady;
    await route.continue();
  });
  const positions = () => page.locator(".lc-art").evaluateAll((images) => images.map((image) => {
    const { x, y, width, height } = image.getBoundingClientRect();
    return { x, y, width, height };
  }));
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator(".lc-stage")).toHaveCSS("position", "sticky");
    await expect(page.locator(".lc-root")).not.toHaveAttribute("data-ready");
    const before = await positions();
    expect(before).toHaveLength(4);
    releaseScripts();
    await expect(page.locator(".lc-root")).toHaveAttribute("data-ready", "");
    const after = await positions();
    for (const [index, image] of before.entries()) {
      for (const key of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(after[index][key] - image[key]), `image ${index} ${key}`).toBeLessThan(1);
      }
    }
  } finally {
    releaseScripts();
  }
});

test("landing hero'yu gösterir, Ücretsiz başla tanıtıma götürür", async ({ page }) => {
  await asVisitor(page);
  await page.addInitScript(() => window.localStorage.removeItem("mentor_welcome_seen"));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Işığın yanıyorsa, yalnız değilsin." }),
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

  const bell = page.getByRole("link", { name: "Daire 6, Masa: oraya git" });
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
  await expect(page.getByText("Bu bir örnek cevap. Yapay zekâ koç Puhu, Premium’da.")).toBeVisible();
});

test("alan seçimi pencereyi yakar ve onboarding'e taşınır", async ({ page }) => {
  await asVisitor(page);
  await page.addInitScript(() => window.localStorage.removeItem("mentor_landing_career"));
  await page.goto("/#durak-7");
  const scene = page.locator(".lc-root[data-ready]");
  await expect(scene).toHaveAttribute("data-stop", "7");
  await expect(page.getByRole("heading", { name: "Bu oda boş. Senin olsun mu?" })).toBeAttached();

  await page.getByRole("radio", { name: "Yazılım & Bilişim" }).check();
  await expect(scene).toHaveAttribute("data-career", "YAZILIM");
  await expect(page.getByRole("heading", { name: "Hoş geldin, komşu!" })).toBeAttached();
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
  await expect(page.getByRole("heading", { name: "Arkadaşlarınla aynı masada çalış." })).toBeAttached();
  // The morning desk's phone holds one story screen instead of cycling.
  await expect(page.locator(".lm-slide.s2")).toHaveCSS("opacity", "1");
  await expect(page.locator(".lm-slide.s1")).toHaveCSS("opacity", "0");
});

test("sabah masası: iğne kendi notunu öne çıkarır, telefonda notlar sekmeyle gelir", async ({ page }, testInfo) => {
  await asVisitor(page);
  await page.goto("/#sabah");
  const desk = page.locator("#sabah");
  await expect(desk.getByRole("heading", { level: 2, name: "Masanda neler var?" })).toBeVisible();
  // The demo speaks the app's own words (notebooks.desk.bubble_due).
  await expect(desk.getByText("Yanlış Defterini en öne koydum. Bugün 2 tekrar seni bekliyor.")).toBeAttached();

  const pin = desk.getByRole("button", { name: "Hedef panosu" });
  await pin.click();
  await expect(pin).toHaveAttribute("aria-pressed", "true");
  // Picking the board pushes it: the swing restarts (it alternates between two names).
  await expect(desk.locator(".lm-stage")).toHaveAttribute("data-sway", /^[01]$/);
  await expect(desk.getByRole("heading", { level: 3, name: "Hedefini duvara as!" })).toBeVisible();

  const notebook = desk.getByRole("heading", { level: 3, name: "Yanlış soruların artık kaybolmaz!" });
  if (testInfo.project.name.startsWith("desktop")) {
    await expect(notebook).toBeVisible();
    return;
  }
  // Below lg: one note at a time.
  await expect(notebook).toBeHidden();
  await desk.getByRole("button", { name: "Hikâye", exact: true }).click();
  await expect(desk.getByRole("heading", { level: 3, name: "Hafta bitti mi? Hikâyen hazır!" })).toBeVisible();
  await expect(desk.getByRole("heading", { level: 3, name: "Hedefini duvara as!" })).toBeHidden();
});

test("odak odası: oda sekmesi sahneyi değiştirir", async ({ page }) => {
  await asVisitor(page);
  // The table note, Gece Yolculuğu and the league rows follow the API's availability flags, read
  // on the server where `page.route` cannot reach; this test holds whichever state the API is in.
  await page.goto("/#odak");
  const focus = page.locator("#odak");
  await expect(focus.getByRole("heading", { level: 2, name: "Odanı seç, süreni kur, başla!" })).toBeVisible();
  // The session page's own words.
  await expect(focus.getByRole("heading", { level: 3, name: "Odaklan, molanı al, serini koru." })).toBeVisible();

  const cafe = focus.getByRole("button", { name: "Kafe", exact: true });
  await cafe.click();
  await expect(cafe).toHaveAttribute("aria-pressed", "true");
  await expect(focus.locator(".lf-room")).toHaveAttribute("data-room", "CAFE");
  await expect(focus.locator(".lf-scene")).not.toHaveClass(/is-light/);
  await focus.getByRole("button", { name: "Ev", exact: true }).click();
  await expect(focus.locator(".lf-scene")).toHaveClass(/is-light/);
});

test("kâğıt not, fare üstüne gelince bir kez uçuşup durur", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop"), "a mouse starts it; touch screens run it on arrival");
  await asVisitor(page);
  await page.goto("/#sabah");
  const note = page.locator("#sabah .lm-note").nth(1);
  await expect(note).toHaveAttribute("data-flutter", "");
  await note.hover();
  await expect(note).toHaveAttribute("data-flutter", "on");
  // One damped breeze, then it settles and can lift again.
  await expect(note).toHaveAttribute("data-flutter", "", { timeout: 3000 });
});

test("tanıtımı görmüş ziyaretçi Ücretsiz başla ile kayda gider", async ({ page }) => {
  await asVisitor(page);
  await page.addInitScript(() => window.localStorage.setItem("mentor_welcome_seen", "1"));
  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: "Ücretsiz başla" }).first().click();
  await expect(page).toHaveURL(/\/kayit$/);
});
