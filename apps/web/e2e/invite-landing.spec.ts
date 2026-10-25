import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

/**
 * The friend-invite landing (`/davet/PUHU-XXXXXXXX`) and the redeem that follows onboarding.
 * Everything runs against a mocked API; the real redeem rules are covered by the API e2e.
 */

const CODE = "PUHU-TEST2345";
const STORAGE_KEY = "mentor.pendingReferral";

const newcomer: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "davetli@test.local",
  displayName: "Deniz Kaya",
  username: null,
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: null,
  examVariant: null,
  examDate: null,
  dailyFocusGoalMinutes: null,
  careerGroup: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const onboardedStudent: AuthUser = { ...newcomer, username: "davetli", examType: "KPSS" };
const coach: AuthUser = { ...onboardedStudent, roles: ["COACH"], username: "kocum" };

const DISCOUNT = { discountType: "PERCENT", discountValue: 30 };

type Answer = { status: number; body?: unknown };

interface Mock {
  /** Who the refresh cookie resolves to; `null` is an anonymous visitor. */
  session: AuthUser | null;
  /** Answers `GET /economy/invite/preview/:code`. */
  preview: Answer;
  /** Answers `POST /economy/invite/redeem`. */
  redeem: Answer;
  /** Holds the preview back until released, to look at the skeleton. */
  previewGate?: Promise<void>;
}

const OK_PREVIEW: Answer = {
  status: 200,
  body: { inviterDisplayName: "Ayşe", discount: DISCOUNT },
};
const INVALID_PREVIEW: Answer = {
  status: 404,
  body: { code: "INVITE_CODE_INVALID", message: "Bu davet kodu geçersiz." },
};

function headersFor(route: Route) {
  return {
    "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3100",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, authorization, accept-language",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  };
}

async function mockApi(page: Page, overrides: Partial<Mock> = {}) {
  const mock: Mock = {
    session: null,
    preview: OK_PREVIEW,
    redeem: { status: 200, body: { status: "OK" } },
    ...overrides,
  };
  const calls = { preview: [] as string[], redeem: 0 };

  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const headers = headersFor(route);
    const json = (answer: Answer) =>
      route.fulfill({
        status: answer.status,
        contentType: "application/json",
        headers,
        body: answer.body === undefined ? "" : JSON.stringify(answer.body),
      });

    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (method === "POST" && path === "/v1/auth/refresh") {
      return mock.session
        ? json({
            status: 200,
            body: { accessToken: "test-token", expiresIn: 3600, user: mock.session },
          })
        : json({
            status: 401,
            body: { code: "AUTH_INVALID_REFRESH", message: "Oturum bulunamadı." },
          });
    }
    if (method === "POST" && path === "/v1/auth/login") {
      // The account someone with an existing login signs in to.
      mock.session = { ...onboardedStudent };
      return json({
        status: 200,
        body: { accessToken: "test-token", expiresIn: 3600, user: mock.session },
      });
    }
    if (method === "POST" && path === "/v1/auth/signup") {
      mock.session = { ...newcomer };
      return json({
        status: 200,
        body: { accessToken: "test-token", expiresIn: 3600, user: mock.session },
      });
    }
    if (method === "PATCH" && path === "/v1/users/me" && mock.session) {
      mock.session = { ...mock.session, ...(request.postDataJSON() as Partial<AuthUser>) };
      return json({ status: 200, body: mock.session });
    }
    if (method === "GET" && path === "/v1/users/me" && mock.session) {
      return json({ status: 200, body: mock.session });
    }
    if (method === "GET" && path.startsWith("/v1/economy/invite/preview/")) {
      calls.preview.push(decodeURIComponent(path.split("/").pop() ?? ""));
      await mock.previewGate;
      return json(mock.preview);
    }
    if (method === "POST" && path === "/v1/economy/invite/redeem") {
      calls.redeem += 1;
      return json(mock.redeem);
    }
    if (method === "GET" && path === "/v1/coaching/vision") return json({ status: 200, body: null });
    if (method === "POST" && path === "/v1/coaching/vision") {
      return json({ status: 200, body: request.postDataJSON() });
    }
    return route.fulfill({ status: 204, headers });
  });

  return calls;
}

