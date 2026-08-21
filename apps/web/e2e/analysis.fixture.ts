import type {
  AuthUser,
  CoachingAnalysisDto,
  DeepAnalysisView,
  ExamCalendarDto,
  ExamSubjectDto,
  PhotoAccessDto,
  WeeklyReviewDto,
  WeeklyReviewNarrationDto,
} from "@mentor/types";
import type { Page, Route } from "@playwright/test";

export const exam = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "kpss-lisans-2026",
  name: "KPSS Lisans 2026",
  family: "KPSS",
  variant: "LISANS",
  isCurrent: true,
} as const;

export const subjects: ExamSubjectDto[] = [
  { slug: "matematik", name: "Matematik", questionCount: 30, sortOrder: 1 },
  { slug: "tarih", name: "Tarih", questionCount: 27, sortOrder: 2 },
];

export const user: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "analiz@test.local",
  displayName: "Analiz Test",
  username: "analysis_test",
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

export const emptyAnalysis: CoachingAnalysisDto = {
  trend: [],
  subjects: [],
  photoSubjectSignals: [],
  photoTopicSignals: [],
  notebookErrorSignals: [],
  notebookErrorMessage: null,
  nextFocus: null,
  personalRecordNet: null,
  ghost: null,
};

export const firstAnalysis: CoachingAnalysisDto = {
  ...emptyAnalysis,
  trend: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      takenAt: "2026-07-13T10:00:00.000Z",
      totalNet: "42.00",
      examName: exam.name,
    },
  ],
  subjects: [
    {
      subjectRef: "matematik",
      subjectName: "Matematik",
      averageNet: "12.00",
      attemptCount: 1,
      questionCount: 30,
      normalizedAveragePercent: "40.00",
      recentAverageNet: "12.00",
      netDelta: "0.00",
    },
  ],
  nextFocus: {
    subjectRef: "matematik",
    subjectName: "Matematik",
    source: "LOWEST_AVERAGE",
    evidenceCount: 1,
    evidenceLevel: "EARLY",
    message:
      "Matematik için küçük ve düzenli bir tekrar iyi bir başlangıç olabilir.",
    suggestedTaskTitle: "Matematik tekrarına başla",
    recentTrend: [
      {
        mockExamId: "33333333-3333-4333-8333-333333333333",
        takenAt: "2026-07-13T10:00:00.000Z",
        net: "12.00",
      },
    ],
    recentDelta: null,
    trendDirection: "FIRST",
    trendMessage: "Bu ilk karşılaştırma noktan.",
  },
  personalRecordNet: "42.00",
};

export const multipleAnalysis: CoachingAnalysisDto = {
  ...firstAnalysis,
  trend: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      takenAt: "2026-07-13T10:00:00.000Z",
      totalNet: "48.00",
      examName: exam.name,
    },
    firstAnalysis.trend[0]!,
  ],
  photoSubjectSignals: [
    { subjectRef: "matematik", subjectName: "Matematik", count: 3 },
  ],
  photoTopicSignals: [
    {
      subjectRef: "matematik",
      subjectName: "Matematik",
      topicRef: "problemler",
      topicName: "Problemler",
      count: 3,
    },
  ],
  nextFocus: {
    ...firstAnalysis.nextFocus!,
    topicRef: "problemler",
    topicName: "Problemler",
    source: "PHOTO_SIGNAL",
    evidenceCount: 3,
    evidenceLevel: "REPEATED",
    suggestedTaskTitle: "Problemler konusunu tekrar et",
    recentDelta: "+4.00",
    trendDirection: "UP",
  },
  personalRecordNet: "48.00",
  ghost: {
    latest: {
      id: "44444444-4444-4444-8444-444444444444",
      takenAt: "2026-07-13T10:00:00.000Z",
      totalNet: "48.00",
      examName: exam.name,
    },
    previousNet: "42.00",
    previousDelta: "+6.00",
    beatPrevious: true,
    bestPreviousNet: "42.00",
    recordDelta: "+6.00",
    isNewRecord: true,
    headline: "Kendi ritminin önüne geçtin.",
    subjects: [],
    aiNarration: null,
  },
};

