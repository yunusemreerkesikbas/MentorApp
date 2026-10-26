import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

const user: AuthUser = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "profil@test.local",
  displayName: "Profil Test",
  username: "profile_test",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "KPSS",
  examVariant: null,
  examDate: "2026-07-26",
  dailyFocusGoalMinutes: null,
  careerGroup: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

test("ayarlar yasal footer bağlantısını AppNav içindeki belgeye açar", async ({ page }) => {
  await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  await page.goto("/ayarlar");

  const footer = page.getByRole("navigation", { name: "Yasal" });
  // The six legal texts only; cookie preferences is a row in the Uygulama card.
  await expect(footer.getByRole("link")).toHaveCount(6);
  await expect(page.getByRole("link", { name: "İkon kaynakları" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Çerez tercihleri" })).toHaveAttribute(
    "href", "/ayarlar/cerez-tercihleri",
  );
  await footer.getByRole("link", { name: "Kullanım Koşulları" }).click();

  await expect(page).toHaveURL(/\/ayarlar\/yasal\/kullanim-kosullari$/);
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await expect(page.getByTestId("app-sidebar")).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Ana menü" })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Kullanım Koşulları", level: 1 })).toBeVisible();
});

test("hesap silme satırı açıklamayı paylaşılan onay dialogunda gösterir", async ({
  page,
}) => {
  const api = await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  await page.goto("/profil");

  await expect(page.getByRole("heading", { name: "Hesap" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hesabımı sil", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Hesabın ve verilerin kalıcı olarak silinir: koç sohbetlerin, notların, hedef panon ve yüklediğin fotoğraflar. Aktif aboneliğin varsa iptal edilir. Fatura kayıtları yasal saklama yükümlülüğü gereği korunur. Bu işlem geri alınamaz.",
    ),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Hesabımı sil" }).click();

  const dialog = page.getByRole("dialog", { name: "Hesabımı sil" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Hesabımı sil", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText(
      "Hesabın ve verilerin kalıcı olarak silinir: koç sohbetlerin, notların, hedef panon ve yüklediğin fotoğraflar. Aktif aboneliğin varsa iptal edilir. Fatura kayıtları yasal saklama yükümlülüğü gereği korunur. Bu işlem geri alınamaz.",
    ),
  ).toBeVisible();
  await expect(api.deleteAccountCalls).toBe(0);

  await page.getByRole("button", { name: "Vazgeç" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(api.deleteAccountCalls).toBe(0);
});

// Guards APP-017's regression: the settings toggle only flipped a flag and no browser was ever
// subscribed, so every push job reached zero endpoints.
test("push anahtarı tarayıcıyı abone edip uç noktayı API'ye kaydeder", async ({ page }) => {
  test.skip(!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, "build has no VAPID public key");
  await mockProfileApi(page);
  const subscriptions: unknown[] = [];
  const preferencePatches: unknown[] = [];
  // Registered after the shared mock, so it answers first and hands everything else back.
  await page.route("http://localhost:3001/v1/notifications/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method === "GET" && path === "/v1/notifications/preferences") {
      return json(route, { emailEnabled: true, pushEnabled: false, campaignsEnabled: true });
    }
    if (method === "POST" && path === "/v1/notifications/push-subscriptions") {
      subscriptions.push(request.postDataJSON());
      return json(route, null, 204);
    }
    if (method === "PATCH" && path === "/v1/notifications/preferences") {
      preferencePatches.push(request.postDataJSON());
      return json(route, { emailEnabled: true, pushEnabled: true, campaignsEnabled: true });
    }
    return route.fallback();
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    const endpoint = "https://fcm.googleapis.com/fcm/send/e2e";
    const registration = {
      pushManager: {
        getSubscription: async () => null,
        subscribe: async () => ({
          endpoint,
          toJSON: () => ({ endpoint, keys: { p256dh: "p256dh-e2e", auth: "auth-e2e" } }),
        }),
      },
    };
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "default", requestPermission: async () => "granted" },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: async () => registration,
        getRegistration: async () => undefined,
        ready: Promise.resolve(registration),
      },
    });
  });

  await page.goto("/profil");
  const toggle = page.getByRole("switch", { name: "Push bildirimleri" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(subscriptions).toEqual([
    {
      endpoint: "https://fcm.googleapis.com/fcm/send/e2e",
      keys: { p256dh: "p256dh-e2e", auth: "auth-e2e" },
    },
  ]);
  expect(preferencePatches).toEqual([{ pushEnabled: true }]);
});

