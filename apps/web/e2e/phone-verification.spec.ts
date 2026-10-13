import { expect, test, type Page } from "@playwright/test";
import type { AuthUser, PhoneStatusDto } from "@mentor/types";

const user: AuthUser = {
  id: "33333333-3333-4333-8333-333333333333", email: "phone@test.local",
  displayName: "Phone Test", username: "phone_test", avatarUrl: null, bio: null, website: null,
  roles: ["STUDENT"], organizationId: null, examType: "KPSS", examVariant: null,
  examDate: null, dailyFocusGoalMinutes: null, emailVerified: true, createdAt: "2026-01-01T00:00:00.000Z",
};
const challengeId = "44444444-4444-4444-8444-444444444444";
const apiUrl = "http://localhost:3001/v1";
const pendingCheckoutUrl = "https://payment.test.local/hosted/checkout?token=stored-token";

interface MockOptions {
  phone?: Partial<PhoneStatusDto>;
  phoneEmpty?: boolean;
  unknownSend?: boolean;
  lifetimeMs?: number;
  coach?: boolean;
  sponsorPending?: boolean;
  pendingTrial?: "known" | "unknown";
  pendingPaid?: "known" | "unknown";
  unknownCheckout?: boolean;
  trialUsed?: boolean;
}

async function mockApi(page: Page, options: MockOptions = {}) {
  let status: PhoneStatusDto = { verified: false, maskedPhoneNumber: null, available: true, reauthenticationRequired: false, ...options.phone };
  let sent = 0;
  let confirms = 0;
  let phoneReads = 0;
  let requestedPhone = "";
  let checkout: Record<string, unknown> | null = null;
  let pendingPaid = options.pendingPaid;
  let checkoutCalls = 0;
  const principal = options.coach ? { ...user, roles: ["STUDENT", "COACH"] } : user;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    Object.defineProperty(window, "turnstile", { value: {
      render: (_container: unknown, widget: { callback: (token: string) => void }) => { widget.callback("test-token"); return "widget"; }, remove: () => {},
    } });
  });
  await page.route(`${apiUrl}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const headers = {
      "access-control-allow-origin": request.headers().origin ?? "http://localhost:3100",
      "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type, authorization, accept-language",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    };
    const json = (body: unknown, code = 200) => route.fulfill({ status: code, headers, contentType: "application/json", body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/v1/auth/refresh") return json({ accessToken: "test-token", expiresIn: 3600, user: principal });
    if (path === "/v1/auth/login") {
      status = { ...status, reauthenticationRequired: false };
      return json({ accessToken: "test-token", expiresIn: 3600, user: principal });
    }
    if (path === "/v1/users/me/phone") {
      phoneReads++;
      return options.phoneEmpty ? route.fulfill({ status: 204, headers }) : json(status);
    }
    if (path === "/v1/users/me/phone/verifications") {
      sent++;
      requestedPhone = (request.postDataJSON() as { phoneNumber: string }).phoneNumber;
      return json({ challengeId, maskedPhoneNumber: "+90 5** *** **67", sendStatus: options.unknownSend ? "UNKNOWN" : "SENT",
        expiresAt: new Date(Date.now() + (options.lifetimeMs ?? 60_000)).toISOString(),
        resendAvailableAt: new Date(Date.now() + 500).toISOString(),
      }, 201);
    }
    if (path === `/v1/users/me/phone/verifications/${challengeId}/confirm`) {
      confirms++;
      if ((request.postDataJSON() as { code: string }).code !== "123456") return json({ code: "AUTH_PHONE_CODE_INVALID", message: "Kod eşleşmedi. Yeniden deneyebilirsin." }, 400);
      status = { ...status, verified: true, maskedPhoneNumber: "+90 5** *** **67" };
      return json(status);
    }
    if (path === "/v1/users/me") return json(principal);
    if (path === "/v1/users/me/auth-accounts/google") return json({ enabled: false, linked: false, providerEmail: null, canLink: false });
    if (path === "/v1/auth/google/status") return json({ enabled: true });
    if (path === "/v1/plans") return json([{ id: "premium-monthly", name: "Premium Aylık", periodMonths: 1, priceMinor: 24900, currency: "TRY", trialDays: 7, seatCount: 0, purchaseEnabled: true, redirectToMobile: false }]);
    if (path === "/v1/subscription") return json({ subscription: options.pendingTrial || pendingPaid ? {
      id: "pending-subscription", planId: "premium-monthly", status: "INCOMPLETE", startedAt: "2026-10-01T12:00:00.000Z",
      trialEndsAt: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, sponsored: false,
    } : null, entitlement: { tier: "FREE", isPremium: false, validUntil: null, reason: options.pendingTrial || pendingPaid ? "INCOMPLETE" : "NONE" }, features: {}, discount: null,
      trialEligibility: { eligible: !options.pendingTrial && !options.trialUsed && status.verified, reason: options.pendingTrial ? "PENDING" : options.trialUsed ? "ACCOUNT_USED" : status.verified ? "AVAILABLE" : "PHONE_REQUIRED" },
      pendingTrialCheckoutUrl: options.pendingTrial === "known" ? pendingCheckoutUrl : null,
      pendingCheckoutUrl: options.pendingTrial === "known" || pendingPaid === "known" ? pendingCheckoutUrl : null,
    });
    if (path === "/v1/coach/access") return json({ canChat: false, mode: "NONE", reason: "PAYMENT_PREMIUM_REQUIRED" });
    if (path === "/v1/subscription/offers") return json({ offers: {}, available: [] });
    if (path === "/v1/subscription/checkout") {
      checkoutCalls++;
      checkout = request.postDataJSON() as Record<string, unknown>;
      if (options.unknownCheckout) {
        pendingPaid = "unknown";
        return json({ code: "PAYMENT_PROVIDER_UNAVAILABLE", message: "Ödeme sağlayıcısından yanıt bekleniyor." }, 503);
      }
      return json({ checkoutUrl: `${new URL(request.headers().origin ?? "http://localhost:3100").origin}/abonelik/sonuc?status=success` });
    }
    if (path === "/v1/mentorship/my-coach") return json(options.sponsorPending ? {
      linkId: "link-1", coachDisplayName: "Mert", coachUsername: null, status: "ACTIVE", acceptedAt: "2026-09-29T12:00:00.000Z",
      dataScope: [], coachNote: null, studentNote: null, coachProfile: null, coachStatus: "ACTIVE", seatWaiting: false,
      sponsoredPremiumPending: !status.verified,
    } : null);
    if (path.startsWith("/v1/mentorship/")) return json({ items: [], total: 0 });
    if (path === "/v1/notifications/preferences") return json({ emailEnabled: true, pushEnabled: false, campaignsEnabled: true });
    if (path === "/v1/notifications/stream-token") return json({ token: "stream" });
    if (path === "/v1/notifications/stream") return route.fulfill({ status: 200, headers, contentType: "text/event-stream", body: "" });
    if (path === "/v1/community/achievements/unseen") return json({ celebrations: [] });
    if (path.startsWith("/v1/economy/")) return json({ code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    return json({ items: [], total: 0, unreadCount: 0 });
  });
  return {
    get sent() { return sent; }, get confirms() { return confirms; }, get phoneReads() { return phoneReads; },
    get requestedPhone() { return requestedPhone; }, get checkout() { return checkout; },
    get checkoutCalls() { return checkoutCalls; },
  };
}

async function sendCode(page: Page) {
  await page.getByLabel("Cep telefonu numaran").fill("0532 123 45 67");
  await page.getByRole("button", { name: "SMS kodu gönder" }).click();
  await expect(page.getByLabel("SMS doğrulama kodu")).toBeVisible();
}

test("settings accepts a full OTP, keeps an invalid attempt recoverable and normalizes the phone", async ({ page }) => {
  const api = await mockApi(page, { unknownSend: true });
  await page.goto("/ayarlar");
  await expect(page.getByText("Bu, pazarlama izni değildir.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "KVKK aydınlatma metni", exact: true })).toHaveAttribute("href", "/yasal/kvkk-aydinlatma");
  await sendCode(page);
  await expect(page.getByText("Gönderim sonucu henüz belli değil.", { exact: false })).toBeVisible();
  expect(api.sent).toBe(1);
  expect(api.requestedPhone).toBe("+905321234567");
  const code = page.getByLabel("SMS doğrulama kodu");
  await expect(code).toHaveAttribute("autocomplete", "one-time-code");
  await code.fill("111111");
  await page.getByRole("button", { name: "Telefonu doğrula" }).click();
  await expect(page.getByText("Kod eşleşmedi. Yeniden deneyebilirsin.")).toBeVisible();
  await code.fill("123456");
  await page.getByRole("button", { name: "Telefonu doğrula" }).click();
  await expect(page.getByText("Telefonun doğrulandı:", { exact: false })).toBeVisible();
  expect(api.confirms).toBe(2);
  await expect(page.getByRole("button", { name: "Telefon numarasını değiştir" })).toBeVisible();
});

test("server deadlines disable expired codes and enable a manual resend", async ({ page }) => {
  const api = await mockApi(page, { lifetimeMs: 1_000 });
  await page.goto("/ayarlar");
  await sendCode(page);
  await expect(page.getByRole("button", { name: "Kodu yeniden gönder" })).toBeDisabled();
  await expect(page.getByLabel("SMS doğrulama kodu")).toBeDisabled({ timeout: 5_000 });
  await expect(page.getByText("Kodun süresi doldu.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Kodu yeniden gönder" }).click();
  expect(api.sent).toBe(2);
  await expect(page.getByLabel("SMS doğrulama kodu")).toBeEnabled();
});

test("unavailable SMS has a clear state and no verification bypass", async ({ page }) => {
  const api = await mockApi(page, { phone: { available: false } });
  await page.goto("/en/settings");
  await expect(page.getByText("SMS verification is unavailable right now.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send SMS code" })).toHaveCount(0);
  expect(api.sent).toBe(0);
});

test("an empty phone status degrades to a retry instead of crashing settings", async ({ page }) => {
  const api = await mockApi(page, { phoneEmpty: true });
  await page.goto("/ayarlar");
  await expect(page.getByRole("button", { name: "Yeniden dene" })).toBeVisible();
  await expect(page.getByText("This page couldn't load")).toHaveCount(0);
  expect(api.sent).toBe(0);
});

test("number changes carry a safe localized settings return through Google sign-in", async ({ page }) => {
  const api = await mockApi(page, { coach: true, phone: { verified: true, maskedPhoneNumber: "+90 5** *** **11", reauthenticationRequired: true } });
  await page.goto("/ayarlar");
  await page.getByRole("button", { name: "Telefon numarasını değiştir" }).click();
  await page.getByRole("link", { name: "Yeniden giriş yap" }).click();
  await expect(page).toHaveURL(/\/giris\?next=/);
  const googleRequest = page.waitForRequest((request) => request.url().includes("/v1/auth/google/start"));
  await page.route(`${apiUrl}/auth/google/start?**`, (route) => route.abort());
  await page.getByRole("button", { name: "Google ile devam et" }).click();
  const start = await googleRequest;
  expect(new URL(start.url()).searchParams.get("returnTo")).toBe("/ayarlar?section=phone");
  expect(api.sent).toBe(0);
});

test("password reauthentication returns a coach to settings without treating refresh as verification", async ({ page }) => {
  const api = await mockApi(page, { coach: true, phone: { verified: true, maskedPhoneNumber: "+90 5** *** **11", reauthenticationRequired: true } });
  await page.goto("/ayarlar");
  await page.getByRole("button", { name: "Telefon numarasını değiştir" }).click();
  await page.getByRole("link", { name: "Yeniden giriş yap" }).click();
  await expect(page).toHaveURL(/\/giris\?next=/);
  await page.getByLabel("E-posta", { exact: true }).fill(user.email);
  await page.locator('input[name="password"]').fill("password-for-test");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(/\/ayarlar\?section=phone$/);
  await page.getByRole("button", { name: "Telefon numarasını değiştir" }).click();
  await expect(page.getByLabel("Cep telefonu numaran")).toBeVisible();
  expect(api.sent).toBe(0);
});

test("paid checkout after a used trial never asks for SMS and sends useTrial false", async ({ page }) => {
  const api = await mockApi(page, { trialUsed: true });
  await page.goto("/abonelik");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Ücretli aboneliği başlat" }).click();
  await expect.poll(() => api.checkout).toEqual({ planId: "premium-monthly", useTrial: false });
  expect(api.phoneReads).toBe(0);
  expect(api.sent).toBe(0);
});

test("trial waits for SMS and the refreshed server eligibility before checkout", async ({ page }) => {
  const api = await mockApi(page);
  await page.goto("/en/subscription");
  await expect(page.getByText("A 7-day free trial is automatically included with your subscription.")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByText("kept for 12 months", { exact: false })).toBeVisible();
  await expect(page.getByText("It does not give marketing consent.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Personal data protection notice" })).toBeVisible();
  await page.goto("/abonelik");
  await expect(page.getByText("7 gün ücretsiz deneme aboneliğine otomatik eklenir.")).toBeVisible();
  await expect(page.getByText("Deneme başladığında telefonunun denemede kullanıldığına dair kayıt 12 ay saklanır.", { exact: false })).toBeVisible();
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Denemeyi başlat" })).toBeDisabled();
  await sendCode(page);
  await page.getByLabel("SMS doğrulama kodu").fill("123456");
  await page.getByRole("button", { name: "Telefonu doğrula" }).click();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Denemeyi başlat" })).toBeEnabled();
  await page.getByRole("button", { name: "Denemeyi başlat" }).click();
  await expect.poll(() => api.checkout).toEqual({ planId: "premium-monthly", useTrial: true });
  expect(api.sent).toBe(1);
});

test("an active coach link stays visible while sponsored Premium awaits phone verification", async ({ page }) => {
  await mockApi(page, { sponsorPending: true });
  await page.goto("/kocum");
  await expect(page.getByRole("heading", { name: "Mert" })).toBeVisible();
  await expect(page.getByText("Koç bağlantın açık.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Cep telefonu numaran")).toBeVisible();
});

test("paywall trial phone verification controls remain reachable within the dialog viewport", async ({ page, context }) => {
  const api = await mockApi(page);
  await page.goto("/koc/sohbet");
  await page.getByRole("button", { name: "Premium'a yükselt" }).click();
  const dialog = page.getByTestId("premium-paywall");
  const body = page.getByTestId("premium-paywall-body");
  const viewport = page.viewportSize()!;
  // The CSS sheet entrance may still be moving when the trigger click resolves.
  await expect.poll(async () => {
    const bounds = await dialog.boundingBox();
    return bounds !== null && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height;
  }).toBe(true);

  await expect(page.getByText("7 gün ücretsiz deneme aboneliğine otomatik eklenir.")).toBeVisible();
  await expect(body).toHaveCSS("overflow-y", "auto");
  expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.getByLabel("Cep telefonu numaran").fill("0532 123 45 67");
  const send = page.getByRole("button", { name: "SMS kodu gönder" });
  await send.scrollIntoViewIfNeeded();
  const sendBounds = await send.boundingBox();
  const scrollBounds = await body.boundingBox();
  expect(sendBounds!.height).toBeGreaterThanOrEqual(44);
  expect(sendBounds!.y).toBeGreaterThanOrEqual(scrollBounds!.y);
  expect(sendBounds!.y + sendBounds!.height).toBeLessThanOrEqual(scrollBounds!.y + scrollBounds!.height + 1);
  await send.click();

  const code = page.getByLabel("SMS doğrulama kodu");
  await expect(code).toHaveAttribute("autocomplete", "one-time-code");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() => navigator.clipboard.writeText("123456"));
  await code.focus();
  await code.press("Control+V");
  await expect(code).toHaveValue("123456");
  const confirm = page.getByRole("button", { name: "Telefonu doğrula" });
  await confirm.scrollIntoViewIfNeeded();
  const confirmBounds = await confirm.boundingBox();
  expect(confirmBounds!.height).toBeGreaterThanOrEqual(44);
  expect(confirmBounds!.y).toBeGreaterThanOrEqual(scrollBounds!.y);
  expect(confirmBounds!.y + confirmBounds!.height).toBeLessThanOrEqual(scrollBounds!.y + scrollBounds!.height + 1);
  await confirm.click();
  // Refreshed eligibility removes the verification card once the trial can start.
  await expect(code).toHaveCount(0);
  await page.getByRole("checkbox").check();
  const start = page.getByRole("button", { name: "Denemeyi başlat" });
  await expect(start).toBeEnabled();
  await expect(start).toBeInViewport({ ratio: 1 });
  expect(api.sent).toBe(1);
  expect(api.confirms).toBe(1);
});

for (const surface of ["subscription", "paywall"] as const) {
  async function openPendingSurface(page: Page) {
    await page.goto(surface === "subscription" ? "/abonelik" : "/koc/sohbet");
    await page.reload();
    if (surface === "paywall") await page.getByRole("button", { name: "Premium'a yükselt" }).click();
  }

  test(`${surface} resumes the stored pending trial URL after reload without a new checkout`, async ({ page }) => {
    const api = await mockApi(page, { pendingTrial: "known" });
    await page.route(pendingCheckoutUrl, (route) => route.fulfill({ contentType: "text/html", body: "<p>Stored hosted checkout</p>" }));
    await openPendingSurface(page);
    await expect(page.getByRole("button", { name: "Ücretli aboneliği başlat" })).toHaveCount(0);
    if (surface === "subscription") await expect(page.getByRole("button", { name: "Bekleyen denemeyi iptal et", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ödemeye devam et" }).click();
    await expect(page).toHaveURL(pendingCheckoutUrl);
    expect(api.checkout).toBeNull();
    expect(api.sent).toBe(0);
  });

  test(`${surface} keeps an unknown pending trial on hold without paid, retry or cancel actions`, async ({ page }) => {
    const api = await mockApi(page, { pendingTrial: "unknown" });
    await openPendingSurface(page);
    await expect(page.getByText("Deneme ödemesinin sonucu henüz belli değil.", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Destek seçenekleri" })).toHaveAttribute("href", "/ayarlar");
    for (const action of ["Ödemeye devam et", "Ücretli aboneliği başlat", "Denemeyi başlat", "Aboneliği iptal et", "Bekleyen denemeyi iptal et"]) {
      await expect(page.getByRole("button", { name: action, exact: true })).toHaveCount(0);
    }
    expect(api.checkout).toBeNull();
    expect(api.sent).toBe(0);
  });

  test(`${surface} resumes a stored paid checkout without a new checkout`, async ({ page }) => {
    const api = await mockApi(page, { pendingPaid: "known" });
    await page.route(pendingCheckoutUrl, (route) => route.fulfill({ contentType: "text/html", body: "<p>Stored hosted checkout</p>" }));
    await openPendingSurface(page);
    await expect(page.getByRole("button", { name: "Ücretli aboneliği başlat" })).toHaveCount(0);
    if (surface === "subscription") await expect(page.getByRole("button", { name: "Bekleyen ödemeyi iptal et", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ödemeye devam et" }).click();
    await expect(page).toHaveURL(pendingCheckoutUrl);
    expect(api.checkoutCalls).toBe(0);
  });

  test(`${surface} holds an unknown paid checkout without new purchase or cancellation`, async ({ page }) => {
    const api = await mockApi(page, { pendingPaid: "unknown" });
    await openPendingSurface(page);
    await expect(page.getByText("Ödemenin sonucu henüz belli değil.", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Destek seçenekleri" })).toHaveAttribute("href", "/ayarlar");
    for (const action of ["Ödemeye devam et", "Ücretli aboneliği başlat", "Denemeyi başlat", "Aboneliği iptal et", "Bekleyen ödemeyi iptal et"]) {
      await expect(page.getByRole("button", { name: action, exact: true })).toHaveCount(0);
    }
    expect(api.checkoutCalls).toBe(0);
  });

  test(`${surface} reads the pending server state after an ambiguous checkout failure`, async ({ page }) => {
    const api = await mockApi(page, { unknownCheckout: true, trialUsed: true });
    await openPendingSurface(page);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Ücretli aboneliği başlat" }).click();
    await expect(page.getByText("Ödemenin sonucu henüz belli değil.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ücretli aboneliği başlat" })).toHaveCount(0);
    expect(api.checkoutCalls).toBe(1);
  });
}
