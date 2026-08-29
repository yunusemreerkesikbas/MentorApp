import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AchievementCollectionDto,
  AuthUser,
  PublicProfile,
} from "@mentor/types";

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
  achievementsEnabled: false,
  achievementShowcase: null,
  avatarUrl: "https://cdn.test/ayse.svg",
  examType: "KPSS",
  createdAt: "2026-01-01T00:00:00.000Z",
  bio: "Her gün biraz daha ileri.",
  website: "https://mentor.test/ayse",
  streak: 8,
  badges: ["marathon", "motivator", "newcomer"],
  xp: 411,
  level: {
    tier: 3,
    xp: 411,
    nextAt: 600,
    key: "compass",
    chapter: "awakening",
    currentAt: 300,
    nextKey: "cycle",
    progress: { current: 111, target: 300, remaining: 189, percent: 37 },
  },
  followerCount: 1130,
  followingCount: 475,
  activityCount: 12,
  isPremium: true,
  isFollowing: false,
  buddyStatus: "none",
};

const achievementShowcase = {
  earnedCount: 4,
  // The API owns this newest-first order; the client renders it as received.
  items: [
    {
      id: "week_reflected" as const,
      title: "Haftanı Dinledin",
      description: "Haftanın sesini duymak için durdun.",
      unlockHint: "Haftanı dinlemek için kısa bir değerlendirme yap.",
      artKey: "week_reflected" as const,
      status: "EARNED" as const,
      earnedAt: "2026-08-21T10:00:00.000Z",
      progress: null,
    },
    {
      id: "rhythm_found" as const,
      title: "Ritmi Yakaladın",
      description: "Yedi günlük çalışma ritmini yakaladın.",
      unlockHint: "Yedi günlük çalışma ritmine ulaş.",
      artKey: "rhythm_found" as const,
      status: "EARNED" as const,
      earnedAt: "2026-08-19T10:00:00.000Z",
      progress: null,
    },
    {
      id: "first_step" as const,
      title: "İlk Adım",
      description: "İlk geçerli odak oturumunu tamamladın.",
      unlockHint: "İlk geçerli odak oturumunu tamamla.",
      artKey: "first_step" as const,
      status: "EARNED" as const,
      earnedAt: "2026-08-18T10:00:00.000Z",
      progress: null,
    },
  ],
};

const achievementCollection: AchievementCollectionDto = {
  ownerView: true,
  summary: {
    earnedCount: 0,
    totalCount: 12,
    suggestedAchievementId: "rhythm_found",
  },
  items: [
    {
      id: "first_step",
      title: "İlk Adım",
      description: "İlk geçerli odak oturumunu tamamladın.",
      unlockHint: "İlk geçerli odak oturumunu tamamla.",
      artKey: "first_step",
      status: "LOCKED",
      earnedAt: null,
      progress: null,
    },
    {
      id: "rhythm_found",
      title: "Ritmi Yakaladın",
      description: "Yedi günlük çalışma ritmini yakaladın.",
      unlockHint: "Yedi günlük çalışma ritmine ulaş.",
      artKey: "rhythm_found",
      status: "LOCKED",
      earnedAt: null,
      progress: { current: 3, target: 7 },
    },
  ],
};

const publicAchievementCollection: AchievementCollectionDto = {
  ownerView: false,
  summary: null,
  items: [
    {
      ...achievementCollection.items[0],
      status: "EARNED",
      earnedAt: "2026-08-18T10:00:00.000Z",
    },
  ],
};

const completeAchievementIds = [
  "first_step",
  "route_drawn",
  "dream_space_created",
  "rhythm_found",
  "rhythm_kept",
  "returned_to_path",
  "route_renewed",
  "starting_point_set",
  "mistake_revisited",
  "week_reflected",
  "first_hello",
  "helped_someone",
] as const;

const completeAchievementCollection: AchievementCollectionDto = {
  ownerView: true,
  summary: {
    earnedCount: 12,
    totalCount: 12,
    suggestedAchievementId: null,
  },
  items: completeAchievementIds.map((id) => ({
    id,
    title: id,
    description: id,
    unlockHint: id,
    artKey: id,
    status: "EARNED",
    earnedAt: "2026-08-18T10:00:00.000Z",
    progress: null,
  })),
};

