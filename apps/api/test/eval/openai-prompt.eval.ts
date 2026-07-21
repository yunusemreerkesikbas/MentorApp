import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ConfigService } from "@nestjs/config";
import type { GhostComparisonDto, WeeklyReviewDto } from "@mentor/types";
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
import { hasSeriousDistressSignal } from "../../src/modules/ai/domain/serious-distress";
import { extractReplyMarkers } from "../../src/modules/ai/domain/suggested-task";
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
const context: CoachContext = {
  examType: "KPSS",
  moodLevel: 2,
  struggleNote: "Paragraf sorularında dikkatim dağılıyor",
  recentSessions: {
    count7d: 4,
    focusMinutes7d: 160,
    subjects: ["Türkçe", "Matematik"],
    lastStruggleNote: "Paragrafta ana fikir",
  },
  todayPlan: {
    done: 1,
    total: 2,
    pendingTitles: ["Matematik: 20 soru"],
  },
};

const weeklyReview: WeeklyReviewDto = {
  period: {
    startDate: "2026-07-06",
    endDate: "2026-07-12",
    timeZone: "Europe/Istanbul",
  },
  status: "READY",
  evidence: { mockExamCount: 1, completedSessionCount: 4 },
  rhythm: {
    completedSessionCount: 4,
    focusMinutes: 160,
    activeDays: 3,
    moodCheckinCount: 2,
    energySignal: "MIXED",
    message: "Bu hafta üç güne yayılan sakin bir ritim kurdun.",
  },
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
  struggleNote: "Paragrafta ana fikri kaçırdım",
});
const ghostPrompt = buildGhostPrompt(ghost);
const visionPrompt = buildVisionNotePrompt(
  context,
  "Kamu kurumunda uzman yardımcısı olmak",
  "Ankara",
  "Daha istikrarlı bir hayat kurmak",
);
const weeklyPrompt = buildWeeklyReviewPrompt(weeklyReview, "tr");
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
      OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      OPENAI_EMBED_MODEL:
        process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small",
    }),
  );
});

describe("OpenAI prompt quality eval", () => {
  it("passes objective checks for nine synthetic scenarios and writes the review report", async () => {
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
          model: process.env.OPENAI_MODEL ?? "unknown",
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
    expect(reports).toHaveLength(9);
    expect(failures, `Review ${REPORT_PATH}`).toEqual([]);
  }, 360_000);
});
