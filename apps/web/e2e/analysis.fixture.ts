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
  nextFocus: null,
  personalRecordNet: null,
  ghost: null,
};

export const firstAnalysis: CoachingAnalysisDto = {
  ...emptyAnalysis,
  trend: [{
    id: "33333333-3333-4333-8333-333333333333",
    takenAt: "2026-07-13T10:00:00.000Z",
    totalNet: "42.00",
    examName: exam.name,
  }],
  subjects: [{
    subjectRef: "matematik",
    subjectName: "Matematik",
    averageNet: "12.00",
    attemptCount: 1,
    questionCount: 30,
    normalizedAveragePercent: "40.00",
  }],
  nextFocus: {
    subjectRef: "matematik",
    subjectName: "Matematik",
    source: "LOWEST_AVERAGE",
    evidenceCount: 1,
    evidenceLevel: "EARLY",
    message: "Matematik için küçük ve düzenli bir tekrar iyi bir başlangıç olabilir.",
    suggestedTaskTitle: "Matematik tekrarına başla",
    recentTrend: [{
      mockExamId: "33333333-3333-4333-8333-333333333333",
      takenAt: "2026-07-13T10:00:00.000Z",
      net: "12.00",
    }],
    recentDelta: null,
    trendDirection: "FIRST",
    trendMessage: "Bu ilk karşılaştırma noktan.",
  },
  personalRecordNet: "42.00",
};

export const multipleAnalysis: CoachingAnalysisDto = {
  ...firstAnalysis,
  trend: [{
    id: "44444444-4444-4444-8444-444444444444",
    takenAt: "2026-07-13T10:00:00.000Z",
    totalNet: "48.00",
    examName: exam.name,
  }, firstAnalysis.trend[0]!],
  photoSubjectSignals: [{ subjectRef: "matematik", subjectName: "Matematik", count: 3 }],
  photoTopicSignals: [{
    subjectRef: "matematik",
    subjectName: "Matematik",
    topicRef: "problemler",
    topicName: "Problemler",
    count: 3,
  }],
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
  period: { startDate: "2026-07-06", endDate: "2026-07-12", timeZone: "Europe/Istanbul" },
  status: "INSUFFICIENT",
  evidence: { mockExamCount: 0, completedSessionCount: 0 },
  rhythm: {
    completedSessionCount: 0,
    focusMinutes: 0,
    activeDays: 0,
    moodCheckinCount: 0,
    energySignal: null,
    message: "Bir küçük seansla bu haftanın ritmini başlatabilirsin.",
  },
  performance: null,
  focus: null,
  suggestedTask: null,
};

export const readyWeekly: WeeklyReviewDto = {
  ...insufficientWeekly,
  status: "READY",
  evidence: { mockExamCount: 1, completedSessionCount: 3 },
  rhythm: {
    completedSessionCount: 3,
    focusMinutes: 90,
    activeDays: 2,
    moodCheckinCount: 1,
    energySignal: "STEADY",
    message: "Dengeli bir ritim yakaladın.",
  },
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
  weeklyNarration?: WeeklyReviewNarrationDto;
}

export interface MockApiLog {
  requests: Array<{ method: string; path: string }>;
  unexpected: string[];
  weeklyCalls: number;
  photoAccessCalls: number;
}

export async function mockAnalysisApi(page: Page, options: MockApiOptions = {}): Promise<MockApiLog> {
  const authUser = options.authUser ?? user;
  const analysis = options.analysis ?? emptyAnalysis;
  const weekly = [...(options.weekly ?? [insufficientWeekly])];
  const log: MockApiLog = { requests: [], unexpected: [], weeklyCalls: 0, photoAccessCalls: 0 };

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname + url.search;
    const method = request.method();
    log.requests.push({ method, path });

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user: authUser });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, authUser);
    if (method === "GET" && path.startsWith("/v1/notifications?")) {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") {
      return json(route, { token: "test-stream" });
    }
    if (method === "GET" && path.startsWith("/v1/notifications/stream?")) {
      return route.fulfill({ status: 200, contentType: "text/event-stream", headers: corsHeaders, body: "" });
    }
    if (method === "GET" && path === "/v1/content/exams/by-type/KPSS/calendar") {
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
    if (method === "GET" && path === `/v1/content/exams/${exam.slug}/subjects`) return json(route, subjects);
    if (method === "GET" && path.startsWith("/v1/coaching/analysis?")) return json(route, analysis);
    if (method === "GET" && path.startsWith("/v1/mock-exams?")) {
      return json(route, { items: [], total: 0, page: 1, pageSize: 5 });
    }
    if (method === "GET" && path.startsWith("/v1/coaching/weekly-review?")) {
      log.weeklyCalls += 1;
      const response = weekly.shift() ?? readyWeekly;
      return response === "error"
        ? json(route, { code: "TEST_WEEKLY_ERROR", message: "Haftalık değerlendirme yüklenemedi." }, 503)
        : json(route, response);
    }
    if (method === "GET" && path === "/v1/coach/photo-access") {
      log.photoAccessCalls += 1;
      return json(route, options.photoAccess ?? { canCategorize: true, monthlyLimit: 10, remainingThisMonth: 7 });
    }
    if (method === "GET" && path.startsWith("/v1/economy/deep-analysis?")) {
      return options.deepAnalysis
        ? json(route, options.deepAnalysis)
        : json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    }
    if (
      method === "POST" &&
      path === "/v1/coach/weekly-review" &&
      options.weeklyNarration
    ) {
      return json(route, options.weeklyNarration);
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
