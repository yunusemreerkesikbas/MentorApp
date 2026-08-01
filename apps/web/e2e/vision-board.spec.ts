import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser, GeoResponseDto } from "@mentor/types";

/** YKS, so university badges and the card's university list are in play. */
const user: AuthUser = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "hedef@test.local",
  displayName: "Hedef Test",
  username: "hedef_test",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "YKS",
  examDate: "2026-06-20",
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const geo: GeoResponseDto = {
  cities: [
    {
      code: "42",
      name: "Konya",
      slug: "konya",
      region: "IC_ANADOLU",
      universities: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Selçuk Üniversitesi",
          slug: "selcuk-universitesi",
          kind: "STATE",
          foundedYear: 1975,
          websiteUrl: null,
        },
      ],
    },
    {
      code: "06",
      name: "Ankara",
      slug: "ankara",
      region: "IC_ANADOLU",
      universities: [],
    },
  ],
  universitySource: {
    source: "YÖK",
    sourceUrl: "https://www.yok.gov.tr",
    verifiedAt: "2026-07-01T00:00:00.000Z",
  },
};

test("haritadan seçilen şehir ve kariyer alanı kaydedilir", async ({ page }) => {
  const api = await mockVisionApi(page);
  await page.goto("/hedef");

  await page
    .getByLabel("Hedef şehir (isteğe bağlı)")
    .selectOption({ label: "Konya" });

  // Selecting a province fills the card — including the university list, because this user is YKS.
  await expect(page.getByText("Selçuk Üniversitesi")).toBeVisible();
  await expect(page.getByText("1 üniversite")).toBeVisible();

  await page.getByRole("radio", { name: "Yazılım & Bilişim" }).click();
  await page
    .getByRole("textbox", { name: "Hedefin" })
    .fill("Bilgisayar mühendisi olmak");
  await page.getByRole("button", { name: "Kaydet" }).click();

  await expect.poll(() => api.saved.length).toBe(1);
  expect(api.saved[0]).toMatchObject({
    goalTitle: "Bilgisayar mühendisi olmak",
    targetCityCode: "42",
    careerGroup: "YAZILIM",
  });
});

test("üniversitesi olmayan şehirde kart boş liste yerine açıklama gösterir", async ({
  page,
}) => {
  await mockVisionApi(page);
  await page.goto("/hedef");

  await page
    .getByLabel("Hedef şehir (isteğe bağlı)")
    .selectOption({ label: "Ankara" });

  await expect(
    page.getByText("Bu şehirde kayıtlı üniversite yok."),
  ).toBeVisible();
});

async function mockVisionApi(page: Page) {
  const saved: unknown[] = [];

  // Dismiss the analytics consent bar up front — it docks over the bottom of the form.
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path === "/v1/content/geo") return json(route, geo);
    // The shell renders inside the app chrome, whose notification drawer reads `.items` off this
    // response. A bare 204 here throws and takes the whole page down before the form ever mounts.
    if (method === "GET" && path === "/v1/notifications") {
      return json(route, {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        unreadCount: 0,
      });
    }
    if (method === "GET" && path === "/v1/coaching/vision") {
      return json(route, null, 204);
    }
    if (method === "POST" && path === "/v1/coaching/vision") {
      saved.push(request.postDataJSON());
      return json(route, {
        goalTitle: "Bilgisayar mühendisi olmak",
        targetCityCode: "42",
        targetCity: null,
        targetUniversityId: null,
        careerGroup: "YAZILIM",
        motivation: null,
        aiNote: null,
        createdAt: "2026-07-31T00:00:00.000Z",
        updatedAt: "2026-07-31T00:00:00.000Z",
      });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") {
      return json(route, { token: "test-stream" });
    }
    if (method === "GET" && path === "/v1/notifications/stream") {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: corsHeaders,
        body: "",
      });
    }

    return json(route, null, 204);
  });

  return {
    get saved() {
      return saved;
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
