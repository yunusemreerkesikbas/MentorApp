import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AchievementCollectionDto,
  AuthUser,
  PhoneStatusDto,
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

test("üye profili kimlik kartı, aksiyonlar ve yolculuk panelini her genişlikte korur", async ({
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

    const card = page.locator(".profile-card");
    await expect(card.getByRole("heading", { level: 1, name: profile.displayName })).toBeVisible();
    // The viewer's own profile lives at the foot of the sidebar (Topluluk Tur 1); on phones the
    // sidebar is the rooms drawer, so there is no header chip to check.
    if (viewport.width >= 1024) {
      const ownProfile = page
        .locator(".community-workspace__sidebar")
        .getByRole("link", { name: /Profilim/ });
      await expect(ownProfile).toHaveAttribute("href", "/topluluk/uye/yunus_emre");
      // Someone else's profile is not "Profilim" (the route template is the same).
      await expect(ownProfile).not.toHaveAttribute("aria-current", "page");
    }
    const headerBack = page
      .locator(".community-header")
      .getByRole("link", { name: "Topluluk" });
    if (viewport.width < 1024) {
      await expect(headerBack).toHaveAttribute("href", "/topluluk");
    } else {
      await expect(headerBack).toHaveCount(0);
    }

    // The card, no cover (Topluluk Tur 2): identity, bio, site, counts, the one ledge.
    await expect(page.locator(".profile-hero")).toHaveCount(0);
    await expect(card.getByTestId("premium-identity-mark")).toBeVisible();
    await expect(card.getByRole("img", { name: `${profile.displayName} profil fotoğrafı` })).toBeVisible();
    await expect(card.getByText("@ayse · KPSS", { exact: false })).toBeVisible();
    await expect(card.getByText(profile.bio!)).toBeVisible();
    await expect(card.getByRole("link", { name: "mentor.test/ayse" })).toHaveAttribute("href", profile.website!);
    await expect(card.getByRole("button", { name: /1\.130\s*takipçi/ })).toBeVisible();
    await expect(card.getByRole("button", { name: /475\s*takip$/ })).toBeVisible();
    await expect(card.getByText("8 günlük seri 🔥")).toBeVisible();
    await expect(card.getByRole("button", { name: "Takip et", exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: /Yol arkadaşı ol/ })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    // The journey: under the card below 1280 px, in the sticky rail above it.
    const railPanel = page.locator("aside .profile-progress-panel");
    const inlinePanel = page.locator(".profile-progress-mobile .profile-progress-panel");
    if (viewport.width >= 1280) {
      await expect(railPanel).toBeVisible();
      await expect(inlinePanel).toBeHidden();
      expect(
        await railPanel.evaluate((element) => getComputedStyle(element.parentElement!).position),
      ).toBe("sticky");
    } else {
      await expect(inlinePanel).toBeVisible();
      await expect(railPanel).toBeHidden();
    }

    if (viewport.width < 1024) {
      const channelsButton = page
        .locator(".community-header")
        .getByRole("button", { name: "Kanallar" });
      await expect(channelsButton).toBeVisible();

      if (viewport.width === 375) {
        const avatarTrigger = card.getByRole("button", { name: "Profil fotoğrafını aç" });
        await avatarTrigger.click();
        const preview = page.getByRole("dialog", {
          name: `${profile.displayName} profil fotoğrafı önizlemesi`,
        });
        await expect(preview).toBeVisible();
        await expect(
          preview.getByRole("img", { name: `${profile.displayName} profil fotoğrafı` }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(preview).toBeHidden();
        await expect(avatarTrigger).toBeFocused();

        await channelsButton.click();
        await expect(page.getByRole("dialog", { name: "Kanallar" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog", { name: "Kanallar" })).toBeHidden();
        await expect(channelsButton).toBeFocused();
      }
    }

    await page.screenshot({
      path: testInfo.outputPath(`member-profile-${viewport.width}.png`),
      fullPage: true,
      // The skeleton fades out with a blur; capture the settled page, not the crossfade.
      animations: "disabled",
    });
  }

  await page.getByRole("button", { name: "Profili paylaş" }).click();
  await expect(page.getByText("Profil bağlantısı kopyalandı")).toBeVisible();

  // The follow call fails in this mock: the button says "Takiptesin", then rolls back.
  const followButton = page.getByRole("button", { name: "Takip et", exact: true });
  await followButton.click();
  await expect(page.getByRole("button", { name: "Takiptesin", exact: true })).toBeVisible();
  await expect(followButton).toBeVisible();

  // A long name stays on one card without side scroll, and a broken photo falls back to initials.
  await page.goto("/topluluk/uye/broken");
  await expect(
    page.getByRole("heading", { name: "Çok Uzun İsimli Bir Topluluk Üyesi Soyadı" }),
  ).toBeVisible();
  await expect(page.locator(".profile-avatar").getByText("ÇS", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
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
  await expect(panel.getByText("111 / 300 XP", { exact: true })).toBeVisible();
  await expect(
    panel.getByRole("progressbar", { name: "Pusula seviye ilerlemesi" }),
  ).toHaveAttribute("aria-valuenow", "111");
  // Their own profile lights "Profilim" in the sidebar (phones carry the sidebar in the drawer).
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await expect(
      page.locator(".community-workspace__sidebar").getByRole("link", { name: /Profilim/ }),
    ).toHaveAttribute("aria-current", "page");
  }
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
  // A visitor reads about the owner, not to themselves (Topluluk Tur 2).
  await expect(panel.getByText("Kendi yönünü bulmaya başladı.", { exact: true })).toBeVisible();
  await expect(panel.getByRole("progressbar")).toHaveCount(0);
  await expect(panel.getByText(/XP daha/)).toHaveCount(0);

  await panel.getByRole("button", { name: "Gece Yolculuğu rehberini aç" }).click();
  const dialog = page.getByRole("dialog", { name: "Gece Yolculuğu" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("progressbar")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Kapat" }).click();
});

test("yüklenen profil ve oda listesi 'Yükleniyor…' canlı bölgesinin içinde kalmaz", async ({
  page,
}) => {
  // SkeletonGroup's reveal mode kept role="status" + aria-live + "Yükleniyor…" around the loaded
  // content, so a screen reader met the whole profile as a polite loading announcement.
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.goto("/topluluk/uye/ayse");
  await expect(page.locator(".profile-progress-panel:visible").getByText("Seviye 3 · Pusula", { exact: true })).toBeVisible();
  await expect(page.locator("main h1").first()).toBeVisible();
  await expect(page.locator('[role="status"] h1')).toHaveCount(0);
  await expect(page.locator('[aria-live] h1')).toHaveCount(0);
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
  if (page.viewportSize()!.width < 640) {
    await dialog.getByRole("button", { name: "Kapat" }).click();
  } else {
    await page
      .locator("[data-journey-level-guide-backdrop]")
      .click({ position: { x: 2, y: 2 } });
  }
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

  // Saved items moved to their own page (Topluluk Tur 2): no tab here, and old links land there.
  await expect(page.getByRole("button", { name: "Kaydedilenler", exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Paylaşımlar", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.goto("/topluluk/uye/yunus_emre?tab=bookmarks");
  await expect(page).toHaveURL(/\/topluluk\/kayitli$/);
  await expect(page.getByRole("heading", { level: 1, name: "Kaydedilenler" })).toBeVisible();

  await page.goto("/topluluk/uye/yunus_emre");

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
    await expect(image).toHaveAttribute("sizes", "80px");
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
  expect(firstTriggerBox!.x).toBeGreaterThanOrEqual(showcaseBox!.x);
  expect(lastTriggerBox!.x + lastTriggerBox!.width).toBeLessThanOrEqual(
    showcaseBox!.x + showcaseBox!.width,
  );

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
    if (method === "GET" && path === "/v1/users/me/auth-accounts/google") {
      return json(route, {
        enabled: false,
        linked: false,
        providerEmail: null,
        canLink: false,
      });
    }
    if (method === "GET" && path === "/v1/users/me/phone") {
      const phone: PhoneStatusDto = {
        verified: false,
        maskedPhoneNumber: null,
        available: false,
        reauthenticationRequired: false,
      };
      return json(route, phone);
    }
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
