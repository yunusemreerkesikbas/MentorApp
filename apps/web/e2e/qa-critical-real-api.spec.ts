import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

/** Runs only against the disposable local QA API, without network response mocks. */
const qaApi = process.env.QA_REAL_API_URL;
test.skip(!qaApi, "Set QA_REAL_API_URL for isolated real-API smoke tests.");

test.beforeAll(() => {
  if (qaApi !== "http://localhost:3101/v1") {
    throw new Error("Real-API smoke tests require the isolated localhost:3101 QA API.");
  }
});

test("real API: two tabs refresh, scoped cookie, logout", async ({ page, context, request }) => {
  const suffix = randomUUID().slice(0, 8);
  const email = `qa-browser-${suffix}@example.test`;
  const password = "MentorQa!2026";
  const signup = await request.post(`${qaApi}/auth/signup`, {
    data: {
      email,
      password,
      displayName: "QA Browser",
      username: `qa_browser_${suffix}`,
      kvkkAccepted: true,
      termsAccepted: true,
      ageEligibilityConfirmed: true,
      intent: "STUDENT",
    },
  });
  expect(signup.status()).toBe(201);

  await page.goto("/giris");
  await page.getByRole("textbox", { name: "E-posta" }).fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/(baslangic|panel)$/);

  const refreshCookie = (await context.cookies("http://localhost:3101/v1/auth"))
    .find((cookie) => cookie.name === "mentor_web_refresh");
  expect(refreshCookie).toMatchObject({ httpOnly: true, path: "/v1/auth" });
  const storedWeb = await page.evaluate(() => [
    ...Object.entries(localStorage), ...Object.entries(sessionStorage),
  ]);
  expect(JSON.stringify(storedWeb)).not.toMatch(/access.?token|refresh.?token|mentor_admin_token|eyJ[A-Za-z0-9_-]+\./i);

  const secondTab = await context.newPage();
  await secondTab.goto("/baslangic");
  await expect(secondTab.getByRole("heading", { name: /Merhaba QA/ })).toBeVisible();
  await Promise.all([page.reload(), secondTab.reload()]);
  await expect(page).not.toHaveURL(/\/giris$/);
  await expect(secondTab).not.toHaveURL(/\/giris$/);

  const logout = await context.request.post(`${qaApi}/auth/logout`);
  expect(logout.status()).toBe(204);
  await Promise.all([page.reload(), secondTab.reload()]);
  await expect(page).toHaveURL(/\/giris$/);
  await expect(secondTab).toHaveURL(/\/giris$/);
});

test("real API: public article and cookie preferences render in TR/EN", async ({ page }) => {
  await page.goto("/blog/kpss-basvuru-sureci");
  await expect(page.getByRole("heading", { name: "KPSS Başvuru Süreci" })).toBeVisible();
  await page.goto("/cerez-tercihleri");
  await expect(page.getByRole("heading", { name: "Çerez ve analitik tercihleri" })).toBeVisible();
  await page.goto("/en/cookie-preferences");
  await expect(page.getByRole("heading", { name: "Cookie and analytics preferences" })).toBeVisible();
});

test("admin shell sends restrictive CSP and rejects a student session", async ({ page, request }) => {
  const response = await page.goto("http://localhost:3102/login");
  expect(response?.status()).toBe(200);
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("'unsafe-eval'");
  await expect(page.getByRole("heading", { name: "Mentor Admin" })).toBeVisible();

  const forged = await request.get(`${qaApi}/admin/users`, {
    headers: { "Cf-Access-Jwt-Assertion": "forged" },
  });
  expect([401, 403]).toContain(forged.status());
});

