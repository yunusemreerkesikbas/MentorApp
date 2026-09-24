import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";

const api = process.env.QA_STAGE2_API_URL;
test.skip(api !== "http://localhost:3201/v1", "Requires the isolated Stage 2 QA API.");

const suffix = randomUUID().slice(0, 8);
const account = {
  email: `qa-stage2-${suffix}@example.test`,
  password: "MentorQa!2026",
};

test.beforeAll(async ({ request }) => {
  const signup = await request.post(`${api}/auth/signup`, {
    data: {
      ...account,
      displayName: "QA Stage Two",
      username: `qa_stage2_${suffix}`,
      kvkkAccepted: true,
      termsAccepted: true,
      ageEligibilityConfirmed: true,
      intent: "STUDENT",
    },
  });
  expect(signup.status()).toBe(201);
  const { accessToken } = await signup.json() as { accessToken: string };
  const profile = await request.patch(`${api}/users/me`, {
    data: { examType: "KPSS", examVariant: "LISANS" },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(profile.status()).toBe(200);
});

async function login(context: BrowserContext): Promise<string> {
  const response = await context.request.post(`${api}/auth/login`, { data: account });
  expect(response.status()).toBe(200);
  return (await response.json() as { accessToken: string }).accessToken;
}

test("I01: signup form blocks submission without mandatory consent", async ({ page }) => {
  let signupRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url() === `${api}/auth/signup`) signupRequests++;
  });
  await page.goto("/kayit");
  await page.getByRole("textbox", { name: "Ad Soyad" }).fill("QA Rıza");
  await page.getByRole("textbox", { name: "E-posta" }).fill("qa-no-consent@example.test");
  await page.locator('input[type="password"]').fill("MentorQa!2026");
  await page.getByRole("button", { name: "Kayıt ol" }).click();
  await expect(page).toHaveURL(/\/kayit$/);
  await expect(page.getByRole("checkbox", { name: /KVKK aydınlatma/ })).not.toBeChecked();
  expect(signupRequests).toBe(0);
});

