import { expect, test } from "@playwright/test";
import { mockAnalysisApi } from "./analysis.fixture";

const DARK = /\bdark\b/;

test("masaüstünde lamba temayı çevirir, çöker ve yeniden yüklemede kalıcıdır", async (
  { page },
  testInfo,
) => {
  test.skip(!testInfo.project.name.startsWith("desktop"));
  await mockAnalysisApi(page);
  await page.goto("/analiz");

  const html = page.locator("html");
  await expect(html).not.toHaveClass(DARK);

  const lamp = page.getByRole("button", { name: "Koyu temaya geç" });
  await expect(lamp).toHaveAttribute("aria-pressed", "false");
  await lamp.click();

  await expect(html).toHaveClass(DARK);
  await expect(page.getByRole("button", { name: "Açık temaya geç" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const themeCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "mentor-theme",
  );
  expect(themeCookie?.value).toBe("dark");

  await page.reload();
  await expect(html).toHaveClass(DARK);
});

test("dar rail'deki lamba da aynı düğmedir", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop"));
  await mockAnalysisApi(page);
  await page.goto("/analiz");

  await page.getByTestId("app-sidebar-collapse").click();
  await expect(page.getByTestId("app-sidebar-collapsed")).not.toHaveAttribute("inert", "");

  await page.getByRole("button", { name: "Koyu temaya geç" }).click();
  await expect(page.locator("html")).toHaveClass(DARK);
});

test("mobil başlıktaki lamba aynı temayı çevirir", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"));
  await mockAnalysisApi(page);
  await page.goto("/analiz");

  await page.getByRole("button", { name: "Koyu temaya geç" }).click();
  await expect(page.locator("html")).toHaveClass(DARK);
});
