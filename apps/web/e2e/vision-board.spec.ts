import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AuthUser,
  CampusExperienceDto,
  GeoResponseDto,
  GeoSearchResultDto,
  PreferenceSimulationAccessDto,
  UniversityProgramsDto,
} from "@mentor/types";

/** YKS, so university counts and the map explorer are in play. */
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
  examVariant: null,
  examDate: "2026-06-20",
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const SELCUK = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Selçuk Üniversitesi",
  slug: "selcuk-universitesi",
  kind: "STATE" as const,
  foundedYear: null,
  websiteUrl: null,
  latitude: 38.024207,
  longitude: 32.505705,
  programCount: 2,
};

/** 16 of the 206 real universities have no confirmed fix; they must list but never pin. */
const NO_COORDS = {
  ...SELCUK,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Koordinatsız Üniversitesi",
  slug: "koordinatsiz",
  latitude: null,
  longitude: null,
  programCount: 0,
};

const geo: GeoResponseDto = {
  cities: [
    {
      code: "42",
      name: "Konya",
      slug: "konya",
      region: "IC_ANADOLU",
      universities: [SELCUK, NO_COORDS],
    },
    {
      code: "06",
      name: "Ankara",
      slug: "ankara",
      region: "IC_ANADOLU",
      universities: [],
    },
  ],
  dataset: null,
  universitySource: {
    source: "ÖSYM 2026 Kılavuzu",
    sourceUrl: "https://www.osym.gov.tr",
    verifiedAt: "2026-08-01T00:00:00.000Z",
  },
};

const programs: UniversityProgramsDto = {
  university: SELCUK,
  source: geo.universitySource,
  programs: [
    {
      code: "108911205",
      faculty: "TEKNOLOJİ FAKÜLTESİ",
      name: "Bilgisayar Mühendisliği",
      level: "LISANS",
      durationYears: 4,
      scoreType: "SAY",
      quota: 69,
      guideYear: 2026,
      scores: [{ year: 2025, minScore: 411.79234, successRank: 85150 }],
    },
    {
      code: "108911206",
      faculty: "TEKNOLOJİ FAKÜLTESİ",
      name: "Yeni Program",
      level: "LISANS",
      durationYears: 4,
      scoreType: "SAY",
      quota: 30,
      guideYear: 2026,
      // ~13% of the guide has no cutoff; the row must still render.
      scores: [],
    },
  ],
};

const searchResult: GeoSearchResultDto = {
  cities: [{ code: "42", name: "Konya", slug: "konya", region: "IC_ANADOLU" }],
  universities: [],
  programs: [
    {
      code: "108911205",
      name: "Bilgisayar Mühendisliği",
      faculty: "TEKNOLOJİ FAKÜLTESİ",
      level: "LISANS",
      universityId: SELCUK.id,
      universityName: SELCUK.name,
      cityCode: "42",
      cityName: "Konya",
    },
  ],
  titles: [],
  institutions: [],
};

const simulationAccess: PreferenceSimulationAccessDto = {
  enabled: true,
  reason: null,
  dataset: {
    version: "yks-2026-guide-2025-placement-v1",
    examType: "YKS",
    guideYear: 2026,
    placementYear: 2025,
    officialPreferenceLimit: 24,
    source: "ÖSYM 2026 YKS Kılavuzu",
    sourceUrl: "https://www.osym.gov.tr/",
    verifiedAt: "2026-08-02T00:00:00.000Z",
  },
};

const campus: CampusExperienceDto = {
  id: "33333333-3333-4333-8333-333333333333",
  universityId: SELCUK.id,
  universityName: SELCUK.name,
  coverageStatus: "TERRAIN_ONLY",
  renderMode: "HYBRID",
  initialCamera: {
    center: { lat: 38.024207, lng: 32.505705, altitude: 0 },
    heading: 70,
    tilt: 55,
    range: 1_900,
  },
  source: "Selçuk Üniversitesi",
  sourceUrl: "https://aday.selcuk.edu.tr/home/Kampuste_Yasam",
  verifiedAt: "2026-08-08T00:00:00.000Z",
  pois: [],
};

/**
 * Mobile: browse + form live in a left drawer. Desktop: persistent rail + top form.
 * Both Playwright projects run this file — open the drawer only below the `lg` breakpoint.
 */
async function openBrowsePanel(page: Page) {
  if ((page.viewportSize()?.width ?? 0) >= 1024) return;
  const drawer = page.getByTestId("vision-browse-drawer");
  if (await drawer.isVisible().catch(() => false)) return;
  await page.getByTestId("vision-browse-open").click();
  await expect(drawer).toBeVisible();
}

/** Scope to the drawer on mobile so assertions do not hit a hidden desktop surface. */
function browseRoot(page: Page) {
  if ((page.viewportSize()?.width ?? 0) >= 1024) return page;
  return page.getByTestId("vision-browse-drawer");
}

/**
 * There is no city `<select>` any more — the map and the search panel are the two ways in, and
 * search is the one a keyboard can drive. Going through it here keeps the tests honest about the
 * accessible path actually working.
 */
