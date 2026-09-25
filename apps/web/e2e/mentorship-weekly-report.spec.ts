import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser, MentorshipWeeklySnapshotDto } from "@mentor/types";

const COACH_ID = "11111111-1111-4111-8111-111111111111";
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const REPORT_ID = "55555555-5555-4555-8555-555555555555";
const SOURCE_FINGERPRINT = "a".repeat(64);

const snapshot: MentorshipWeeklySnapshotDto = {
  period: {
    startDate: "2026-08-31",
    endDate: "2026-09-06",
    previousStartDate: "2026-08-24",
    previousEndDate: "2026-08-30",
    timeZone: "Europe/Istanbul",
  },
  current: {
    focusMinutes: 180,
    sessions: 5,
    activeDays: 4,
    plannedTasks: 6,
    completedTasks: 4,
    completionRate: 2 / 3,
    hasRecordedActivity: true,
  },
  previous: {
    focusMinutes: 120,
    sessions: 4,
    activeDays: 3,
    plannedTasks: 0,
    completedTasks: 0,
    completionRate: null,
    hasRecordedActivity: true,
  },
  deltas: {
    focusMinutes: 60,
    sessions: 1,
    activeDays: 1,
    plannedTasks: 6,
    completedTasks: 4,
    completionRate: null,
  },
  subjects: [
    {
      subjectRef: "turkce",
      currentFocusMinutes: 120,
      previousFocusMinutes: 60,
      currentSessions: 3,
      previousSessions: 2,
    },
  ],
  mocks: {
    examScopeName: "KPSS Lisans",
    currentAttemptCount: 1,
    previousAttemptCount: 1,
    currentAverageNet: 61.5,
    previousAverageNet: 58,
    currentPublishers: ["Örnek Yayınları"],
    previousPublishers: ["Başlangıç Yayınları"],
    subjects: [],
  },
  evidence: [
    {
      id: "focus_minutes",
      kind: "FOCUS_MINUTES",
      current: 180,
      previous: 120,
      delta: 60,
    },
  ],
  limitations: [],
};

/** Names sit beside the snapshot, never inside it: the fingerprint hashes the snapshot. */
const subjectNames = { turkce: "Türkçe" };

const brief = {
  findings: [
    {
      observation: "Kayıtlı çalışma süresi arttı.",
      evidenceIds: ["focus_minutes"],
      uncertainty: "Kayıtlar çalışmanın niteliğini tek başına göstermez.",
      conversationQuestion: "Bu artışı destekleyen koşullar nelerdi?",
    },
  ],
  model: "test-model",
  generatedAt: "2026-09-07T10:00:00.000Z",
  locale: "tr" as const,
  promptVersion: "v1",
};

