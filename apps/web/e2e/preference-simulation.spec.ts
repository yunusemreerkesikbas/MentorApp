import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AuthUser,
  CampusExperienceDto,
  GeoResponseDto,
  PreferenceSimulationAccessDto,
  PreferenceSimulationDto,
  ProgramCatalogSearchResponseDto,
} from "@mentor/types";

const universityId = "11111111-1111-4111-8111-111111111111";
const user: AuthUser = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "simulation@test.local",
  displayName: "Simulation Test",
  username: "simulation_test",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "YKS",
  examVariant: null,
  examDate: "2027-06-19",
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const dataset = {
  version: "yks-2026-guide-2025-placement-v1",
  examType: "YKS" as const,
  guideYear: 2026,
  placementYear: 2025,
  officialPreferenceLimit: 24,
  source: "ÖSYM 2026 YKS Kılavuzu",
  sourceUrl: "https://www.osym.gov.tr/",
  verifiedAt: "2026-08-02T00:00:00.000Z",
};

const access: PreferenceSimulationAccessDto = {
  enabled: true,
  reason: null,
  dataset,
};

const campus: CampusExperienceDto = {
  id: "22222222-2222-4222-8222-222222222222",
  universityId,
  universityName: "Selçuk Üniversitesi",
  coverageStatus: "PHOTOREALISTIC",
  renderMode: "PHOTOREALISTIC",
  initialCamera: {
    center: { lat: 38.024207, lng: 32.505705, altitude: 0 },
    heading: 20,
    tilt: 60,
    range: 2_200,
  },
  source: "Selçuk Üniversitesi",
  sourceUrl: "https://aday.selcuk.edu.tr/home/Kampuste_Yasam",
  verifiedAt: "2026-08-02T00:00:00.000Z",
  pois: Array.from({ length: 5 }, (_, index) => ({
    id: `33333333-3333-4333-8333-33333333333${index}`,
    slug: `durak-${index + 1}`,
    category: "CAMPUS",
    title: `Kampüs durağı ${index + 1}`,
    summary: `Doğrulanmış kampüs bilgisi ${index + 1}`,
    position: index + 1,
    camera: {
      center: {
        lat: 38.024207 + index * 0.001,
        lng: 32.505705 + index * 0.001,
        altitude: 0,
      },
      heading: index * 35,
      tilt: 60,
      range: 700,
    },
    sourceUrl: "https://aday.selcuk.edu.tr/home/Kampuste_Yasam",
    verifiedAt: "2026-08-02T00:00:00.000Z",
  })),
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
          id: universityId,
          name: "Selçuk Üniversitesi",
          slug: "selcuk-universitesi",
          kind: "STATE",
          foundedYear: 1975,
          websiteUrl: "https://www.selcuk.edu.tr/",
          latitude: 38.024207,
          longitude: 32.505705,
          programCount: 2,
        },
      ],
    },
  ],
  dataset: null,
  universitySource: {
    source: "ÖSYM",
    sourceUrl: "https://www.osym.gov.tr/",
    verifiedAt: "2026-08-02T00:00:00.000Z",
  },
};

const initialSimulation: PreferenceSimulationDto = {
  dataset,
  stale: false,
  refreshSummary: null,
  scenario: {
    id: "55555555-5555-4555-8555-555555555555",
    datasetVersion: dataset.version,
    ranks: { SAY: null, EA: null, SÖZ: null, DİL: null, TYT: null },
    revision: 1,
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    items: [],
  },
};

const search: ProgramCatalogSearchResponseDto = {
  dataset,
  page: 1,
  pageSize: 20,
  total: 1,
  items: [
    {
      code: "102210277",
      name: "Bilgisayar Mühendisliği",
      faculty: "Mühendislik Fakültesi",
      level: "LISANS",
      scoreType: "SAY",
      quota: 80,
      guideYear: 2026,
      placementYear: 2025,
      successRank: 48_250,
      universityId,
      universityName: "Selçuk Üniversitesi",
      cityCode: "42",
      cityName: "Konya",
    },
  ],
};

test("kampüs turu, tercih ekleme ve autosave harita hatasında da çalışır", async ({ page }) => {
  const api = await mockApi(page);
  await page.goto(`/hedef/simulasyon?universityId=${universityId}`);

  await expect(page.getByTestId("campus-map-fallback")).toBeVisible();
  await expect(page.getByText("Kampüs durağı 1")).toBeVisible();
  await page.getByRole("button", { name: "Sonraki durak" }).click();
  await expect(page.getByText("Doğrulanmış kampüs bilgisi 2")).toBeVisible();

  await page.getByRole("tab", { name: "Tercihler" }).click();
  await page.getByLabel("SAY").fill("42000");
  await page.getByLabel("Tüm YKS programlarında ara").fill("bilgisayar");
  await expect(page.getByText("Bilgisayar Mühendisliği")).toBeVisible();
  await page.getByRole("button", { name: "Ekle" }).click();

  await expect.poll(() => api.savedBodies.length).toBeGreaterThan(0);
  expect(api.savedBodies.at(-1)).toMatchObject({
    expectedRevision: 1,
    ranks: { SAY: 42000 },
    programCodes: ["102210277"],
  });
  await expect(page.getByText(/Fark: \+6[.,]250/)).toBeVisible();
});

async function mockApi(page: Page) {
  const savedBodies: Array<Record<string, unknown>> = [];
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
    if (method === "GET" && path === "/v1/notifications") {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") {
      return json(route, { token: "test-stream" });
    }
    if (method === "GET" && path === "/v1/notifications/stream") {
      return route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
    }
    if (method === "GET" && path.endsWith("/preference-simulation/access")) {
      return json(route, access);
    }
    if (method === "GET" && path === "/v1/coaching/preference-simulation") {
      return json(route, initialSimulation);
    }
    if (method === "PUT" && path === "/v1/coaching/preference-simulation") {
      const body = request.postDataJSON() as Record<string, unknown> & {
        ranks: Record<string, number | null>;
      };
      savedBodies.push(body);
      return json(route, {
        ...initialSimulation,
        scenario: {
          ...initialSimulation.scenario!,
          revision: 2,
          ranks: { ...initialSimulation.scenario!.ranks, ...body.ranks },
          items: [
            {
              snapshot: {
                ...search.items[0],
                position: 1,
                source: dataset.source,
                sourceUrl: dataset.sourceUrl,
                verifiedAt: dataset.verifiedAt,
              },
              comparison: {
                status: "COMPARED",
                userRank: 42_000,
                cutoffRank: 48_250,
                delta: 6_250,
                direction: "AHEAD",
              },
            },
          ],
        },
      });
    }
    if (method === "GET" && path.includes("/campus-experience")) {
      return json(route, campus);
    }
    if (method === "GET" && path === "/v1/content/geo") return json(route, geo);
    if (method === "GET" && path === "/v1/content/programs/search") {
      return json(route, search);
    }
    return json(route, null, 204);
  });

  return { savedBodies };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": "http://localhost:3100",
      "access-control-allow-credentials": "true",
    },
    body: body == null ? "" : JSON.stringify(body),
  });
}