test("economy refresh updates the open balance sheet and celebrates ledger rewards once", async ({ page }) => {
  await mockProfileApi(page);
  let xp = 603;
  let coin = 10;
  const rewardId = "44444444-4444-4444-8444-444444444444";
  let rewardAvailable = false;
  let acknowledged = false;
  let acknowledgments = 0;
  const reward = { id: rewardId, amount: 7, unit: "COIN", status: "CONFIRMED", note: null,
    reason: "quest.weekly.effort-allowance", title: "Görev Coin’i", description: "Haftalık emek",
    createdAt: "2026-09-16T12:00:00Z" };
  const level = { tier: 3, xp: 603, nextAt: 1200, key: "compass", chapter: "awakening", currentAt: 600, nextKey: "cycle", progress: { current: 3, target: 600, remaining: 597, percent: 1 } };
  await page.route("http://localhost:3001/v1/economy/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/balance")) return json(route, { xp, coinConfirmed: coin, coinPending: 0, level });
    if (path.endsWith("/quests")) return json(route, []);
    if (path.endsWith("/invite")) return json(route, inviteView());
    if (path.endsWith("/ledger")) return json(route, rewardAvailable ? [reward] : []);
    if (path.endsWith("/rewards/unseen")) {
      const items = rewardAvailable && !acknowledged ? [reward] : [];
      return json(route, { items, total: items.length, page: 1, pageSize: 20 });
    }
    if (path.endsWith("/rewards/seen")) {
      expect(route.request().postDataJSON()).toEqual({ ledgerIds: [rewardId] });
      acknowledged = true;
      acknowledgments += 1;
      return json(route, null, 204);
    }
    return route.fallback();
  });
  await page.addInitScript(() => {
    localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    (window as unknown as { coinRewards: number[] }).coinRewards = [];
    window.addEventListener("mentor:coin-celebrate", (event) => {
      (window as unknown as { coinRewards: number[] }).coinRewards.push((event as CustomEvent).detail.amount);
    });
  });
  await page.goto("/profil");
  await page.getByRole("button", { name: "Bakiyen", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("603", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { coinRewards: number[] }).coinRewards)).toEqual([]);
  xp = 608;
  coin = 17;
  rewardAvailable = true;
  await page.evaluate(() => window.dispatchEvent(new Event("mentor:economy-changed")));
  await expect(sheet.getByText("608", { exact: true })).toBeVisible();
  await expect(sheet.getByText("17", { exact: true })).toBeVisible();
  await expect.poll(() => acknowledgments).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { coinRewards: number[] }).coinRewards)).toEqual([7]);
  await page.evaluate(() => window.dispatchEvent(new Event("mentor:economy-changed")));
  await expect.poll(() => acknowledged).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { coinRewards: number[] }).coinRewards)).toEqual([7]);
});

