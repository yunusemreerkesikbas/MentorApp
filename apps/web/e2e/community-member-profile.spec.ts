import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser, PublicProfile } from "@mentor/types";

const viewer: AuthUser = {
  id: "viewer-1",
  email: "viewer@test.local",
  displayName: "Yunus Emre Erkesikbaş",
  username: "yunus_emre",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "KPSS",
  examVariant: null,
  examDate: "2027-07-25",
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const profile: PublicProfile = {
  userId: "member-1",
  displayName: "Ayşe Yılmaz",
  username: "ayse",
  avatarUrl: "https://cdn.test/ayse.svg",
  examType: "KPSS",
  createdAt: "2026-01-01T00:00:00.000Z",
  bio: "Her gün biraz daha ileri.",
  website: "https://mentor.test/ayse",
  streak: 8,
  badges: ["marathon", "motivator", "newcomer"],
  xp: 411,
  level: { tier: 4, xp: 411, nextAt: 600 },
  followerCount: 1130,
  followingCount: 475,
  activityCount: 12,
  isPremium: true,
  isFollowing: false,
  buddyStatus: "none",
};

test("üye profili responsive hero, aksiyonlar ve seviye panelini korur", async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await mockProfileApi(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 768, height: 900 },
    { width: 1024, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/topluluk/uye/ayse");

    await expect(page.getByRole("heading", { name: profile.displayName })).toBeVisible();
    await expect(page.locator(".community-header__profile")).toHaveAttribute(
      "href",
      "/topluluk/uye/yunus_emre",
    );
    await expect(page.getByRole("img", { name: "Premium üye" })).toBeVisible();
    await expect(page.getByText("12", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("img", { name: `${profile.displayName} profil fotoğrafı` })).toBeVisible();
    expect(
      await page.locator(".profile-hero").evaluate((element) => getComputedStyle(element).backgroundColor),
    ).toBe("rgb(255, 255, 255)");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    if (viewport.width < 1024) {
      const channelsButton = page
        .locator(".community-header")
        .getByRole("button", { name: "Kanallar" });
      await expect(channelsButton).toBeVisible();
      await expect(page.getByText("Kanallar", { exact: true })).toHaveCount(0);

      if (viewport.width === 375) {
        await channelsButton.click();
        await expect(page.getByRole("dialog", { name: "Kanallar" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog", { name: "Kanallar" })).toBeHidden();
        await expect(channelsButton).toBeFocused();
      }
    }

    const desktopPanel = page.locator("aside").filter({ hasText: "Yolculuk seviyesi" });
    if (viewport.width >= 1280) {
      await expect(desktopPanel).toBeVisible();
      expect(await desktopPanel.evaluate((element) => getComputedStyle(element).position)).toBe(
        "sticky",
      );
    } else {
      await expect(desktopPanel).toBeHidden();
      await expect(page.getByText("Yolculuk seviyesi").first()).toBeVisible();

      if (viewport.width === 375) {
        const compactPanel = page.locator(
          ".profile-progress-mobile .profile-progress-panel",
        );
        const panelBox = await compactPanel.boundingBox();
        expect(panelBox).not.toBeNull();
        expect(panelBox!.height).toBeLessThanOrEqual(460);
      }
    }

    await page.screenshot({
      path: testInfo.outputPath(`member-profile-${viewport.width}.png`),
      fullPage: true,
    });
  }

  await page.getByRole("button", { name: "Profili paylaş" }).click();
  await expect(page.getByText("Profil bağlantısı kopyalandı")).toBeVisible();

  const followButton = page.getByRole("button", { name: "Takip et", exact: true });
  await followButton.click();
  await expect(page.getByRole("button", { name: "Takip ediliyor", exact: true })).toBeVisible();
  await expect(followButton).toBeVisible();

  await page.goto("/topluluk/uye/broken");
  await expect(
    page.getByRole("heading", {
      name: "Çok Uzun İsimli Bir Topluluk Üyesi Soyadı",
    }),
  ).toBeVisible();
  await expect(page.getByText("ÇU", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("kendi profili ve bookmarks URL geçmişi doğru aksiyonları kullanır", async ({ page }) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/yunus_emre");
  const editProfileLinks = page.getByRole("link", { name: "Profili düzenle" });
  await expect(editProfileLinks).toHaveCount(1);
  await expect(editProfileLinks).toHaveAttribute("href", "/ayarlar?section=profile");
  await expect(page.getByRole("button", { name: "Takip et", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Kaydedilenler", exact: true }).click();
  await expect(page).toHaveURL(/\?tab=bookmarks$/);
  await expect(page.getByRole("button", { name: "Kaydedilenler", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.goBack();
  await expect(page.getByRole("button", { name: "Gönderiler", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.goto("/topluluk/uye/yunus_emre?tab=bookmarks");
  await expect(page.getByRole("button", { name: "Kaydedilenler", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await editProfileLinks.click();
  await expect(page).toHaveURL(/\/ayarlar\?section=profile$/);
  await expect(page.getByRole("dialog", { name: "Profil bilgileri" })).toBeVisible();

  await page.goto("/profil");
  await expect(page).toHaveURL(/\/ayarlar$/);
});

async function mockProfileApi(page: Page) {
  await page.route("https://cdn.test/missing.svg", async (route) => {
    await route.fulfill({ status: 404, body: "" });
  });
  await page.route("https://cdn.test/ayse.svg", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#d6dbfd"/><circle cx="400" cy="360" r="190" fill="#55acee"/><path d="M120 1000c20-300 540-300 560 0" fill="#101216"/></svg>',
    });
  });

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname + url.search;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user: viewer });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, viewer);
    if (method === "GET" && path === "/v1/community/profile/ayse") return json(route, profile);
    if (method === "GET" && path === "/v1/community/profile/broken") {
      return json(route, {
        ...profile,
        userId: "member-broken",
        displayName: "Çok Uzun İsimli Bir Topluluk Üyesi Soyadı",
        username: "cok_uzun_kullanici_adi_ile_tasma_kontrolu",
        avatarUrl: "https://cdn.test/missing.svg",
      });
    }
    if (method === "GET" && path === "/v1/community/profile/yunus_emre") {
      return json(route, {
        ...profile,
        userId: viewer.id,
        displayName: viewer.displayName,
        username: viewer.username,
        avatarUrl: null,
        isPremium: false,
      });
    }
    if (method === "GET" && path.startsWith("/v1/forum/users/")) {
      return json(route, { items: [], nextCursor: null });
    }
    if (method === "GET" && path === "/v1/forum/bookmarks") {
      return json(route, { items: [], nextCursor: null });
    }
    if (method === "PUT" && path === "/v1/users/ayse/follow") {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return json(route, { code: "FOLLOW_FAILED", message: "Tekrar deneyin" }, 500);
    }
    if (method === "GET" && path.startsWith("/v1/forum/zones?")) {
      return json(route, { items: [], page: 1, pageSize: 100, total: 0 });
    }
    if (method === "GET" && path.startsWith("/v1/notifications?")) {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") {
      return json(route, { token: "test-stream" });
    }
    if (method === "GET" && path.startsWith("/v1/notifications/stream?")) {
      return route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
    }
    if (method === "GET" && path.startsWith("/v1/economy/")) {
      return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }

    return json(route, null, 204);
  });
}

function json(route: Route, body: unknown, status = 200) {
  const origin = route.request().headers()["origin"] ?? "http://localhost:3100";
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
    },
    body: body === null ? "" : JSON.stringify(body),
  });
}