const stored = (page: Page) =>
  page.evaluate((key) => window.sessionStorage.getItem(key), STORAGE_KEY);

/** Signup is done; answers the student wizard and presses "Panele git". */
async function finishOnboarding(page: Page) {
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("radio", { name: "YKS" }).click();
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("radio", { name: "Ailem için" }).click();
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("radio", { name: "Eğitim" }).click();
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("radio", { name: "Dengeli" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel("Kullanıcı adı").fill("deniz_davet");
  await page.getByRole("button", { name: "Devam" }).click();
  await expect(page.getByRole("heading", { name: "Yolun hazır." })).toBeVisible();
  await page.getByRole("button", { name: "Panele git" }).click();
}

async function signUp(page: Page) {
  await page.getByRole("textbox", { name: "Ad Soyad" }).fill("Deniz Kaya");
  await page.getByRole("textbox", { name: "E-posta" }).fill("deniz@test.local");
  await page.locator('input[type="password"]').fill("MentorQa!2026");
  await page.getByRole("checkbox", { name: /KVKK aydınlatma/ }).click();
  await page.getByRole("checkbox", { name: /Kullanım Koşulları/ }).click();
  await page.getByRole("button", { name: "Kayıt ol" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a friend sees who invited them, the discount and the code, and nothing is kept until they act", async ({
  page,
}) => {
  const calls = await mockApi(page);
  await page.goto("/davet/puhu-test2345");

  await expect(page.getByRole("heading", { name: "Ayşe seni davet etti!" })).toBeVisible();
  await expect(page.getByText("Premium'da %30 indirim seni bekliyor.")).toBeVisible();
  await expect(page.getByText("PuhuKoç'ta birlikte çalışalım mı?")).toBeVisible();
  // The code is text on the page, so it can be typed into Ayarlar when the app is opened elsewhere.
  await expect(page.getByText("Davet kodun", { exact: true })).toBeVisible();
  await expect(page.getByText(CODE, { exact: true })).toBeVisible();
  // The disclosure comes before any redeem could happen.
  await expect(
    page.getByText("Ayşe katıldığını görecek. Premium'a geçersen ona Coin düşer."),
  ).toBeVisible();

  expect(calls.preview).toEqual([CODE]);
  // Looking is not choosing: nothing is remembered on page view.
  expect(await stored(page)).toBeNull();
  expect(calls.redeem).toBe(0);

  await page.getByRole("link", { name: "Hemen başla" }).click();
  await expect(page).toHaveURL(/\/kayit$/);
  expect(await stored(page)).toBe(CODE);
});

test("no discount line when the preview has none", async ({ page }) => {
  await mockApi(page, { preview: { status: 200, body: { inviterDisplayName: "Ayşe", discount: null } } });
  await page.goto(`/davet/${CODE}`);

  await expect(page.getByRole("heading", { name: "Ayşe seni davet etti!" })).toBeVisible();
  await expect(page.getByText(/indirim/)).toHaveCount(0);
});

test("the English landing speaks English and keeps the English signup route", async ({ page }) => {
  await mockApi(page);
  await page.goto(`/en/invite/${CODE.toLowerCase()}`);

  await expect(page.getByRole("heading", { name: "Ayşe invited you!" })).toBeVisible();
  await expect(page.getByText("30% off Premium is waiting for you.")).toBeVisible();
  await expect(
    page.getByText("Ayşe will see that you joined. If you go Premium, they get Coin."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Get started" }).click();
  await expect(page).toHaveURL(/\/en\/signup$/);
  expect(await stored(page)).toBe(CODE);
});

test("someone who already has an account signs in and comes back to the invite", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto(`/davet/${CODE}`);

  await page.getByRole("link", { name: "Zaten hesabım var" }).click();
  await expect(page).toHaveURL(/\/giris\?next=/);
  expect(decodeURIComponent(page.url())).toContain(`next=/invite/${CODE}`);
  expect(await stored(page)).toBe(CODE);

  await page.getByRole("textbox", { name: "E-posta" }).fill("davetli@test.local");
  await page.locator('input[type="password"]').fill("MentorQa!2026");
  await page.getByRole("button", { name: "Giriş yap" }).click();

  // Back on the invite, now signed in: the choice is theirs, and the remembered code is spent.
  await expect(page).toHaveURL(new RegExp(`/davet/${CODE}$`));
  await expect(page.getByRole("button", { name: "Daveti kabul et" })).toBeVisible();
  expect(calls.redeem).toBe(0);
  await expect.poll(() => stored(page)).toBeNull();
});

test("the skeleton holds the place while the invite loads", async ({ page }) => {
  let release!: () => void;
  const previewGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await mockApi(page, { previewGate });
  await page.goto(`/davet/${CODE}`);

  await expect(page.getByRole("status", { name: "Davet yükleniyor" })).toBeVisible();
  await expect(page.getByRole("heading")).toHaveCount(0);

  release();
  await expect(page.getByRole("heading", { name: "Ayşe seni davet etti!" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Davet yükleniyor" })).toHaveCount(0);
});

test("a signed-in student accepts with one deliberate click", async ({ page }) => {
  const calls = await mockApi(page, { session: onboardedStudent });
  await page.goto(`/davet/${CODE}`);

  const accept = page.getByRole("button", { name: "Daveti kabul et" });
  await expect(accept).toBeVisible();
  await expect(page.getByRole("link", { name: "Hemen başla" })).toHaveCount(0);
  await expect(
    page.getByText("Ayşe katıldığını görecek. Premium'a geçersen ona Coin düşer."),
  ).toBeVisible();
  // Following a shared link never connects anyone by itself.
  expect(calls.redeem).toBe(0);

  await accept.click();
  await expect(page.getByText("Harika, artık birliktesiniz!")).toBeVisible();
  await expect(accept).toHaveCount(0);
  expect(calls.redeem).toBe(1);
  await expect(page.getByRole("link", { name: "Panele git" })).toHaveAttribute("href", "/panel");
});

test("a refused accept says why, in the API's words, and does not pretend", async ({ page }) => {
  const calls = await mockApi(page, {
    session: onboardedStudent,
    redeem: {
      status: 409,
      body: { code: "INVITE_ALREADY_REDEEMED", message: "Bir davet kodunu zaten kullandın." },
    },
  });
  await page.goto(`/davet/${CODE}`);

  await page.getByRole("button", { name: "Daveti kabul et" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Bir davet kodunu zaten kullandın." }),
  ).toBeVisible();
  await expect(page.getByText("Harika, artık birliktesiniz!")).toHaveCount(0);
  expect(calls.redeem).toBe(1);
});

test("someone signed in but still in onboarding is sent there with the code", async ({ page }) => {
  const calls = await mockApi(page, { session: newcomer });
  await page.goto(`/davet/${CODE}`);

  await expect(page.getByRole("button", { name: "Daveti kabul et" })).toHaveCount(0);
  await page.getByRole("link", { name: "Hemen başla" }).click();
  await expect(page).toHaveURL(/\/baslangic$/);
  expect(await stored(page)).toBe(CODE);
  expect(calls.redeem).toBe(0);
});

test("a coach sees the neutral state and cannot accept", async ({ page }) => {
  const calls = await mockApi(page, { session: coach });
  await page.goto(`/davet/${CODE}`);

  await expect(page.getByRole("heading", { name: "Bu davet bağlantısı çalışmıyor." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Daveti kabul et" })).toHaveCount(0);
  await expect(page.getByText(CODE)).toHaveCount(0);
  expect(await stored(page)).toBeNull();
  expect(calls.redeem).toBe(0);
});

test("a dead link says so and still offers a way in, without a code", async ({ page }) => {
  await mockApi(page, { preview: INVALID_PREVIEW });
  await page.goto(`/davet/${CODE}`);

  await expect(page.getByRole("heading", { name: "Bu davet bağlantısı çalışmıyor." })).toBeVisible();
  await page.getByRole("link", { name: "Yine de başla" }).click();
  await expect(page).toHaveURL(/\/kayit$/);
  expect(await stored(page)).toBeNull();
});

test("a malformed code is a dead link without asking the API", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/davet/abc");

  await expect(page.getByRole("heading", { name: "Bu davet bağlantısı çalışmıyor." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Yine de başla" })).toBeVisible();
  expect(calls.preview).toEqual([]);
});

test("a failed lookup is not called a dead link and can be retried", async ({ page }) => {
  let attempt = 0;
  const calls = await mockApi(page);
  await page.route("http://localhost:3001/v1/economy/invite/preview/**", async (route) => {
    attempt += 1;
    await route.fulfill({
      status: attempt === 1 ? 500 : 200,
      contentType: "application/json",
      headers: headersFor(route),
      body: JSON.stringify(
        attempt === 1
          ? { code: "INTERNAL_ERROR", message: "x" }
          : { inviterDisplayName: "Ayşe", discount: null },
      ),
    });
  });
  await page.goto(`/davet/${CODE}`);

  await expect(page.getByRole("heading", { name: "Davet şimdi yüklenmedi." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bu davet bağlantısı çalışmıyor." })).toHaveCount(0);
  await page.getByRole("button", { name: "Yeniden dene" }).click();
  await expect(page.getByRole("heading", { name: "Ayşe seni davet etti!" })).toBeVisible();
  expect(calls.redeem).toBe(0);
});

test("a new student's code is redeemed once when onboarding ends, then the normal destination", async ({
  page,
}) => {
  const calls = await mockApi(page);
  await page.goto(`/davet/${CODE}`);
  await page.getByRole("link", { name: "Hemen başla" }).click();
  await expect(page).toHaveURL(/\/kayit$/);
  await signUp(page);
  await expect(page).toHaveURL(/\/baslangic/);
  // Signing up and walking the wizard redeems nothing yet.
  expect(calls.redeem).toBe(0);

  await finishOnboarding(page);

  await expect(page).toHaveURL(/\/panel/);
  await expect.poll(() => calls.redeem).toBe(1);
  await expect(page.getByText("Kodun kaydedildi!")).toBeVisible();
  // The code was consumed: nothing is left to redeem on the next visit.
  expect(await stored(page)).toBeNull();
});

test("a refused redeem after onboarding shows the API's message and still lands on the panel", async ({
  page,
}) => {
  const calls = await mockApi(page, {
    redeem: {
      status: 409,
      body: { code: "INVITE_ALREADY_REDEEMED", message: "Bir davet kodunu zaten kullandın." },
    },
  });
  await page.goto(`/davet/${CODE}`);
  await page.getByRole("link", { name: "Hemen başla" }).click();
  await signUp(page);
  await expect(page).toHaveURL(/\/baslangic/);

  await finishOnboarding(page);

  await expect(page).toHaveURL(/\/panel/);
  await expect(page.getByText("Bir davet kodunu zaten kullandın.")).toBeVisible();
  expect(calls.redeem).toBe(1);
});

test("onboarding without a pending code never calls redeem", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/kayit");
  await signUp(page);
  await expect(page).toHaveURL(/\/baslangic/);

  await finishOnboarding(page);

  await expect(page).toHaveURL(/\/panel/);
  expect(calls.redeem).toBe(0);
});
