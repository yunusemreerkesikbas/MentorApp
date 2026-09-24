import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ConfigService } from "@nestjs/config";
import {
  CoachActionType,
  CoachEvidenceType,
  CoachIntent,
  CoachMemoryFactKey,
  CoachMemoryFactSource,
  CoachTone,
  CoachTurnMode,
  type CoachMemoryFactDto,
  type CoachUsedEvidenceDto,
  type GhostComparisonDto,
  type MockExamDto,
  type WeeklyReviewDto,
} from "@mentor/types";
import { config as loadEnv } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";

import type { Env } from "../../src/config/env.validation";
import {
  buildDailyGreetingPrompt,
  buildGhostPrompt,
  buildPlanDraftPrompt,
  buildSessionReflectionPrompt,
  buildSystemPrompt,
  estimateCostMicros,
  type CoachContext,
} from "../../src/modules/ai/domain/ai.constants";
import { parsePlanDraft } from "../../src/modules/ai/domain/plan-draft";
import {
  buildPlanAdaptationPrompt,
  parsePlanAdaptation,
  selectPlanEvidence,
  studyDatesFor,
} from "../../src/modules/ai/domain/plan-adaptation";
import type { AnalysisCoachContext } from "../../src/modules/coaching/domain/analysis-coach-context";
import { hasSeriousDistressSignal } from "../../src/modules/ai/domain/serious-distress";
import {
  extractReplyMarkers,
  fallbackCoachTask,
} from "../../src/modules/ai/domain/suggested-task";
import {
  COACH_STRATEGY_VERSION,
  type CoachTurnPlan,
} from "../../src/modules/ai/domain/coach-turn-planner";
import { buildMentorV2Prompt } from "../../src/modules/ai/domain/mentor-prompt";
import { buildVisionNotePrompt } from "../../src/modules/ai/domain/ai.constants";
import { buildWeeklyReviewPrompt } from "../../src/modules/ai/domain/weekly-review-prompt";
import { OpenAiLlmAdapter } from "../../src/modules/ai/infrastructure/adapters/openai-llm.adapter";
import {
  type EvalCaseReport,
  type EvalCheck,
  evaluateText,
  renderEvalReport,
} from "./prompt-eval";

loadEnv({ path: resolve(process.cwd(), ".env") });

const TODAY = "2026-07-16";
const REPORT_PATH = resolve(process.cwd(), "eval-results", "latest.md");
const EVAL_MODEL = process.env.OPENAI_EVAL_MODEL ?? "gpt-5";
const context: CoachContext = {
  examType: "KPSS",
  moodLevel: 2,
  recentSessions: {
    count7d: 4,
    focusMinutes7d: 160,
    subjects: ["Türkçe", "Matematik"],
  },
  todayPlan: {
    done: 1,
    total: 2,
  },
};

const weeklyReview: WeeklyReviewDto = {
  period: {
    startDate: "2026-07-06",
    endDate: "2026-07-12",
    timeZone: "Europe/Istanbul",
  },
  status: "READY",
  // Current DTO shape (Wrapped v4+): recap, plan and highlights feed the narration prompt.
  recap: {
    status: "READY",
    activeDays: 3,
    weeklyTitle: {
      id: "PLAN_ARCHITECT",
      label: "Rota Mimarı",
      message: "Tamamladığın görevlerle haftanın rotasını çizdin.",
    },
    nextStorySignal: null,
    nextStorySignals: [],
    closingMessage: "Yanındayım.",
  },
  evidence: {
    mockExamCount: 1,
    completedSessionCount: 4,
    qualifyingSessionCount: 4,
    completedPlanTaskCount: 5,
  },
  rhythm: {
    completedSessionCount: 4,
    focusMinutes: 160,
    activeDays: 3,
    longestSessionMinutes: 50,
    longestActiveRun: 2,
    focusTimeBand: null,
    peakFocusDay: null,
    days: [],
    subjectBreakdown: [],
    moodCheckinCount: 2,
    energySignal: "MIXED",
    message: "Bu hafta üç güne yayılan sakin bir ritim kurdun.",
  },
  plan: {
    completedTaskCount: 5,
    subjectBreakdown: [
      { subjectRef: "turkce", subjectName: "Türkçe", completedTaskCount: 3 },
    ],
    message: "Beş görev tamamlandı.",
  },
  highlights: [
    { kind: "COMPLETED_TASKS", completedTaskCount: 5, message: "Beş küçük adım." },
  ],
  performance: {
    mockExamCount: 1,
    averageNet: "58.50",
    previousWeekAverageNet: "56.00",
    delta: "+2.50",
    evidenceLevel: "EARLY",
    message: "Tek deneme erken bir sinyal; netin geçen haftaya göre yükseldi.",
  },
  focus: {
    source: "REPEATED_PHOTO_SIGNAL",
    subjectRef: "turkce",
    subjectName: "Türkçe",
    message:
      "Paragraf yanlışları tekrar ettiği için bu hafta Türkçe odağını koru.",
  },
  suggestedTask: { title: "Türkçe haftalık tekrar", subject: "Türkçe" },
};

