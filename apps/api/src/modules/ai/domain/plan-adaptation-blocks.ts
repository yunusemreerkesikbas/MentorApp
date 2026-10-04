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

const ACTIONS = ["PRACTICE", "REVIEW", "RECALL", "NOTEBOOK"] as const;
type Action = (typeof ACTIONS)[number];

function key(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR");
}

function actionText(action: Action, locale: PromptLocale): string {
  if (locale === "en") {
    if (action === "RECALL") return "test yourself without notes";
    return action === "PRACTICE"
      ? "practice questions and review mistakes"
      : action === "REVIEW"
        ? "review"
        : "retry mistake cards";
  }
  if (action === "RECALL") return "notlarına bakmadan kendini test et";
  return action === "PRACTICE"
    ? "soru çöz ve yanlışlarını incele"
    : action === "REVIEW"
      ? "tekrar et"
      : "yanlış kartlarını yeniden çöz";
}

function slotsFor(minutes: number): number {
  return minutes <= 45 ? 1 : minutes <= 120 ? 2 : 3;
}

function blockTitle(
  label: string,
  action: Action,
  locale: PromptLocale,
): string {
  const suffix = `: ${actionText(action, locale)}`;
  return `${label.slice(0, 200 - suffix.length).trimEnd()}${suffix}`;
}

/** PLAN-only safe fill. The model selects among verified topics; the server owns load and titles. */
export function fillPersonalizedPlanBlocks(input: {
  rawChanges: readonly unknown[];
  dates: readonly string[];
  minutesPerDay: number;
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
  const subjectUses = new Map<string, number>();
  const candidates = input.rawChanges.filter(
    (raw): raw is Record<string, unknown> =>
      typeof raw === "object" &&
      raw !== null &&
      (raw as { kind?: unknown }).kind === "ADD",
  );
  const used = new Set<number>();
  const topicUses = new Map<string, number>();
  const topicDates = new Map<string, string>();
  const result: Array<Extract<CoachPlanAdaptationChangeDto, { kind: "ADD" }>> =
    [];

  for (const date of input.dates) {
    const total = input.minutesPerDay;
    if (total < 10) continue;
    const count = slotsFor(total);
    const daySubjects = new Set<string>();
    for (let slot = 0; slot < count; slot += 1) {
      const minutes =
        Math.floor(total / count) + (slot < total % count ? 1 : 0);
      const preferred = uncovered.shift() ?? null;
      const alternatives = subjects.filter(
        (name) => !daySubjects.has(key(name)),
      );
      // ponytail: weighted rotation uses subject-level evidence; topic mastery can refine weights later.
      const subject =
        preferred ??
        [...(alternatives.length ? alternatives : subjects)].sort(
          (a, b) =>
            (subjectUses.get(key(a)) ?? 0) / (1 + score(a)) -
              (subjectUses.get(key(b)) ?? 0) / (1 + score(b)) ||
            score(b) - score(a),
        )[0] ??
        null;
      const available = candidates.findIndex(
        (raw, index) =>
          !used.has(index) &&
          raw.taskDate === date &&
          (subject === null ||
            key(String(raw.subject ?? "")) === key(subject)) &&
          (subjects.length === 0 ||
            subjects.some(
              (subject) => key(subject) === key(String(raw.subject ?? "")),
            )),
      );
      if (available >= 0) used.add(available);
      const raw = available >= 0 ? candidates[available]! : null;
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
      const revisit =
        (subjectUses.get(key(subject ?? "")) ?? 0) % 2 === 1
          ? allowed.find(
              (topic) =>
                topicDates.has(topicKey(topic)) &&
                topicDates.get(topicKey(topic))! < date,
            )
          : undefined;
      let chosen: Extract<
        CoachPlanAdaptationChangeDto,
        { kind: "ADD" }
      > | null = null;
      for (const topic of [revisit, modelTopic, ...allowed].filter(
        (item): item is VerifiedPlanTopic => Boolean(item),
      )) {
        const activity =
          topic === revisit
            ? "RECALL"
            : ACTIONS.includes(raw?.activity as Action) &&
                (raw?.activity !== "NOTEBOOK" || isNotebookTopic(topic))
              ? (raw!.activity as Action)
              : isNotebookTopic(topic)
                ? "NOTEBOOK"
                : ACTIONS[slot % 3]!;
        for (const action of [activity, ...ACTIONS].filter(
          (action) => action !== "NOTEBOOK" || isNotebookTopic(topic),
        )) {
          const title = blockTitle(topic.name, action, locale);
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
            durationMinutes: minutes,
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
          topicDates.set(topicKey(topic), date);
          break;
        }
        if (chosen) break;
      }
      if (!chosen) {
        const label =
          subject ?? (locale === "en" ? "General review" : "Genel tekrar");
        for (const action of ACTIONS.filter(
          (action) => action !== "NOTEBOOK",
        )) {
          const title = blockTitle(label, action, locale);
          const titleKey = `${date}:${key(title)}`;
          if (input.titleCounts.has(titleKey)) continue;
          const reason = weak.has(key(subject ?? ""))
            ? input.grounding?.weakReason
            : input.grounding?.chosenReason;
          chosen = {
            kind: "ADD",
            title,
            durationMinutes: minutes,
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
      daySubjects.add(key(subject ?? ""));
      subjectUses.set(
        key(subject ?? ""),
        (subjectUses.get(key(subject ?? "")) ?? 0) + 1,
      );
    }
  }
  return result;
}
