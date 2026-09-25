import type { Page } from "@playwright/test";
import type {
  AuthUser,
  MentorshipFollowupDto,
  MentorshipStudentReportDto,
  MentorshipWeeklySnapshotDto,
} from "@mentor/types";

/**
 * The coach's student page (redesigned 2026-09-25), mocked end to end: the report, the assistant's
 * brief, the note, the mark, the follow-ups and the weekly report. Dates are built around today on
 * the Istanbul calendar, the API's day cut, so the week drawn is always the current one.
 */

export const COACH: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "koc@test.local",
  displayName: "Mert Aydın",
  username: "kocmert",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT", "COACH"],
  organizationId: null,
  examType: "KPSS",
  examVariant: "LISANS",
  examDate: null,
  dailyFocusGoalMinutes: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

export const ALI_ID = "44444444-4444-4444-8444-444444444444";

export function istanbulToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function shiftDay(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function mondayOf(iso: string): string {
  const weekday = new Date(`${iso}T00:00:00.000Z`).getUTCDay();
  return shiftDay(iso, -((weekday + 6) % 7));
}

const TODAY = istanbulToday();
const MONDAY = mondayOf(TODAY);

type Task = MentorshipStudentReportDto["planTasks"][number];
const task = (taskDate: string, title: string, over: Partial<Task> = {}): Task => ({
  taskDate,
  title,
  subject: null,
  topic: null,
  status: "PENDING",
  assignedByCoach: true,
  coachNote: null,
  ...over,
});

/** A student with a full month behind them: a flag, a plan, five exams, a note. */
export function richReport(over: Partial<MentorshipStudentReportDto> = {}): MentorshipStudentReportDto {
  return {
    studentId: ALI_ID,
    studentDisplayName: "Ali Demir",
    studentUsername: "alidemir",
    acceptedAt: "2026-09-02T10:00:00.000Z",
    studentExamType: "KPSS",
    coachNote: {
      body: "Denemeden önceki gün dinlen. Paragrafı sabah, tarihi akşam çalış.",
      updatedAt: `${shiftDay(TODAY, -6)}T09:00:00.000Z`,
    },
    riskFlags: ["NET_DROP"],
    attendedAt: null,
    needsAttention: true,
    activity: {
      lastActiveDate: TODAY,
      currentStreak: 1,
      longestStreak: 9,
      sessions7d: 5,
      focusMinutes7d: 150,
      activeDays7d: 3,
      sessions28d: 24,
      focusMinutes28d: 1050,
      activeDays28d: 18,
    },
    dailyFocusMinutes28d: [
      60, 45, 0, 90, 30, 0, 20, 75, 50, 0, 45, 80, 0, 35, 90, 60, 40, 0, 55, 25, 0, 45, 80, 0, 25, 0,
      0, 25,
    ],
    planCompletionRate7d: 0.5,
    mockTrend: [
      [2, 74.5, "Yediiklim"],
      [9, 80.25, "Pegem"],
      [16, 78, "Yediiklim"],
      [23, 76.75, "Benim Hocam"],
      [30, 72.5, "Pegem"],
    ].map(([daysAgo, totalNet, publisherName]) => ({
      takenAt: `${shiftDay(TODAY, -(daysAgo as number))}T10:00:00.000Z`,
      totalNet: totalNet as number,
      publisherName: publisherName as string,
      examName: "KPSS Lisans 2026",
    })),
    latestMockSubjects: [
      ["turkce", "Türkçe", 24, 4, 2, 23],
      ["matematik", "Matematik", 19, 5, 6, 17.75],
      ["tarih", "Tarih", 17, 6, 4, 15.5],
      ["cografya", "Coğrafya", 11, 4, 3, 10],
      ["vatandaslik", "Vatandaşlık", 5, 2, 2, 4.5],
      ["guncel-bilgiler", "Güncel Bilgiler", 4, 1, 1, 3.75],
    ].map(([subjectRef, subjectName, correct, wrong, blank, net]) => ({
      subjectRef: subjectRef as string,
      subjectName: subjectName as string,
      correct: correct as number,
      wrong: wrong as number,
      blank: blank as number,
      net: net as number,
    })),
    planTasks: [
      task(MONDAY, "Paragraf: 20 soru", { subject: "Türkçe", topic: "Paragraf", status: "DONE" }),
      task(MONDAY, "Güncel bilgiler okuma", { assignedByCoach: false, status: "DONE" }),
      task(shiftDay(MONDAY, 1), "Osmanlı kuruluş dönemi tekrarı", {
        subject: "Tarih",
        topic: "Osmanlı",
        status: "DONE",
        coachNote: "Kronolojiyi kendi cümlelerinle yaz, haritayı yanında tut.",
      }),
      task(shiftDay(MONDAY, 2), "İklim tipleri tekrarı", { subject: "Coğrafya", topic: "İklim" }),
      task(shiftDay(MONDAY, 3), "Problemler: 15 soru", { subject: "Matematik", topic: "Problemler" }),
      task(shiftDay(MONDAY, 3), "Vatandaşlık okuma", { assignedByCoach: false }),
      task(shiftDay(MONDAY, 7), "Son denemenin analizi"),
      task(shiftDay(MONDAY, -7), "Sözcükte anlam: 20 soru", {
        subject: "Türkçe",
        topic: "Sözcükte anlam",
        status: "DONE",
      }),
      task(shiftDay(MONDAY, -5), "Oran orantı", { subject: "Matematik", topic: "Oran orantı", status: "DONE" }),
    ],
    droppedAssignments: [
      {
        assignmentGroupId: null,
        taskDate: shiftDay(MONDAY, -3),
        title: "Geometri: üçgenler",
        droppedAt: `${shiftDay(MONDAY, -3)}T18:00:00.000Z`,
      },
    ],
    moodTrend: [13, 12, 11, 9, 8, 6, 5, 4, 2, 1].map((daysAgo, index) => ({
      date: shiftDay(TODAY, -daysAgo),
      level: [3, 4, 4, 3, 2, 3, 4, 3, 2, 4][index]!,
    })),
    ...over,
  };
}

/** A student who joined today: nothing to read yet. */
export function newReport(): MentorshipStudentReportDto {
  return richReport({
    studentDisplayName: "Elif Koç",
    acceptedAt: new Date().toISOString(),
    coachNote: null,
    riskFlags: [],
    needsAttention: false,
    activity: {
      lastActiveDate: null,
      currentStreak: 0,
      longestStreak: 0,
      sessions7d: 0,
      focusMinutes7d: 0,
      activeDays7d: 0,
      sessions28d: 0,
      focusMinutes28d: 0,
      activeDays28d: 0,
    },
    dailyFocusMinutes28d: Array<number>(28).fill(0),
    planCompletionRate7d: null,
    mockTrend: [],
    latestMockSubjects: [],
    planTasks: [],
    droppedAssignments: [],
    moodTrend: [],
  });
}

export const BRIEF_TEXT =
  "Ali hafta başında düzenli çalıştı, çarşamba boş geçti. Son denemesi önceki üçünün ortalamasının altında; en çok matematik ve tarihte soru kaçırmış.";

const lastMonday = shiftDay(MONDAY, -7);
const SNAPSHOT: MentorshipWeeklySnapshotDto = {
  period: {
    startDate: lastMonday,
    endDate: shiftDay(lastMonday, 6),
    previousStartDate: shiftDay(lastMonday, -7),
    previousEndDate: shiftDay(lastMonday, -1),
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
  subjects: [],
  mocks: {
    examScopeName: "KPSS Lisans",
    currentAttemptCount: 1,
    previousAttemptCount: 1,
    currentAverageNet: 61.5,
    previousAverageNet: 58,
    currentPublishers: [],
    previousPublishers: [],
    subjects: [],
  },
  evidence: [],
  limitations: [],
};

export interface StudentMockOptions {
  /** Reports by student id; any other id answers with Ali's report under that id. */
  reports?: Record<string, MentorshipStudentReportDto>;
  pro?: boolean;
  brief?: string | "fail";
  /** Fail every report read until `calls.healReport()`: dev mode's double effects read twice. */
  failReport?: boolean;
  followups?: MentorshipFollowupDto[] | null;
  weekly?: "ready" | "disabled";
  archive?: number;
}

export async function mockStudentApi(page: Page, options: StudentMockOptions = {}) {
  let failing = options.failReport ?? false;
  const calls = {
    report: 0,
    brief: 0,
    attention: [] as boolean[],
    note: [] as (string | null)[],
    healReport: () => {
      failing = false;
    },
  };

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const headers = {
      "access-control-allow-origin": request.headers().origin ?? "http://localhost:3100",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type, authorization, accept-language",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    };
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });

    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json({ accessToken: "test-token", expiresIn: 3600, user: COACH });
    }
    if (path === "/v1/users/me") return json(COACH);
    if (path === "/v1/subscription") {
      return json({
        subscription: null,
        entitlement: options.pro
          ? { tier: "PREMIUM", isPremium: true, validUntil: "2026-12-01T00:00:00.000Z", reason: "ACTIVE" }
          : { tier: "FREE", isPremium: false, validUntil: null, reason: "NONE" },
        features: {},
        discount: null,
      });
    }

    const student = /^\/v1\/mentorship\/students\/([^/]+)(\/.*)?$/.exec(path);
    if (student) {
      const [, id, rest = ""] = student;
      if (method === "GET" && rest === "") {
        calls.report += 1;
        if (failing) return json({ code: "INTERNAL_ERROR", message: "Bir şeyler ters gitti." }, 500);
        return json(options.reports?.[id!] ?? { ...richReport(), studentId: id });
      }
      if (method === "POST" && rest === "/brief") {
        calls.brief += 1;
        if (options.brief === "fail") return json({ code: "INTERNAL_ERROR", message: "x" }, 500);
        return json({ brief: options.brief ?? BRIEF_TEXT, model: "cache", generatedAt: new Date().toISOString() });
      }
      if (method === "PUT" && rest === "/attention") {
        calls.attention.push((request.postDataJSON() as { attended: boolean }).attended);
        return route.fulfill({ status: 204, headers });
      }
      if (method === "PUT" && rest === "/note") {
        calls.note.push((request.postDataJSON() as { body: string | null }).body);
        return route.fulfill({ status: 204, headers });
      }
      if (rest.startsWith("/weekly-reports")) {
        if (options.weekly !== "ready") {
          return json({ code: "MENTORSHIP_WEEKLY_REPORT_DISABLED", message: "kapalı" }, 404);
        }
        if (rest === "/weekly-reports/preview") {
          return json({
            draftId: "draft-1",
            studentId: id,
            studentDisplayName: "Ali Demir",
            sourceFingerprint: "a".repeat(64),
            status: "DRAFT",
            snapshot: SNAPSHOT,
            subjectNames: {},
            coachContext: null,
            brief: null,
          });
        }
        if (rest === "/weekly-reports") {
          const items = Array.from({ length: options.archive ?? 0 }, (_, index) => ({
            id: `report-${index}`,
            locale: "tr",
            period: { ...SNAPSHOT.period, startDate: shiftDay(lastMonday, -7 * (index + 1)) },
            version: 1,
            finalizedAt: "2026-09-10T10:00:00.000Z",
            replacesId: null,
          }));
          return json({ items, total: items.length, page: 1, pageSize: 20 });
        }
      }
      if (rest === "/planning-tasks") return json({ items: [], total: 0, page: 1, pageSize: 100 });
    }

    if (path === "/v1/mentorship/followups/availability") {
      return json({ enabled: options.followups !== null && options.followups !== undefined });
    }
    if (path === "/v1/mentorship/followups") {
      const items = options.followups ?? [];
      return json({ items, total: items.length, page: 1, pageSize: 10 });
    }
    if (path === "/v1/mentorship/templates") return json([]);
    if (path === "/v1/notifications") return json({ items: [], unreadCount: 0, total: 0 });
    if (path.startsWith("/v1/achievements") || path.startsWith("/v1/journey")) {
      return json({ celebrations: [] });
    }
    return route.fulfill({ status: 204, headers });
  });

  return calls;
}

/** A follow-up the coach opened with the student, as the coach's list returns it. */
export function followup(over: Partial<MentorshipFollowupDto> = {}): MentorshipFollowupDto {
  return {
    id: "f-1",
    studentId: ALI_ID,
    studentDisplayName: "Ali Demir",
    title: "Denemeden sonra kısa görüşme",
    privateNote: null,
    sharedDecision: "Cuma denemesinden sonra konuşalım.",
    response: "PENDING",
    followUpDate: TODAY,
    status: "OPEN",
    version: 1,
    replacesId: null,
    createdAt: "2026-09-20T07:00:00Z",
    updatedAt: "2026-09-20T07:00:00Z",
    respondedAt: null,
    closedAt: null,
    ...over,
  };
}