test("I02: chosen exam persists through reload and a second tab", async ({ page, context }) => {
  const userSuffix = randomUUID().slice(0, 8);
  const signup = await context.request.post(`${api}/auth/signup`, {
    data: {
      email: `qa-onboard-${userSuffix}@example.test`,
      password: "MentorQa!2026",
      displayName: "QA Onboard",
      username: `qa_onboard_${userSuffix}`,
      kvkkAccepted: true,
      termsAccepted: true,
      ageEligibilityConfirmed: true,
      intent: "STUDENT",
    },
  });
  expect(signup.status()).toBe(201);
  const { accessToken } = await signup.json() as { accessToken: string };

  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("radio", { name: "KPSS" }).click();
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("radio", { name: "Lisans", exact: true }).click();
  await page.getByRole("button", { name: "Devam" }).click();

  const profile = await context.request.get(`${api}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(profile.status()).toBe(200);
  expect(await profile.json()).toMatchObject({ examType: "KPSS", examVariant: "LISANS" });

  await page.reload();
  await expect(page).not.toHaveURL(/\/giris$/);
  const secondTab = await context.newPage();
  await secondTab.goto("/onboarding");
  await expect(secondTab).not.toHaveURL(/\/giris$/);
});

test("I03: forgot-password gives the same browser response for known and unknown accounts", async ({ page }) => {
  const responses: string[] = [];
  for (const email of ["qa-unknown@example.test", account.email]) {
    await page.goto("/sifremi-unuttum");
    await page.getByRole("textbox", { name: "E-posta" }).fill(email);
    await page.getByRole("button", { name: "Sıfırlama bağlantısı gönder" }).click();
    const message = page.getByText(/Bu e-posta kayıtlıysa/);
    await expect(message).toBeVisible();
    responses.push(await message.innerText());
  }
  expect(responses[0]).toBe(responses[1]);
});

test("I04: protected page denies anonymous access and logout revokes browser access", async ({ page, context }) => {
  await page.goto("/plan");
  await expect(page).toHaveURL(/\/giris(?:\?|$)/);
  await page.getByRole("textbox", { name: "E-posta" }).fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).not.toHaveURL(/\/giris(?:\?|$)/);
  await page.goto("/plan");
  await expect(page).toHaveURL(/\/plan$/);

  const logout = await context.request.post(`${api}/auth/logout`);
  expect(logout.status()).toBe(204);
  await page.reload();
  await expect(page).toHaveURL(/\/giris(?:\?|$)/);
});

test("C01 C02 C04: public Blog, verified article, draft isolation and legacy redirect", async ({ page, request }) => {
  await page.goto("/blog");
  await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "KPSS Başvuru Süreci" })).toBeVisible();
  await page.goto("/blog/kpss-basvuru-sureci");
  await expect(page.getByRole("heading", { level: 1, name: "KPSS Başvuru Süreci" })).toBeVisible();
  await expect(page.getByRole("link", { name: "ÖSYM" }).first()).toBeVisible();
  await expect(page.getByText(/Son doğrulama:/)).toBeVisible();

  const missing = await request.get(`${api}/content/info-articles/qa-unpublished-missing`);
  expect(missing.status()).toBe(404);
  const legacy = await request.get("http://localhost:3200/bilgi?category=APPLICATION", {
    maxRedirects: 0,
  });
  expect(legacy.status()).toBe(308);
  expect(legacy.headers().location).toContain("/blog?category=APPLICATION");

  await page.goto("/en/blog/kpss-basvuru-sureci");
  await expect(page.getByRole("heading", { level: 1, name: "KPSS Başvuru Süreci" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Sign in/ })).toBeVisible();
});

test("K01: a real task completes in the panel and survives reload", async ({ page, context }) => {
  const token = await login(context);
  const title = `QA Tarih tekrar ${randomUUID().slice(0, 5)}`;
  const auth = { Authorization: `Bearer ${token}` };
  const create = await context.request.post(`${api}/plan-tasks`, {
    data: { title, subject: "Tarih" },
    headers: auth,
  });
  expect(create.status()).toBe(201);
  const task = await create.json() as { id: string };
  try {
    await page.goto("/panel");
    const node = page.getByTestId("today-path-node").first();
    await expect(node).toHaveAccessibleName(new RegExp(title));
    await node.click();
    await page.getByRole("menuitem", { name: "Bitti olarak işaretle" }).click();
    await expect(node).toHaveAccessibleName(new RegExp(`${title}, bitti`));
    await page.reload();
    const today = await context.request.get(`${api}/coaching/today`, { headers: auth });
    expect(today.status()).toBe(200);
    const body = await today.json() as { tasks: Array<{ id: string; status: string }> };
    expect(body.tasks.find((item) => item.id === task.id)?.status).toBe("DONE");
  } finally {
    await context.request.delete(`${api}/plan-tasks/${task.id}`, { headers: auth });
  }
});

test("K02 response-mock: 429 waits for an explicit retry", async ({ page, context }) => {
  await login(context);
  let todayCalls = 0;
  await page.route(`${api}/coaching/today`, async (route) => {
    todayCalls++;
    if (todayCalls === 1) {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ code: "QA_RATE_LIMIT", message: "QA hız sınırı" }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto("/panel");
  await expect(page.getByRole("button", { name: "Tekrar dene" })).toBeVisible();
  await page.waitForTimeout(1_000);
  expect(todayCalls).toBe(1);
  await page.getByRole("button", { name: "Tekrar dene" }).click();
  await expect(page.getByTestId("today-path-card")).toBeVisible();
  expect(todayCalls).toBe(2);
});

test("K03: completed study session persists in the browser history", async ({ page, context }, testInfo) => {
  const token = await login(context);
  const auth = { Authorization: `Bearer ${token}` };
  const start = await context.request.post(`${api}/study-sessions`, {
    data: { preset: "25_5", subject: "QA Tarih" },
    headers: auth,
  });
  expect(start.status()).toBe(201);
  const session = await start.json() as { id: string };
  const finish = await context.request.patch(`${api}/study-sessions/${session.id}`, {
    data: { status: "COMPLETED", actualFocusSeconds: 1500 },
    headers: auth,
  });
  expect(finish.status()).toBe(200);
  expect((await finish.json() as { countsAsFocusSession: boolean }).countsAsFocusSession).toBe(true);

  await page.goto("/seans");
  const mobile = testInfo.project.name === "mobile-chromium";
  if (mobile) await page.getByTestId("session-history-open").click();
  const history = page.getByTestId(mobile ? "session-history-drawer" : "session-history-rail");
  await expect(history.getByText("QA Tarih")).toBeVisible();
});

test("K04: mock-exam net appears in analysis from the real API", async ({ page, context }) => {
  const token = await login(context);
  const auth = { Authorization: `Bearer ${token}` };
  const calendar = await context.request.get(`${api}/content/exams/kpss-lisans-2026/calendar`);
  expect(calendar.status()).toBe(200);
  const { exam } = await calendar.json() as { exam: { id: string } };
  const create = await context.request.post(`${api}/mock-exams`, {
    data: { examId: exam.id, subjects: [{ subjectRef: "turkce", correct: 20, wrong: 4, blank: 6 }] },
    headers: auth,
  });
  expect(create.status()).toBe(201);
  const result = await create.json() as { id: string; totalNet: string };
  expect(result.totalNet).toBe("19.00");
  try {
    await page.goto("/analiz?tab=progress");
    await expect(page.getByTestId("analysis-latest-net")).toHaveText("19.00");
  } finally {
    await context.request.delete(`${api}/mock-exams/${result.id}`, { headers: auth });
  }
});

test("K05: Free plan gate opens without an AI preview request", async ({ page, context }) => {
  await login(context);
  let aiPreviewRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/v1\/coach\/plan-adaptation$/.test(request.url())) aiPreviewRequests++;
  });
  await page.goto("/plan");
  await page.getByRole("button", { name: "Koçla planla" }).click();
  await expect(page.getByTestId("premium-paywall")).toBeVisible();
  expect(aiPreviewRequests).toBe(0);
});

test("K05: fake-Premium plan reaches one AI preview request", async ({ page, context }) => {
  const premium = { email: "qa-stage2-premium@example.test", password: "MentorQa!2026" };
  const loginResponse = await context.request.post(`${api}/auth/login`, { data: premium });
  expect(loginResponse.status()).toBe(200);
  const { accessToken } = await loginResponse.json() as { accessToken: string };
  const view = await context.request.get(`${api}/subscription`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect((await view.json() as { entitlement: { isPremium: boolean } }).entitlement.isPremium).toBe(true);

  let previewRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/v1\/coach\/plan-adaptation$/.test(request.url())) previewRequests++;
  });
  await page.goto("/plan");
  await page.getByRole("button", { name: "Koçla planla" }).click();
  await expect(page.getByRole("dialog", { name: "Bu hafta hangi günler çalışacaksın?" })).toBeVisible();
  for (const next of [
    "Günde yaklaşık kaç dakika?",
    "Ağırlık vermek istediğin dersler",
    "Bu hafta için notun (isteğe bağlı)",
  ]) {
    await page.getByRole("button", { name: "Devam" }).click();
    await expect(page.getByRole("dialog", { name: next })).toBeVisible();
  }
  await page.getByRole("button", { name: "Önizlemeyi hazırla" }).click();
  await expect.poll(() => previewRequests).toBe(1);
  await expect(page.getByTestId("premium-paywall")).toHaveCount(0);
});
