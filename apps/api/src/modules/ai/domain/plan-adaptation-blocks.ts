import type { CoachPlanAdaptationChangeDto } from "@mentor/types";
import type { PromptLocale } from "./prompt-locale";

export interface VerifiedPlanTopic {
  subjectName: string;
  slug: string;
  name: string;
}

interface BlockGrounding {
  weakSubjects?: readonly string[];
  weakReason?: string | null;
  chosenReason?: string | null;
  notebookReason?: string | null;
}

const ACTIONS = ["PRACTICE", "REVIEW", "NOTEBOOK"] as const;
type Action = (typeof ACTIONS)[number];

function key(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR");
}

function actionText(action: Action, locale: PromptLocale): string {
  if (locale === "en") {
    return action === "PRACTICE"
      ? "practice questions"
      : action === "REVIEW"
        ? "review"
        : "review mistake cards";
  }
  return action === "PRACTICE"
    ? "soru çöz"
    : action === "REVIEW"
      ? "tekrar et"
      : "yanlış kartlarını gözden geçir";
}

function slotsFor(minutes: number): number {
  return minutes <= 45 ? 1 : minutes <= 120 ? 2 : 3;
}

/** PLAN-only safe fill. The model selects among verified topics; the server owns load and titles. */
export function fillPersonalizedPlanBlocks(input: {
  rawChanges: readonly unknown[];
  dates: readonly string[];
  minutesPerDay: number;
  pendingByDate: Map<string, number>;
  titleCounts: Map<string, number>;
  focusSubjects: readonly string[];
  topics: readonly VerifiedPlanTopic[];
  grounding?: BlockGrounding;
  locale?: PromptLocale;
}): Array<Extract<CoachPlanAdaptationChangeDto, { kind: "ADD" }>> {
  const locale = input.locale ?? "tr";
  const subjects = [
    ...new Set(
      (input.focusSubjects.length
        ? input.focusSubjects
        : (input.grounding?.weakSubjects ?? [])
      )
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  const uncovered = [...subjects];
  const weak = new Set((input.grounding?.weakSubjects ?? []).map(key));
  const notebook = key(input.grounding?.notebookReason ?? "");
  const score = (subject: string) =>
    Number(weak.has(key(subject))) +
    2 *
      Number(
        input.topics.some(
          (topic) =>
            key(topic.subjectName) === key(subject) &&
            notebook.includes(key(topic.name)),
        ),
      );
  const prioritized = subjects
    .filter((subject) => score(subject) > 0)
    .sort((a, b) => score(b) - score(a));
  const extras = prioritized.length ? prioritized : subjects;
  let extraIndex = 0;
  const candidates = input.rawChanges.filter(
    (raw): raw is Record<string, unknown> =>
      typeof raw === "object" &&
      raw !== null &&
      (raw as { kind?: unknown }).kind === "ADD",
  );
  const used = new Set<number>();
  const topicUses = new Map<string, number>();
  const result: Array<Extract<CoachPlanAdaptationChangeDto, { kind: "ADD" }>> =
    [];

  for (const date of input.dates) {
    const existing = input.pendingByDate.get(date) ?? 0;
    if (existing >= 3) continue;
    const total =
      existing === 0
        ? input.minutesPerDay
        : Math.max(10, Math.min(60, Math.floor(input.minutesPerDay / 2)));
    if (total < 10) continue;
    const count = existing === 0 ? slotsFor(total) : 1;
    for (
      let slot = 0;
      slot < count && (input.pendingByDate.get(date) ?? 0) < 3;
      slot += 1
    ) {
      const minutes =
        Math.floor(total / count) + (slot < total % count ? 1 : 0);
      const preferred = uncovered.shift() ?? null;
      const available = candidates.findIndex(
        (raw, index) =>
          !used.has(index) &&
          raw.taskDate === date &&
          (preferred === null ||
            key(String(raw.subject ?? "")) === key(preferred)) &&
          (subjects.length === 0 ||
            subjects.some(
              (subject) => key(subject) === key(String(raw.subject ?? "")),
            )),
      );
      if (available >= 0) used.add(available);
      const raw = available >= 0 ? candidates[available]! : null;
      const subject = preferred ?? extras[extraIndex++ % extras.length] ?? null;
      const allowed = input.topics.filter(
        (topic) => subject && key(topic.subjectName) === key(subject),
      );
      const isNotebookTopic = (topic: VerifiedPlanTopic) =>
        notebook.includes(key(topic.name));
      const topicKey = (topic: VerifiedPlanTopic) =>
        `${key(topic.subjectName)}:${topic.slug}`;
      allowed.sort(
        (a, b) =>
          (topicUses.get(topicKey(a)) ?? 0) -
            (topicUses.get(topicKey(b)) ?? 0) ||
          Number(isNotebookTopic(b)) - Number(isNotebookTopic(a)),
      );
      const modelTopic =
        typeof raw?.topicSlug === "string"
          ? allowed.find(
              (topic) =>
                topic.slug === raw.topicSlug && !topicUses.has(topicKey(topic)),
            )
          : undefined;
      let chosen: Extract<
        CoachPlanAdaptationChangeDto,
        { kind: "ADD" }
      > | null = null;
      for (const topic of [modelTopic, ...allowed].filter(
        (item): item is VerifiedPlanTopic => Boolean(item),
      )) {
        const activity =
          ACTIONS.includes(raw?.activity as Action) &&
          (raw?.activity !== "NOTEBOOK" || isNotebookTopic(topic))
            ? (raw!.activity as Action)
            : isNotebookTopic(topic)
              ? "NOTEBOOK"
              : ACTIONS[slot % 2]!;
        for (const action of [activity, ...ACTIONS]) {
          const title =
            `${topic.name}: ${minutes} ${locale === "en" ? "min" : "dk"} ${actionText(action, locale)}`.slice(
              0,
              200,
            );
          const titleKey = `${date}:${key(title)}`;
          if (input.titleCounts.has(titleKey)) continue;
          const reason = isNotebookTopic(topic)
            ? input.grounding?.notebookReason
            : weak.has(key(subject ?? ""))
              ? input.grounding?.weakReason
              : input.grounding?.chosenReason;
          chosen = {
            kind: "ADD",
            title,
            subject,
            topic: topic.name,
            taskDate: date,
            ...(reason ? { reason } : {}),
          };
          input.titleCounts.set(titleKey, 1);
          topicUses.set(
            topicKey(topic),
            (topicUses.get(topicKey(topic)) ?? 0) + 1,
          );
          break;
        }
        if (chosen) break;
      }
      if (!chosen) {
        const label =
          subject ?? (locale === "en" ? "General review" : "Genel tekrar");
        for (const action of ACTIONS) {
          const title =
            `${label}: ${minutes} ${locale === "en" ? "min" : "dk"} ${actionText(action, locale)}`.slice(
              0,
              200,
            );
          const titleKey = `${date}:${key(title)}`;
          if (input.titleCounts.has(titleKey)) continue;
          const reason = weak.has(key(subject ?? ""))
            ? input.grounding?.weakReason
            : input.grounding?.chosenReason;
          chosen = {
            kind: "ADD",
            title,
            subject,
            topic: null,
            taskDate: date,
            ...(reason ? { reason } : {}),
          };
          input.titleCounts.set(titleKey, 1);
          break;
        }
      }
      if (!chosen) continue;
      result.push(chosen);
      input.pendingByDate.set(date, (input.pendingByDate.get(date) ?? 0) + 1);
    }
  }
  return result;
}