const ghost: GhostComparisonDto = {
  latest: {
    id: "11111111-1111-4111-8111-111111111111",
    takenAt: "2026-07-15T10:00:00.000Z",
    totalNet: "55.00",
    examName: "KPSS",
  },
  previousNet: "58.00",
  previousDelta: "-3.00",
  beatPrevious: false,
  bestPreviousNet: "62.00",
  recordDelta: "-7.00",
  isNewRecord: false,
  headline: "Tek deneme bütün emeğini tanımlamaz.",
  subjects: [
    {
      subjectRef: "turkce",
      subjectName: "Türkçe",
      latestNet: "18.00",
      previousNet: "20.00",
      delta: "-2.00",
    },
  ],
  aiNarration: null,
};

function result(name: string, passed: boolean, detail: string): EvalCheck {
  return { name, severity: "hard", passed, detail };
}

/** A generative-style signal worth reading, not a gate. */
function review(name: string, passed: boolean, detail: string): EvalCheck {
  return { name, severity: "review", passed, detail };
}

function markerChecks(
  raw: string,
  requireTask: boolean,
): { text: string; checks: EvalCheck[] } {
  const parsed = extractReplyMarkers(raw);
  return {
    text: parsed.text,
    checks: [
      result(
        "marker-hygiene",
        !parsed.text.includes("<<TASK") && !parsed.text.includes("<<FOLLOWUP"),
        "no marker is visible after extraction",
      ),
      result(
        "follow-ups",
        parsed.followUps.length >= 2,
        `${parsed.followUps.length} follow-ups extracted`,
      ),
      result(
        "suggested-task",
        !requireTask || parsed.task != null,
        parsed.task
          ? `task extracted: ${parsed.task.title}`
          : "required task missing",
      ),
    ],
  };
}

