import { expect, test } from "@playwright/test";
import { prepareTrialUser, trialApi } from "./core-trial.fixture";
import { multipleAnalysis } from "./analysis.fixture";
import tr from "../messages/tr.json";
import en from "../messages/en.json";

for (const locale of ["tr", "en"] as const) {
  const english = locale === "en";
  const copy = english ? en : tr;
  const home = english ? "/en/dashboard" : "/panel";
  const account = english ? "/en/settings" : "/ayarlar";
  const closedTitle = copy.availability.closed_title;

  test(`${locale}: personal tools remain usable without closed navigation or automatic AI`, async ({ page }, info) => {
    const fixture = await prepareTrialUser(page);
    await page.goto(home);
    await expect(page.getByTestId("today-path-card")).toBeVisible();
    await expect(page.getByRole("button", { name: copy.panel.premium_greeting_nudge })).toHaveCount(0);
    await expect(page.locator('a[href="/topluluk"], a[href="/en/community"], a[href="/koc"], a[href="/en/coach"]')).toHaveCount(0);
    await page.getByTestId("mood-option-2").click();
    await expect(page.getByTestId("mood-option-2")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: copy.mood.coach_speech_cta, exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("dashboard.png"), fullPage: true });
    await page.goto(english ? "/en/plan?coach=adapt" : "/plan?coach=adapt");
    await expect(page.getByRole("heading", { name: copy.plan.title, exact: true })).toBeAttached();
    const notebook = await page.request.post(`${trialApi}/coaching/notebooks`, {
      headers: { Authorization: `Bearer ${fixture.token}` }, data: { title: "Deneme Defteri" },
    });
    expect(notebook.status()).toBe(201);
    await page.goto(english ? "/en/notebooks" : "/defterlerim");
    await expect(page.getByText("Deneme Defteri", { exact: true }).first()).toBeVisible();
    await page.goto(account);
    await expect(page.locator('a[href="/kocum"], a[href="/en/my-coach"], a[href="/koc-ol"], a[href="/en/become-a-coach"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: copy.profile.account.logout, exact: true })).toBeVisible();
    expect(fixture.closedRequests).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });

  test(`${locale}: old room links still allow a solo focus session`, async ({ page }, info) => {
    const fixture = await prepareTrialUser(page);
    await page.goto(english ? "/en/study-session?room=33333333-3333-4333-8333-333333333333" : "/seans?room=33333333-3333-4333-8333-333333333333");
    await expect(page.getByRole("button", { name: copy.session_controls.start, exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("focus.png"), fullPage: true });
    const started = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/v1/study-sessions");
    await page.getByRole("button", { name: copy.session_controls.start, exact: true }).click();
    const response = await started;
    expect(response.status()).toBe(201);
    expect((await response.json()).roomId).toBeNull();
    expect(fixture.closedRequests).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });

  test(`${locale}: a premium entitlement cannot start automatic AI while globally closed`, async ({ page }) => {
    const fixture = await prepareTrialUser(page);
    await page.route("**/v1/subscription", route => route.fulfill({
      status: 200, contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": route.request().headers()["origin"] ?? "http://localhost:3100", "Access-Control-Allow-Credentials": "true" },
      body: JSON.stringify({ subscription: null, entitlement: { tier: "PREMIUM", isPremium: true, validUntil: null, reason: "ACTIVE" }, features: {}, discount: null }),
    }));
    await page.goto(home);
    await expect(page.getByTestId("today-path-card")).toBeVisible();
    await page.getByTestId("mood-option-2").click();
    await page.getByRole("button", { name: copy.mood.coach_speech_cta, exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.route("**/v1/coaching/analysis?*", route => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify(multipleAnalysis),
      headers: { "Access-Control-Allow-Origin": route.request().headers()["origin"] ?? "http://localhost:3100", "Access-Control-Allow-Credentials": "true" },
    }));
    await page.goto(english ? "/en/analysis" : "/analiz");
    await expect(page.getByText(multipleAnalysis.ghost!.headline, { exact: true }).first()).toBeVisible();
    expect(fixture.closedRequests).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });

  test(`${locale}: own progress survives while direct social links are closed`, async ({ page }, info) => {
    const fixture = await prepareTrialUser(page);
    await page.goto(english ? `/en/community/member/${fixture.user.username}` : `/topluluk/uye/${fixture.user.username}`);
    await expect(page.getByRole("heading", { name: fixture.user.displayName, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /followers|following|takipçi|takip$/i })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("own-profile.png"), fullPage: true });
    for (const path of english ? ["/en/community", "/en/community/member/other", "/en/coach", "/en/my-coach", "/en/join-room?kod=OLD", "/en/invite/OLD"] : ["/topluluk", "/topluluk/uye/other", "/koc", "/kocum", "/masaya-katil?kod=OLD", "/davet/OLD"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: closedTitle, exact: true })).toBeVisible();
    }
    expect(fixture.closedRequests).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });

  test(`${locale}: existing coach presentation retains account access without redirect loops`, async ({ page }, info) => {
    const fixture = await prepareTrialUser(page, true);
    await page.goto(english ? "/en" : "/");
    await expect(page).toHaveURL(new RegExp(`${account}$`));
    await expect(page.getByRole("button", { name: copy.profile.account.logout, exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("coach-account.png"), fullPage: true });
    await page.goto(english ? "/en/coaching/students" : "/kocluk");
    await expect(page.getByRole("heading", { name: closedTitle, exact: true })).toBeVisible();
    await page.getByRole("link", { name: copy.availability.account, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${account}$`));
    expect(fixture.closedRequests).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });
}