test("koç ayarlarında Kazanımlar yok, sınav satırı koçluk yaptığı sınavı sorar", async ({ page }) => {
  await mockProfileApi(page, { ...user, roles: ["COACH"] });
  // Counted, then handed to the ECONOMY_DISABLED mock: a student's settings fetch quests on mount
  // even with the economy off, so zero calls means the section never mounted.
  let questCalls = 0;
  await page.route("http://localhost:3001/v1/economy/quests", (route) => {
    questCalls += 1;
    return route.fallback();
  });
  // A real balance, so the missing pills below are the coach rule and not an empty store.
  let balanceCalls = 0;
  await page.route("http://localhost:3001/v1/economy/balance", (route) => {
    balanceCalls += 1;
    return json(route, { xp: 40, coinConfirmed: 5, coinPending: 0, level: null });
  });
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  await page.goto("/ayarlar");

  await page.getByRole("button", { name: /Koçluk yaptığın sınav/ }).click();
  await page.getByRole("button", { name: "KPSS", exact: true }).click();
  await expect(page.getByText("Hangi KPSS düzeyine koçluk yapıyorsun?")).toBeVisible();

  await expect(page.getByText("Hedef sınav", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Kazanımlar", { exact: true })).toHaveCount(0);
  expect(questCalls).toBe(0);
  await expect.poll(() => balanceCalls).toBeGreaterThan(0);
  await expect(page.getByLabel("Coin ve XP")).toHaveCount(0);
});

// --- Davet kartı (Ayarlar > Davet et) -------------------------------------------------------------

const INVITE_CODE = "PUHU-TEST2345";
const percentDiscount = { discountType: "PERCENT", discountValue: 30 };

/**
 * The card as the API returns it (`InviteCodeView`) for a student who has not been invited and
 * nobody joined yet, with a live %30 friend discount.
 */
function inviteView(over: Record<string, unknown> = {}) {
  return {
    code: INVITE_CODE,
    rewardCoin: 20,
    joined: [],
    joinedCount: 0,
    convertedCount: 0,
    redeemed: null,
    canRedeem: true,
    friendDiscount: percentDiscount,
    ...over,
  };
}

/**
 * Economy ON for the settings page: balance, quests and the invite view (which carries the friend
 * discount itself). The public preview is counted, never needed: the card must not ask it.
 * Registered after `mockProfileApi`, so it answers first and hands everything else back.
 */
async function mockInviteEconomy(
  page: Page,
  { view, onRedeem }: { view: () => unknown; onRedeem?: () => void },
) {
  const redeemBodies: unknown[] = [];
  const previewRequests: string[] = [];
  await page.route("http://localhost:3001/v1/economy/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method === "GET" && path.endsWith("/balance")) {
      return json(route, { xp: 0, coinConfirmed: 0, coinPending: 0, level: null });
    }
    if (method === "GET" && path.endsWith("/quests")) return json(route, []);
    if (method === "GET" && path.endsWith("/rewards/unseen")) {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20 });
    }
    if (method === "GET" && path.startsWith("/v1/economy/invite/preview/")) {
      previewRequests.push(path);
      return json(route, { inviterDisplayName: "Profil", discount: null });
    }
    if (method === "GET" && path === "/v1/economy/invite") return json(route, view());
    if (method === "POST" && path === "/v1/economy/invite/redeem") {
      redeemBodies.push(request.postDataJSON());
      onRedeem?.();
      return json(route, { status: "PENDING" }, 201);
    }
    return route.fallback();
  });
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  return { redeemBodies, previewRequests };
}

async function openInviteCard(page: Page) {
  await page.goto("/ayarlar");
  const row = page.getByRole("button", { name: "Davet et", exact: true });
  await row.click();
  const dialog = page.getByRole("dialog", { name: /Arkadaşını getir/ });
  await expect(dialog).toBeVisible();
  return { row, dialog };
}

