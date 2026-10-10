import { expect, test } from "@playwright/test";
import { mockSubscriptionApi } from "./fixtures/subscription";

test("ödeme kapalıyken fiyatı gösterir ve checkout kontrollerini kapatır", async ({
  page,
}) => {
  await mockSubscriptionApi(page);
  await page.goto("/abonelik");

  await expect(page.getByText("₺249,00")).toBeVisible();
  await expect(page.getByText("Şu an kullanılamıyor")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Çok yakında" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Panele dön" })).toHaveCount(0);
});

test("açık abonelikte başlangıç ve yenileme satırlarını gösterir", async ({
  page,
}) => {
  await mockSubscriptionApi(page, { subscribed: true });
  await page.goto("/abonelik");

  await expect(page.getByText("Başlangıç")).toBeVisible();
  await expect(page.getByText("12 Nisan 2026")).toBeVisible();
  await expect(page.getByText("Sonraki yenileme")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aboneliği iptal et" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Çok yakında" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Panele dön" })).toHaveCount(0);
});

test("kilitli koç CTA paywall modalını açar", async ({ page }) => {
  await mockSubscriptionApi(page, { premiumRequired: true });
  await page.goto("/koc/sohbet");

  await page.getByRole("button", { name: "Premium'a yükselt" }).click();
  await expect(page.getByTestId("premium-paywall")).toBeVisible();
  await expect(page.getByRole("button", { name: "Çok yakında" })).toBeDisabled();
});

test("ödeme dönüşü başarı overlay gösterir", async ({ page }) => {
  await mockSubscriptionApi(page);
  await page.goto("/abonelik/sonuc?status=success");

  await expect(page.getByTestId("checkout-result")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ödeme başarılı" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Panele dön" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Koça git" })).toHaveCount(0);
  await expect(page.getByText("₺249,00")).toHaveCount(0);
});

test("ödeme dönüşü hata overlay gösterir", async ({ page }) => {
  await mockSubscriptionApi(page);
  await page.goto("/abonelik/sonuc?status=failure");

  await expect(
    page.getByRole("heading", { name: "Bir sorun oluştu" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Abonelik sayfasına dön" }),
  ).toBeVisible();
});
