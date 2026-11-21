import { expect, type Page } from "@playwright/test";

/*
 * Shared checks for the six public SEO pages ("Landing'in odası",
 * docs/superpowers/specs/2026-11-21-seo-lp-landing-rooms-design.md). Every page is the same shell
 * and paper kit, so the same promises hold on each: the H1 paints without JS, the FAQ ships as
 * FAQPage JSON-LD, a phone never scrolls sideways and reduced motion keeps every note still.
 */

/** Phones are the `mobile-*` project (375 px); the hero only has two columns from 768 px. */
const DESKTOP_MIN_WIDTH = 768;

/** No session: the refresh call answers 401, so the page treats the visitor as anonymous. */
export async function asVisitor(page: Page) {
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

/**
 * The server HTML alone: the H1 with its exact text, the first paper note, and on a desktop the
 * hero scene's art inside the first screen. Call it from a `describe` with
 * `test.use({ javaScriptEnabled: false })`, so nothing here waits on hydration.
 */
export async function expectFirstPaint(page: Page, { path, h1 }: { path: string; h1: string }) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".seo-note").first()).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) >= DESKTOP_MIN_WIDTH) {
    await expect(page.locator(".seo-scene img").first()).toBeInViewport();
  }
}

export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

export async function expectFaqJsonLd(page: Page) {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(blocks.some((block) => block.includes('"FAQPage"'))).toBe(true);
}

/**
 * Reduced motion: a mouse over a note starts no breeze (no SVG filter on it) and every Puhu
 * sticker stands still. The page reloads under the emulated media, because the flutter hook reads
 * the preference once, when it mounts.
 */
export async function expectStillUnderReducedMotion(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "load" });
  const note = page.locator("[data-flutter]").first();
  await note.scrollIntoViewIfNeeded();
  await note.hover();
  await page.waitForTimeout(300);
  expect(await note.evaluate((element) => getComputedStyle(element).filter)).toBe("none");
  const stickers = await page
    .locator(".seo-puhu")
    .evaluateAll((elements) => elements.map((element) => getComputedStyle(element).animationName));
  for (const animationName of stickers) {
    expect(animationName).toBe("none");
  }
}