test.describe("davet kartı", () => {
  test("başlık, indirimli alt metin ve davet kodu", async ({ page }) => {
    await mockProfileApi(page);
    const api = await mockInviteEconomy(page, { view: () => inviteView() });
    const { dialog } = await openInviteCard(page);

    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(
      "Arkadaşını getir, birlikte çalışın!",
    );
    await expect(dialog.getByText("Davet et", { exact: true })).toBeVisible();
    // The discount comes from the view's `friendDiscount`, not from a second (public) lookup.
    await expect(
      dialog.getByText("%30 indirim arkadaşına, 20 Coin sana. Üstelik birlikte çalışırsınız!"),
    ).toBeVisible();
    await expect(dialog.getByText(INVITE_CODE, { exact: true })).toBeVisible();
    expect(api.previewRequests).toEqual([]);
  });

  test("indirim yoksa alt metin yalnız Coin'i söyler", async ({ page }) => {
    await mockProfileApi(page);
    const api = await mockInviteEconomy(page, { view: () => inviteView({ friendDiscount: null }) });
    const { dialog } = await openInviteCard(page);
    expect(api.previewRequests).toEqual([]);

    await expect(
      dialog.getByText("Arkadaşın Premium'a geçince sana 20 Coin. Üstelik birlikte çalışırsınız!"),
    ).toBeVisible();
    await expect(dialog.getByText("%30")).toHaveCount(0);
  });

  test("Paylaş bağlantıyı navigator.share ile paylaşır", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, { view: () => inviteView() });
    await page.addInitScript(() => {
      (window as unknown as { shared: unknown[] }).shared = [];
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: unknown) => {
          (window as unknown as { shared: unknown[] }).shared.push(data);
        },
      });
    });
    const { dialog } = await openInviteCard(page);

    await dialog.getByRole("button", { name: "Paylaş" }).click();

    const shared = await page.evaluate(() => (window as unknown as { shared: unknown[] }).shared);
    expect(shared).toHaveLength(1);
    const payload = shared[0] as { url: string; text: string };
    expect(new URL(payload.url).pathname).toBe(`/davet/${INVITE_CODE}`);
    expect(new URL(payload.url).origin).toBe(new URL(page.url()).origin);
    expect(payload.text).toBe("PuhuKoç'ta birlikte çalışalım!");
  });

  test("paylaşım yoksa bağlantıyı kopyalar ve söyler", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, { view: () => inviteView() });
    await page.addInitScript(() => {
      (window as unknown as { copied: string[] }).copied = [];
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as unknown as { copied: string[] }).copied.push(text);
          },
        },
      });
    });
    const { dialog } = await openInviteCard(page);

    await dialog.getByRole("button", { name: "Paylaş" }).click();

    await expect(dialog.getByText("Bağlantı kopyalandı")).toBeVisible();
    const copied = await page.evaluate(() => (window as unknown as { copied: string[] }).copied);
    expect(copied).toHaveLength(1);
    expect(new URL(copied[0]).pathname).toBe(`/davet/${INVITE_CODE}`);
  });

  test("ilerleme satırı katılanları ve Premium'a geçenleri sayar", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, {
      view: () =>
        inviteView({
          joined: [{ displayName: "Ayşe" }, { displayName: "Mehmet" }],
          joinedCount: 2,
          convertedCount: 1,
        }),
    });
    const { dialog } = await openInviteCard(page);

    await expect(dialog.getByText("2 arkadaşın katıldı · 1 kişi Premium'a geçti")).toBeVisible();
    await expect(dialog.getByText("İlk arkadaşını bekliyoruz!")).toHaveCount(0);
  });

  test("katılan arkadaşlar isimle görünür, Premium'a geçen kişi işaretlenmez", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, {
      view: () =>
        inviteView({
          joined: [{ displayName: "Ayşe" }, { displayName: "Mehmet" }],
          joinedCount: 2,
          convertedCount: 1,
        }),
    });
    const { dialog } = await openInviteCard(page);

    const friends = dialog.getByRole("list", { name: "Katılan arkadaşların" });
    await expect(friends).toBeVisible();
    // Exactly the names: no "+N" (everyone is listed) and no per-person payment marker.
    await expect(friends.getByRole("listitem")).toHaveText(["Ayşe", "Mehmet"]);
    await expect(friends.getByText(/Premium|\+/)).toHaveCount(0);
  });

  test("isimler ilk üçle sınırlı, kalanı +N der ve sayı joinedCount'tan gelir", async ({ page }) => {
    await mockProfileApi(page);
    // The view lists the newest 20 live friends and counts all 25.
    await mockInviteEconomy(page, {
      view: () =>
        inviteView({
          joined: Array.from({ length: 20 }, (_, index) => ({ displayName: `Arkadaş ${index}` })),
          joinedCount: 25,
          convertedCount: 3,
        }),
    });
    const { dialog } = await openInviteCard(page);

    const friends = dialog.getByRole("list", { name: "Katılan arkadaşların" });
    await expect(friends.getByRole("listitem")).toHaveCount(4);
    await expect(friends.getByRole("listitem").nth(0)).toHaveText("Arkadaş 0");
    await expect(friends.getByRole("listitem").nth(2)).toHaveText("Arkadaş 2");
    await expect(friends.getByText("+22", { exact: true })).toBeVisible();
    // Screen readers hear words, not a bare "+22".
    await expect(friends.getByText("22 arkadaş daha", { exact: true })).toHaveCount(1);
    await expect(friends.getByText("Arkadaş 3", { exact: true })).toHaveCount(0);
  });

  test("ilerleme satırı listedeki 20 isimde durmaz, toplam katılanı söyler", async ({ page }) => {
    await mockProfileApi(page);
    // The view lists the newest 20 live friends and counts all 25.
    await mockInviteEconomy(page, {
      view: () =>
        inviteView({
          joined: Array.from({ length: 20 }, (_, index) => ({ displayName: `Arkadaş ${index}` })),
          joinedCount: 25,
          convertedCount: 3,
        }),
    });
    const { dialog } = await openInviteCard(page);

    await expect(dialog.getByText("25 arkadaşın katıldı · 3 kişi Premium'a geçti")).toBeVisible();
    await expect(dialog.getByText(/^20 arkadaşın katıldı/)).toHaveCount(0);
  });

  test("katılan sayısı listeyi değil joinedCount'u izler: liste boş olsa da sayı doğru", async ({ page }) => {
    await mockProfileApi(page);
    // Every friend erased: nobody to list, but the count still says how many came.
    await mockInviteEconomy(page, {
      view: () => inviteView({ joined: [], joinedCount: 2, convertedCount: 1 }),
    });
    const { dialog } = await openInviteCard(page);

    await expect(dialog.getByText("2 arkadaşın katıldı · 1 kişi Premium'a geçti")).toBeVisible();
    await expect(dialog.getByText("İlk arkadaşını bekliyoruz!")).toHaveCount(0);
    // Nobody left to name: no list and no orphan "+2" chip, the count line says it all.
    await expect(dialog.getByRole("list", { name: "Katılan arkadaşların" })).toHaveCount(0);
  });

  test("kimse katılmadıysa bekleyen metin görünür", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, { view: () => inviteView() });
    const { dialog } = await openInviteCard(page);

    await expect(dialog.getByText("İlk arkadaşını bekliyoruz!")).toBeVisible();
    await expect(dialog.getByText(/arkadaşın katıldı/)).toHaveCount(0);
  });

  test("kod kullanılmışsa davet edeni söyler ve form görünmez", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, {
      view: () =>
        inviteView({
          canRedeem: false,
          redeemed: {
            inviterDisplayName: "Ayşe",
            discount: { ...percentDiscount, phoneRequired: false },
          },
        }),
    });
    const { dialog } = await openInviteCard(page);

    await expect(dialog.getByText("Ayşe davetiyle geldin!")).toBeVisible();
    await expect(dialog.getByText("İndirimin ödeme ekranında seni bekliyor.")).toBeVisible();
    await expect(dialog.getByRole("textbox")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Kodu kullan" })).toHaveCount(0);
  });

  test("telefon doğrulanmadıysa indirim için telefona yönlendirir", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, {
      view: () =>
        inviteView({
          canRedeem: false,
          redeemed: {
            inviterDisplayName: "Ayşe",
            discount: { ...percentDiscount, phoneRequired: true },
          },
        }),
    });
    const { dialog } = await openInviteCard(page);

    await expect(dialog.getByText("Ayşe davetiyle geldin!")).toBeVisible();
    await expect(dialog.getByText("İndirimin ödeme ekranında seni bekliyor.")).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: "İndirim için telefonunu doğrula." })).toHaveAttribute(
      "href",
      "/ayarlar#phone-verification",
    );
  });

  test("kod kullanılamıyorsa (ödeme yapmış ya da süre dolmuş) form görünmez", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, { view: () => inviteView({ canRedeem: false }) });
    const { dialog } = await openInviteCard(page);

    await expect(dialog.getByText(INVITE_CODE, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("textbox")).toHaveCount(0);
    await expect(dialog.getByText(/davetiyle geldin/)).toHaveCount(0);
  });

  test("açıklama satırı kod alanının üstünde görünür", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, { view: () => inviteView() });
    const { dialog } = await openInviteCard(page);

    const disclosure = dialog.getByText(
      "Davet eden kişi katıldığını görecek. Premium'a geçersen ona Coin düşer.",
    );
    const input = dialog.getByRole("textbox", { name: "Bir davet kodun var mı?" });
    await expect(disclosure).toBeVisible();
    await expect(input).toBeVisible();
    // The dock slides in, so two sequential reads can straddle a frame; retry until it has landed.
    await expect(async () => {
      const disclosureBox = await disclosure.boundingBox();
      const inputBox = await input.boundingBox();
      expect(disclosureBox!.y + disclosureBox!.height).toBeLessThanOrEqual(inputBox!.y);
    }).toPass();
  });

  test("kod formu kartın içinde kalır, Kodu kullan düğmesi kesilmez", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, {
      view: () => inviteView({ joined: [{ displayName: "Ayşe" }], joinedCount: 1, convertedCount: 1 }),
    });
    const { dialog } = await openInviteCard(page);
    const submit = dialog.getByRole("button", { name: "Kodu kullan" });

    // The dock slides in; measure once it has landed.
    await expect(async () => {
      const dialogBox = await dialog.boundingBox();
      const submitBox = await submit.boundingBox();
      expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height);
    }).toPass();
  });

  test("kodu kullanınca kaydeder, kaydedildiğini söyler ve davet edeni gösterir", async ({ page }) => {
    await mockProfileApi(page);
    let redeemed = false;
    const api = await mockInviteEconomy(page, {
      view: () =>
        redeemed
          ? inviteView({
              canRedeem: false,
              redeemed: { inviterDisplayName: "Ayşe", discount: null },
            })
          : inviteView(),
      onRedeem: () => {
        redeemed = true;
      },
    });
    const { dialog } = await openInviteCard(page);

    await dialog.getByRole("textbox", { name: "Bir davet kodun var mı?" }).fill("puhu-abcd2345");
    await dialog.getByRole("button", { name: "Kodu kullan" }).click();

    await expect(dialog.getByText("Kodun kaydedildi!")).toBeVisible();
    await expect(dialog.getByText("Ayşe davetiyle geldin!")).toBeVisible();
    await expect(dialog.getByRole("textbox")).toHaveCount(0);
    expect(api.redeemBodies).toEqual([{ code: "PUHU-ABCD2345" }]);
  });

  test("odak dialoga girer, Tab içeride döner, Escape odağı Davet et satırına geri verir", async ({
    page,
  }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, { view: () => inviteView() });
    const { row, dialog } = await openInviteCard(page);

    await expect(dialog.getByRole("button", { name: "Kapat" })).toBeFocused();

    const insideDialog = () =>
      page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press("Tab");
      expect(await insideDialog()).toBe(true);
    }
    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await insideDialog()).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(row).toBeFocused();
  });

  test("Kapat düğmesi de odağı Davet et satırına geri verir", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, { view: () => inviteView() });
    const { row, dialog } = await openInviteCard(page);

    await dialog.getByRole("button", { name: "Kapat" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(row).toBeFocused();
  });
});

