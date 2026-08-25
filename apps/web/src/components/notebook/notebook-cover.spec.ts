import { describe, expect, it } from "vitest";
import {
  NOTEBOOK_COVER_COLORS,
  NOTEBOOK_COVER_MATERIALS,
} from "@mentor/types";
import {
  COVER_COLORS,
  COVER_MATERIALS,
  DEFAULT_COVER,
} from "./notebook-surface";

/**
 * The covers are data, and the only way they break is by drifting apart.
 *
 * A colour or a finish added to the enum without a recipe here does not fail to compile — the enum
 * lives in `@mentor/types` and the recipes are a plain record — it just renders a cover with no
 * paint on it, in a picker that offers it as if it worked. That is the whole risk, so that is the
 * whole test.
 */
describe("cover recipes", () => {
  it("has a colour for every colour the picker offers", () => {
    for (const color of NOTEBOOK_COVER_COLORS) {
      expect(COVER_COLORS[color]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("has a finish for every material the picker offers", () => {
    for (const material of NOTEBOOK_COVER_MATERIALS) {
      expect(COVER_MATERIALS[material]).toContain("gradient");
    }
  });

  it("defaults to a combination that exists", () => {
    expect(NOTEBOOK_COVER_COLORS).toContain(DEFAULT_COVER.color);
    expect(NOTEBOOK_COVER_MATERIALS).toContain(DEFAULT_COVER.material);
  });
});