test("real API: admin browser session stays separate from web and refreshes on reload", async ({ page, context }, testInfo) => {
  const suffix = randomUUID().slice(0, 8);
  const email = `qa-admin-${suffix}@example.test`;
  const password = "MentorQa!2026";
  const signup = await context.request.post(`${qaApi}/auth/signup`, {
    data: {
      email,
      password,
      displayName: "QA Admin",
      username: `qa_admin_${suffix}`,
      kvkkAccepted: true,
      termsAccepted: true,
      ageEligibilityConfirmed: true,
      intent: "STUDENT",
    },
  });
  expect(signup.status()).toBe(201);
  const userId = (await signup.json()).user.id as string;
  expect(userId).toMatch(/^[a-f0-9-]{36}$/);
  const promoteOutput = execFileSync("docker", [
    "exec", "mentor-postgres", "psql", "-U", "mentor", "-d", "mentor_test", "-c",
    `begin; select set_config('app.role','SERVICE',true); update users set roles = array_append(roles, 'ADMIN') where id = '${userId}'; commit;`,
  ], { encoding: "utf8" });
  expect(promoteOutput).toContain("UPDATE 1");
  await context.clearCookies();

  await page.goto("http://localhost:3102/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL("http://localhost:3102/");
  await expect(page.getByRole("heading", { name: "Panel", exact: true })).toBeVisible();
  if (process.env.QA_EVIDENCE_DIR && testInfo.project.name === "desktop-chromium") {
    await page.screenshot({ path: `${process.env.QA_EVIDENCE_DIR}/2026-09-24-admin-chrome.png` });
  }
  const adminCookie = (await context.cookies("http://localhost:3101/v1/auth/admin"))
    .find((cookie) => cookie.name === "mentor_admin_refresh");
  expect(adminCookie).toMatchObject({ httpOnly: true, path: "/v1/auth/admin" });
  expect((await context.cookies()).some((cookie) => cookie.name === "mentor_web_refresh")).toBe(false);
  const storedAdmin = await page.evaluate(() => [
    ...Object.entries(localStorage), ...Object.entries(sessionStorage),
  ]);
  expect(JSON.stringify(storedAdmin)).not.toMatch(/mentor_admin_token|eyJ[A-Za-z0-9_-]+\./);

  await page.reload();
  await expect(page).toHaveURL("http://localhost:3102/");
  await expect(page.getByRole("heading", { name: "Panel", exact: true })).toBeVisible();
  const logout = await context.request.post(`${qaApi}/auth/admin/logout`);
  expect(logout.status()).toBe(204);
  await page.reload();
  await expect(page).toHaveURL("http://localhost:3102/login");
});

test("real API: private notebook image uses a single-use upload and a signed read URL", async ({ page, context }) => {
  const suffix = randomUUID().slice(0, 8);
  const password = "MentorQa!2026";
  const signup = async (label: string) => {
    const response = await context.request.post(`${qaApi}/auth/signup`, {
      data: {
        email: `qa-media-${label}-${suffix}@example.test`,
        password,
        displayName: `QA Media ${label}`,
        username: `qa_media_${label}_${suffix}`,
        kvkkAccepted: true,
        termsAccepted: true,
        ageEligibilityConfirmed: true,
        intent: "STUDENT",
      },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).accessToken as string;
  };
  const ownerToken = await signup("owner");
  const otherToken = await signup("other");
  const ownerAuth = { Authorization: `Bearer ${ownerToken}` };
  const otherAuth = { Authorization: `Bearer ${otherToken}` };

  const invalidMime = await context.request.post(`${qaApi}/coaching/notebook/entries/image-upload-url`, {
    data: { contentType: "text/html" }, headers: ownerAuth,
  });
  expect(invalidMime.status()).toBe(400);
  const ticketResponse = await context.request.post(`${qaApi}/coaching/notebook/entries/image-upload-url`, {
    data: { contentType: "image/png" }, headers: ownerAuth,
  });
  expect(ticketResponse.status()).toBe(201);
  const ticket = await ticketResponse.json() as { uploadUrl: string; key: string; maxBytes: number };
  expect(ticket.maxBytes).toBe(5 * 1024 * 1024);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
  const uploadUrl = new URL(ticket.uploadUrl, qaApi).toString();
  const upload = await context.request.put(uploadUrl, { data: png, headers: { "Content-Type": "image/png" } });
  expect(upload.status()).toBe(204);
  const replay = await context.request.put(uploadUrl, { data: png, headers: { "Content-Type": "image/png" } });
  expect(replay.status()).toBe(401);

  const calendar = await context.request.get(`${qaApi}/content/exams/kpss-lisans-2026/calendar`);
  expect(calendar.status()).toBe(200);
  const examId = (await calendar.json()).exam.id as string;
  const create = await context.request.post(`${qaApi}/coaching/notebook/entries`, {
    data: { examId, source: "OWN", errorType: "CARELESS", storageKey: ticket.key }, headers: ownerAuth,
  });
  expect(create.status()).toBe(201);
  const entry = await create.json() as { id: string; url: string };
  expect(entry.url).toContain("/v1/storage/fake-private-object?");
  const foreignEntry = await context.request.get(`${qaApi}/coaching/notebook/entries/${entry.id}`, { headers: otherAuth });
  expect(foreignEntry.status()).toBe(404);

  const readUrl = new URL(entry.url, qaApi);
  const browserRead = await page.goto(readUrl.toString());
  expect(browserRead?.status()).toBe(200);
  expect(browserRead?.headers()["cache-control"]).toBe("private, no-store");
  const forged = new URL(readUrl);
  forged.searchParams.set("expires", "1");
  const expiredRead = await page.goto(forged.toString());
  expect(expiredRead?.status()).toBe(404);
});