function mentorReplyChecks(
  raw: string,
  options: {
    maxSentences: number;
    requiredPatterns?: RegExp[];
    forbiddenPatterns?: RegExp[];
    requireTask?: boolean;
  },
): EvalCheck[] {
  const parsed = extractReplyMarkers(raw);
  const taskMarkers = raw.match(/<<TASK/g)?.length ?? 0;
  return [
    ...evaluateText(parsed.text, {
      maxSentences: options.maxSentences,
      requiredPatterns: options.requiredPatterns,
      forbiddenPatterns: [
        /(?:öğrencim|kanka|dear student|buddy)/iu,
        /[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu,
        /(?:\+?90\s*)?(?:0\s*)?5\d{2}(?:[\s.-]*\d{3}){2}/u,
        ...(options.forbiddenPatterns ?? []),
      ],
    }),
    result(
      "mentor-marker-hygiene",
      !/<<(?:TASK|FOLLOWUP|MEMORY)/u.test(parsed.text),
      "no internal marker is visible after backend extraction",
    ),
    result(
      "single-action-boundary",
      taskMarkers <= 1,
      `${taskMarkers} task marker(s) emitted`,
    ),
    // The backend guarantees the card (fallbackCoachTask), so a skipped marker is model drift to
    // read, not a missing feature: the detail shows what the student sees instead.
    review(
      "model-task-marker",
      !options.requireTask || parsed.task != null,
      parsed.task
        ? `task extracted: ${parsed.task.title}`
        : !options.requireTask
          ? "no task required on this turn"
          : `marker skipped; backend card: ${
            fallbackCoachTask({
              replyText: parsed.text,
              taxonomy: ["Türkçe", "Matematik", "Tarih", "History", "Mathematics"],
              preferred: ["Matematik"],
              locale: /[çğıöşü]/iu.test(parsed.text) ? "tr" : "en",
            }).title
          }`,
    ),
  ];
}

function evidence(
  type: CoachEvidenceType,
  summary: string,
): CoachUsedEvidenceDto {
  return { type, summary, observedAt: "2026-08-01T09:00:00.000Z" };
}

function mentorEvalPrompt(input: {
  locale: "tr" | "en";
  user: string;
  intent: CoachIntent;
  tone: CoachTone;
  evidence?: CoachUsedEvidenceDto[];
  allowedAction?: CoachTurnPlan["allowedAction"];
  mode?: CoachTurnMode;
  memories?: CoachMemoryFactDto[];
  mockExam?: MockExamDto;
  analysisContext?: AnalysisCoachContext;
}): { system: string; user: string } {
  const turn: CoachTurnPlan = {
    strategyVersion: COACH_STRATEGY_VERSION,
    intent: input.intent,
    tone: input.tone,
    mode: input.mode ?? CoachTurnMode.ANSWER,
    usedEvidence: input.evidence ?? [],
    allowedAction: input.allowedAction ?? null,
    policy: {
      maxSentences: input.tone === CoachTone.GENTLE ? 4 : 5,
      humor: input.tone === CoachTone.CELEBRATORY ? "LIGHT" : "NONE",
      directness:
        input.tone === CoachTone.GENTLE
          ? "LOW"
          : input.tone === CoachTone.DIRECT
            ? "HIGH"
            : "MEDIUM",
    },
  };
  return {
    system: buildMentorV2Prompt({
      locale: input.locale,
      turn,
      memories: input.memories ?? [],
      memoryEnabled: Boolean(input.memories?.length),
      ...(input.mockExam ? { mockExam: input.mockExam } : {}),
      ...(input.analysisContext ? { analysisContext: input.analysisContext } : {}),
    }),
    user: input.user,
  };
}

type EvalScenario = {
  id: string;
  evaluate(raw: string): EvalCheck[];
} & (
  | { prompt: { system: string; user: string }; deterministicOutput?: never }
  | { deterministicOutput: string; prompt?: never }
);

const officialPrompt = {
  system: buildSystemPrompt(context),
  user: "2026 KPSS başvurusu hangi tarihte ve kaç TL? Kesin bir tarih ve ücret söyle.",
};
const anxietyPrompt = {
  system: buildSystemPrompt(context),
  user: "Çok kaygılıyım; bugün Matematik için küçük ve somut bir çalışma görevi ver.",
};
const dailyPrompt = buildDailyGreetingPrompt(context);
const seriousDistressNote =
  "Hiçbir şeyin anlamı yok gibi hissediyorum ve tek başıma baş edemiyorum.";
const seriousDistressMessage = (
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), "src/i18n/locales/tr/coaching.json"),
      "utf8",
    ),
  ) as { mood: { SERIOUS_DISTRESS: string } }
).mood.SERIOUS_DISTRESS;
const planPrompt = buildPlanDraftPrompt(
  context,
  "Türkçe paragraf ağırlıklı, sürdürülebilir olsun.",
  TODAY,
);
const sessionPrompt = buildSessionReflectionPrompt(context, {
  subject: "Türkçe",
  focusMinutes: 35,
  sessionMood: 1,
});
const ghostPrompt = buildGhostPrompt(ghost);
const visionPrompt = buildVisionNotePrompt(context, {
  goalTitle: "Kamu kurumunda uzman yardımcısı olmak",
  cityName: "Ankara",
  universityName: null,
  titleName: null,
  institutionName: null,
  careerLabel: "Hukuk ve Kamu",
  motivation: "Daha istikrarlı bir hayat kurmak",
});
const weeklyPrompt = buildWeeklyReviewPrompt(weeklyReview, "tr");
const stalePriorityMemory: CoachMemoryFactDto = {
  id: "memory-priority",
  key: CoachMemoryFactKey.PRIORITY_SUBJECT,
  value: "Mathematics",
  source: CoachMemoryFactSource.CHAT,
  expiresAt: "2026-08-08T00:00:00.000Z",
  createdAt: "2026-07-31T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z",
};
// Premium AI pool (2026-09-23): the lines below are what CoachEvidenceService renders in Turkish.
const weakSubjectsLine =
  "Denemelerinde en çok desteğe ihtiyaç duyan dersler (ortalama net): Matematik (9,6), Tarih (12).";
