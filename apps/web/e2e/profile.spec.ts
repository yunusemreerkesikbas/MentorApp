import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

const user: AuthUser = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "profil@test.local",
  displayName: "Profil Test",
  username: "profile_test",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "KPSS",
  examVariant: null,
  examDate: "2026-07-26",
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

test("hesap silme satırı açıklamayı paylaşılan onay dialogunda gösterir", async ({
  page,
}) => {
  const api = await mockProfileApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );
  await page.goto("/profil");

  await expect(page.getByRole("heading", { name: "Hesap" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hesabımı sil", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Hesabın ve verilerin kalıcı olarak silinir: koç sohbetlerin, notların, hedef panon ve yüklediğin fotoğraflar. Aktif aboneliğin varsa iptal edilir. Fatura kayıtları yasal saklama yükümlülüğü gereği korunur. Bu işlem geri alınamaz.",
    ),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Hesabımı sil" }).click();

  const dialog = page.getByRole("dialog", { name: "Hesabımı sil" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Hesabımı sil", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText(
      "Hesabın ve verilerin kalıcı olarak silinir: koç sohbetlerin, notların, hedef panon ve yüklediğin fotoğraflar. Aktif aboneliğin varsa iptal edilir. Fatura kayıtları yasal saklama yükümlülüğü gereği korunur. Bu işlem geri alınamaz.",
    ),
  ).toBeVisible();
  await expect(api.deleteAccountCalls).toBe(0);

  await page.getByRole("button", { name: "Vazgeç" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(api.deleteAccountCalls).toBe(0);
});

async function mockProfileApi(page: Page) {
  let deleteAccountCalls = 0;

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname + url.search;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path.startsWith("/v1/notifications?")) {
      return json(route, {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        unreadCount: 0,
      });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") {
      return json(route, { token: "test-stream" });
    }
    if (method === "GET" && path.startsWith("/v1/notifications/stream?")) {
      return route.fulfill({ status: 200, contentType: "text/event-stream", headers: corsHeaders, body: "" });
    }
    if (method === "GET" && path === "/v1/notifications/preferences") {
      return json(route, { emailEnabled: true, pushEnabled: true });
    }
    if (method === "GET" && path.startsWith("/v1/economy/")) {
      return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }
    if (method === "DELETE" && path === "/v1/account") {
      deleteAccountCalls += 1;
      return json(route, null, 204);
    }

    return json(route, null, 204);
  });

  return {
    get deleteAccountCalls() {
      return deleteAccountCalls;
    },
  };
}

const corsHeaders = {
  "access-control-allow-origin": "http://localhost:3100",
  "access-control-allow-credentials": "true",
};

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: body == null ? "" : JSON.stringify(body),
  });
}
