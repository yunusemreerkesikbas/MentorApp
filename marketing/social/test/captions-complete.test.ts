import { expect, it } from "vitest";
import { CAPTIONS } from "../src/captions";
import { PIECES } from "../src/pieces";

it("has a short caption and alt text for every piece", () => {
  for (const p of PIECES) {
    const c = CAPTIONS[p.id];
    expect(c, p.id).toBeDefined();
    expect(c!.text.split("\n").filter(Boolean).length, p.id).toBeLessThanOrEqual(3);
    if (p.cards) expect(c!.alt, p.id).toHaveLength(p.cards);
    else expect(typeof c!.alt === "string" && c!.alt.length > 0, p.id).toBe(true);
  }
});
