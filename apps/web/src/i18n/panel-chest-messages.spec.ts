import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import tr from "../../messages/tr.json";
import en from "../../messages/en.json";

describe("daily quest chest messages", () => {
  for (const [locale, messages] of [["tr", tr], ["en", en]] as const) {
    it(`renders progress, ready state and dynamic Coin amount in ${locale}`, () => {
      const t = createTranslator({ locale, messages, namespace: "panel", onError: (error) => { throw error; } });
      expect(t("quests_chest", { current: 2, target: 5 })).toContain("2/5");
      expect(t("quests_chest_open")).not.toContain("panel.");
      expect(t("quests_chest_reward", { reward: 17 })).toContain("17 Coin");
    });
  }
});