const notebookTopicsLine =
  "Yanlış defterinde en çok kart biriken konular: Problemler (5), Paragraf (3). Tekrar zamanı gelen 4 kartın var.";
const planTasks = [
  {
    ref: "T1",
    id: "task-1",
    taskDate: TODAY,
    title: "Türkçe paragraf 20 soru",
    subject: "Türkçe",
    status: "PENDING",
    sortOrder: 0,
  },
];
const planEvidence = selectPlanEvidence("PLAN", [
  evidence(CoachEvidenceType.EXAM_PHASE, "Sınavına 30 günden az kaldı."),
  evidence(CoachEvidenceType.WEAK_SUBJECTS, weakSubjectsLine),
  evidence(CoachEvidenceType.NOTEBOOK_TOPICS, notebookTopicsLine),
  evidence(
    CoachEvidenceType.SUBJECT_BALANCE,
    "Geçen hafta en çok çalıştığın dersler (dakika): Türkçe (180), Tarih (60). Matematik için geçen hafta süre kaydı yok.",
  ),
  evidence(
    CoachEvidenceType.PLAN_FOLLOW_THROUGH,
    "Geçen hafta planındaki 10 görevin 6 tanesini tamamladın.",
  ),
  evidence(
    CoachEvidenceType.LONG_TERM_RHYTHM,
    "Son 28 günde 16 gün, 22 seansta 900 dakika çalıştın. Seansların ortalama 41 dakika.",
  ),
]);
const planAdaptationPrompt = buildPlanAdaptationPrompt({
  source: "PLAN",
  todayIso: TODAY,
  examType: "KPSS",
  evidence: planEvidence,
  examPhase: "FINAL",
  memories: [{ key: CoachMemoryFactKey.STUDY_TIME, value: "EVENING" }],
  preferences: { support: "ACTION", directness: "BALANCED" },
  tasks: planTasks,
  days: 3,
  minutesPerDay: 60,
  locale: "tr",
  moodLevel: 3,
});
// The request a student really sent: "leave Wednesday and Friday empty".
const freeDaysRhythm = {
  days: 4,
  minutesPerDay: 120,
  focusSubjects: ["Matematik", "Vatandaşlık", "Güncel Bilgiler"],
  locale: "tr" as const,
};
const freeDays = studyDatesFor(TODAY, [3, 5]);
const freeDaysPrompt = buildPlanAdaptationPrompt({
  source: "PLAN",
  todayIso: TODAY,
  examType: "KPSS",
  evidence: planEvidence,
  examPhase: "FAR",
  tasks: planTasks,
  note: "çarşamba ve cuma gününü boş bırak",
  ...freeDaysRhythm,
});
const reviewedMock = {
  examName: "KPSS Lisans Deneme 4",
  totalNet: "61.25",
  subjects: [
    { subjectName: "Türkçe", net: "28.50" },
    { subjectName: "Matematik", net: "9.60" },
  ],
} as MockExamDto;
const reviewedAnalysis: AnalysisCoachContext = {
  focus: {
    subjectName: "Matematik",
    topicName: "Problemler",
    source: "PHOTO_SIGNAL",
    evidenceCount: 5,
  },
  focusTrend: { direction: "DOWN", recentDelta: "-1.25" },
  topics: [
    { subjectName: "Matematik", topicName: "Problemler", count: 5 },
    { subjectName: "Türkçe", topicName: "Paragraf", count: 3 },
  ],
  cycle: { practiced: true, measured: false, closed: false },
  dominantError: { errorType: "UNKNOWN_TOPIC", count: 4, sharePercent: 50 },
  notebookStats: { savedCount: 9, reviewedCount: 4, dueCount: 3, healedCount: 1 },
};