export const insufficientWeekly: WeeklyReviewDto = {
  period: {
    startDate: "2026-07-06",
    endDate: "2026-07-12",
    timeZone: "Europe/Istanbul",
  },
  status: "INSUFFICIENT",
  recap: {
    status: "EMPTY",
    activeDays: 0,
    weeklyTitle: null,
    nextStorySignal: null,
    nextStorySignals: [],
    closingMessage: "Yeni haftada tek bir küçük adım yeterli.",
  },
  evidence: {
    mockExamCount: 0,
    completedSessionCount: 0,
    qualifyingSessionCount: 0,
    completedPlanTaskCount: 0,
  },
  rhythm: {
    completedSessionCount: 0,
    focusMinutes: 0,
    activeDays: 0,
    longestSessionMinutes: 0,
    longestActiveRun: 0,
    focusTimeBand: null,
    peakFocusDay: null,
    days: [],
    subjectBreakdown: [],
    moodCheckinCount: 0,
    energySignal: null,
    message: "Bir küçük seansla bu haftanın ritmini başlatabilirsin.",
  },
  plan: {
    completedTaskCount: 0,
    subjectBreakdown: [],
    message: "Yeni haftada tek bir görevle başlayabilirsin.",
  },
  highlights: [],
  performance: null,
  focus: null,
  suggestedTask: null,
};

export const readyWeekly: WeeklyReviewDto = {
  ...insufficientWeekly,
  status: "READY",
  recap: {
    status: "READY",
    activeDays: 5,
    weeklyTitle: {
      id: "FOCUS_DIVER",
      label: "Nebula Dalgıcı",
      message: "En uzun seansında 80 dakika derinleştin.",
    },
    nextStorySignal: null,
    nextStorySignals: [],
    closingMessage: "Bu haftanın hikâyesini sen yazdın.",
  },
  evidence: {
    mockExamCount: 1,
    completedSessionCount: 5,
    qualifyingSessionCount: 5,
    completedPlanTaskCount: 4,
  },
  rhythm: {
    completedSessionCount: 5,
    focusMinutes: 265,
    activeDays: 5,
    longestSessionMinutes: 80,
    longestActiveRun: 4,
    focusTimeBand: {
      id: "MORNING",
      label: "Sabah modu",
      focusMinutes: 190,
      qualifyingSessionCount: 3,
      message: "Sabah modu başrolü aldı: 190 dakika odak.",
    },
    peakFocusDay: {
      date: "2026-07-07",
      focusMinutes: 80,
      message: "Güç gününde 80 dakika odağı topladın.",
    },
    days: [
      { date: "2026-07-06", active: true },
      { date: "2026-07-07", active: true },
      { date: "2026-07-08", active: true },
      { date: "2026-07-09", active: true },
      { date: "2026-07-10", active: false },
      { date: "2026-07-11", active: true },
      { date: "2026-07-12", active: false },
    ],
    subjectBreakdown: [
      {
        subjectRef: "matematik",
        subjectName: "Matematik",
        focusMinutes: 190,
        qualifyingSessionCount: 3,
      },
      {
        subjectRef: "tarih",
        subjectName: "Tarih",
        focusMinutes: 45,
        qualifyingSessionCount: 1,
      },
      {
        subjectRef: "cografya",
        subjectName: "Coğrafya",
        focusMinutes: 30,
        qualifyingSessionCount: 1,
      },
    ],
    moodCheckinCount: 1,
    energySignal: "STEADY",
    message: "Dengeli bir ritim yakaladın.",
  },
  plan: {
    completedTaskCount: 4,
    subjectBreakdown: [
      {
        subjectRef: "matematik",
        subjectName: "Matematik",
        completedTaskCount: 2,
      },
      {
        subjectRef: "tarih",
        subjectName: "Tarih",
        completedTaskCount: 1,
      },
      {
        subjectRef: "cografya",
        subjectName: "Coğrafya",
        completedTaskCount: 1,
      },
    ],
    message: "Planındaki 4 küçük adımı tamamladın.",
  },
  highlights: [
    {
      kind: "POSITIVE_COMPARISON",
      metric: "ACTIVE_DAYS",
      current: 5,
      previous: 3,
      delta: 2,
      message: "Geçen haftaya göre 2 gün daha fazla ritim kurdun.",
    },
    {
      kind: "LONGEST_SESSION",
      minutes: 80,
      message: "Tek seferde 80 dakika odağını korudun.",
    },
  ],
  performance: {
    mockExamCount: 1,
    averageNet: "48.00",
    previousWeekAverageNet: "42.00",
    delta: "+6.00",
    evidenceLevel: "COMPARABLE",
    message: "Kendi geçmişine göre ilerleme var.",
  },
  focus: {
    source: "REPEATED_PHOTO_SIGNAL",
    subjectRef: "matematik",
    subjectName: "Matematik",
    message: "Problemler için kısa bir tekrar planla.",
  },
  suggestedTask: {
    title: "Matematik haftalık tekrar",
    subject: "Matematik",
  },
};

