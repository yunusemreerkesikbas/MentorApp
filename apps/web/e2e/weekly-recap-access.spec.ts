import { expect, test, type Page } from "@playwright/test";
import type { WeeklyRecapOfferDto } from "@mentor/types";
import { exam, mockAnalysisApi, readyWeekly } from "./analysis.fixture";

/**
 * The locked weekly story ("Açma seçimi", docs/plans/2026-11-03-coin-unlock-choice-design.md):
 * the cover shows the week's free numbers, Coin is confirmed inline. The Premium row depends on
 * the server-rendered purchase availability, so these runs cover the Coin and gift paths.
 */
const coin: Partial<WeeklyRecapOfferDto> = { enabled: true, mode: "COIN", canOpen: true, cost: 250, coinConfirmed: 320 };

async function openCard(page: Page, recapOffer: Partial<WeeklyRecapOfferDto>) {
  const api = await mockAnalysisApi(page, { weekly: [readyWeekly], recapOffer });
  await page.goto(`/analiz/haftanin-hikayesi?examId=${exam.id}`);
  return { api, card: page.getByTestId("weekly-recap-access") };
}

test("the locked story shows its week and confirms Coin inline", async ({ page }) => {
  const { api, card } = await openCard(page, coin);
  await expect(card.getByRole("heading", { level: 1, name: "HAFTANIN HİKÂYESİ" })).toBeVisible();
  await expect(card.getByText("5 gün", { exact: true })).toBeVisible();
  await expect(card.getByText("340 dk", { exact: true })).toBeVisible();
  await expect(card.getByText(/· En çok Matematik$/)).toBeVisible();
  await expect(card.getByText("Coin'in hazır! 2 hikâye hakkın duruyor.")).toBeVisible();
  await expect(card.getByRole("button", { name: "Teklifi yenile" })).toHaveCount(0);

  await card.getByRole("button", { name: "250 Coin ile aç", exact: true }).click();
  const confirm = card.getByRole("group", { name: "250 Coin ile bu hafta" });
  await expect(confirm).toContainText("320");
  await expect(confirm).toContainText("70 Coin");
  await expect(confirm.getByRole("button", { name: "Onayla ve aç", exact: true })).toBeVisible();
  await confirm.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(card.getByRole("button", { name: "250 Coin ile aç", exact: true })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(api.unexpected).toEqual([]);
});

test("short Coin draws the progress and how Coin adds up, with no Coin ledge", async ({ page }) => {
  const { card } = await openCard(page, { ...coin, coinConfirmed: 80, canOpen: false,
    reason: "INSUFFICIENT_COIN", message: "Yetersiz" });
  await expect(card.getByRole("progressbar", { name: "Bu hikâye için biriken Coin" })).toHaveAttribute("aria-valuenow", "80");
  await expect(card.getByText("80/250", { exact: true })).toBeVisible();
  await expect(card.getByText(/^170 Coin daha, hikâye senin!/)).toBeVisible();
  await expect(card.getByRole("link", { name: "Coin nasıl birikir" })).toHaveAttribute("href", /\/profil#coin$/);
  await expect(card.getByRole("button", { name: /Coin ile aç/ })).toHaveCount(0);
});

test("the first story is a gift, with no email step", async ({ page }) => {
  const { card } = await openCard(page, { enabled: true, mode: "EARNED", canOpen: true, cost: 0 });
  await expect(card.getByRole("heading", { name: "İlk hikâyen bizden!" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Hediyemi aç", exact: true })).toBeVisible();
  await expect(card.getByText(/e-posta/i)).toHaveCount(0);
});
