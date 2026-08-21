import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_IDS,
} from "./achievement-definitions";

describe("achievement definitions", () => {
  it("locks the twelve V1 achievement ids without duplicates", () => {
    expect(ACHIEVEMENT_IDS).toEqual([
      "first_step",
      "route_drawn",
      "dream_space_created",
      "rhythm_found",
      "rhythm_kept",
      "returned_to_path",
      "route_renewed",
      "starting_point_set",
      "mistake_revisited",
      "week_reflected",
      "first_hello",
      "helped_someone",
    ]);
    expect(new Set(ACHIEVEMENT_IDS).size).toBe(12);
  });

  it("gives every V1 achievement a versioned image and translation contract", () => {
    expect(ACHIEVEMENT_DEFINITIONS).toHaveLength(12);
    for (const definition of ACHIEVEMENT_DEFINITIONS) {
      expect(definition.ruleVersion).toBe(1);
      expect(definition.artKey).toBe(definition.id);
      expect(definition.titleKey).toBe(`achievements.items.${definition.id}.title`);
      expect(definition.descriptionKey).toBe(
        `achievements.items.${definition.id}.description`,
      );
      expect(definition.unlockHintKey).toBe(
        `achievements.items.${definition.id}.unlockHint`,
      );
    }
  });

  it("exposes numeric progress only for the two rhythm milestones", () => {
    const targets = Object.fromEntries(
      ACHIEVEMENT_DEFINITIONS.map((definition) => [
        definition.id,
        definition.progressTarget,
      ]),
    );

    expect(targets.rhythm_found).toBe(7);
    expect(targets.rhythm_kept).toBe(30);
    expect(targets.returned_to_path).toBeNull();
  });
});