// --- Tavsiye et (Ayarlar > Uygulama) --------------------------------------------------------------

/**
 * `navigator.share` records what it was handed into `window.shared`. With `rejectWith` it then
 * rejects with a DOMException of that name, the way a browser refuses (NotAllowedError) or the
 * user dismisses the sheet (AbortError).
 */
async function stubNavigatorShare(page: Page, rejectWith?: string) {
  await page.addInitScript((errorName) => {
    (window as unknown as { shared: unknown[] }).shared = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: unknown) => {
        (window as unknown as { shared: unknown[] }).shared.push({
          ...(data as object),
          at: performance.now(),
        });
        if (errorName) throw new DOMException("share refused", errorName);
      },
    });
  }, rejectWith);
}

/** `navigator.clipboard.writeText` records into `window.copied`. */
async function stubClipboard(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { copied: string[] }).copied = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copied: string[] }).copied.push(text);
        },
      },
    });
  });
}

async function sharedPayloads(page: Page) {
  return page.evaluate(
    () => (window as unknown as { shared: { url: string; at: number }[] }).shared,
  );
}

async function copiedTexts(page: Page) {
  return page.evaluate(() => (window as unknown as { copied: string[] }).copied);
}

test.describe("tavsiye et", () => {
  test("öğrencide kartın zaten okuduğu kodla kişisel bağlantıyı paylaşır, yeni davet isteği atmaz", async ({
    page,
  }) => {
    await mockProfileApi(page);
    let inviteCalls = 0;
    await mockInviteEconomy(page, {
      view: () => {
        inviteCalls += 1;
        return inviteView();
      },
    });
    await stubNavigatorShare(page);
    await page.goto("/ayarlar");
    // The Davet et card read the code on mount; whatever it asked for is the baseline.
    await expect(page.getByRole("button", { name: "Davet et", exact: true })).toBeVisible();
    const callsOnLoad = inviteCalls;
    expect(callsOnLoad).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Tavsiye et", exact: true }).click();

    await expect.poll(async () => (await sharedPayloads(page)).length).toBe(1);
    const [payload] = await sharedPayloads(page);
    expect(new URL(payload.url).pathname).toBe(`/davet/${INVITE_CODE}`);
    expect(new URL(payload.url).origin).toBe(new URL(page.url()).origin);
    // The code is in hand, so the sheet opens inside the tap: no round trip, no new request.
    expect(inviteCalls).toBe(callsOnLoad);
  });

  test("öğrencide paylaşım yoksa kişisel bağlantıyı kopyalar", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, { view: () => inviteView() });
    await stubClipboard(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    });
    await page.goto("/ayarlar");

    await page.getByRole("button", { name: "Tavsiye et", exact: true }).click();

    await expect(page.getByText("Bağlantı kopyalandı")).toBeVisible();
    const copied = await copiedTexts(page);
    expect(copied).toHaveLength(1);
    expect(new URL(copied[0]).pathname).toBe(`/davet/${INVITE_CODE}`);
  });

  // iOS Safari refuses a share it no longer ties to the tap; the link must still get out.
  test("tarayıcı paylaşımı reddederse kişisel bağlantıyı kopyalar ve söyler", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, { view: () => inviteView() });
    await stubNavigatorShare(page, "NotAllowedError");
    await stubClipboard(page);
    await page.goto("/ayarlar");
    await expect(page.getByRole("button", { name: "Davet et", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Tavsiye et", exact: true }).click();

    await expect(page.getByText("Bağlantı kopyalandı")).toBeVisible();
    await expect(page.getByText("Paylaşım açılamadı")).toHaveCount(0);
    expect(await sharedPayloads(page)).toHaveLength(1);
    const copied = await copiedTexts(page);
    expect(copied).toHaveLength(1);
    expect(new URL(copied[0]).pathname).toBe(`/davet/${INVITE_CODE}`);
  });

  test("paylaşım penceresini kapatmak sessizdir: kopyalamaz, hata göstermez", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, { view: () => inviteView() });
    await stubNavigatorShare(page, "AbortError");
    await stubClipboard(page);
    await page.goto("/ayarlar");
    const row = page.getByRole("button", { name: "Tavsiye et", exact: true });

    await row.click();
    await expect.poll(async () => (await sharedPayloads(page)).length).toBe(1);
    // A second tap is only handled once the first finished, so by now any copy or toast would exist.
    await row.click();
    await expect.poll(async () => (await sharedPayloads(page)).length).toBe(2);

    expect(await copiedTexts(page)).toEqual([]);
    await expect(page.getByText("Bağlantı kopyalandı")).toHaveCount(0);
    await expect(page.getByText("Paylaşım açılamadı")).toHaveCount(0);
  });

  test("ekonomi kapalıysa genel bağlantıya düşer ve yine paylaşır", async ({ page }) => {
    // `mockProfileApi` answers every economy GET with 404 ECONOMY_DISABLED.
    await mockProfileApi(page);
    await page.addInitScript(() =>
      window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
    );
    await stubNavigatorShare(page);
    await page.goto("/ayarlar");

    await page.getByRole("button", { name: "Tavsiye et", exact: true }).click();

    await expect.poll(async () => (await sharedPayloads(page)).length).toBe(1);
    const [payload] = await sharedPayloads(page);
    expect(new URL(payload.url).pathname).toBe("/");
    expect(payload.url).not.toContain("/davet/");
  });

  test("davet isteği hata verirse (kod hiç okunamadı) genel bağlantıyı paylaşır", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, { view: () => inviteView() });
    // Registered last, so it answers first: neither the card nor the tap ever gets a code.
    await page.route("http://localhost:3001/v1/economy/invite", (route) =>
      json(route, { code: "INTERNAL", message: "Hata" }, 500),
    );
    await stubNavigatorShare(page);
    await page.goto("/ayarlar");

    await page.getByRole("button", { name: "Tavsiye et", exact: true }).click();

    await expect.poll(async () => (await sharedPayloads(page)).length).toBe(1);
    const [payload] = await sharedPayloads(page);
    expect(new URL(payload.url).pathname).toBe("/");
  });

  test("kod sayfada yokken dokunuş kodu bir kez okur, sonraki dokunuş okumaz", async ({ page }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, { view: () => inviteView() });
    // The page's own read fails once, so the tap is the first to hold a code. Registered last,
    // so it answers first and hands every later call to the working mock.
    let inviteCalls = 0;
    await page.route("http://localhost:3001/v1/economy/invite", (route) => {
      inviteCalls += 1;
      return inviteCalls === 1
        ? json(route, { code: "INTERNAL", message: "Hata" }, 500)
        : route.fallback();
    });
    await stubNavigatorShare(page);
    await page.goto("/ayarlar");
    await expect.poll(() => inviteCalls).toBe(1);
    const row = page.getByRole("button", { name: "Tavsiye et", exact: true });

    await row.click();
    await expect.poll(async () => (await sharedPayloads(page)).length).toBe(1);
    expect(new URL((await sharedPayloads(page))[0].url).pathname).toBe(`/davet/${INVITE_CODE}`);
    expect(inviteCalls).toBe(2);

    await row.click();
    await expect.poll(async () => (await sharedPayloads(page)).length).toBe(2);
    expect(new URL((await sharedPayloads(page))[1].url).pathname).toBe(`/davet/${INVITE_CODE}`);
    expect(inviteCalls).toBe(2);
  });

  test("davet isteği yanıt vermezse kısa bir beklemeden sonra genel bağlantıyı paylaşır", async ({
    page,
  }) => {
    await mockProfileApi(page);
    await mockInviteEconomy(page, { view: () => inviteView() });
    // Never answered: no code reaches the page, and the tap must not wait on it forever.
    await page.route("http://localhost:3001/v1/economy/invite", () => {});
    await stubNavigatorShare(page);
    // Timed inside the page, from the tap to the share call: the click itself (scrolling, waiting
    // for the row to settle) is Playwright's time, not the lookup's.
    await page.addInitScript(() =>
      document.addEventListener(
        "click",
        () => ((window as unknown as { tappedAt: number }).tappedAt = performance.now()),
        true,
      ),
    );
    await page.goto("/ayarlar");

    await page.getByRole("button", { name: "Tavsiye et", exact: true }).click();

    await expect
      .poll(async () => (await sharedPayloads(page)).length, { timeout: 6000 })
      .toBe(1);
    const tappedAt = await page.evaluate(() => (window as unknown as { tappedAt: number }).tappedAt);
    const [payload] = await sharedPayloads(page);
    const elapsed = payload.at - tappedAt;
    expect(new URL(payload.url).pathname).toBe("/");
    expect(payload.url).not.toContain("/davet/");
    // It did wait for the lookup (about 1.5 s) rather than giving up at once, and not much longer.
    expect(elapsed).toBeGreaterThanOrEqual(1400);
    expect(elapsed).toBeLessThan(4000);
  });

  test("koçta davet kodu istemez, genel bağlantıyı paylaşır", async ({ page }) => {
    await mockProfileApi(page, { ...user, roles: ["COACH"] });
    // A coach is out of the program: the API would answer 403, and the row must not even ask.
    let inviteCalls = 0;
    await page.route("http://localhost:3001/v1/economy/invite", (route) => {
      inviteCalls += 1;
      return json(route, { code: "INVITE_COACH_NOT_ALLOWED", message: "Koç" }, 403);
    });
    await page.addInitScript(() =>
      window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
    );
    await stubNavigatorShare(page);
    await page.goto("/ayarlar");

    await page.getByRole("button", { name: "Tavsiye et", exact: true }).click();

    await expect.poll(async () => (await sharedPayloads(page)).length).toBe(1);
    const [payload] = await sharedPayloads(page);
    expect(new URL(payload.url).pathname).toBe("/");
    expect(inviteCalls).toBe(0);
  });
});