test("koç haftalık raporu açık istekle hazırlar ve sonlandırır", async ({
  page,
}) => {
  const api = await mockWeeklyReportApi(page);
  await page.goto(`/kocluk/${STUDENT_ID}`);

  const section = page.getByRole("region", { name: "Haftalık değerlendirme" });
  await expect(section).toBeVisible();
  // Honest copy, no metric tiles: the numbers live in the panel, the PDF is the coach's to send.
  await expect(section.getByText("Taslak")).toBeVisible();
  await expect(section.getByText("PDF'i Ayşe'ye sen ilet.", { exact: false })).toBeVisible();
  await expect(section.getByText("180 dk")).toHaveCount(0);
  await expect(
    section.getByRole("button", { name: "Değerlendirmeyi aç" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(api.briefCalls).toBe(0);

  await section.getByRole("button", { name: "Değerlendirmeyi aç" }).click();
  const panel = page.getByRole("dialog", { name: "Haftalık değerlendirme" });
  await expect(panel).toBeVisible();
  // The canvas table: this week against the one before; sessions and plan percentages stay in the PDF.
  await expect(panel.getByRole("rowheader", { name: "Tamamlanan görev" })).toBeVisible();
  await expect(panel.getByRole("cell", { name: "3 sa", exact: true })).toBeVisible();
  await expect(panel.getByText("Seans", { exact: true })).toHaveCount(0);
  // The subject's name, never its slug.
  await expect(panel.getByText("Türkçe", { exact: true })).toBeVisible();
  await expect(panel.getByText("turkce")).toHaveCount(0);

  await panel.getByRole("button", { name: "Hazırlık oluştur" }).click();
  await expect(panel.getByText("Kayıtlı çalışma süresi arttı.")).toBeVisible();
  expect(api.briefCalls).toBe(1);

  await panel
    .getByLabel("Öğrenciyle paylaşılacak değerlendirme")
    .fill("Ritmi birlikte koruyalım.");
  await panel.getByRole("button", { name: "Raporu sonlandır" }).click();
  await expect(
    panel.getByRole("link", { name: "Sonlandırılan raporu aç" }),
  ).toBeVisible();
  await expect.poll(() => api.finalizeBodies.length).toBe(1);
  expect(api.finalizeBodies[0]).toMatchObject({
    weekStart: "2026-08-31",
    sourceFingerprint: SOURCE_FINGERPRINT,
    coachEvaluation: "Ritmi birlikte koruyalım.",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("görüşme hazırlığı yönlendirmeyi korur, değişikliği belirtir ve haftalar arasında taşımaz", async ({
  page,
}) => {
  const api = await mockWeeklyReportApi(page, { preparation: true });
  await page.goto(`/kocluk/${STUDENT_ID}`);
  const open = page.getByRole("button", { name: "Değerlendirmeyi aç" });
  await open.click();
  const panel = page.getByRole("dialog", { name: "Haftalık değerlendirme" });
  // The focus waits behind its link; once written, the panel opens with it showing.
  await panel.getByRole("button", { name: "Odak konusu ekle (isteğe bağlı)" }).click();
  const context = panel.getByLabel("Bu görüşmede odaklanmak istediğin konu");
  await expect(context).toHaveAttribute("maxlength", "500");
  await context.fill("Program yoğunluğunu konuşacağız.");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await open.click();
  await expect(context).toHaveValue("Program yoğunluğunu konuşacağız.");
  await panel.getByRole("button", { name: "Hazırlık oluştur" }).click();
  await expect(
    panel.getByRole("heading", { name: "Görüşmenin odağı" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("heading", { name: "Olası sonraki adım" }),
  ).toBeVisible();
  expect(api.briefBodies[0]).toMatchObject({
    coachContext: "Program yoğunluğunu konuşacağız.",
  });
  await context.fill("Yeni yönlendirme");
  await expect(panel.getByRole("status")).toContainText(
    "önceki yönlendirmeye ait",
  );
  await panel.getByRole("button", { name: "Hazırlığı güncelle" }).click();
  await expect(
    panel.getByText("Bu hazırlıkta kullandığın yönlendirme: Yeni yönlendirme"),
  ).toBeVisible();
  await page.reload();
  await open.click();
  await expect(context).toHaveValue("Yeni yönlendirme");
  await panel
    .getByRole("button", { name: "Önceki hafta", exact: true })
    .click();
  await expect(context).toHaveValue("");
  await expect(
    panel.getByRole("heading", { name: "Görüşmenin odağı" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("panelde başka haftaya bakmak kartın haftasını değiştirmez", async ({
  page,
}) => {
  await mockWeeklyReportApi(page);
  await page.goto(`/kocluk/${STUDENT_ID}`);
  const section = page.getByRole("region", { name: "Haftalık değerlendirme" });
  // The latest week, 31 August to 6 September.
  await expect(section).toContainText("6 Eylül");
  await section.getByRole("button", { name: "Değerlendirmeyi aç" }).click();
  const panel = page.getByRole("dialog", { name: "Haftalık değerlendirme" });
  await panel.getByRole("button", { name: "Önceki hafta", exact: true }).click();
  await expect(panel).toContainText("24");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(section).toContainText("6 Eylül");
  await expect(section).not.toContainText("24 Ağustos");
});

test("yazdırma görünümü yalnız paylaşılabilir sözleşmeyi kullanır", async ({
  page,
}) => {
  const api = await mockWeeklyReportApi(page);
  await page.goto(
    `/kocluk/${STUDENT_ID}/haftalik-raporlar/${REPORT_ID}/yazdir`,
  );

  await expect(
    page.getByRole("heading", { name: "Haftalık öğrenci değerlendirmesi" }),
  ).toBeVisible();
  await expect(page.getByText("Ritmi birlikte koruyalım.")).toBeVisible();
  await expect(page.getByText("Hazırlayan: Koç Deniz")).toBeVisible();
  await expect(page.getByText("Türkçe", { exact: true })).toBeVisible();
  await expect(page.getByText("turkce")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "PDF indir" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Yazdır" })).toBeVisible();
  await expect(page.getByText("ÖZEL AI NOTU")).toHaveCount(0);
  expect(
    api.requestedPaths.some((path) => path.endsWith(`/${REPORT_ID}/share`)),
  ).toBe(true);
  expect(
    api.requestedPaths.some((path) => path.endsWith(`/${REPORT_ID}`)),
  ).toBe(false);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF indir" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "ayse-yilmaz-haftalik-degerlendirme-2026-08-31.pdf",
  );

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".weekly-report-print-toolbar")).toHaveCSS(
    "display",
    "none",
  );
});

test("detay raporu başarısız olduğunda isteği sonsuz tekrarlamaz", async ({
  page,
}) => {
  const api = await mockWeeklyReportApi(page, { failStudentReport: true });

  await page.goto(`/kocluk/${STUDENT_ID}`);
  // Said in place, with one way to ask again; never a loop of requests.
  await expect(
    page.getByRole("alert").filter({ hasText: "Öğrencinin raporu açılamadı." }),
  ).toBeVisible();
  await expect.poll(() => api.studentReportCalls).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  const settledCalls = api.studentReportCalls;
  expect(settledCalls).toBeLessThanOrEqual(2);
  await page.waitForTimeout(1_000);
  expect(api.studentReportCalls).toBe(settledCalls);
});

test("haftalık rapor başarısız olduğunda isteği sonsuz tekrarlamaz", async ({
  page,
}) => {
  const api = await mockWeeklyReportApi(page, { failWeeklyPreview: true });

  await page.goto(`/kocluk/${STUDENT_ID}`);
  await expect(page.getByText("Ayşe Yılmaz").first()).toBeVisible();
  // Said in the card, with its retry; no toast on top of it.
  await expect(
    page
      .getByRole("region", { name: "Haftalık değerlendirme" })
      .getByText("Haftalık değerlendirme açılamadı."),
  ).toBeVisible();
  await expect(page.getByText("Bir sorun oluştu")).toHaveCount(0);
  await expect.poll(() => api.weeklyPreviewCalls).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  const settledCalls = api.weeklyPreviewCalls;
  expect(settledCalls).toBeLessThanOrEqual(2);
  await page.waitForTimeout(1_000);
  expect(api.weeklyPreviewCalls).toBe(settledCalls);
});

async function mockWeeklyReportApi(
  page: Page,
  options: {
    failStudentReport?: boolean;
    failWeeklyPreview?: boolean;
    preparation?: boolean;
  } = {},
) {
  const user: AuthUser = {
    id: COACH_ID,
    email: "koc@test.local",
    displayName: "Koç Deniz",
    username: "deniz",
    avatarUrl: null,
    bio: null,
    website: null,
    roles: ["COACH"],
    organizationId: null,
    examType: "KPSS",
    examVariant: "LISANS",
    examDate: "2026-07-26",
    dailyFocusGoalMinutes: null,
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  let briefCalls = 0;
  let usedContext: string | null = null;
  const briefBodies: Record<string, unknown>[] = [];
  let finalized = false;
  const finalizeBodies: Record<string, unknown>[] = [];
  const requestedPaths: string[] = [];
  let studentReportCalls = 0;
  let weeklyPreviewCalls = 0;

  const preview = (
    withBrief: boolean,
    weekStart = snapshot.period.startDate,
  ) => ({
    draftId: "44444444-4444-4444-8444-444444444444",
    studentId: STUDENT_ID,
    studentDisplayName: "Ayşe Yılmaz",
    sourceFingerprint: SOURCE_FINGERPRINT,
    status: withBrief ? "BRIEF_READY" : "DRAFT",
    snapshot: {
      ...snapshot,
      period: { ...snapshot.period, startDate: weekStart },
    },
    subjectNames,
    coachContext: withBrief ? usedContext : null,
    brief: withBrief
      ? {
          ...brief,
          coachContext: usedContext,
          ...(options.preparation
            ? {
                preparation: {
                  version: 1,
                  focus: {
                    text: "Programın uygulanabilirliğini birlikte değerlendir.",
                    evidenceIds: ["focus_minutes"],
                  },
                  progress: null,
                  uncertainty: "Kayıtlı süre öğrenmenin niteliğini göstermez.",
                  question: "Bu haftaki program sana nasıl geldi?",
                  nextStep:
                    "Yoğunluk zorladıysa öncelikleri birlikte daraltmayı değerlendir.",
                },
              }
            : {}),
        }
      : null,
  });
  const finalizedReport = {
    id: REPORT_ID,
    studentId: STUDENT_ID,
    studentDisplayName: "Ayşe Yılmaz",
    locale: "tr",
    period: snapshot.period,
    version: 1,
    sourceFingerprint: SOURCE_FINGERPRINT,
    snapshot,
    subjectNames,
    brief,
    coachEvaluation: "Ritmi birlikte koruyalım.",
    replacesId: null,
    finalizedAt: "2026-09-07T10:00:00.000Z",
  };

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    requestedPaths.push(url.pathname);

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && url.pathname === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (method === "GET" && url.pathname === "/v1/users/me")
      return json(route, user);
    if (method === "GET" && url.pathname.startsWith("/v1/notifications")) {
      return json(route, {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        unreadCount: 0,
      });
    }
    if (
      method === "POST" &&
      url.pathname === "/v1/notifications/stream-token"
    ) {
      return json(route, { token: "test-stream" });
    }
    if (method === "GET" && url.pathname.includes("/followups")) {
      return json(route, { items: [], total: 0, page: 1, pageSize: 10 });
    }
    if (
      method === "GET" &&
      url.pathname === `/v1/mentorship/students/${STUDENT_ID}`
    ) {
      studentReportCalls += 1;
      if (options.failStudentReport) {
        return json(
          route,
          { code: "INTERNAL_ERROR", message: "Bir şeyler ters gitti." },
          500,
        );
      }
      return json(route, studentReport());
    }
    if (
      method === "GET" &&
      url.pathname ===
        `/v1/mentorship/students/${STUDENT_ID}/weekly-reports/preview`
    ) {
      weeklyPreviewCalls += 1;
      if (options.failWeeklyPreview) {
        return json(
          route,
          { code: "INTERNAL_ERROR", message: "Bir şeyler ters gitti." },
          500,
        );
      }
      return json(
        route,
        preview(
          briefCalls > 0 &&
            (!url.searchParams.get("weekStart") ||
              url.searchParams.get("weekStart") === snapshot.period.startDate),
          url.searchParams.get("weekStart") ?? snapshot.period.startDate,
        ),
      );
    }
    if (
      method === "POST" &&
      url.pathname ===
        `/v1/mentorship/students/${STUDENT_ID}/weekly-reports/brief`
    ) {
      briefBodies.push(request.postDataJSON() as Record<string, unknown>);
      usedContext =
        (briefBodies.at(-1)?.coachContext as string | undefined)?.trim() ||
        null;
      briefCalls += 1;
      return json(route, preview(true), 202);
    }
    if (
      method === "POST" &&
      url.pathname ===
        `/v1/mentorship/students/${STUDENT_ID}/weekly-reports/finalize`
    ) {
      finalizeBodies.push(request.postDataJSON() as Record<string, unknown>);
      finalized = true;
      return json(route, finalizedReport, 201);
    }
    if (
      method === "GET" &&
      url.pathname === `/v1/mentorship/students/${STUDENT_ID}/weekly-reports`
    ) {
      return json(route, {
        items: finalized
          ? [
              {
                id: REPORT_ID,
                locale: "tr",
                period: snapshot.period,
                version: 1,
                finalizedAt: finalizedReport.finalizedAt,
                replacesId: null,
              },
            ]
          : [],
        total: finalized ? 1 : 0,
        page: 1,
        pageSize: 20,
      });
    }
    if (
      method === "GET" &&
      url.pathname ===
        `/v1/mentorship/students/${STUDENT_ID}/weekly-reports/${REPORT_ID}/share`
    ) {
      const safeSnapshot = {
        period: snapshot.period,
        current: snapshot.current,
        previous: snapshot.previous,
        deltas: snapshot.deltas,
        subjects: snapshot.subjects,
        mocks: snapshot.mocks,
        limitations: snapshot.limitations,
      };
      return json(route, {
        id: REPORT_ID,
        locale: "tr",
        studentDisplayName: "Ayşe Yılmaz",
        coachDisplayName: "Koç Deniz",
        period: snapshot.period,
        version: 1,
        finalizedAt: finalizedReport.finalizedAt,
        snapshot: safeSnapshot,
        subjectNames,
        coachEvaluation: "Ritmi birlikte koruyalım.",
      });
    }
    return json(route, null, 204);
  });

  return {
    get briefCalls() {
      return briefCalls;
    },
    get studentReportCalls() {
      return studentReportCalls;
    },
    get weeklyPreviewCalls() {
      return weeklyPreviewCalls;
    },
    briefBodies,
    finalizeBodies,
    requestedPaths,
  };
}

function studentReport() {
  return {
    studentId: STUDENT_ID,
    studentDisplayName: "Ayşe Yılmaz",
    studentUsername: "ayse",
    acceptedAt: "2026-09-01T10:00:00.000Z",
    studentExamType: "KPSS",
    coachNote: null,
    riskFlags: [],
    attendedAt: null,
    needsAttention: false,
    activity: {
      lastActiveDate: "2026-09-06",
      currentStreak: 3,
      longestStreak: 9,
      sessions7d: 5,
      focusMinutes7d: 180,
      activeDays7d: 4,
      sessions28d: 12,
      focusMinutes28d: 640,
      activeDays28d: 11,
    },
    dailyFocusMinutes28d: Array.from({ length: 28 }, (_, day) => (day % 2 === 0 ? 40 : 0)),
    planCompletionRate7d: 2 / 3,
    mockTrend: [],
    latestMockSubjects: [],
    planTasks: [],
    droppedAssignments: [],
    moodTrend: [],
  };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin":
        route.request().headers()["origin"] ?? "http://localhost:3100",
      "access-control-allow-credentials": "true",
    },
    body: body == null ? "" : JSON.stringify(body),
  });
}