async function selectKonya(page: Page) {
  await openBrowsePanel(page);
  const root = browseRoot(page);
  await root.getByLabel("Üniversite, şehir veya bölüm ara…").fill("konya");
  await root.getByRole("button", { name: "Konya", exact: true }).click();
}

async function chooseCareer(page: Page, label: string) {
  await openBrowsePanel(page);
  const root = browseRoot(page);
  await root.getByLabel("Puhu'nun alanı").click();
  await page.getByRole("option", { name: label }).click();
}

test("şehir ve Puhu'nun alanı seçilip kaydedilir", async ({ page }) => {
  const api = await mockVisionApi(page);
  await page.goto("/hedef");

  await selectKonya(page);
  await chooseCareer(page, "Yazılım & Bilişim");
  const root = browseRoot(page);
  await root.getByRole("textbox", { name: "Hedefin" }).fill("Bilgisayar mühendisi olmak");
  await root.getByRole("button", { name: "Kaydet" }).click();

  await expect.poll(() => api.saved.length).toBe(1);
  expect(api.saved[0]).toMatchObject({
    goalTitle: "Bilgisayar mühendisi olmak",
    targetCityCode: "42",
    careerGroup: "YAZILIM",
  });
});

test("şehir seçilince üniversiteleri, üniversiteye girince bölümleri gösterir", async ({
  page,
}) => {
  await mockVisionApi(page);
  await page.goto("/hedef");

  await selectKonya(page);
  const root = browseRoot(page);

  await expect(root.getByText("Konya · 2 üniversite")).toBeVisible();
  await root.getByRole("button", { name: SELCUK.name }).click();

  await expect(root.getByText("TEKNOLOJİ FAKÜLTESİ")).toBeVisible();
  // Quota is this year's, the cutoff is last year's — the row must not blur the two.
  await expect(root.getByText("SAY · 2026 kontenjan 69 · 2025 taban 411.79")).toBeVisible();
  // A program that never took a placement still appears, marked as such.
  await expect(root.getByText("SAY · 2026 kontenjan 30 · Yerleşme yok")).toBeVisible();
});

test("üniversite hedef olarak seçilip kaydedilir", async ({ page }) => {
  const api = await mockVisionApi(page);
  await page.goto("/hedef");

  await openBrowsePanel(page);
  const root = browseRoot(page);
  await root.getByRole("textbox", { name: "Hedefin" }).fill("Mühendis olmak");
  await selectKonya(page);

  await browseRoot(page).getByRole("button", { name: SELCUK.name }).click();
  await browseRoot(page).getByRole("button", { name: "Hedefim bu üniversite" }).click();

  await browseRoot(page).getByRole("button", { name: "Kaydet" }).click();
  await expect.poll(() => api.saved.length).toBe(1);
  expect(api.saved[0]).toMatchObject({
    targetCityCode: "42",
    targetUniversityId: SELCUK.id,
  });
});

test("üniversite pinleri ülke görünümünde, zoom gerekmeden çizilir", async ({
  page,
}) => {
  await mockVisionApi(page);
  await page.goto("/hedef");

  // No zoom, no city selected: the pins are on the map from first paint. One per university that
  // has a confirmed position — the coordinate-less one is listed but deliberately not pinned.
  const pins = page.locator(".mentor-tr-map-pin");
  await expect(pins).toHaveCount(1);

  await selectKonya(page);
  await expect(browseRoot(page).getByRole("button", { name: NO_COORDS.name })).toBeVisible();
  await expect(pins).toHaveCount(1);
});

test("Selçuk hover kartı hedef seçmeden 3D simülasyonu açar", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "Hover action is desktop-only");
  await mockVisionApi(page);
  await page.goto("/hedef");

  await page.locator(".mentor-tr-map-pin").hover();

  const simulationLink = page.getByRole("link", { name: "3D simülasyonu aç" });
  await expect(simulationLink).toBeVisible();
  await expect(simulationLink).toHaveAttribute(
    "href",
    `/hedef/simulasyon?universityId=${SELCUK.id}`,
  );
});

test("arama üniversite, şehir ve bölümde çalışır", async ({ page }) => {
  await mockVisionApi(page);
  await page.goto("/hedef");

  await openBrowsePanel(page);
  const root = browseRoot(page);
  await root.getByLabel("Üniversite, şehir veya bölüm ara…").fill("bilgisayar");
  await expect(root.getByText("Selçuk Üniversitesi · Konya")).toBeVisible();
});

async function mockVisionApi(page: Page) {
  const saved: unknown[] = [];

  // Dismiss the analytics consent bar up front — it docks over the bottom of the form.
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path === "/v1/content/geo") return json(route, geo);
    if (method === "GET" && path.endsWith("/preference-simulation/access")) {
      return json(route, simulationAccess);
    }
    if (method === "GET" && path.includes("/campus-experience")) {
      return json(route, campus);
    }
    if (method === "GET" && path === "/v1/content/geo/search") {
      return json(route, searchResult);
    }
    if (method === "GET" && path.endsWith("/programs")) {
      return json(route, programs);
    }
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
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
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