async function mockProfileApi(page: Page, me: AuthUser = user) {
  let deleteAccountCalls = 0;

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname + url.search;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user: me });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, me);
    if (method === "GET" && path === "/v1/users/me/phone") return json(route, { verified: false, maskedPhoneNumber: null, available: false, reauthenticationRequired: false });
    // The Google card reads `.enabled` off this body; the empty catch-all 204 crashed the page.
    if (method === "GET" && path === "/v1/users/me/auth-accounts/google") {
      return json(route, { enabled: false, linked: false, providerEmail: null, canLink: false });
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
      return route.fulfill({ status: 200, contentType: "text/event-stream", headers: corsHeaders, body: "" });
    }
    if (method === "GET" && path === "/v1/notifications/preferences") {
      return json(route, { emailEnabled: true, pushEnabled: true });
    }
    if (method === "GET" && path.startsWith("/v1/economy/")) {
      return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }
    if (method === "DELETE" && path === "/v1/account") {
      deleteAccountCalls += 1;
      return json(route, null, 204);
    }

    return json(route, null, 204);
  });

  return {
    get deleteAccountCalls() {
      return deleteAccountCalls;
    },
  };
}

const corsHeaders = {
  "access-control-allow-origin": process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
  "access-control-allow-credentials": "true",
};

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: body == null ? "" : JSON.stringify(body),
  });
}
