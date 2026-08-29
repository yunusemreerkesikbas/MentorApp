export type QuestCopyArgs = Record<string, string | number>;

export type QuestCopyRef = {
  key: string;
  args: QuestCopyArgs;
};

const MILESTONE_PATTERNS: ReadonlyArray<{
  re: RegExp;
  key: string;
  arg: "days" | "count";
}> = [
  { re: /^milestone\.streak\.(\d+)$/, key: "milestone.streak", arg: "days" },
  { re: /^milestone\.focus_sessions\.(\d+)$/, key: "milestone.focus_sessions", arg: "count" },
  { re: /^milestone\.plan_tasks\.(\d+)$/, key: "milestone.plan_tasks", arg: "count" },
];

/**
 * Maps a stable quest id to the `economy.json` `quests.*` key plus interpolation args.
 * Milestone ids keep the threshold in the id (`milestone.streak.7`); weekly `{target}` is
 * config and is supplied at view time, not here.
 */
export function questCopyRef(questId: string): QuestCopyRef {
  for (const pattern of MILESTONE_PATTERNS) {
    const match = pattern.re.exec(questId);
    if (match) {
      return { key: pattern.key, args: { [pattern.arg]: Number(match[1]) } };
    }
  }
  return { key: questId, args: {} };
}

export type QuestCopyFn = (key: string, args?: Record<string, unknown>) => string;

function isMissingCopy(value: string, key: string): boolean {
  return value === key || value === `economy.${key}`;
}

/** Ledger rows outlive config: drop unresolved `{target}` / `{days}` / `{count}`. */
export function stripQuestPlaceholders(text: string): string {
  return text.replace(/\{(?:target|days|count)\}\s?/g, "").replace(/\s{2,}/g, " ").trim();
}

export function resolveQuestCardCopy(
  t: QuestCopyFn,
  questId: string,
  extraArgs: QuestCopyArgs = {},
): { title: string; badgeLabel: string } {
  const ref = questCopyRef(questId);
  const args = { ...ref.args, ...extraArgs };
  return {
    title: t(`quests.${ref.key}.title`, args),
    badgeLabel: t(`quests.${ref.key}.badge`, args),
  };
}

/**
 * Ledger quest line: explicit `ledgerTitle` when stripping `{target}` would break grammar;
 * otherwise the card title with unresolved placeholders stripped. `{days}`/`{count}` from
 * the id are interpolated. Returns undefined when the catalog has no copy for this id.
 */
export function resolveQuestLedgerDescription(t: QuestCopyFn, questId: string): string | undefined {
  const ref = questCopyRef(questId);
  const ledgerKey = `quests.${ref.key}.ledgerTitle`;
  const ledger = t(ledgerKey, ref.args);
  if (!isMissingCopy(ledger, ledgerKey)) return ledger;
  const titleKey = `quests.${ref.key}.title`;
  const title = t(titleKey, ref.args);
  if (isMissingCopy(title, titleKey)) return undefined;
  return stripQuestPlaceholders(title);
}