interface MockApiOptions {
  authUser?: AuthUser;
  analysis?: CoachingAnalysisDto;
  weekly?: Array<WeeklyReviewDto | "error">;
  photoAccess?: PhotoAccessDto;
  deepAnalysis?: DeepAnalysisView;
  deepAnalysisPurchase?: DeepAnalysisView;
  weeklyNarration?: WeeklyReviewNarrationDto | "error";
}

export interface MockApiLog {
  requests: Array<{ method: string; path: string }>;
  unexpected: string[];
  weeklyCalls: number;
  photoAccessCalls: number;
  /** Mock exams saved through the form — what the notebook handoff hangs off. */
  createdMockExams: Record<string, unknown>[];
}

export async function mockAnalysisApi(
  page: Page,
  options: MockApiOptions = {},
): Promise<MockApiLog> {
  const authUser = options.authUser ?? user;
  const analysis = options.analysis ?? emptyAnalysis;
  const weekly = [...(options.weekly ?? [insufficientWeekly])];
  const log: MockApiLog = {
    requests: [],
    unexpected: [],
    weeklyCalls: 0,
    photoAccessCalls: 0,
    createdMockExams: [],
  };

  await page.addInitScript(() => {
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
  });
  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname + url.search;
    const method = request.method();
    log.requests.push({ method, path });

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, {
        accessToken: "test-token",
        expiresIn: 3600,
        user: authUser,
      });
    }
    if (method === "GET" && path === "/v1/users/me")
      return json(route, authUser);
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
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: corsHeaders,
        body: "",
      });
    }
    if (
      method === "GET" &&
      path === "/v1/content/exams/by-type/KPSS/calendar"
    ) {
      const calendar: ExamCalendarDto = {
        exam,
        events: [],
        examDateLabel: "26 Temmuz 2026",
        daysRemaining: 10,
        nextEvent: null,
        daysUntilNextEvent: null,
      };
      return json(route, calendar);
    }
    if (method === "GET" && path === `/v1/content/exams/${exam.slug}/subjects`)
      return json(route, subjects);
    if (method === "GET" && path.startsWith("/v1/coaching/analysis?"))
      return json(route, analysis);
    if (method === "GET" && path.startsWith("/v1/mock-exams?")) {
      return json(route, { items: [], total: 0, page: 1, pageSize: 5 });
    }
    if (method === "GET" && path.startsWith("/v1/coaching/weekly-review?")) {
      log.weeklyCalls += 1;
      const response =
        weekly.length > 1 ? weekly.shift()! : (weekly[0] ?? insufficientWeekly);
      return response === "error"
        ? json(
            route,
            {
              code: "TEST_WEEKLY_ERROR",
              message: "Haftalık değerlendirme yüklenemedi.",
            },
            503,
          )
        : json(route, response);
    }
    if (method === "GET" && path === "/v1/coach/photo-access") {
      log.photoAccessCalls += 1;
      return json(
        route,
        options.photoAccess ?? {
          canCategorize: true,
          monthlyLimit: 10,
          remainingThisMonth: 7,
        },
      );
    }
    if (method === "GET" && path.startsWith("/v1/economy/deep-analysis?")) {
      return options.deepAnalysis
        ? json(route, options.deepAnalysis)
        : json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }
    if (method === "POST" && path === "/v1/economy/deep-analysis") {
      return options.deepAnalysisPurchase
        ? json(route, options.deepAnalysisPurchase)
        : json(
            route,
            { code: "TEST_PURCHASE_UNAVAILABLE", message: "Kapalı" },
            503,
          );
    }
    if (method === "POST" && path === "/v1/coach/weekly-review") {
      return options.weeklyNarration === "error" || !options.weeklyNarration
        ? json(
            route,
            { code: "TEST_AI_ERROR", message: "AI notu hazırlanamadı." },
            503,
          )
        : json(route, options.weeklyNarration);
    }

    // Saving a mock exam is what hands the student over to the notebook, so this fixture has to be
    // able to accept one.
    if (method === "POST" && path === "/v1/mock-exams") {
      log.createdMockExams.push(request.postDataJSON() as Record<string, unknown>);
      return json(route, {
        id: "12121212-1212-4121-8121-121212121212",
        totalNet: 42,
      });
    }

    if (/^\/v1\/(coaching|mock-exams|coach|plan-tasks)/.test(path)) {
      log.unexpected.push(`${method} ${path}`);
    }
    return json(route, { code: "TEST_UNEXPECTED_REQUEST", message: path }, 501);
  });

  return log;
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
