import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import type { AuthSession, AuthUser } from "@mentor/types";

export const trialApi = process.env.QA_STAGE2_API_URL?.trim() || "http://localhost:3001/v1";

/** Real isolated API data; only silent auth is stubbed to reuse the real access token per document. */
export async function prepareTrialUser(page: Page, coachPresentation = false) {
  const availability = await page.request.get(`${trialApi}/app/availability`);
  expect(availability.status()).toBe(200);
  expect(await availability.json()).toEqual({
    aiCoach: false, social: false, forum: false, studyRooms: false, humanCoaching: false,
    studentPurchases: false, coachPurchases: false, coachRegistration: false, coachSignup: false, studentSignup: true, economy: false, invites: false,
  });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const signup = await page.request.post(`${trialApi}/auth/signup`, { headers: { Origin: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100" }, data: {
    email: `core-${suffix}@test.local`, password: "TrialPass1234", displayName: "Deneme Kullanıcısı",
    kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true,
  } });
  expect(signup.status()).toBe(201);
  const session = await signup.json() as AuthSession;
  const profile = await page.request.patch(`${trialApi}/users/me`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { username: `core${suffix}`, examType: "KPSS" },
  });
  expect(profile.status()).toBe(200);
  session.user = await profile.json() as AuthUser;
  // This case verifies account presentation; role authorization is covered by API HTTP suites.
  if (coachPresentation) session.user.roles = ["COACH"];
  await page.route("**/v1/auth/refresh", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(session),
    headers: { "Access-Control-Allow-Origin": route.request().headers()["origin"] ?? "http://localhost:3100", "Access-Control-Allow-Credentials": "true" },
  }));
  await page.addInitScript(() => localStorage.setItem("mentor.analytics-consent.v1", "rejected"));
  const closedRequests: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (/^\/v1\/(?:ai\/|coach\/|study-rooms(?:\/|$)|buddy(?:\/|$))/.test(path) || /\/users\/[^/]+\/(?:follow|followers|following)$/.test(path)) {
      closedRequests.push(`${request.method()} ${path}`);
    }
  });
  return { user: session.user, token: session.accessToken, closedRequests, errors };
}