test("üye profili responsive hero, aksiyonlar ve seviye panelini korur", async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await mockProfileApi(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
  });

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 768, height: 900 },
    { width: 1024, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/topluluk/uye/ayse");

    await expect(
      page.getByRole("heading", { name: profile.displayName }),
    ).toBeVisible();
    await expect(page.locator(".community-header__profile")).toHaveAttribute(
      "href",
      "/topluluk/uye/yunus_emre",
    );
    await expect(
      page
        .locator(".community-header__profile")
        .locator(":scope > img, :scope > span")
        .first(),
    ).toHaveCSS("border-top-width", "0px");
    expect(
      await page
        .locator(".community-header__profile")
        .locator(":scope > img, :scope > span")
        .first()
        .evaluate((element) => getComputedStyle(element).boxShadow),
    ).toContain("0px 0px 0px 1px");
    const headerBack = page
      .locator(".community-header")
      .getByRole("link", { name: "Topluluk" });
    if (viewport.width < 1024) {
      await expect(headerBack).toHaveAttribute("href", "/topluluk");
    } else {
      await expect(headerBack).toHaveCount(0);
    }
    await expect(
      page.locator(".profile-hero").getByRole("link", { name: "Topluluk" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("premium-identity-mark")).toBeVisible();
    await expect(page.getByRole("img", { name: "Premium üye" })).toBeVisible();
    await expect(page.getByText("12", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: `${profile.displayName} profil fotoğrafı`,
      }),
    ).toBeVisible();
    expect(
      await page
        .locator(".profile-hero")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ).toBe("rgb(255, 255, 255)");
    await expect(page.locator(".profile-hero__mist")).toHaveCount(0);
    const identitySurface = await page
      .locator(".profile-hero__identity")
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          borderTopWidth: style.borderTopWidth,
          borderTopLeftRadius: style.borderTopLeftRadius,
          borderTopRightRadius: style.borderTopRightRadius,
        };
      });
    expect(identitySurface.backgroundColor).toBe("rgb(255, 255, 255)");
    const heroComposition = await page
      .locator(".profile-hero")
      .evaluate((hero) => {
        const media = hero.querySelector<HTMLElement>(".profile-hero__media");
        const identity = hero.querySelector<HTMLElement>(
          ".profile-hero__identity",
        );
        if (!media || !identity)
          throw new Error("Profile hero surfaces are missing");
        return {
          heroHeight: hero.getBoundingClientRect().height,
          mediaHeight: media.getBoundingClientRect().height,
          identityHeight: identity.getBoundingClientRect().height,
        };
      });
    if (viewport.width < 1280) {
      expect(identitySurface.borderTopWidth).toBe("1px");
      expect(identitySurface.borderTopLeftRadius).not.toBe("0px");
      expect(identitySurface.borderTopRightRadius).not.toBe("0px");
      await expect(page.locator(".profile-header")).toHaveCSS(
        "border-left-width",
        "1px",
      );
      expect(
        heroComposition.mediaHeight / heroComposition.heroHeight,
      ).toBeGreaterThan(0.58);
      expect(
        heroComposition.mediaHeight / heroComposition.heroHeight,
      ).toBeLessThan(0.64);
      expect(heroComposition.identityHeight).toBeLessThan(
        heroComposition.mediaHeight,
      );
    } else {
      expect(identitySurface.borderTopWidth).toBe("0px");
      expect(heroComposition.heroHeight).toBe(360);
      expect(heroComposition.mediaHeight).toBe(180);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    if (viewport.width < 1024) {
      const channelsButton = page
        .locator(".community-header")
        .getByRole("button", { name: "Kanallar" });
      await expect(channelsButton).toBeVisible();
      await expect(page.getByText("Kanallar", { exact: true })).toHaveCount(0);

      if (viewport.width === 375) {
        const avatarTrigger = page
          .getByRole("button", { name: "Profil fotoğrafını aç" })
          .first();
        await avatarTrigger.click();
        const preview = page.getByRole("dialog", {
          name: `${profile.displayName} profil fotoğrafı önizlemesi`,
        });
        await expect(preview).toBeVisible();
        await expect(
          preview.getByRole("img", {
            name: `${profile.displayName} profil fotoğrafı`,
          }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(preview).toBeHidden();
        await expect(avatarTrigger).toBeFocused();

        await channelsButton.click();
        await expect(
          page.getByRole("dialog", { name: "Kanallar" }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(
          page.getByRole("dialog", { name: "Kanallar" }),
        ).toBeHidden();
        await expect(channelsButton).toBeFocused();
      }
    }

    const desktopPanel = page
      .locator("aside")
      .filter({ hasText: "Yolculuk seviyesi" });
    if (viewport.width >= 1280) {
      await expect(desktopPanel).toBeVisible();
      await expect(page.locator(".profile-desktop-avatar")).toBeVisible();
      await expect(page.locator(".profile-desktop-avatar")).toHaveCSS(
        "width",
        "96px",
      );
      await expect(page.locator(".profile-desktop-avatar img")).toHaveCSS(
        "border-top-width",
        "0px",
      );
      await expect(page.locator(".profile-desktop-avatar img")).toHaveCSS(
        "outline-width",
        "1px",
      );
      expect(
        await page
          .locator(".profile-desktop-avatar img")
          .evaluate((element) => getComputedStyle(element).boxShadow),
      ).toContain("0px 0px 0px 4px");
      await expect(page.locator(".profile-header")).toHaveCSS(
        "border-left-width",
        "0px",
      );
      const actionRow = page.locator(".profile-header__action-row");
      const actionBox = await actionRow.boundingBox();
      const headerBox = await page.locator(".profile-header").boundingBox();
      const avatarBox = await page
        .locator(".profile-desktop-avatar")
        .boundingBox();
      expect(actionBox).not.toBeNull();
      expect(headerBox).not.toBeNull();
      expect(avatarBox).not.toBeNull();
      expect(
        Math.abs(
          actionBox!.x + actionBox!.width - (headerBox!.x + headerBox!.width),
        ),
      ).toBeLessThanOrEqual(20);
      expect(actionBox!.y).toBeGreaterThanOrEqual(avatarBox!.y);
      expect(actionBox!.y).toBeLessThanOrEqual(
        avatarBox!.y + avatarBox!.height,
      );
      await expect(
        actionRow.getByRole("button", { name: "Profili paylaş" }),
      ).toHaveCSS("width", "40px");
      await expect(
        actionRow.getByRole("button", { name: "Takip et" }),
      ).toHaveCSS("min-width", "144px");
      const metricBoxes = await page
        .locator(".profile-metrics > *")
        .evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect()),
        );
      expect(metricBoxes).toHaveLength(3);
      expect(
        metricBoxes[1]!.x - (metricBoxes[0]!.x + metricBoxes[0]!.width),
      ).toBeLessThanOrEqual(32);
      expect(
        metricBoxes[2]!.x - (metricBoxes[1]!.x + metricBoxes[1]!.width),
      ).toBeLessThanOrEqual(32);
      expect(
        await desktopPanel.evaluate(
          (element) => getComputedStyle(element).position,
        ),
      ).toBe("sticky");
    } else {
      await expect(page.locator(".profile-desktop-avatar")).toBeHidden();
      await expect(desktopPanel).toBeHidden();
      await expect(page.getByText("Yolculuk seviyesi").first()).toBeVisible();

      if (viewport.width === 375) {
        const compactPanel = page.locator(
          ".profile-progress-mobile .profile-progress-panel",
        );
        const panelBox = await compactPanel.boundingBox();
        expect(panelBox).not.toBeNull();
        expect(panelBox!.height).toBeLessThanOrEqual(460);
        await expect(compactPanel).toHaveCSS("box-shadow", "none");
        expect(
          await compactPanel.evaluate(
            (element) => getComputedStyle(element).backgroundImage,
          ),
        ).toBe("none");
      }
    }

    await page.screenshot({
      path: testInfo.outputPath(`member-profile-${viewport.width}.png`),
      fullPage: true,
    });
  }

  await page.getByRole("button", { name: "Profili paylaş" }).click();
  await expect(page.getByText("Profil bağlantısı kopyalandı")).toBeVisible();

  const followButton = page.getByRole("button", {
    name: "Takip et",
    exact: true,
  });
  await followButton.click();
  await expect(
    page.getByRole("button", { name: "Takip ediliyor", exact: true }),
  ).toBeVisible();
  await expect(followButton).toBeVisible();

  await page.goto("/topluluk/uye/broken");
  await expect(
    page.getByRole("heading", {
      name: "Çok Uzun İsimli Bir Topluluk Üyesi Soyadı",
    }),
  ).toBeVisible();
  await expect(
    page.locator(".profile-desktop-avatar").getByText("ÇS", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("profil sahibi Gece Yolculuğu kimliğini ve seviye içi ilerlemeyi görür", async ({
  page,
}) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/yunus_emre");

  const panel = page.locator(".profile-progress-panel:visible");
  await expect(panel.getByText("Seviye 3 · Pusula", { exact: true })).toBeVisible();
  await expect(panel.getByText("I. Bölüm · Uyanış", { exact: true })).toBeVisible();
  await expect(panel.getByText("Kendi yönünü bulmaya başladın.", { exact: true })).toBeVisible();
  await expect(panel.getByText("Döngü’ye ulaşmak için 189 XP daha", { exact: true })).toBeVisible();
  await expect(
    panel.getByRole("progressbar", { name: "Pusula seviye ilerlemesi" }),
  ).toHaveAttribute("aria-valuenow", "111");
});

test("ziyaretçi yolculuk kimliğini görür fakat sayısal XP ilerlemesini görmez", async ({
  page,
}) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/ayse");

  const panel = page.locator(".profile-progress-panel:visible");
  await expect(panel.getByText("Seviye 3 · Pusula", { exact: true })).toBeVisible();
  await expect(panel.getByText("Kendi yönünü bulmaya başladın.", { exact: true })).toBeVisible();
  await expect(panel.getByRole("progressbar")).toHaveCount(0);
  await expect(panel.getByText(/XP daha/)).toHaveCount(0);

  await panel.getByRole("button", { name: "Gece Yolculuğu rehberini aç" }).click();
  const dialog = page.getByRole("dialog", { name: "Gece Yolculuğu" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("progressbar")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Kapat" }).click();
});

test("Gece Yolculuğu rehberi erişilebilir dialog davranışını korur", async ({
  page,
}) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/yunus_emre");

  const trigger = page
    .locator(".profile-progress-panel:visible")
    .getByRole("button", { name: "Gece Yolculuğu rehberini aç" });
  await trigger.focus();
  await trigger.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Gece Yolculuğu" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Uyanış" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Ahenk" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Derinleşme" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Birlikte Işık" })).toBeVisible();
  const levelButtons = dialog.locator('button[aria-label^="Seviye "]');
  await expect(levelButtons).toHaveCount(12);
  const lastLevelButton = dialog.getByRole("button", { name: /Takımyıldız/ });
  await expect(lastLevelButton).toBeVisible();

  const closeButton = dialog.getByRole("button", { name: "Kapat" });
  await expect(closeButton).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await closeButton.press("Shift+Tab");
  await expect(lastLevelButton).toBeFocused();
  await lastLevelButton.press("Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");

  await trigger.click();
  await expect(dialog).toBeVisible();
  await page
    .locator("[data-journey-level-guide-backdrop]")
    .click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("Gece Yolculuğu rehberi azaltılmış hareket tercihinde kullanılabilir kalır", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/yunus_emre");
  const trigger = page
    .locator(".profile-progress-panel:visible")
    .getByRole("button", { name: "Gece Yolculuğu rehberini aç" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Gece Yolculuğu" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Kapat" }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("Takımyıldız seviyesinde yolculuğun devam ettiğini söyler", async ({ page }) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/complete_user");

  await expect(
    page
      .locator(".profile-progress-panel:visible")
      .getByText("Bütün ışıklar birbirine bağlandı; yolculuğun devam ediyor.", {
        exact: true,
      }),
  ).toBeVisible();
});

test("kendi profili ve bookmarks URL geçmişi doğru aksiyonları kullanır", async ({
  page,
}) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/yunus_emre");
  const editProfileLinks = page.getByRole("link", { name: "Profili düzenle" });
  await expect(editProfileLinks).toHaveCount(1);
  await expect(editProfileLinks).toHaveAttribute(
    "href",
    "/ayarlar?section=profile",
  );
  await expect(
    page.getByRole("button", { name: "Takip et", exact: true }),
  ).toHaveCount(0);

  await page
    .getByRole("button", { name: "Kaydedilenler", exact: true })
    .click();
  await expect(page).toHaveURL(/\?tab=bookmarks$/);
  await expect(
    page.getByRole("button", { name: "Kaydedilenler", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Gönderiler", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.goto("/topluluk/uye/yunus_emre?tab=bookmarks");
  await expect(
    page.getByRole("button", { name: "Kaydedilenler", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await editProfileLinks.click();
  await expect(page).toHaveURL(/\/ayarlar\?section=profile$/);
  await expect(
    page.getByRole("dialog", { name: "Profil bilgileri" }),
  ).toBeVisible();

  await page.goto("/profil");
  await expect(page).toHaveURL(/\/ayarlar$/);
});

test("kilitli başarılar gridde sade kalır ve ilerlemeyi bilgi kartında açıklar", async ({
  page,
}) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/yunus_emre?tab=achievements");

  const lockedCards = page.getByRole("button", { name: /başarısı kilitli/ });
  await expect(lockedCards).toHaveCount(2);
  await expect(page.locator("[data-achievement-info]")).toHaveCount(2);
  await expect(page.getByText("3/7", { exact: true })).toHaveCount(0);

  await page
    .getByRole("button", { name: /Ritmi Yakaladın başarısı kilitli/ })
    .click();
  const detail = page.getByRole("dialog", { name: "Ritmi Yakaladın" });
  await expect(
    detail.getByText("Nasıl uyanır?", { exact: true }),
  ).toBeVisible();
  await expect(
    detail.getByText("Yedi günlük çalışma ritmine ulaş."),
  ).toBeVisible();
  await expect(detail.getByText("İlerlemen", { exact: true })).toBeVisible();
  await expect(detail.getByText("3 / 7 gün", { exact: true })).toBeVisible();
});

test("profil sahibi koleksiyon özetini görür ve sıradaki keşiften bilgi kartını açar", async ({
  page,
}) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/yunus_emre?tab=achievements");

  await expect(page.getByRole("heading", { name: "Koleksiyonun" })).toBeVisible();
  await expect(page.getByText("0 / 12", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Koleksiyon ilerlemesi" }),
  ).toHaveAttribute("aria-valuenow", "0");

  const suggestion = page.getByRole("button", {
    name: /Sıradaki keşif.*Ritmi Yakaladın.*Nasıl uyanır?/,
  });
  await suggestion.click();
  const detail = page.getByRole("dialog", { name: "Ritmi Yakaladın" });
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "Kapat" }).click();
  await expect(suggestion).toBeFocused();

  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    )
    .toBe(true);
});

test("ziyaretçi görünümünde koleksiyon rehberi gösterilmez", async ({ page }) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/public_learner?tab=achievements");

  await expect(page.getByRole("heading", { name: "Koleksiyonun" })).toHaveCount(0);
  await expect(
    page.getByRole("progressbar", { name: "Koleksiyon ilerlemesi" }),
  ).toHaveCount(0);
  await expect(page.getByText("İlk Adım", { exact: true })).toBeVisible();
});

test("tamamlanan koleksiyon sakin kutlama durumunu gösterir", async ({ page }) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/complete_user?tab=achievements");

  await expect(page.getByText("12 / 12", { exact: true })).toBeVisible();
  await expect(page.getByText("Koleksiyon tamamlandı.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Bütün rozetler seninle; yolculuğun devam ediyor.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Sıradaki keşif", { exact: true })).toHaveCount(0);
});

test("başarı bilgi kartı odağı içeride tutar ve kapandığında tetikleyiciye döndürür", async ({
  page,
}) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/yunus_emre?tab=achievements");

  const trigger = page.getByRole("button", {
    name: /Ritmi Yakaladın başarısı kilitli/,
  });
  await trigger.focus();
  await trigger.press("Enter");

  const detail = page.getByRole("dialog", { name: "Ritmi Yakaladın" });
  const closeButton = detail.getByRole("button", { name: "Kapat" });
  await expect(closeButton).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("hidden");

  await closeButton.press("Tab");
  await expect(closeButton).toBeFocused();

  await page.keyboard.press("Escape");
  expect(await detail.count()).toBe(1);
  await expect(detail).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("");
});

test("başarı bilgi kartı dış alana tıklanınca kapanır", async ({ page }) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/yunus_emre?tab=achievements");

  const trigger = page.getByRole("button", {
    name: /Ritmi Yakaladın başarısı kilitli/,
  });
  await trigger.click();

  const detail = page.getByRole("dialog", { name: "Ritmi Yakaladın" });
  await page
    .locator("[data-achievement-detail-backdrop]")
    .click({ position: { x: 2, y: 2 } });

  await expect(detail).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("profil, API'nin sıraladığı yolculuk izlerini erişilebilir detay ve tümü bağlantısıyla gösterir", async ({
  page,
}) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/showcase_user");

  const showcase = page.getByRole("region", { name: "Yolculuktan İzler" });
  await expect(showcase).toBeVisible();
  const triggers = showcase.getByRole("button");
  await expect(triggers).toHaveCount(3);
  const showcaseImages = showcase.locator("img");
  await expect(showcaseImages).toHaveCount(3);
  for (const image of [
    showcaseImages.nth(0),
    showcaseImages.nth(1),
    showcaseImages.nth(2),
  ]) {
    await expect(image).toHaveAttribute("sizes", "64px");
  }
  await expect(triggers.nth(0)).toHaveAccessibleName(
    "Haftanı Dinledin seninle",
  );
  await expect(triggers.nth(1)).toHaveAccessibleName(
    "Ritmi Yakaladın seninle",
  );
  await expect(triggers.nth(2)).toHaveAccessibleName("İlk Adım seninle");
  await expect(showcase.getByText("Haftanı Dinledin", { exact: true })).toHaveCount(0);
  await expect(showcase.getByRole("link", { name: "Tümünü gör" })).toHaveAttribute(
    "href",
    "/topluluk/uye/showcase_user?tab=achievements",
  );
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    )
    .toBe(true);

  for (const trigger of [triggers.nth(0), triggers.nth(1), triggers.nth(2)]) {
    const box = await trigger.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  const showcaseBox = await showcase.boundingBox();
  const firstTriggerBox = await triggers.nth(0).boundingBox();
  const lastTriggerBox = await triggers.nth(2).boundingBox();
  expect(showcaseBox).not.toBeNull();
  expect(firstTriggerBox).not.toBeNull();
  expect(lastTriggerBox).not.toBeNull();
  const triggerGroupCenter =
    (firstTriggerBox!.x + lastTriggerBox!.x + lastTriggerBox!.width) / 2;
  const showcaseCenter = showcaseBox!.x + showcaseBox!.width / 2;
  expect(Math.abs(triggerGroupCenter - showcaseCenter)).toBeLessThanOrEqual(2);

  const trigger = triggers.nth(0);
  await trigger.focus();
  await trigger.press("Enter");
  const detail = page.getByRole("dialog", { name: "Haftanı Dinledin" });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("Haftanın sesini duymak için durdun.")).toBeVisible();
  await expect(detail.getByText("21.08.2026 tarihinde seninle")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("boş veya devre dışı başarı gösterimi profil başlığında yer kaplamaz", async ({
  page,
}) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/ayse");

  await expect(
    page.getByRole("region", { name: "Yolculuktan İzler" }),
  ).toHaveCount(0);

  await page.goto("/topluluk/uye/empty_showcase");

  await expect(
    page.getByRole("region", { name: "Yolculuktan İzler" }),
  ).toHaveCount(0);
});

test("tümünü gör bağlantısı yalnızca üçten fazla kazanımda görünür", async ({
  page,
}) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/three_showcase");

  const showcase = page.getByRole("region", { name: "Yolculuktan İzler" });
  await expect(showcase).toBeVisible();
  await expect(showcase.getByRole("button")).toHaveCount(3);
  await expect(showcase.getByRole("link", { name: "Tümünü gör" })).toHaveCount(0);
});

test("showcase chrome'u İngilizce rota için yerelleştirilir", async ({ page }) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/en/community/member/showcase_user");

  const showcase = page.getByRole("region", { name: "Traces of the Journey" });
  await expect(showcase).toBeVisible();
  await expect(
    showcase.getByRole("link", { name: "View all" }),
  ).toHaveAttribute("href", "/en/community/member/showcase_user?tab=achievements");
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
      return json(route, {
        accessToken: "test-token",
        expiresIn: 3600,
        user: viewer,
      });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, viewer);
    if (method === "GET" && path === "/v1/community/profile/ayse")
      return json(route, profile);
    if (method === "GET" && path === "/v1/community/profile/showcase_user") {
      return json(route, {
        ...profile,
        userId: "showcase-member",
        username: "showcase_user",
        achievementsEnabled: true,
        achievementShowcase,
      });
    }
    if (method === "GET" && path === "/v1/community/profile/three_showcase") {
      return json(route, {
        ...profile,
        userId: "three-showcase-member",
        username: "three_showcase",
        achievementsEnabled: true,
        achievementShowcase: { ...achievementShowcase, earnedCount: 3 },
      });
    }
    if (method === "GET" && path === "/v1/community/profile/empty_showcase") {
      return json(route, {
        ...profile,
        userId: "empty-showcase-member",
        username: "empty_showcase",
        achievementsEnabled: true,
        achievementShowcase: { earnedCount: 0, items: [] },
      });
    }
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
        achievementsEnabled: true,
        avatarUrl: null,
        isPremium: false,
      });
    }
    if (method === "GET" && path === "/v1/community/profile/public_learner") {
      return json(route, {
        ...profile,
        userId: "public-member",
        username: "public_learner",
        achievementsEnabled: true,
      });
    }
    if (method === "GET" && path === "/v1/community/profile/complete_user") {
      return json(route, {
        ...profile,
        userId: viewer.id,
        displayName: viewer.displayName,
        username: viewer.username,
        achievementsEnabled: true,
        xp: 10000,
        level: {
          tier: 12,
          xp: 10000,
          nextAt: null,
          key: "constellation",
          chapter: "shared_light",
          currentAt: 10000,
          nextKey: null,
          progress: null,
        },
      });
    }
    if (
      method === "GET" &&
      path === "/v1/community/profile/yunus_emre/achievements"
    ) {
      return json(route, achievementCollection);
    }
    if (
      method === "GET" &&
      path === "/v1/community/profile/public_learner/achievements"
    ) {
      return json(route, publicAchievementCollection);
    }
    if (
      method === "GET" &&
      path === "/v1/community/profile/complete_user/achievements"
    ) {
      return json(route, completeAchievementCollection);
    }
    if (method === "GET" && path.startsWith("/v1/forum/users/")) {
      return json(route, { items: [], nextCursor: null });
    }
    if (method === "GET" && path === "/v1/forum/bookmarks") {
      return json(route, { items: [], nextCursor: null });
    }
    if (method === "PUT" && path === "/v1/users/ayse/follow") {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return json(
        route,
        { code: "FOLLOW_FAILED", message: "Tekrar deneyin" },
        500,
      );
    }
    if (method === "GET" && path.startsWith("/v1/forum/zones?")) {
      return json(route, { items: [], page: 1, pageSize: 100, total: 0 });
    }
    if (method === "GET" && path.startsWith("/v1/notifications?")) {
      return json(route, {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        unreadCount: 0,
      });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") {
      return json(route, { token: "test-stream" });
    }
    if (method === "GET" && path.startsWith("/v1/notifications/stream?")) {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "",
      });
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
