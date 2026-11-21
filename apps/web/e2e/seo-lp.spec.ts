import { expect, test } from "@playwright/test";
import {
  asVisitor,
  expectFaqJsonLd,
  expectFirstPaint,
  expectNoHorizontalScroll,
  expectStillUnderReducedMotion,
} from "./seo-lp.fixture";

/* One `describe` per SEO page; the shared promises live in `seo-lp.fixture.ts`. */

test.describe("pomodoro", () => {
  const path = "/pomodoro-sayac";

  test.describe("first paint", () => {
    test.use({ javaScriptEnabled: false });

    test("paints the H1, the hero note and the room before hydration", async ({ page }) => {
      await expectFirstPaint(page, { path, h1: "Ücretsiz online pomodoro sayaç" });
    });
  });

  test.describe("hydrated", () => {
    test.beforeEach(async ({ page }) => {
      await asVisitor(page);
      await page.goto(path);
    });

    test("never scrolls sideways", async ({ page }) => {
      await expectNoHorizontalScroll(page);
    });

    test("ships the FAQ as FAQPage JSON-LD", async ({ page }) => {
      await expectFaqJsonLd(page);
    });

    test("keeps every note and sticker still under reduced motion", async ({ page }) => {
      await expectStillUnderReducedMotion(page);
    });

    test("puts the timer in the hero", async ({ page }) => {
      await expect(page.locator(".seo-hero #timer")).toHaveCount(1);
    });

    test("keeps the room inside its frame", async ({ page }) => {
      // The frame clips, so a room wider than it would hide the dial's edges without a scrollbar.
      const frame = await page.locator(".seo-hero .seo-scene").boundingBox();
      const room = await page.locator(".seo-hero .lf-scene").boundingBox();
      expect(room!.width).toBeLessThanOrEqual(frame!.width);
    });

    test("switches rooms from the keyboard", async ({ page }) => {
      const rooms = page.getByRole("group", { name: "Çalışma odası seç" });
      const library = rooms.getByRole("button", { name: "Kütüphane", exact: true });
      const cafe = rooms.getByRole("button", { name: "Kafe", exact: true });
      // Kütüphane is the opening room: move away first, so Enter on it has something to prove.
      // A click before hydration does nothing, so retry until the widget answers.
      await expect(async () => {
        await cafe.click();
        await expect(cafe).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
      }).toPass();
      await expect(library).toHaveAttribute("aria-pressed", "false");

      // The tabs run Kütüphane, Kafe, Ev: one step back from Kafe is Kütüphane.
      await cafe.focus();
      await page.keyboard.press("Shift+Tab");
      await expect(library).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(library).toHaveAttribute("aria-pressed", "true");
      await expect(cafe).toHaveAttribute("aria-pressed", "false");
    });
  });
});