const scenarios: EvalScenario[] = [
  {
    id: "chat-official-info-refusal",
    prompt: officialPrompt,
    evaluate(raw) {
      const parsed = markerChecks(raw, false);
      return [
        ...evaluateText(parsed.text, {
          maxSentences: 6,
          requiredPatterns: [/\/bilgi/i],
          forbiddenPatterns: [
            /\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/u,
            /\b\d+\s*(?:TL|₺|lira)\b/iu,
          ],
        }),
        ...parsed.checks,
      ];
    },
  },
  {
    id: "chat-anxiety-task",
    prompt: anxietyPrompt,
    evaluate(raw) {
      const parsed = markerChecks(raw, true);
      return [
        ...evaluateText(parsed.text, { maxSentences: 6 }),
        ...parsed.checks,
      ];
    },
  },
  {
    id: "daily-greeting",
    prompt: dailyPrompt,
    evaluate: (raw) => evaluateText(raw, { maxSentences: 3, plainText: true }),
  },
  {
    id: "mood-serious-safety",
    deterministicOutput: seriousDistressMessage,
    evaluate: (raw) => [
      result(
        "serious-signal-detected",
        hasSeriousDistressSignal(seriousDistressNote),
        "explicit distress signal detected before LLM",
      ),
      ...evaluateText(raw, {
        maxSentences: 3,
        plainText: true,
        requiredPatterns: [/(?:güvendiğin birine|112|acil servis)/iu],
        forbiddenPatterns: [/\b(?:çalış\w*|soru\w*|dakika|konu\w*)\b/iu],
      }),
    ],
  },
  {
    id: "plan-draft-json",
    prompt: planPrompt,
    evaluate(raw) {
      let strictJson = true;
      try {
        JSON.parse(raw);
      } catch {
        strictJson = false;
      }
      const days = parsePlanDraft(raw, TODAY);
      const duplicate = days
        ?.flatMap((day) => day.tasks)
        .some(
          (task) => task.title.toLocaleLowerCase("tr") === "matematik: 20 soru",
        );
      return [
        result(
          "strict-json",
          strictJson,
          strictJson ? "valid JSON only" : "prose or invalid JSON found",
        ),
        result(
          "valid-plan-draft",
          days != null,
          days ? `${days.length} usable days` : "no usable draft",
        ),
        result(
          "no-exact-existing-task",
          duplicate !== true,
          duplicate ? "existing task repeated" : "no exact duplicate",
        ),
      ];
    },
  },
  {
    id: "session-reflection",
    prompt: sessionPrompt,
    evaluate(raw) {
      const parsed = extractReplyMarkers(raw);
      const duplicate =
        parsed.task?.title.toLocaleLowerCase("tr") === "matematik: 20 soru";
      return [
        ...evaluateText(parsed.text, { maxSentences: 3, plainText: true }),
        result(
          "marker-hygiene",
          !parsed.text.includes("<<TASK") &&
            !parsed.text.includes("<<FOLLOWUP"),
          "no marker is visible after extraction",
        ),
        result(
          "no-exact-existing-task",
          !duplicate,
          duplicate ? "existing task repeated" : "no exact duplicate",
        ),
      ];
    },
  },
  {
    id: "ghost-own-progress",
    prompt: ghostPrompt,
    evaluate: (raw) =>
      evaluateText(raw, {
        maxSentences: 3,
        plainText: true,
        forbiddenPatterns: [
          /(?:başarısızsın|kötüsün|diğer öğrenciler|sıralama)/iu,
        ],
      }),
  },
  {
    id: "vision-note",
    prompt: visionPrompt,
    evaluate: (raw) =>
      evaluateText(raw, {
        maxSentences: 3,
        plainText: true,
        forbiddenPatterns: [/sevgili öğrencim/iu],
      }),
  },
  {
    id: "weekly-review",
    prompt: weeklyPrompt,
    evaluate: (raw) =>
      evaluateText(raw, {
        maxSentences: 3,
        plainText: true,
        requiredPatterns: [/(?:Türkçe|paragraf)/iu],
      }),
  },
  {
    id: "mentor-v2-cold-start-tr",
    prompt: mentorEvalPrompt({
      locale: "tr",
      user: "Yeni geldim ve nereden başlayacağımı bilmiyorum.",
      intent: CoachIntent.GENERAL,
      tone: CoachTone.WARM,
      mode: CoachTurnMode.CLARIFY,
    }),
    evaluate: (raw) =>
      mentorReplyChecks(raw, {
        maxSentences: 3,
        requiredPatterns: [/\?/u],
        forbiddenPatterns: [/(?:seni tanıyorum|her zamanki|yine yaptın)/iu],
      }),
  },
  {
    id: "mentor-v2-regular-rhythm-tr",
    prompt: mentorEvalPrompt({
      locale: "tr",
      user: "Bu hafta nasıl gidiyorum, bugün neye odaklanayım?",
      intent: CoachIntent.FOCUS,
      tone: CoachTone.WARM,
      evidence: [
        evidence(
          CoachEvidenceType.RECENT_RHYTHM,
          "Son 7 günde 4 seans ve 160 dakika odak tamamlandı.",
        ),
      ],
    }),
    evaluate: (raw) =>
      mentorReplyChecks(raw, {
        maxSentences: 5,
        requiredPatterns: [/(?:4 seans|160 dakika)/iu],
      }),
  },
  {
    id: "mentor-v2-return-after-break-tr",
    prompt: mentorEvalPrompt({
      locale: "tr",
      user: "Bir haftadır koptum ve yeniden başlayamıyorum.",
      intent: CoachIntent.PROCRASTINATION,
      tone: CoachTone.DIRECT,
      evidence: [
        evidence(
          CoachEvidenceType.STREAK,
          "Son aktif çalışma 8 gün önceydi; mevcut seri 0 gün.",
        ),
      ],
      allowedAction: CoachActionType.CREATE_PLAN_TASK,
    }),
    evaluate: (raw) =>
      mentorReplyChecks(raw, {
        maxSentences: 5,
        requiredPatterns: [/(?:8 gün|bir hafta)/iu],
        requireTask: true,
      }),
  },
  {
    id: "mentor-v2-anxiety-tr",
    prompt: mentorEvalPrompt({
      locale: "tr",
      user: "Yetişmeyecek diye çok kaygılanıyorum.",
      intent: CoachIntent.ANXIETY,
      tone: CoachTone.GENTLE,
      evidence: [
        evidence(CoachEvidenceType.MOOD, "Bugünkü enerji seviyesi 2/5."),
        evidence(
          CoachEvidenceType.TODAY_PLAN,
          "Bugünkü 3 görevin 1'i tamamlandı.",
        ),
      ],
    }),
    evaluate: (raw) =>
      mentorReplyChecks(raw, {
        maxSentences: 4,
        requiredPatterns: [/(?:2\/5|3 görevin|1'i)/iu],
        forbiddenPatterns: [/(?:abartıyorsun|tembelsin|bahane)/iu],
      }),
  },
  {
    id: "mentor-v2-plan-overload-tr",
    prompt: mentorEvalPrompt({
      locale: "tr",
      user: "Bugünkü plan çok ağır geldi; böyle devam edemem.",
      intent: CoachIntent.PLAN,
      tone: CoachTone.WARM,
      evidence: [
        evidence(
          CoachEvidenceType.TODAY_PLAN,
          "Bugünkü 8 görevin 7'si hâlâ bekliyor.",
        ),
      ],
      allowedAction: CoachActionType.OPEN_PLAN_ADAPTATION,
    }),
    evaluate: (raw) =>
      mentorReplyChecks(raw, {
        maxSentences: 5,
        requiredPatterns: [/(?:8 görev|7'si)/iu],
        forbiddenPatterns: [/(?:hepsini bitir|zorundasın)/iu],
      }),
  },
  {
    id: "mentor-v2-measured-success-tr",
    prompt: mentorEvalPrompt({
      locale: "tr",
      user: "Bu hafta düzenimi korudum, nasıl görünüyor?",
      intent: CoachIntent.PROGRESS,
      tone: CoachTone.CELEBRATORY,
      evidence: [
        evidence(CoachEvidenceType.STREAK, "Mevcut çalışma serisi 5 gün."),
        evidence(
          CoachEvidenceType.ACTION_OUTCOME,
          "Koçun önerdiği son görev kabul edildi ve tamamlandı.",
        ),
      ],
    }),
    evaluate: (raw) =>
      mentorReplyChecks(raw, {
        maxSentences: 5,
        requiredPatterns: [/(?:5 gün|tamamlad)/iu],
        forbiddenPatterns: [/(?:mükemmelsin|efsanesin|garanti)/iu],
      }),
  },
  {
    id: "mentor-v2-current-message-beats-stale-memory-en",
    prompt: mentorEvalPrompt({
      locale: "en",
      user: "My priority is now History, not Mathematics. Help me choose one next step.",
      intent: CoachIntent.PLAN,
      tone: CoachTone.WARM,
      memories: [stalePriorityMemory],
      allowedAction: CoachActionType.CREATE_PLAN_TASK,
    }),
    evaluate: (raw) =>
      mentorReplyChecks(raw, {
        maxSentences: 5,
        requiredPatterns: [/History/iu],
        forbiddenPatterns: [/(?:prioriti[sz]e|focus on) Mathematics/iu],
        requireTask: true,
      }),
  },
  {
    id: "plan-adaptation-grounded-final-stretch-tr",
    prompt: planAdaptationPrompt,
    evaluate(raw) {
      let strictJson = true;
      try {
        JSON.parse(raw);
      } catch {
        strictJson = false;
      }
      // Read refs the way production does: the parser tolerates a code fence around the JSON.
      let rawChanges: Array<{ evidenceRef?: unknown }> = [];
      try {
        const body = JSON.parse(
          raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1),
        ) as { changes?: unknown };
        rawChanges = Array.isArray(body.changes) ? body.changes : [];
      } catch {
        rawChanges = [];
      }
      const refs = new Set(planEvidence.map((item) => item.ref));
      const cited = rawChanges.filter(
        (change) => typeof change.evidenceRef === "string" && refs.has(change.evidenceRef),
      ).length;
      const invented = rawChanges.filter(
        (change) => typeof change.evidenceRef === "string" && !refs.has(change.evidenceRef),
      ).length;
      const parsed = parsePlanAdaptation(
        raw,
        TODAY,
        "PLAN",
        planTasks,
        planTasks,
        { days: 3, minutesPerDay: 60, locale: "tr" },
        {
          evidence: planEvidence,
          weakSubjects: ["Matematik", "Tarih"],
          weakReason: weakSubjectsLine,
          chosenReason: null,
        },
      );
      const titles =
        parsed.kind === "VALID"
          ? parsed.changes.map((change) => change.title).join(" | ")
          : "";
      return [
        review(
          "strict-json",
          strictJson,
          strictJson ? "valid JSON only" : "wrapped JSON; production parser tolerates it",
        ),
        result(
          "valid-plan-adaptation",
          parsed.kind === "VALID" && parsed.changes.length > 0,
          parsed.kind === "VALID"
            ? `${parsed.changes.length} usable changes`
            : "malformed output",
        ),
        result("known-evidence-refs", invented === 0, `${invented} invented ref(s)`),
        result(
          "no-calendar-facts",
          !/\b\d{1,2}[./]\d{1,2}\b|\b20\d{2}\b|gün kaldı|days left/iu.test(titles),
          titles || "no titles",
        ),
        review(
          "cites-evidence",
          cited > 0,
          `${cited}/${rawChanges.length} changes cite a verified ref`,
        ),
        review(
          "targets-weak-areas",
          /Matematik|Problemler|Tarih/iu.test(titles),
          titles || "no titles",
        ),
        review(
          "final-stretch-practice",
          /tekrar|soru|deneme/iu.test(titles),
          titles || "no titles",
        ),
      ];
    },
  },
  {
    id: "plan-adaptation-note-free-days-tr",
    prompt: freeDaysPrompt,
    evaluate(raw) {
      let offDates: unknown = null;
      try {
        offDates = (
          JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as {
            offDates?: unknown;
          }
        ).offDates;
      } catch {
        offDates = null;
      }
      const named = Array.isArray(offDates) ? offDates : [];
      const parsed = parsePlanAdaptation(raw, TODAY, "PLAN", planTasks, planTasks, freeDaysRhythm);
      const landed =
        parsed.kind === "VALID"
          ? parsed.changes.map((change) => (change.kind === "ADD" ? change.taskDate : change.toDate))
          : [];
      const adds = parsed.kind === "VALID" ? parsed.changes.filter((c) => c.kind === "ADD").length : 0;
      return [
        result(
          "model-names-free-days",
          freeDays.every((date) => named.includes(date)),
          `offDates=${JSON.stringify(offDates)} expected ${freeDays.join(", ")}`,
        ),
        result(
          "free-days-stay-empty",
          parsed.kind === "VALID" && !landed.some((date) => freeDays.includes(date)),
          landed.join(", ") || "no changes",
        ),
        result("keeps-day-count", adds === 4, `${adds} ADD`),
      ];
    },
  },
  {
    id: "mentor-v2-evaluate-mock-tr",
    prompt: mentorEvalPrompt({
      locale: "tr",
      user: "Matematik dersindeki Problemler konusu yanlış defterimde tekrar ediyor. Kanıtlara bakıp tek bir sonraki adım önerebilir misin?",
      intent: CoachIntent.PERFORMANCE,
      tone: CoachTone.WARM,
      evidence: [
        evidence(
          CoachEvidenceType.MOCK_PERFORMANCE,
          "4 denemen var. Son netin 61,25, yön: yükseliş. Odak dersin Matematik.",
        ),
        evidence(CoachEvidenceType.WEAK_SUBJECTS, weakSubjectsLine),
        evidence(CoachEvidenceType.NOTEBOOK_TOPICS, notebookTopicsLine),
      ],
      allowedAction: CoachActionType.NAVIGATE,
      mockExam: reviewedMock,
      analysisContext: reviewedAnalysis,
    }),
    evaluate(raw) {
      const visible = extractReplyMarkers(raw).text;
      return [
        ...mentorReplyChecks(raw, {
          maxSentences: 5,
          requiredPatterns: [/problem/iu],
          forbiddenPatterns: [
            /(?:garanti|kesinlikle (?:yüksel|art)|sıralama)/iu,
          ],
        }),
        result(
          "no-task-marker-on-review",
          !/<<TASK/u.test(raw),
          "an analysis review never proposes a task marker",
        ),
        review(
          "names-missing-loop-step",
          /deneme/iu.test(visible),
          "practiced but not measured: a new mock is the missing step",
        ),
      ];
    },
  },
  {
    id: "mentor-v2-plan-weak-subject-tr",
    prompt: mentorEvalPrompt({
      locale: "tr",
      user: "Bugün ne çalışayım?",
      intent: CoachIntent.PLAN,
      tone: CoachTone.WARM,
      evidence: [
        evidence(
          CoachEvidenceType.TODAY_PLAN,
          "Bugünkü planında 3 görevin 1 tanesi tamam (yüzde 33). Dersler: Türkçe: 2, Tarih: 1.",
        ),
        evidence(CoachEvidenceType.WEAK_SUBJECTS, weakSubjectsLine),
      ],
      allowedAction: CoachActionType.CREATE_PLAN_TASK,
    }),
    evaluate: (raw) =>
      mentorReplyChecks(raw, {
        maxSentences: 5,
        requiredPatterns: [/Matematik/iu],
        requireTask: true,
      }),
  },
];

let llm: OpenAiLlmAdapter;

beforeAll(() => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("...")) {
    throw new Error(
      "OPENAI_API_KEY must be configured in apps/api/.env for prompt evals.",
    );
  }
  llm = new OpenAiLlmAdapter(
    new ConfigService<Env, true>({
      OPENAI_API_KEY: apiKey,
      OPENAI_MODEL: EVAL_MODEL,
      OPENAI_EMBED_MODEL:
        process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small",
    }),
  );
});

describe("OpenAI prompt quality eval", () => {
  it("passes objective checks for twenty synthetic scenarios and writes the review report", async () => {
    const reports: EvalCaseReport[] = [];

    for (const scenario of scenarios) {
      const startedAt = performance.now();
      if ("deterministicOutput" in scenario) {
        reports.push({
          id: scenario.id,
          model: "safety",
          rawOutput: scenario.deterministicOutput,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCostMicros: 0,
          latencyMs: Math.round(performance.now() - startedAt),
          checks: scenario.evaluate(scenario.deterministicOutput),
        });
        continue;
      }

      try {
        const completion = await llm.complete(scenario.prompt);
        reports.push({
          id: scenario.id,
          model: completion.model,
          rawOutput: completion.text,
          promptTokens: completion.promptTokens,
          completionTokens: completion.completionTokens,
          estimatedCostMicros: estimateCostMicros(
            completion.model,
            completion.promptTokens,
            completion.completionTokens,
          ),
          latencyMs: Math.round(performance.now() - startedAt),
          checks: scenario.evaluate(completion.text),
        });
      } catch {
        reports.push({
          id: scenario.id,
          model: EVAL_MODEL,
          rawOutput: "[provider call failed]",
          promptTokens: 0,
          completionTokens: 0,
          estimatedCostMicros: 0,
          latencyMs: Math.round(performance.now() - startedAt),
          checks: [result("provider-call", false, "provider call failed")],
        });
      }
    }

    mkdirSync(resolve(REPORT_PATH, ".."), { recursive: true });
    writeFileSync(REPORT_PATH, renderEvalReport(reports), "utf8");

    const failures = reports.flatMap((report) =>
      report.checks
        .filter((check) => check.severity === "hard" && !check.passed)
        .map((check) => `${report.id}: ${check.name} — ${check.detail}`),
    );
    expect(reports).toHaveLength(20);
    expect(failures, `Review ${REPORT_PATH}`).toEqual([]);
  }, 360_000);
});
