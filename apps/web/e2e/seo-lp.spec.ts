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

test.describe("study programs", () => {
  const programs = [
    { name: "yks", path: "/yks-calisma-programi", h1: "YKS çalışma programı: hedefine göre haftanı kur", sample: "#ornek" },
    { name: "tyt", path: "/tyt-calisma-programi", h1: "TYT çalışma programı: temeli haftaya yay", sample: "#ornek-tyt" },
    { name: "lgs", path: "/lgs-calisma-programi", h1: "LGS çalışma programı: 8. sınıf haftanı sakin kur", sample: "#ornek" },
  ];

  for (const { name, path, h1, sample } of programs) {
    test.describe(name, () => {
      test.describe("first paint", () => {
        test.use({ javaScriptEnabled: false });

        test("paints the H1, the demo note and the plan room before hydration", async ({ page }) => {
          await expectFirstPaint(page, { path, h1 });
          await expect(page.locator('.seo-hero img[src*="room-plan"]')).toBeVisible();
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

        test("pins the plan demo as a paper note in the hero", async ({ page }) => {
          await expect(page.locator(".seo-hero .seo-note #plan-demo")).toHaveCount(1);
        });

        test("changes the preview when a second chip is picked", async ({ page }) => {
          const demo = page.locator("#plan-demo");
          const chip = demo.getByRole("group").first().getByRole("button").nth(1);
          const before = await demo.innerText();
          // A click before hydration does nothing, so retry until the widget answers.
          await expect(async () => {
            await chip.click();
            await expect(chip).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
          }).toPass();
          expect(await demo.innerText()).not.toBe(before);
        });

        test("picks a demo chip from the keyboard", async ({ page }) => {
          const chips = page.locator("#plan-demo").getByRole("group").first().getByRole("button");
          const first = chips.nth(0);
          const second = chips.nth(1);
          // Retry until hydration: Tab from the first chip, then Enter on the second.
          await expect(async () => {
            await first.focus();
            await page.keyboard.press("Tab");
            await expect(second).toBeFocused({ timeout: 500 });
            await page.keyboard.press("Enter");
            await expect(second).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
          }).toPass();
          await expect(first).toHaveAttribute("aria-pressed", "false");
          // Space works too: step back with Shift+Tab and press it.
          await page.keyboard.press("Shift+Tab");
          await expect(first).toBeFocused();
          await page.keyboard.press("Space");
          await expect(first).toHaveAttribute("aria-pressed", "true");
        });

        test("lists a seven-day sample week", async ({ page }) => {
          await expect(page.locator(`${sample} tbody tr`)).toHaveCount(7);
        });

        test("has the parent note only on LGS", async ({ page }) => {
          await expect(page.locator("#veli")).toHaveCount(name === "lgs" ? 1 : 0);
        });
      });
    });
  }
});

test.describe("mistake notebook", () => {
  const path = "/yanlis-defteri-uygulamasi";

  test.describe("first paint", () => {
    test.use({ javaScriptEnabled: false });

    test("paints the H1, the demo note and the desk before hydration", async ({ page }) => {
      await expectFirstPaint(page, { path, h1: "Yanlış defteri: sorularını kaydet, tekrar zamanı dön" });
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
      // The desk's Puhu is on the page, so the check above really covered his frames.
      await expect(page.locator(".lm-puhu img")).toHaveCount(5);
    });

    test("shows the desk scene as one labelled picture in the hero", async ({ page }) => {
      await expect(page.locator('.seo-hero [role="img"][aria-label]')).toBeVisible();
    });

    test("answers Çözdüm and Takıldım on the demo card", async ({ page }) => {
      const demo = page.locator(".seo-hero-pinned");
      const solved = demo.getByRole("button", { name: /Çözdüm/ });
      const missed = demo.getByRole("button", { name: /Takıldım/ });
      // A click before hydration does nothing, so retry until the widget answers.
      await expect(async () => {
        await solved.click();
        await expect(demo.getByText(/Harika!/)).toBeVisible({ timeout: 500 });
      }).toPass();
      await missed.click();
      await expect(demo.getByText(/Sorun değil!/)).toBeVisible();
      await expect(demo.getByText(/Harika!/)).toHaveCount(0);
    });

    test("keeps the demo buttons at least 44px tall", async ({ page }) => {
      for (const name of [/Çözdüm/, /Takıldım/]) {
        const box = await page.locator(".seo-hero-pinned").getByRole("button", { name }).boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    });

    test("has no 1 / 3 deck counter", async ({ page }) => {
      await expect(page.getByText("1 / 3")).toHaveCount(0);
    });

    test("keeps the how-it-works anchor", async ({ page }) => {
      await expect(page.locator("#nasil-calisir")).toHaveCount(1);
    });

    test("names the ecosystem section for assistive tech", async ({ page }) => {
      await expect(page.getByRole("region", { name: "Planın ve odak seansların da yanında" })).toBeVisible();
    });
  });
});

test.describe("study app", () => {
  const path = "/ders-calisma-uygulamasi";

  test.describe("first paint", () => {
    test.use({ javaScriptEnabled: false });

    test("paints the H1, the default plan note and the facade before hydration", async ({ page }) => {
      await expectFirstPaint(page, { path, h1: "Ders çalışma uygulaması: planın ve çalışma masan bir arada" });
      await expect(page.getByRole("button", { name: "Plan", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".seo-hero-pinned").getByRole("heading", { name: "Haftanı planla" })).toBeVisible();
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

    test("selects Plan by default", async ({ page }) => {
      await expect(page.getByRole("button", { name: "Plan", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("button", { name: "Odak", exact: true })).toHaveAttribute("aria-pressed", "false");
    });

    test("shows Odak's note and its link from the keyboard", async ({ page }) => {
      const plan = page.getByRole("button", { name: "Plan", exact: true });
      const odak = page.getByRole("button", { name: "Odak", exact: true });
      const note = page.locator(".seo-hero-pinned");
      // Retry until hydration; Enter only ever selects, so a repeat cannot flip it back.
      await expect(async () => {
        await plan.focus();
        await page.keyboard.press("Tab");
        await expect(odak).toBeFocused({ timeout: 500 });
        await page.keyboard.press("Enter");
        await expect(odak).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
      }).toPass();
      await expect(note.getByRole("heading", { name: "Odak seansı aç" })).toBeVisible();
      await expect(note.getByRole("link", { name: "Ücretsiz online pomodoro sayaç" })).toHaveAttribute("href", "/pomodoro-sayac");
      await expect(plan).toHaveAttribute("aria-pressed", "false");
    });

    test("announces the selected note politely", async ({ page }) => {
      await expect(page.locator('.seo-hero-pinned[aria-live="polite"]')).toHaveCount(1);
    });

    test("keeps the tags at least 44px tall", async ({ page }) => {
      for (const name of ["Puhu", "Defter", "Plan", "Odak", "Masa"]) {
        const box = await page.getByRole("button", { name, exact: true }).boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);
      }
    });

    test("lists the five features as notes", async ({ page }) => {
      await expect(page.locator("#ozellikler .seo-note")).toHaveCount(5);
    });

    test("keeps the anchors", async ({ page }) => {
      await expect(page.locator("#nasil")).toHaveCount(1);
      await expect(page.locator("#sss")).toHaveCount(1);
    });

    test("names the exams section for assistive tech", async ({ page }) => {
      await expect(page.getByRole("region", { name: "Hangi sınavlara hazırlanabilirsin?" })).toBeVisible();
    });

    test("breezes a plain note under a mouse, and keeps the live note still", async ({ page }, testInfo) => {
      test.skip(!testInfo.project.name.startsWith("desktop"), "a mouse starts it; touch screens run it on arrival");
      const note = page.locator("#ozellikler .seo-note").first();
      await note.scrollIntoViewIfNeeded();
      await expect(note).toHaveAttribute("data-flutter", "");
      // The hook binds after hydration, so hover again until the breeze starts.
      await expect(async () => {
        await page.mouse.move(0, 0);
        await note.hover();
        await expect(note).toHaveAttribute("data-flutter", "on", { timeout: 500 });
      }).toPass();
      await expect(note).toHaveAttribute("data-flutter", "", { timeout: 3000 });
      // The pinned note holds live controls: amplitude 0, so it never starts.
      const live = page.locator(".seo-hero-pinned .seo-note");
      await live.hover();
      await page.waitForTimeout(300);
      await expect(live).toHaveAttribute("data-flutter", "");
    });
  });
});

test.describe("en", () => {
  const routes = [
    "/en/pomodoro-timer",
    "/en/yks-study-program",
    "/en/tyt-study-program",
    "/en/lgs-study-program",
    "/en/mistake-notebook",
    "/en/study-app",
  ];

  for (const path of routes) {
    test(`${path} renders translated copy`, async ({ page }) => {
      await asVisitor(page);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const text = await page.locator("body").innerText();
      // Raw keys read `namespace.key`: the four page namespaces and the root ones the pages borrow.
      expect(text).not.toMatch(
        /\b(pomodoroLp|studyProgramLp|mistakeNotebookLp|studyAppLp|notebook|notebooks|session_room|session_ambient|landing)\.[a-z_]+/,
      );
      expect(text).not.toContain("MISSING_MESSAGE");
    });
  }
});
