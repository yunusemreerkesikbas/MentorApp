import { expect, test } from "@playwright/test";
import {
  mockEconomyUses as mock,
  openEconomyUses as open,
  economyUsesFixture as view,
} from "./fixtures/economy-uses";

test("güncel fiyat, kapasite ve günlük hak gösterilir; yalnız ilgili ekrana gidilir", async ({
  page,
}, info) => {
  const { state } = await mock(page);
  const region = await open(page);
  await expect(region.getByText("37 Coin", { exact: true })).toBeVisible();
  await expect(region.getByText("7 Coin", { exact: true })).toBeVisible();
  await expect(
    region.getByText("Coin ile alınan ek kapasite: 1 / 2"),
  ).toBeVisible();
  await expect(
    region.getByText("Son 24 saatlik sınırda kalan kullanım hakkı: 3"),
  ).toBeVisible();
  await expect(
    region.getByText(
      "XP kişisel ilerlemeni gösterir. Harcanmaz ve Coin'e dönüşmez.",
    ),
  ).toBeVisible();
  await expect(
    region.getByRole("button", { name: "Analiz ekranını aç" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("coin-use-catalog.png"),
    fullPage: true,
  });
  await region.getByRole("button", { name: "Defterlerime git" }).click();
  await expect(page).toHaveURL(/\/defterlerim$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toBe(0);
});

test("Premium ücretlenmez ve dolmuş günlük hak kullanıma açık gösterilmez", async ({
  page,
}) => {
  await mock(page, {
    view: {
      coinConfirmed: 42,
      items: [
        {
          id: "NOTEBOOK_SLOT",
          status: "PREMIUM_INCLUDED",
          cost: null,
          premiumIncluded: true,
          canOpen: true,
        },
        {
          id: "COACH_CHAT",
          status: "DAILY_LIMIT_REACHED",
          cost: null,
          premiumIncluded: true,
          canOpen: false,
          dailyRemaining: 0,
        },
        {
          id: "DEEP_ANALYSIS",
          status: "PREMIUM_INCLUDED",
          cost: null,
          premiumIncluded: true,
          canOpen: true,
        },
      ],
    },
  });
  const region = await open(page);
  await expect(
    region.getByText("Premium'a dahil", { exact: true }),
  ).toHaveCount(3);
  await expect(
    region.getByText("Son 24 saatlik kullanım hakkın doldu. Yeni hak açıldığında kullanabilirsin."),
  ).toBeVisible();
  await expect(
    region.getByRole("button", { name: "Puhu sohbetini aç" }),
  ).toHaveCount(0);
  await expect(region.getByText(/^\d+ Coin$/)).toHaveCount(0);
  await expect(
    region.getByRole("button", { name: "Analiz ekranını aç" }),
  ).toBeVisible();
});

test("yetersiz Coin, kapalı AI ve alınmış haftalık hak ayrı gösterilir", async ({
  page,
}) => {
  await mock(page, {
    view: {
      coinConfirmed: 1,
      items: [
        {
          id: "NOTEBOOK_SLOT",
          status: "INSUFFICIENT_COIN",
          cost: 37,
          premiumIncluded: false,
          canOpen: true,
        },
        {
          id: "COACH_CHAT",
          status: "UNAVAILABLE",
          cost: null,
          premiumIncluded: false,
          canOpen: false,
        },
        {
          id: "DEEP_ANALYSIS",
          status: "ALREADY_UNLOCKED",
          cost: null,
          premiumIncluded: false,
          canOpen: true,
        },
      ],
    },
  });
  const region = await open(page);
  await expect(
    region.getByText("Bu seçenek için henüz yeterli Coin'in yok."),
  ).toBeVisible();
  await expect(
    region.getByText("Bu seçenek şu an kullanılamıyor."),
  ).toBeVisible();
  await expect(
    region.getByText("Bu kullanım hakkı zaten açık, yeniden Coin harcanmaz."),
  ).toBeVisible();
  await expect(
    region.getByRole("button", { name: "Puhu sohbetini aç" }),
  ).toHaveCount(0);
});

test("hata eski fiyatı korumaz; yenileme güncel fiyatı yükler", async ({
  page,
}) => {
  const { state } = await mock(page, { error: true });
  const region = await open(page);
  await expect(region.getByRole("alert")).toBeVisible();
  await expect(region.getByText("37 Coin", { exact: true })).toHaveCount(0);
  state.error = false;
  await region.getByRole("button", { name: "Seçenekleri yenile" }).click();
  await expect(region.getByText("37 Coin", { exact: true })).toBeVisible();
  state.view = {
    ...view,
    items: [{ ...view.items[0], cost: 46 }, ...view.items.slice(1)],
  };
  await region.getByRole("button", { name: "Seçenekleri yenile" }).click();
  await expect(region.getByText("46 Coin", { exact: true })).toBeVisible();
  await expect(region.getByText("37 Coin", { exact: true })).toHaveCount(0);
  state.error = true;
  await region.getByRole("button", { name: "Seçenekleri yenile" }).click();
  await expect(region.getByRole("alert")).toBeVisible();
  await expect(region.getByText("46 Coin", { exact: true })).toHaveCount(0);
});

test("ekonomi kapanınca açık katalog ve Coin göstergeleri gizlenir", async ({
  page,
}) => {
  const { state } = await mock(page);
  const region = await open(page);
  await expect(region.getByText("37 Coin", { exact: true })).toBeVisible();
  state.closed = true;
  await region.getByRole("button", { name: "Seçenekleri yenile" }).click();
  await expect(region).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[aria-label="Coin ve XP"]:visible')).toHaveCount(
    0,
  );
});

test("İngilizce seçenekler ve XP açıklaması görüntülenir", async ({ page }) => {
  await mock(page);
  const region = await open(page, true);
  await expect(
    region.getByText("Extra notebook capacity", { exact: true }),
  ).toBeVisible();
  await expect(
    region.getByText(
      "XP shows your personal progress. It cannot be spent or converted to Coin.",
    ),
  ).toBeVisible();
  await expect(
    region.getByRole("button", { name: "Go to my notebooks" }),
  ).toBeVisible();
});

test("ilk açılışta kapalı ekonomi kullanım seçeneklerini yüklemez", async ({
  page,
}) => {
  const { state } = await mock(page, { closed: true });
  const closed = page.waitForResponse(
    (res) => res.url().endsWith("/economy/balance") && res.status() === 404,
  );
  await page.goto("/ayarlar");
  await closed;
  await expect(
    page.getByRole("button", { name: "Bakiyen", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Coin ile neler açabilirim?" }),
  ).toHaveCount(0);
  expect(state.requests).toBe(0);
});

test("ekonomi kapandıktan sonra gelen eski yanıt teklifleri geri getirmez", async ({
  page,
}) => {
  const held = await mock(page, { hold: true });
  let responses = 0;
  page.on("response", (res) => {
    if (res.url().endsWith("/economy/uses")) responses++;
  });
  const region = await open(page);
  await expect(
    region.getByRole("status", { name: "Kullanım seçenekleri yükleniyor" }),
  ).toBeVisible();
  held.state.closed = true;
  await region.getByRole("button", { name: "Seçenekleri yenile" }).click();
  await expect(region).toHaveCount(0);
  held.release();
  await expect.poll(() => responses).toBe(held.state.requests);
  await expect(region).toHaveCount(0);
  await expect(page.locator('[aria-label="Coin ve XP"]:visible')).toHaveCount(
    0,
  );
});
