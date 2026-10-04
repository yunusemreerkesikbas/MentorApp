import type { PromptLocale } from "./prompt-locale";

/** One verified sentence. The model does not write it. Titles never enter this input. */
export type GroundingSignal =
  | "EVALUATE"
  | "RECENT_SESSIONS"
  | "TODAY_PLAN"
  | "MOOD"
  | "PLAN"
  | "COVERAGE"
  | "REST";

export interface GroundingFactInput {
  signal: GroundingSignal;
  locale: PromptLocale;
  focus?: { subjectName: string; topicName?: string } | null;
  recentSessions?: {
    count7d: number;
    focusMinutes7d: number;
    subjects: string[];
  } | null;
  todayPlan?: { total: number; done: number } | null;
  moodLevel?: number | null;
  /** Plan-task subject field only. Never a task title. */
  pendingSubjects?: readonly string[];
  /** Counts only: how much of the student's own record the plan was built from. */
  coverage?: { mockCount: number; notebookCount: number; sessions28d: number } | null;
}

const MOOD_LABEL_TR: Record<number, string> = {
  1: "çok düşük",
  2: "düşük",
  3: "orta",
  4: "iyi",
  5: "çok iyi",
};

const MOOD_LABEL_EN: Record<number, string> = {
  1: "very low",
  2: "low",
  3: "steady",
  4: "good",
  5: "very good",
};

export function moodLabel(
  level: number | null | undefined,
  locale: PromptLocale,
): string | null {
  if (level == null) return null;
  const table = locale === "en" ? MOOD_LABEL_EN : MOOD_LABEL_TR;
  return table[level] ?? null;
}

function firstName(values: readonly string[] | undefined): string | null {
  for (const value of values ?? []) {
    const name = value.trim();
    if (name) return name;
  }
  return null;
}

function focusSentence(input: GroundingFactInput): string | null {
  const subject = input.focus?.subjectName.trim();
  if (!subject) return null;
  const topic = input.focus?.topicName?.trim();
  const name = topic ? `${subject}, ${topic}` : subject;
  return input.locale === "en"
    ? `Your latest mock's focus is ${name}.`
    : `Son denemende odak ${name}.`;
}

function sessionsSentence(input: GroundingFactInput): string | null {
  const recent = input.recentSessions;
  if (!recent || (recent.count7d <= 0 && recent.focusMinutes7d <= 0)) return null;
  const subject = firstName(recent.subjects);
  if (input.locale === "en") {
    const count = `Over the last 7 days, you focused for ${recent.focusMinutes7d} minutes across ${recent.count7d} sessions.`;
    return subject ? `${count} ${subject} is part of that time.` : count;
  }
  const count = `Son 7 günde ${recent.count7d} seansla ${recent.focusMinutes7d} dakika odaklanmışsın.`;
  return subject ? `${count} İçinde ${subject} var.` : count;
}

function planCountSentence(input: GroundingFactInput): string | null {
  const plan = input.todayPlan;
  if (!plan || plan.total <= 0) return null;
  return input.locale === "en"
    ? `You have completed ${plan.done} of ${plan.total} tasks in today's plan.`
    : `Bugünkü planındaki ${plan.total} görevin ${plan.done} tanesini tamamlamışsın.`;
}

function moodSentence(input: GroundingFactInput): string | null {
  const label = moodLabel(input.moodLevel, input.locale);
  if (!label) return null;
  return input.locale === "en"
    ? `Today's mood is ${label}.`
    : `Bugünkü ruh halin ${label}.`;
}

function pendingSubjectSentence(input: GroundingFactInput): string | null {
  const subject = firstName(input.pendingSubjects);
  if (!subject) return null;
  return input.locale === "en"
    ? `${subject} is among your pending tasks.`
    : `Bekleyen işlerin arasında ${subject} var.`;
}

/** "A, B ve C" / "A, B and C". */
function joinList(parts: readonly string[], conjunction: string): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} ${conjunction} ${parts.at(-1)}`;
}

function coverageSentence(input: GroundingFactInput): string | null {
  const coverage = input.coverage;
  if (!coverage) return null;
  const { mockCount, notebookCount, sessions28d } = coverage;
  if (input.locale === "en") {
    const plural = (count: number, noun: string) =>
      `${count} ${noun}${count === 1 ? "" : "s"}`;
    const parts = [
      mockCount > 0 ? plural(mockCount, "mock exam") : null,
      notebookCount > 0 ? plural(notebookCount, "mistake card") : null,
      sessions28d > 0
        ? `${plural(sessions28d, "session")} from the last 28 days`
        : null,
    ].filter((part): part is string => part !== null);
    return parts.length > 0
      ? `We looked at your ${joinList(parts, "and")}.`
      : "Plans fit you better as your data grows. We're building this one from your choices.";
  }
  const parts = [
    mockCount > 0 ? `${mockCount} denemene` : null,
    notebookCount > 0 ? `${notebookCount} yanlış kartına` : null,
    sessions28d > 0 ? `son 28 gündeki ${sessions28d} seansına` : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) {
    return "Veri biriktikçe plan daha çok sana göre şekillenir. Bunu seçimlerinle kuruyoruz.";
  }
  const sentence = `${joinList(parts, "ve")} baktık.`;
  return sentence.charAt(0).toLocaleUpperCase("tr-TR") + sentence.slice(1);
}

/** Low mood with nothing left to lighten: say what is true, and that rest counts. */
function restSentence(input: GroundingFactInput): string {
  const done = input.todayPlan && input.todayPlan.total > 0 ? input.todayPlan.total : null;
  if (input.locale === "en") {
    return done
      ? `You finished today's ${done} task${done === 1 ? "" : "s"}. Resting today is part of the plan too.`
      : "Nothing is waiting for you today. Resting is part of the plan too.";
  }
  return done
    ? `Bugünkü ${done} görevini tamamlamışsın. Bugün dinlenmek de planın parçası.`
    : "Bugün seni bekleyen bir görev yok. Dinlenmek de planın parçası.";
}

/** One sentence for the surface. Evaluate focus replaces the session counter. */
export function groundingFact(input: GroundingFactInput): string | null {
  if (input.signal === "REST") return restSentence(input);
  if (input.signal === "COVERAGE") return coverageSentence(input);
  if (input.signal === "EVALUATE") return focusSentence(input);
  if (input.signal === "RECENT_SESSIONS") return sessionsSentence(input);
  if (input.signal === "TODAY_PLAN") return planCountSentence(input);
  if (input.signal === "MOOD") return moodSentence(input);
  return pendingSubjectSentence(input) ?? planCountSentence(input);
}
