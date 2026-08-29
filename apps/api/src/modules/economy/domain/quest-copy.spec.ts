import { describe, expect, it } from "vitest";
import tr from "../../../i18n/locales/tr/economy.json";
import en from "../../../i18n/locales/en/economy.json";
import { QUEST_CATALOG } from "./quest.catalog";
import {
  questCopyRef,
  resolveQuestCardCopy,
  resolveQuestLedgerDescription,
  stripQuestPlaceholders,
} from "./quest-copy";

function flatten(obj: unknown, prefix = ""): string[] {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return prefix ? [prefix] : [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    flatten(value, prefix ? `${prefix}.${key}` : key),
  );
}

function lookup(
  catalog: typeof tr,
  key: string,
  args: Record<string, unknown> = {},
): string {
  const parts = key.split(".");
  let current: unknown = catalog;
  for (const part of parts) {
    if (!current || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current !== "string") return key;
  return current.replace(/\{(\w+)\}/g, (_, name: string) => String(args[name] ?? `{${name}}`));
}

const tTr = (key: string, args?: Record<string, unknown>) => lookup(tr, key, args);
const tEn = (key: string, args?: Record<string, unknown>) => lookup(en, key, args);

describe("quest copy catalog", () => {
  it("keeps TR/EN quest keys at parity", () => {
    expect(flatten(tr.quests).toSorted()).toEqual(flatten(en.quests).toSorted());
  });

  it("maps every catalog id to a title and badge in both locales", () => {
    for (const quest of QUEST_CATALOG) {
      const trCopy = resolveQuestCardCopy(tTr, quest.id, { target: 5 });
      const enCopy = resolveQuestCardCopy(tEn, quest.id, { target: 5 });
      expect(trCopy.title, quest.id).not.toMatch(/^quests\./);
      expect(enCopy.title, quest.id).not.toMatch(/^quests\./);
      expect(trCopy.badgeLabel, quest.id).toBeTruthy();
      expect(enCopy.badgeLabel, quest.id).toBeTruthy();
      expect(trCopy.title).not.toContain("{target}");
      expect(enCopy.title).not.toContain("{target}");
      expect(trCopy.title).not.toContain("{days}");
      expect(trCopy.title).not.toContain("{count}");
    }
  });

  it("only weekly.effort-allowance has a ledgerTitle", () => {
    const keys = flatten(tr.quests).filter((key) => key.endsWith(".ledgerTitle"));
    expect(keys).toEqual(["weekly.effort-allowance.ledgerTitle"]);
  });

  it("maps milestone ids to a shared template plus days/count", () => {
    expect(questCopyRef("milestone.streak.7")).toEqual({
      key: "milestone.streak",
      args: { days: 7 },
    });
    expect(questCopyRef("milestone.focus_sessions.25")).toEqual({
      key: "milestone.focus_sessions",
      args: { count: 25 },
    });
    expect(questCopyRef("milestone.plan_tasks.100")).toEqual({
      key: "milestone.plan_tasks",
      args: { count: 100 },
    });
    expect(questCopyRef("daily.plan-task-done")).toEqual({
      key: "daily.plan-task-done",
      args: {},
    });
  });

  it("interpolates {target} on the card and strips it on the ledger line", () => {
    expect(resolveQuestCardCopy(tTr, "weekly.focus-sessions", { target: 5 }).title).toBe(
      "Bu hafta 5 odak seansı tamamla",
    );
    expect(resolveQuestLedgerDescription(tTr, "weekly.focus-sessions")).toBe(
      "Bu hafta odak seansı tamamla",
    );
    expect(resolveQuestLedgerDescription(tTr, "weekly.effort-allowance")).toBe(
      "Haftalık aktif gün hedefi",
    );
  });

  it("resolves English card copy without prize language", () => {
    expect(resolveQuestCardCopy(tEn, "daily.plan-task-done").title).toBe(
      "Complete 1 task from today's plan",
    );
    expect(resolveQuestCardCopy(tEn, "weekly.effort-allowance", { target: 5 }).title).toBe(
      "Be active 5 days this week",
    );
  });

  it("strips leftover placeholders without collapsing the sentence", () => {
    expect(stripQuestPlaceholders("Bu hafta {target} odak seansı tamamla")).toBe(
      "Bu hafta odak seansı tamamla",
    );
  });
});
