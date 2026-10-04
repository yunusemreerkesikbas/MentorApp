import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const qaApi = process.env.QA_REAL_API_URL;
test.skip(qaApi !== "http://localhost:3101/v1", "Requires the isolated QA API.");
const suffix = randomUUID().slice(0, 8);
const qaAccount = {
  email: `qa-panel-${suffix}@example.test`,
  password: "MentorQa!2026",
};

test.beforeAll(async ({ request }) => {
  const signup = await request.post(`${qaApi}/auth/signup`, {
    data: {
      ...qaAccount,
      displayName: "QA Panel",
      username: `qa_panel_${suffix}`,
      kvkkAccepted: true,
      termsAccepted: true,
      ageEligibilityConfirmed: true,
      intent: "STUDENT",
    },
  });
  expect(signup.status()).toBe(201);
  const { accessToken } = await signup.json() as { accessToken: string };
  const profile = await request.patch(`${qaApi}/users/me`, {
    data: { examType: "KPSS" },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(profile.status()).toBe(200);
});

test.beforeEach(async ({ context }) => {
  const login = await context.request.post(`${qaApi}/auth/login`, { data: qaAccount });
  expect(login.status()).toBe(200);
});

test("panel shows a skeleton for slow data, then recovers from a failed request", async ({ page }, testInfo) => {
  let todayCalls = 0;
  await page.route(`${qaApi}/coaching/today`, async (route) => {
    todayCalls++;
    if (todayCalls === 1) {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "QA_TEMPORARY", message: "QA geçici hata" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/panel");
  await expect(page.getByTestId("today-path-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Günaydın|İyi günler|İyi akşamlar/ })).toBeVisible();
  if (process.env.QA_EVIDENCE_DIR && testInfo.project.name === "desktop-chromium") {
    await page.screenshot({ path: `${process.env.QA_EVIDENCE_DIR}/2026-09-24-panel-loading-chrome.png` });
  }
  await expect(page.getByRole("button", { name: "Tekrar dene" })).toBeVisible();
  expect(todayCalls).toBe(1);
  await page.getByRole("button", { name: "Tekrar dene" }).click();
  await expect(page.getByTestId("today-path-card")).toBeVisible();
  expect(todayCalls).toBe(2);
});

test("panel requests automatic subscription offers once per load", async ({ page }) => {
  let offerCalls = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url() === `${qaApi}/subscription/offers`) offerCalls++;
  });
  await page.goto("/panel");
  await expect(page.getByTestId("today-path-card")).toBeVisible();
  await page.waitForTimeout(500);
  expect(offerCalls).toBe(1);
});

test("panel keeps the hero skeleton until entitlement resolves", async ({ page }) => {
  let releaseSubscription = () => {};
  const subscriptionHeld = new Promise<void>((resolve) => {
    releaseSubscription = resolve;
  });
  await page.route(`${qaApi}/subscription`, async (route) => {
    await subscriptionHeld;
    await route.continue();
  });
  const todayReady = page.waitForResponse(
    (response) => response.url() === `${qaApi}/coaching/today` && response.ok(),
  );
  await page.goto("/panel");
  await todayReady;
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("today-path-card")).toHaveCount(0);
  releaseSubscription();
  await expect(page.getByTestId("today-path-card")).toBeVisible();
});
